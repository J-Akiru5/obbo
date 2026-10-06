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

export interface RedeliveryBalanceResult {
  updated: number;
  failed: number;
  errors: string[];
}

/**
 * Clears (or decrements) the pending customer_balance rows that a redelivery
 * dispatch just fulfilled, then marks fully-delivered rows 'fulfilled'
 * (remaining_qty = 0) so they disappear from the Customer Obligation Report
 * and the Client Portal Balance Ledger.
 *
 * IMPORTANT invariants:
 *   - Resolves the ORIGINAL order by PO number while explicitly excluding
 *     'redelivery' orders. The original PO and every redelivery order created
 *     against it share the same po_number, so an unfiltered lookup can return
 *     multiple rows and silently skip the whole balance update.
 *   - Uses list queries with `.limit(1)` instead of `.maybeSingle()`: PostgREST
 *     errors a maybeSingle() request when more than one row matches, which is
 *     exactly the failure mode that made obligations persist.
 *   - Writes `remaining_qty = 0` + `status = 'fulfilled'`. This requires the
 *     updated_at column and the relaxed `remaining_qty >= 0` check from
 *     migration 20261006_customer_balances_fulfilled_state.sql. Without that
 *     migration the PATCH is rejected and reported in `failed`/`errors`.
 */
export async function applyRedeliveryToCustomerBalances(params: {
  linkedPoNumber: string;
  items: RedeliveryBalanceDeduction[];
  // The order being dispatched right now; excluded from the original-order
  // lookup so a redelivery order can never be mistaken for its own original.
  excludeOrderId?: string;
}): Promise<RedeliveryBalanceResult> {
  const { linkedPoNumber, items, excludeOrderId } = params;
  const result: RedeliveryBalanceResult = { updated: 0, failed: 0, errors: [] };
  if (!linkedPoNumber || items.length === 0) return result;

  const { supabase } = await requireAdmin();

  let originalQuery = supabase
    .from('orders')
    .select('id')
    .eq('po_number', linkedPoNumber)
    .neq('order_type', 'redelivery');
  if (excludeOrderId) originalQuery = originalQuery.neq('id', excludeOrderId);
  const { data: originalOrders, error: originalError } = await originalQuery
    .order('created_at', { ascending: true })
    .limit(1);
  const originalOrder = originalOrders?.[0];
  if (originalError || !originalOrder) {
    result.failed += 1;
    result.errors.push(
      `original order not found for PO ${linkedPoNumber}: ${originalError?.message ?? 'no rows'}`,
    );
    console.error('Redelivery balance clearing: original order not found', result.errors[0]);
    return result;
  }

  for (const item of items) {
    if (item.dispatchedUnits <= 0) continue;
    const dispatchedBags = individualBagsFromUnits(
      item.bagType as 'JB' | 'SB',
      item.dispatchedUnits,
    );

    const { data: balances, error: balanceError } = await supabase
      .from('customer_balances')
      .select('id, remaining_qty, status')
      .eq('order_id', originalOrder.id)
      .eq('product_id', item.productId)
      .eq('bag_type', item.bagType)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);
    if (balanceError) {
      result.failed += 1;
      result.errors.push(`balance lookup failed: ${balanceError.message}`);
      console.error('Redelivery balance lookup failed:', balanceError);
      continue;
    }

    const balance = balances?.[0];
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
      result.failed += 1;
      result.errors.push(`balance update failed: ${balanceUpdateError.message}`);
      console.error('Balance deduction on redelivery dispatch failed:', balanceUpdateError);
      continue;
    }
    result.updated += 1;
  }

  return result;
}
