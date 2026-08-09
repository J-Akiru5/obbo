'use server';

import { requireAdmin, logActivity } from './admin-helpers';
import { customerBalanceUpdateSchema } from './schemas';
import { safeAction } from './action-result';

export async function fetchCustomerBalances() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from('customer_balances')
    .select(
      '*, client:profiles!customer_balances_client_id_fkey(full_name, company_name), product:products!customer_balances_product_id_fkey(name), order:orders(po_number)',
    )
    .eq('status', 'pending');
  return data ?? [];
}

// Internal implementation unchanged — safeAction() wraps the export below.
async function _updateCustomerBalance(id: string, remaining_qty: number, status: string) {
  const parsed = customerBalanceUpdateSchema.safeParse({ remaining_qty, status });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase
    .from('customer_balances')
    .update({ remaining_qty, status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'balance_updated', 'customer_balances', id, {
    remaining_qty,
    status,
  });
  return { success: true };
}

export const updateCustomerBalance = safeAction(_updateCustomerBalance);
