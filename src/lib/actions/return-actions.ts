'use server';

import { requireAdmin, logActivity } from './admin-helpers';
import { applyBagReturnToLedger } from './ledger-actions';
import { safeAction } from './action-result';

export async function fetchOrderReturns() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from('order_returns')
    .select(
      '*, order:orders(po_number, dr_number, client:profiles!orders_client_id_fkey(full_name, company_name))',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return data ?? [];
}

// Internal implementation unchanged — safeAction() wraps the export below.
async function _approveOrderReturn(returnId: string, returnReason: 'return' | 'waste' | 'damage') {
  const { supabase, userId } = await requireAdmin();

  const { data: ret } = await supabase
    .from('order_returns')
    .select('id, order_id, jb_qty, sb_qty, status')
    .eq('id', returnId)
    .single();
  if (!ret) throw new Error('Return request not found.');
  if (ret.status !== 'pending') throw new Error('This return request has already been resolved.');

  const { data: order } = await supabase
    .from('orders')
    .select('shipment_id, po_number, dr_number, client_id, bags_returned_jb, bags_returned_sb')
    .eq('id', ret.order_id)
    .single();
  if (!order?.shipment_id) throw new Error('Associated order or shipment not found.');

  const ledgerResult = await applyBagReturnToLedger(supabase, {
    shipmentId: order.shipment_id,
    poNumber: order.po_number,
    drNumber: order.dr_number,
    clientId: order.client_id,
    jbReturned: ret.jb_qty,
    sbReturned: ret.sb_qty,
    returnReason,
  });
  // applyBagReturnToLedger no longer throws (it's wrapped in safeAction) —
  // re-throw here so a failed ledger write fails the WHOLE approval, rather
  // than leaving the request stuck half-approved with no profit adjustment.
  if (!ledgerResult.success) throw new Error(ledgerResult.error);

  const { error: orderError } = await supabase
    .from('orders')
    .update({
      bags_returned_jb: (order.bags_returned_jb ?? 0) + ret.jb_qty,
      bags_returned_sb: (order.bags_returned_sb ?? 0) + ret.sb_qty,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ret.order_id);
  if (orderError) throw new Error(`Failed to update order return totals: ${orderError.message}`);

  const { error } = await supabase
    .from('order_returns')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', returnId);
  if (error) throw new Error(error.message);

  await logActivity(supabase, userId, 'return_approved', 'order_returns', returnId, {
    returnReason,
  });
  return { success: true };
}

export const approveOrderReturn = safeAction(_approveOrderReturn);

// Internal implementation unchanged — safeAction() wraps the export below.
async function _rejectOrderReturn(returnId: string, note?: string) {
  const { supabase, userId } = await requireAdmin();

  const { data: ret } = await supabase
    .from('order_returns')
    .select('id, status')
    .eq('id', returnId)
    .single();
  if (!ret) throw new Error('Return request not found.');
  if (ret.status !== 'pending') throw new Error('This return request has already been resolved.');

  const { error } = await supabase
    .from('order_returns')
    .update({
      status: 'rejected',
      admin_note: note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', returnId);
  if (error) throw new Error(error.message);

  await logActivity(supabase, userId, 'return_rejected', 'order_returns', returnId, { note });
  return { success: true };
}

export const rejectOrderReturn = safeAction(_rejectOrderReturn);
