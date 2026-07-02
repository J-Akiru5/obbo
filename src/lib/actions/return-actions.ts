'use server';

import { requireAdmin, logActivity } from './admin-helpers';

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

export async function processOrderReturn(returnId: string) {
  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase
    .from('order_returns')
    .update({ status: 'processed', updated_at: new Date().toISOString() })
    .eq('id', returnId);
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'return_processed', 'order_returns', returnId, {});
  return { success: true };
}
