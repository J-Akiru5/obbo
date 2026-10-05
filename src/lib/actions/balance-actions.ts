'use server';

import { requireAdmin, logActivity } from './admin-helpers';
import { individualBagsFromUnits } from './profit-utils';
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

export interface RedeliveryBalanceDeduction {
  productId: string;
  bagType: string;
  // JB/SB UNITS just dispatched (order_items denomination) — converted to
  // individual bags internally, matching customer_balances.remaining_qty.
  dispatchedUnits: number;
}

/**
 * Clears (or decrements) the pending customer_balance rows that a redelivery
 * dispatch just fulfilled, then marks fully-delivered rows 'fulfilled' so they
 * disappear from the Customer Obligation Report and the Client Portal Balance
 * Ledger.
 *
 * IMPORTANT: resolves the ORIGINAL order by PO number while explicitly
 * excluding 'redelivery' orders. The original PO and every redelivery order
 * created against it share the same po_number, so an unfiltered
 * `.maybeSingle()` lookup fails with PostgREST's multiple-rows error and the
 * balance update silently never runs — the root cause of fulfilled
 * obligations persisting after re-delivery.
 */
export async function applyRedeliveryToCustomerBalances(params: {
  linkedPoNumber: string;
  items: RedeliveryBalanceDeduction[];
  // The order being dispatched right now; excluded from the original-order
  // lookup so a redelivery order can never be mistaken for its own original.
  excludeOrderId?: string;
}): Promise<{ updated: number }> {
  const { linkedPoNumber, items, excludeOrderId } = params;
  if (!linkedPoNumber || items.length === 0) return { updated: 0 };

  const { supabase } = await requireAdmin();

  let originalQuery = supabase
    .from('orders')
    .select('id')
    .eq('po_number', linkedPoNumber)
    .neq('order_type', 'redelivery');
  if (excludeOrderId) originalQuery = originalQuery.neq('id', excludeOrderId);
  const { data: originalOrder, error: originalError } = await originalQuery
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (originalError || !originalOrder) {
    console.error('Redelivery balance clearing: original order not found', originalError?.message);
    return { updated: 0 };
  }

  let updated = 0;
  for (const item of items) {
    if (item.dispatchedUnits <= 0) continue;
    const dispatchedBags = individualBagsFromUnits(
      item.bagType as 'JB' | 'SB',
      item.dispatchedUnits,
    );

    const { data: balance } = await supabase
      .from('customer_balances')
      .select('id, remaining_qty, status')
      .eq('order_id', originalOrder.id)
      .eq('product_id', item.productId)
      .eq('bag_type', item.bagType)
      .eq('status', 'pending')
      .maybeSingle();

    if (!balance || balance.remaining_qty <= 0) continue;

    const newRemaining = Math.max(0, balance.remaining_qty - dispatchedBags);
    const { error: balanceUpdateError } = await supabase
      .from('customer_balances')
      .update({
        remaining_qty: newRemaining,
        status: newRemaining <= 0 ? 'fulfilled' : 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', balance.id);
    if (balanceUpdateError) {
      console.error('Balance deduction on redelivery dispatch failed:', balanceUpdateError);
      continue;
    }
    updated += 1;
  }

  return { updated };
}
