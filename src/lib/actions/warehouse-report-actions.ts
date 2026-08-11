'use server';

import { requireAdmin, logActivity } from './admin-helpers';
import { warehouseReportSaveSchema, dispatchReportDateSchema } from './schemas';
import { createRoleNotification } from './notification-actions';
import type { WarehouseReport } from '@/lib/types/database';
import { safeAction } from './action-result';
import type { DispatchRow } from '@/lib/report-generators/types';

// One row per delivery_receipts row for the given date — the source of truth
// for "what was dispatched that day". Never reads orders.dr_number (overwritten
// on every dispatch) or orders.updated_at, so historical dates stay correct
// even after later DRs are created against the same order.
export async function fetchDispatchesForDate(date: string): Promise<DispatchRow[]> {
  const parsed = dispatchReportDateSchema.safeParse({ date });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  const { supabase } = await requireAdmin();

  const { data: drs } = await supabase
    .from('delivery_receipts')
    .select('*, order:orders(service_type)')
    .eq('received_date', parsed.data.date)
    .order('created_at', { ascending: true });

  // DRs not linked to an order (manual walk-in POs) have no
  // delivery_receipts→purchase_orders FK to join on — resolve their
  // service_type with a batched po_number lookup instead.
  const orphanPoNumbers = [
    ...new Set(
      (drs || []).filter((dr) => !dr.order && dr.po_number).map((dr) => dr.po_number as string),
    ),
  ];
  const poServiceTypes = new Map<string, string>();
  if (orphanPoNumbers.length > 0) {
    const { data: pos } = await supabase
      .from('purchase_orders')
      .select('po_number, service_type')
      .in('po_number', orphanPoNumbers);
    for (const po of pos || []) {
      if (po.service_type) poServiceTypes.set(po.po_number, po.service_type);
    }
  }

  return (drs || []).map((dr) => ({
    client: dr.client_name || 'Walk-in',
    dr: dr.dr_number,
    service: dr.order?.service_type || poServiceTypes.get(dr.po_number) || 'pickup',
    jb: dr.jb || 0,
    sb: dr.sb || 0,
  }));
}

export async function generateDailyReportData(date: string) {
  const { supabase } = await requireAdmin();

  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];

  const { data: yesterdayReport } = await supabase
    .from('warehouse_reports')
    .select('closing_jb, closing_sb')
    .eq('report_date', prevDateStr)
    .maybeSingle();
  const yesterday_jb = yesterdayReport?.closing_jb || 0;
  const yesterday_sb = yesterdayReport?.closing_sb || 0;

  const { data: shipments } = await supabase
    .from('shipments')
    .select('total_jb, total_sb, damaged_jb, damaged_sb')
    .eq('arrival_date', date);
  const received_jb = shipments?.reduce((sum, s) => sum + (s.total_jb || 0), 0) || 0;
  const received_sb = shipments?.reduce((sum, s) => sum + (s.total_sb || 0), 0) || 0;
  const shipmentDamagedJb = shipments?.reduce((sum, s) => sum + (s.damaged_jb || 0), 0) || 0;
  const shipmentDamagedSb = shipments?.reduce((sum, s) => sum + (s.damaged_sb || 0), 0) || 0;

  const { data: ledger } = await supabase.from('shipment_ledger').select('*').eq('date', date);
  const dispatched_jb = ledger?.reduce((sum, l) => sum + (l.jb || 0), 0) || 0;
  const dispatched_sb = ledger?.reduce((sum, l) => sum + (l.sb || 0), 0) || 0;

  let returned_jb = 0;
  let returned_sb = 0;
  let waste_jb = 0;
  let waste_sb = 0;
  ledger?.forEach((l) => {
    const isWaste = l.return_reason === 'waste' || l.return_reason === 'damage';
    if (l.bags_returned && l.bag_returned_type === 'JB') {
      if (isWaste) waste_jb += l.bags_returned;
      else returned_jb += l.bags_returned;
    }
    if (l.bags_returned && l.bag_returned_type === 'SB') {
      if (isWaste) waste_sb += l.bags_returned;
      else returned_sb += l.bags_returned;
    }
  });

  waste_jb += shipmentDamagedJb;
  waste_sb += shipmentDamagedSb;

  const dispatches = await fetchDispatchesForDate(date);

  const { data: customerBalances } = await supabase
    .from('customer_balances')
    .select(
      '*, client:profiles!customer_balances_client_id_fkey(full_name, company_name), product:products!customer_balances_product_id_fkey(name), order:orders(po_number)',
    )
    .eq('status', 'pending');

  const balances = (customerBalances || []).map((b) => ({
    client: b.client?.company_name || b.client?.full_name,
    product: b.product?.name,
    qty: b.remaining_qty,
    bag_type: b.bag_type,
  }));

  return {
    yesterday_jb,
    yesterday_sb,
    received_jb,
    received_sb,
    dispatched_jb,
    dispatched_sb,
    returned_jb,
    returned_sb,
    waste_jb,
    waste_sb,
    dispatches,
    balances,
  };
}

export async function fetchWarehouseReport(date: string) {
  const { supabase, role } = await requireAdmin();
  const { data } = await supabase
    .from('warehouse_reports')
    .select('*')
    .eq('report_date', date)
    .maybeSingle();
  if (!data) return null;

  const today = new Date().toISOString().split('T')[0];
  if (role === 'admin' && date === today && !data.submitted) {
    return null;
  }
  return data as unknown as WarehouseReport;
}

export async function fetchWarehouseReports(limit: number = 30) {
  const { supabase, role } = await requireAdmin();
  const today = new Date().toISOString().split('T')[0];
  let query = supabase
    .from('warehouse_reports')
    .select('*')
    .order('report_date', { ascending: false })
    .limit(limit);
  if (role === 'admin') {
    query = query.or(`report_date.lt.${today},and(report_date.eq.${today},submitted.eq.true)`);
  }
  const { data } = await query;
  return (data ?? []) as unknown as WarehouseReport[];
}

export async function checkReportSubmission(date: string) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from('warehouse_reports')
    .select('submitted')
    .eq('report_date', date)
    .maybeSingle();
  return data?.submitted ?? false;
}

// Internal implementation unchanged — safeAction() wraps the export below.
async function _saveWarehouseReport(report: {
  report_date: string;
  yesterday_jb: number;
  yesterday_sb: number;
  received_jb: number;
  received_sb: number;
  dispatched_jb: number;
  dispatched_sb: number;
  returned_jb: number;
  returned_sb: number;
  waste_jb: number;
  waste_sb: number;
  closing_jb: number;
  closing_sb: number;
  notes?: string;
}) {
  const clamped = {
    ...report,
    closing_jb: Math.max(0, report.closing_jb),
    closing_sb: Math.max(0, report.closing_sb),
  };
  const parsed = warehouseReportSaveSchema.safeParse(clamped);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  const { supabase, userId } = await requireAdmin();
  const { data, error } = await supabase
    .from('warehouse_reports')
    .upsert({ ...clamped, updated_at: new Date().toISOString() }, { onConflict: 'report_date' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'warehouse_report_saved', 'warehouse_report', data.id, {
    date: report.report_date,
  });
  return data;
}

export const saveWarehouseReport = safeAction(_saveWarehouseReport);

// Internal implementation unchanged — safeAction() wraps the export below.
async function _submitWarehouseReport(date: string) {
  const { supabase, userId } = await requireAdmin();

  const { data: report, error: fetchError } = await supabase
    .from('warehouse_reports')
    .select('id')
    .eq('report_date', date)
    .single();

  if (fetchError || !report) throw new Error('Please save the report before submitting.');

  const { error: submitError } = await supabase
    .from('warehouse_reports')
    .update({ submitted: true })
    .eq('id', report.id);
  if (submitError) throw new Error(`Failed to submit report: ${submitError.message}`);
  await logActivity(supabase, userId, 'warehouse_report_submitted', 'warehouse_report', report.id, {
    date,
  });

  await createRoleNotification({
    targetRole: 'admin',
    title: 'Daily Report Submitted',
    message: `Warehouse report for ${date} has been submitted for review.`,
    href: '/admin/inventory?tab=reports',
    severity: 'info',
  });

  return { success: true };
}

export const submitWarehouseReport = safeAction(_submitWarehouseReport);

// Internal implementation unchanged — safeAction() wraps the export below.
async function _autoSubmitEndOfDayReports() {
  const { supabase, userId, role } = await requireAdmin();
  if (role !== 'warehouse_manager' && role !== 'admin') throw new Error('Forbidden');

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const autoSubmitted: string[] = [];

  const { data: pastReports } = await supabase
    .from('warehouse_reports')
    .select('*')
    .lt('report_date', today)
    .eq('submitted', false);

  for (const report of pastReports ?? []) {
    const { error: autoSubmitError } = await supabase
      .from('warehouse_reports')
      .update({ submitted: true })
      .eq('id', report.id);
    if (autoSubmitError) {
      console.error(`Auto-submit failed for ${report.report_date}:`, autoSubmitError);
      continue;
    }
    await logActivity(
      supabase,
      userId,
      'warehouse_report_auto_submitted',
      'warehouse_report',
      report.id,
      { date: report.report_date },
    );
    autoSubmitted.push(report.report_date);
  }

  const { data: yesterdayReport } = await supabase
    .from('warehouse_reports')
    .select('id')
    .eq('report_date', yesterday)
    .maybeSingle();

  if (!yesterdayReport) {
    try {
      const generated = await generateDailyReportData(yesterday);
      const closing_jb = Math.max(
        0,
        generated.yesterday_jb +
          generated.received_jb -
          generated.dispatched_jb +
          generated.returned_jb -
          generated.waste_jb,
      );
      const closing_sb = Math.max(
        0,
        generated.yesterday_sb +
          generated.received_sb -
          generated.dispatched_sb +
          generated.returned_sb -
          generated.waste_sb,
      );
      const { data: newReport, error: upsertError } = await supabase
        .from('warehouse_reports')
        .upsert({
          report_date: yesterday,
          yesterday_jb: generated.yesterday_jb,
          yesterday_sb: generated.yesterday_sb,
          received_jb: generated.received_jb,
          received_sb: generated.received_sb,
          dispatched_jb: generated.dispatched_jb,
          dispatched_sb: generated.dispatched_sb,
          returned_jb: generated.returned_jb,
          returned_sb: generated.returned_sb,
          waste_jb: generated.waste_jb,
          waste_sb: generated.waste_sb,
          closing_jb,
          closing_sb,
          submitted: true,
        })
        .select()
        .single();
      if (upsertError) {
        console.error('Auto-generate upsert failed for', yesterday, upsertError);
      } else if (newReport) {
        await logActivity(
          supabase,
          userId,
          'warehouse_report_auto_submitted',
          'warehouse_report',
          newReport.id,
          { date: yesterday },
        );
        autoSubmitted.push(yesterday);
      }
    } catch (e) {
      console.error('Auto-generate failed for', yesterday, e);
    }
  }

  return { autoSubmitted };
}

export const autoSubmitEndOfDayReports = safeAction(_autoSubmitEndOfDayReports);
