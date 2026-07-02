'use server';

import { requireAdmin, logActivity } from './admin-helpers';
import { createRoleNotification } from './notification-actions';
import type { WarehouseReport } from '@/lib/types/database';

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

  const { data: orders } = await supabase
    .from('orders')
    .select(
      '*, client:profiles!orders_client_id_fkey(full_name, company_name), items:order_items(*)',
    )
    .in('status', ['dispatched', 'completed'])
    .gte('updated_at', `${date}T00:00:00.000Z`)
    .lt('updated_at', `${date}T23:59:59.999Z`);

  const dispatches = (orders || []).map((o) => {
    const items = o.items as Array<{ bag_type: string; dispatched_qty: number }> | undefined;
    const jb =
      items?.filter((i) => i.bag_type === 'JB').reduce((s, i) => s + i.dispatched_qty, 0) || 0;
    const sb =
      items?.filter((i) => i.bag_type === 'SB').reduce((s, i) => s + i.dispatched_qty, 0) || 0;
    return {
      client: o.client?.company_name || o.client?.full_name,
      dr: o.dr_number,
      service: o.service_type,
      jb,
      sb,
    };
  });

  const drNumbersInOrders = new Set(orders?.map((o) => o.dr_number).filter(Boolean) || []);
  const { data: drs } = await supabase
    .from('delivery_receipts')
    .select('*')
    .eq('received_date', date);
  for (const dr of drs || []) {
    if (!dr.dr_number || drNumbersInOrders.has(dr.dr_number)) continue;
    dispatches.push({
      client: dr.client_name || 'Walk-in',
      dr: dr.dr_number,
      service: dr.jb > 0 ? 'JB' : 'SB',
      jb: dr.jb || 0,
      sb: dr.sb || 0,
    });
  }

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

export async function saveWarehouseReport(report: {
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
  const { supabase, userId } = await requireAdmin();
  const { data, error } = await supabase
    .from('warehouse_reports')
    .upsert({ ...report, updated_at: new Date().toISOString() }, { onConflict: 'report_date' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'warehouse_report_saved', 'warehouse_report', data.id, {
    date: report.report_date,
  });
  return data;
}

export async function submitWarehouseReport(date: string) {
  const { supabase, userId } = await requireAdmin();

  const { data: report, error: fetchError } = await supabase
    .from('warehouse_reports')
    .select('id')
    .eq('report_date', date)
    .single();

  if (fetchError || !report) throw new Error('Please save the report before submitting.');

  await supabase.from('warehouse_reports').update({ submitted: true }).eq('id', report.id);
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

export async function autoSubmitEndOfDayReports() {
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
    await supabase.from('warehouse_reports').update({ submitted: true }).eq('id', report.id);
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
      const closing_jb =
        generated.yesterday_jb +
        generated.received_jb -
        generated.dispatched_jb +
        generated.returned_jb -
        generated.waste_jb;
      const closing_sb =
        generated.yesterday_sb +
        generated.received_sb -
        generated.dispatched_sb +
        generated.returned_sb -
        generated.waste_sb;
      const { data: newReport } = await supabase
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
      if (newReport) {
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
