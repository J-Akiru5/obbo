'use server';

import { requireAdmin, logActivity, getCostConfig } from './admin-helpers';
import {
  computeDispatchProfit,
  computeReturnProfitDelta,
  BAG_EQUIVALENT,
  type DispatchProfitFields,
} from './profit-utils';
import { ledgerEntryCreateSchema, ledgerEntryUpdateSchema } from './schemas';
import { safeAction } from './action-result';
import { createClient } from '@/lib/supabase/server';

// Internal implementation unchanged — safeAction() wraps the export below.
async function _addLedgerEntry(
  shipmentId: string,
  entry: {
    date?: string;
    po_number?: string;
    dr_number?: string;
    client_name?: string;
    driver_name?: string;
    plate_number?: string;
    destination?: string;
    service_type?: string;
    jb?: number;
    sb?: number;
    payment_method?: string;
    check_number?: string;
    amount?: number;
    bags_returned?: number;
    bag_returned_type?: string;
    return_reason?: string;
    client_reason?: string;
    notes?: string;
    delivery_receipt_id?: string | null;
  },
) {
  const parsed = ledgerEntryCreateSchema.safeParse(entry);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  const { supabase, userId } = await requireAdmin();
  const jbOut = entry.jb ?? 0;
  const sbOut = entry.sb ?? 0;
  const returned = entry.bags_returned ?? 0;
  const returnedType = entry.bag_returned_type ?? null;
  const returnReason = entry.return_reason ?? 'return';

  const isDispatch = !entry.bags_returned || entry.bags_returned === 0;
  let profitFields: Partial<DispatchProfitFields> = {};
  if (isDispatch && (jbOut > 0 || sbOut > 0)) {
    const costConfig = await getCostConfig();
    profitFields = computeDispatchProfit({
      totalBags: jbOut * 25 + sbOut * 50,
      totalSales: entry.amount ?? 0,
      landedCostPerBag: costConfig.landed_cost_per_bag,
      localExpensesPerBag: costConfig.local_expenses_per_bag,
    });
  } else if (!isDispatch && returned > 0) {
    // A return/waste/damage event reverses a slice of an ORIGINAL sale.
    // Look that original dispatch row up (same shipment + DR number, the
    // earliest row with jb/sb > 0) and use ITS stored rates — never live
    // cost config — so this reversal can't drift from what was actually
    // charged, even if cost config has changed since.
    const { data: originalDispatch } = await supabase
      .from('shipment_ledger')
      .select('selling_price_per_bag, landed_cost_per_bag, local_expenses_per_bag')
      .eq('shipment_id', shipmentId)
      .eq('dr_number', entry.dr_number ?? '')
      .or('jb.gt.0,sb.gt.0')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!originalDispatch) {
      throw new Error(
        `Cannot calculate return profit: no original dispatch matches DR ${entry.dr_number ?? '(missing)'}.`,
      );
    }
    profitFields = computeReturnProfitDelta({
      returnedBags: returned,
      sellingPricePerBag: Number(originalDispatch.selling_price_per_bag) || 0,
      landedCostPerBag: Number(originalDispatch.landed_cost_per_bag) || 0,
      localExpensesPerBag: Number(originalDispatch.local_expenses_per_bag) || 0,
      isRestockable: returnReason === 'return',
    });
  }

  const { data, error } = await supabase
    .from('shipment_ledger')
    .insert({
      shipment_id: shipmentId,
      ...entry,
      ...profitFields,
      date: entry.date ?? new Date().toISOString().split('T')[0],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const { data: shipment } = await supabase
    .from('shipments')
    .select('remaining_jb, remaining_sb, good_stock')
    .eq('id', shipmentId)
    .single();
  if (shipment) {
    const restockReturned = returnReason === 'return' && returned > 0;
    // `returned` (bags_returned) is an INDIVIDUAL BAG count — same
    // denomination computeReturnProfitDelta above already uses it as — but
    // shipments.remaining_jb/remaining_sb are JB/SB UNIT-denominated. Convert
    // before crediting stock, rounding DOWN: credit only whole units
    // confirmed physically returned, never more than actually came back.
    // Any bag-count remainder below a full unit is a disclosed rounding
    // loss, not phantom stock. See denomination-mismatch bug writeup.
    const jbReturnedBags = restockReturned && returnedType === 'JB' ? returned : 0;
    const sbReturnedBags = restockReturned && returnedType === 'SB' ? returned : 0;
    const jbReturned = Math.floor(jbReturnedBags / BAG_EQUIVALENT.JB);
    const sbReturned = Math.floor(sbReturnedBags / BAG_EQUIVALENT.SB);
    const newRemainingJb = Math.max(0, (shipment.remaining_jb ?? 0) - jbOut + jbReturned);
    const newRemainingSb = Math.max(0, (shipment.remaining_sb ?? 0) - sbOut + sbReturned);
    const { error: stockError } = await supabase
      .from('shipments')
      .update({
        remaining_jb: newRemainingJb,
        remaining_sb: newRemainingSb,
        good_stock: newRemainingJb + newRemainingSb,
      })
      .eq('id', shipmentId);
    if (stockError) {
      console.error('Failed to update shipment stock after ledger entry:', stockError);
    }
  }

  await logActivity(supabase, userId, 'ledger_entry_added', 'shipment_ledger', data.id, entry);
  return data;
}

export const addLedgerEntry = safeAction(_addLedgerEntry);

// Internal implementation unchanged — safeAction() wraps the export below.
async function _updateLedgerEntry(
  id: string,
  shipmentId: string,
  oldEntry: {
    jb: number;
    sb: number;
    bags_returned: number;
    bag_returned_type: string | null;
    return_reason: string | null;
  },
  updates: Partial<{
    date: string;
    po_number: string;
    dr_number: string;
    client_name: string;
    driver_name: string;
    plate_number: string;
    destination: string;
    service_type: string;
    jb: number;
    sb: number;
    payment_method: string;
    check_number: string;
    amount: number;
    bags_returned: number;
    bag_returned_type: string;
    return_reason: string;
    notes: string;
  }>,
) {
  const parsed = ledgerEntryUpdateSchema.safeParse(updates);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  const { supabase, userId } = await requireAdmin();

  // T-1 fix: whenever jb/sb/amount/bags_returned/return_reason change, the
  // stored total_sales/gross_profit/net_profit/selling_price_per_bag go
  // stale unless we recompute them here. We always recompute from THIS
  // row's own stored landed_cost_per_bag/local_expenses_per_bag (or, for a
  // return row, the original dispatch row's stored rates) — never live
  // cost config — so historical immutability holds even through an edit.
  const recomputeTrigger =
    updates.jb !== undefined ||
    updates.sb !== undefined ||
    updates.amount !== undefined ||
    updates.bags_returned !== undefined ||
    updates.return_reason !== undefined ||
    updates.dr_number !== undefined;

  let profitUpdates: Partial<DispatchProfitFields> = {};
  if (recomputeTrigger) {
    const { data: currentRow } = await supabase
      .from('shipment_ledger')
      .select(
        'jb, sb, amount, bags_returned, return_reason, dr_number, landed_cost_per_bag, local_expenses_per_bag',
      )
      .eq('id', id)
      .single();

    if (currentRow) {
      const newJb = updates.jb ?? currentRow.jb ?? 0;
      const newSb = updates.sb ?? currentRow.sb ?? 0;
      const newAmount = updates.amount ?? Number(currentRow.amount) ?? 0;
      const newBagsReturned = updates.bags_returned ?? currentRow.bags_returned ?? 0;
      const newReturnReason = updates.return_reason ?? currentRow.return_reason ?? 'return';
      const landedCostPerBag = Number(currentRow.landed_cost_per_bag) || 0;
      const localExpensesPerBag = Number(currentRow.local_expenses_per_bag) || 0;

      if (!newBagsReturned || newBagsReturned === 0) {
        // Still a dispatch row after the edit — reuse THIS row's own
        // historic rates, not a fresh getCostConfig() call.
        profitUpdates = computeDispatchProfit({
          totalBags: newJb * 25 + newSb * 50,
          totalSales: newAmount,
          landedCostPerBag,
          localExpensesPerBag,
        });
      } else {
        // This row is (or is becoming) a return/waste/damage row — its
        // profit fields are a delta against the ORIGINAL dispatch row, so
        // look that up again rather than reusing this row's own rates
        // (which, for an existing return row, are already the original's).
        const drNumberForLookup = updates.dr_number ?? currentRow.dr_number ?? '';
        const { data: originalDispatch } = await supabase
          .from('shipment_ledger')
          .select('selling_price_per_bag, landed_cost_per_bag, local_expenses_per_bag')
          .eq('shipment_id', shipmentId)
          .eq('dr_number', drNumberForLookup)
          .or('jb.gt.0,sb.gt.0')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!originalDispatch) {
          throw new Error(
            `Cannot calculate return profit: no original dispatch matches DR ${drNumberForLookup || '(missing)'}.`,
          );
        }
        profitUpdates = computeReturnProfitDelta({
          returnedBags: newBagsReturned,
          sellingPricePerBag: Number(originalDispatch.selling_price_per_bag) || 0,
          landedCostPerBag: Number(originalDispatch.landed_cost_per_bag) || 0,
          localExpensesPerBag: Number(originalDispatch.local_expenses_per_bag) || 0,
          isRestockable: newReturnReason === 'return',
        });
      }
    }
  }

  const { error } = await supabase
    .from('shipment_ledger')
    .update({ ...updates, ...profitUpdates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);

  const wasRestockable = oldEntry.return_reason === 'return' || !oldEntry.return_reason;
  const newReturnReason = updates.return_reason ?? oldEntry.return_reason ?? 'return';
  const isRestockable = newReturnReason === 'return';

  const { data: shipment } = await supabase
    .from('shipments')
    .select('remaining_jb, remaining_sb')
    .eq('id', shipmentId)
    .single();
  if (shipment) {
    // bags_returned is an INDIVIDUAL BAG count (same denomination the
    // profit-delta recompute above uses); remaining_jb/remaining_sb are
    // UNIT-denominated. Convert bags -> units, rounding DOWN, same as
    // _addLedgerEntry — see denomination-mismatch bug writeup there.
    const oldJbReturnedBags =
      wasRestockable && oldEntry.bags_returned > 0 && oldEntry.bag_returned_type === 'JB'
        ? oldEntry.bags_returned
        : 0;
    const oldSbReturnedBags =
      wasRestockable && oldEntry.bags_returned > 0 && oldEntry.bag_returned_type === 'SB'
        ? oldEntry.bags_returned
        : 0;
    const oldJbReturned = Math.floor(oldJbReturnedBags / BAG_EQUIVALENT.JB);
    const oldSbReturned = Math.floor(oldSbReturnedBags / BAG_EQUIVALENT.SB);
    const newJbOut = updates.jb ?? oldEntry.jb;
    const newSbOut = updates.sb ?? oldEntry.sb;
    const newReturned = updates.bags_returned ?? oldEntry.bags_returned;
    const newReturnedType = updates.bag_returned_type ?? oldEntry.bag_returned_type;
    const newJbReturnedBags =
      isRestockable && newReturned > 0 && newReturnedType === 'JB' ? newReturned : 0;
    const newSbReturnedBags =
      isRestockable && newReturned > 0 && newReturnedType === 'SB' ? newReturned : 0;
    const newJbReturned = Math.floor(newJbReturnedBags / BAG_EQUIVALENT.JB);
    const newSbReturned = Math.floor(newSbReturnedBags / BAG_EQUIVALENT.SB);

    const correctedJb =
      (shipment.remaining_jb ?? 0) + oldEntry.jb - oldJbReturned - newJbOut + newJbReturned;
    const correctedSb =
      (shipment.remaining_sb ?? 0) + oldEntry.sb - oldSbReturned - newSbOut + newSbReturned;

    const { error: stockError } = await supabase
      .from('shipments')
      .update({
        remaining_jb: Math.max(0, correctedJb),
        remaining_sb: Math.max(0, correctedSb),
        good_stock: Math.max(0, correctedJb) + Math.max(0, correctedSb),
      })
      .eq('id', shipmentId);
    if (stockError) {
      console.error('Failed to correct shipment stock on ledger edit:', stockError);
    }
  }

  await logActivity(supabase, userId, 'ledger_entry_updated', 'shipment_ledger', id, updates);
  return { success: true };
}

export const updateLedgerEntry = safeAction(_updateLedgerEntry);

// ─────────────────────────────────────────────────────────────────────────
// Shared "apply a bag return to the ledger" helper — extracted from
// _updateTrackingStatus's inline loop (orders-actions.ts) so both the
// tracking-tab flow AND the order_returns approval flow (return-actions.ts)
// write ledger entries the exact same way instead of duplicating this logic.
// ─────────────────────────────────────────────────────────────────────────

export interface ApplyBagReturnParams {
  shipmentId: string;
  poNumber?: string | null;
  drNumber?: string | null;
  clientId?: string | null;
  jbReturned?: number;
  sbReturned?: number;
  returnReason: 'return' | 'waste' | 'damage';
  clientReason?: string | null;
}

// Internal implementation unchanged — safeAction() wraps the export below.
async function _applyBagReturnToLedger(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: ApplyBagReturnParams,
) {
  const { shipmentId, poNumber, drNumber, clientId, returnReason, clientReason } = params;
  const jbReturned = params.jbReturned ?? 0;
  const sbReturned = params.sbReturned ?? 0;
  if (jbReturned <= 0 && sbReturned <= 0) return { entriesCreated: 0 };

  let clientLabel = 'Unknown';
  if (clientId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company_name')
      .eq('id', clientId)
      .single();
    clientLabel = profile?.company_name || profile?.full_name || 'Unknown';
  }

  const { data: drRecord } = await supabase
    .from('delivery_receipts')
    .select('id')
    .eq('dr_number', drNumber ?? '')
    .maybeSingle();

  let entriesCreated = 0;
  for (const [returnedBags, bagReturnedType] of [
    [jbReturned, 'JB'],
    [sbReturned, 'SB'],
  ] as const) {
    if (returnedBags <= 0) continue;
    const ledgerResult = await addLedgerEntry(shipmentId, {
      date: new Date().toISOString().split('T')[0],
      po_number: poNumber ?? undefined,
      dr_number: drNumber ?? undefined,
      client_name: clientLabel,
      jb: 0,
      sb: 0,
      bags_returned: returnedBags,
      bag_returned_type: bagReturnedType,
      return_reason: returnReason,
      client_reason: clientReason || undefined,
      delivery_receipt_id: drRecord?.id || null,
    });
    // addLedgerEntry no longer throws (it's wrapped in safeAction) — re-throw
    // here so a failed return-profit ledger entry still fails the WHOLE
    // caller's operation, matching the pre-existing _updateTrackingStatus
    // re-throw convention this helper was extracted from.
    if (!ledgerResult.success) {
      throw new Error(`Failed to record return ledger entry: ${ledgerResult.error}`);
    }
    entriesCreated += 1;
  }
  return { entriesCreated };
}

export const applyBagReturnToLedger = safeAction(_applyBagReturnToLedger);
