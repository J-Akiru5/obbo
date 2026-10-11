'use server';

import { requireAdmin, logActivity, getCostConfig } from './admin-helpers';
import {
  computeDispatchProfit,
  computeLegacyDispatchProfit,
  computeReturnProfitDelta,
  BAG_EQUIVALENT,
  type DispatchProfitFields,
} from './profit-utils';
import { ledgerEntryCreateSchema, ledgerEntryUpdateSchema } from './schemas';
import { safeAction } from './action-result';
import { createClient } from '@/lib/supabase/server';
import type { OrderSource } from '@/lib/types/database';

function asLedgerSource(value: unknown): OrderSource | null {
  return value === 'port' || value === 'warehouse' ? value : null;
}

// Best-effort PO → source lookup. Source is a display label, so a missing PO
// or a failed read must never block a financial ledger write — it just yields
// null (the cell renders "—").
async function lookupPoSource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poNumber: string,
): Promise<OrderSource | null> {
  const { data } = await supabase
    .from('purchase_orders')
    .select('source')
    .eq('po_number', poNumber)
    .maybeSingle();
  return asLedgerSource(data?.source);
}

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
    source?: OrderSource | null;
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
  // Everything below reads the PARSED data (trimmed, and the strict schema has
  // already rejected unknown keys) — never the raw caller object.
  const fields = parsed.data;
  const { supabase, userId } = await requireAdmin();
  const jbOut = fields.jb ?? 0;
  const sbOut = fields.sb ?? 0;
  const returned = fields.bags_returned ?? 0;
  const returnedType = fields.bag_returned_type ?? null;
  const returnReason = fields.return_reason ?? 'return';

  const isDispatch = !fields.bags_returned || fields.bags_returned === 0;
  let profitFields: Partial<DispatchProfitFields> = {};
  // Source is a LABEL ONLY: nothing below feeds it into price, sales, gross or
  // net. `undefined` = the caller didn't say, so it is defaulted further down.
  let inheritedSource: OrderSource | null | undefined;
  if (isDispatch && (jbOut > 0 || sbOut > 0)) {
    const costConfig = await getCostConfig();
    // jb/sb are UNITS and can be fractional now (manual DRs are entered in
    // bags, e.g. 7 JB bags = 0.28 units). Profit is priced per INDIVIDUAL
    // BAG, so round the converted bag count — physical bags are whole.
    const totalBags = Math.round(jbOut * BAG_EQUIVALENT.JB + sbOut * BAG_EQUIVALENT.SB);
    const amount = fields.amount ?? 0;
    profitFields = computeDispatchProfit({
      totalBags,
      totalSales: amount,
      landedCostPerBag: costConfig.landed_cost_per_bag,
      localExpensesPerBag: costConfig.local_expenses_per_bag,
      referencePricePerBag: costConfig.reference_price_per_bag,
      // A manual row has no PO proration to compare against: a positive amount
      // is a recognized sale (full margin), ₱0 recognizes none (so it books
      // −landed per bag, not a margin it never earned).
      recognizedFraction: amount > 0 ? 1 : 0,
    });
  } else if (!isDispatch && returned > 0) {
    // A return/waste/damage event reverses a slice of an ORIGINAL sale.
    // Look that original dispatch row up (same shipment + DR number, the
    // earliest row with jb/sb > 0) and use ITS stored rates and profit basis —
    // never live cost config — so this reversal can't drift from what was
    // actually charged, even if cost config has changed since.
    const { data: originalDispatch } = await supabase
      .from('shipment_ledger')
      .select(
        'selling_price_per_bag, landed_cost_per_bag, local_expenses_per_bag, profit_basis_price_per_bag, source',
      )
      .eq('shipment_id', shipmentId)
      .eq('dr_number', fields.dr_number ?? '')
      .or('jb.gt.0,sb.gt.0')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!originalDispatch) {
      throw new Error(
        `Cannot calculate return profit: no original dispatch matches DR ${fields.dr_number ?? '(missing)'}.`,
      );
    }
    // A return row is the same order coming back, so it carries the original
    // dispatch row's source.
    inheritedSource = asLedgerSource(originalDispatch.source);
    profitFields = computeReturnProfitDelta({
      returnedBags: returned,
      sellingPricePerBag: Number(originalDispatch.selling_price_per_bag) || 0,
      landedCostPerBag: Number(originalDispatch.landed_cost_per_bag) || 0,
      localExpensesPerBag: Number(originalDispatch.local_expenses_per_bag) || 0,
      isRestockable: returnReason === 'return',
      // NULL = a legacy original row, reversed at its selling price as before.
      profitBasisPricePerBag: originalDispatch.profit_basis_price_per_bag,
    });
  }

  // Explicit value (including null) wins. Otherwise: a return row inherits its
  // original dispatch's source; any other row falls back to its PO's source.
  const source =
    fields.source !== undefined
      ? fields.source
      : (inheritedSource ??
        (fields.po_number ? await lookupPoSource(supabase, fields.po_number) : null));

  const { data, error } = await supabase
    .from('shipment_ledger')
    .insert({
      shipment_id: shipmentId,
      ...fields,
      source,
      ...profitFields,
      date: fields.date ?? new Date().toISOString().split('T')[0],
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
    // jbOut/sbOut are JB/SB UNITS (ledger denomination); returned is an
    // INDIVIDUAL BAG count; shipments.remaining_jb/remaining_sb are INDIVIDUAL
    // BAGS. Convert the dispatch side up to bags and credit returns as the
    // exact bag count that physically came back — no unit floor needed now
    // that stock itself is bag-denominated.
    const jbReturnedBags = restockReturned && returnedType === 'JB' ? returned : 0;
    const sbReturnedBags = restockReturned && returnedType === 'SB' ? returned : 0;
    // Round the unit→bag conversion: stock columns are whole bags and the
    // unit side can now be fractional (0.28 * 25 must stay exactly 7, not
    // 7.000000000000001 which Postgres would round away from 7 anyway).
    const newRemainingJb = Math.max(
      0,
      (shipment.remaining_jb ?? 0) - Math.round(jbOut * BAG_EQUIVALENT.JB) + jbReturnedBags,
    );
    const newRemainingSb = Math.max(
      0,
      (shipment.remaining_sb ?? 0) - Math.round(sbOut * BAG_EQUIVALENT.SB) + sbReturnedBags,
    );
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

  await logActivity(supabase, userId, 'ledger_entry_added', 'shipment_ledger', data.id, fields);
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
    source: OrderSource | null;
    jb: number;
    sb: number;
    payment_method: string;
    check_number: string;
    amount: number;
    bags_returned: number;
    bag_returned_type: string;
    return_reason: string;
    client_reason: string | null;
    notes: string;
  }>,
) {
  const parsed = ledgerEntryUpdateSchema.safeParse(updates);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  // Read and write the PARSED data only (the strict schema has already
  // rejected unknown keys).
  const fields = parsed.data;
  const { supabase, userId } = await requireAdmin();

  // T-1 fix: whenever jb/sb/amount/bags_returned/return_reason change, the
  // stored total_sales/gross_profit/net_profit/selling_price_per_bag go
  // stale unless we recompute them here. We always recompute from THIS
  // row's own stored landed_cost_per_bag/local_expenses_per_bag (or, for a
  // return row, the original dispatch row's stored rates) — never live
  // cost config — so historical immutability holds even through an edit.
  //
  // Deliberately NOT re-applied here: the PO revenue cap (capSalesToPoTotal).
  // The cap runs at the two DISPATCH write sites — dispatch_order_v2 in
  // orders-actions.ts and _createDeliveryReceipt in
  // delivery-receipt-actions.ts — which is where a second DR for the same PO
  // used to inflate TOTAL PURCHASED. This edit path is a deliberate data
  // correction, and capping it would make a historically wrong row
  // impossible to fix upward without first editing the order too.
  // `source` is deliberately NOT a trigger: it is a display label and has no
  // bearing on price, sales, gross or net.
  const recomputeTrigger =
    fields.jb !== undefined ||
    fields.sb !== undefined ||
    fields.amount !== undefined ||
    fields.bags_returned !== undefined ||
    fields.return_reason !== undefined ||
    fields.dr_number !== undefined;

  let profitUpdates: Partial<DispatchProfitFields> = {};
  if (recomputeTrigger) {
    const { data: currentRow } = await supabase
      .from('shipment_ledger')
      .select(
        'jb, sb, amount, bags_returned, return_reason, dr_number, landed_cost_per_bag, local_expenses_per_bag, profit_basis_price_per_bag',
      )
      .eq('id', id)
      .single();

    if (currentRow) {
      const newAmount = fields.amount ?? Number(currentRow.amount) ?? 0;
      const newBagsReturned = fields.bags_returned ?? currentRow.bags_returned ?? 0;
      const newReturnReason = fields.return_reason ?? currentRow.return_reason ?? 'return';
      const landedCostPerBag = Number(currentRow.landed_cost_per_bag) || 0;
      const localExpensesPerBag = Number(currentRow.local_expenses_per_bag) || 0;

      if (!newBagsReturned || newBagsReturned === 0) {
        // Still a dispatch row after the edit — reuse THIS row's own
        // historic rates, not a fresh getCostConfig() call.
        const totalBags = Math.round(
          Number(fields.jb ?? currentRow.jb) * BAG_EQUIVALENT.JB +
            Number(fields.sb ?? currentRow.sb) * BAG_EQUIVALENT.SB,
        );

        if (currentRow.profit_basis_price_per_bag == null) {
          // LEGACY row (written before fixed-margin profit): keep the formula
          // it was written with, so editing an old row never silently
          // restates it onto the new basis. Forward-only.
          profitUpdates = computeLegacyDispatchProfit({
            totalBags,
            totalSales: newAmount,
            landedCostPerBag,
            localExpensesPerBag,
          });
        } else {
          // New-style row. Margin is measured at THIS row's stored basis price
          // so the edit can't drift from what the dispatch booked.
          //
          // The dialog resends `amount` on every save, so the amount decides
          // whether a sale is recognized (same rule as a manual add): ₱0
          // recognizes none (basis 0 — a capped redelivery edited for a note
          // stays at −landed per bag instead of booking margin it never
          // earned), a positive amount recognizes it in full.
          //
          // LIVE-CONFIG FALLBACK (deliberate): a row whose stored basis is 0
          // (a ₱0 redelivery) that is edited to a positive amount has no basis
          // of its own to reuse, so it takes the CURRENT configured reference
          // price. This edit path is a data-correction path, so correcting such
          // a row at today's reference price is intended.
          const storedBasis = Number(currentRow.profit_basis_price_per_bag) || 0;
          const referencePricePerBag =
            storedBasis > 0 || newAmount <= 0
              ? storedBasis
              : (await getCostConfig()).reference_price_per_bag;
          profitUpdates = computeDispatchProfit({
            totalBags,
            totalSales: newAmount,
            landedCostPerBag,
            localExpensesPerBag,
            referencePricePerBag,
            recognizedFraction: newAmount > 0 ? 1 : 0,
          });
        }
      } else {
        // This row is (or is becoming) a return/waste/damage row — its
        // profit fields are a delta against the ORIGINAL dispatch row, so
        // look that up again rather than reusing this row's own rates
        // (which, for an existing return row, are already the original's).
        const drNumberForLookup = fields.dr_number ?? currentRow.dr_number ?? '';
        const { data: originalDispatch } = await supabase
          .from('shipment_ledger')
          .select(
            'selling_price_per_bag, landed_cost_per_bag, local_expenses_per_bag, profit_basis_price_per_bag',
          )
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
          // NULL = a legacy original row, reversed at its selling price as before.
          profitBasisPricePerBag: originalDispatch.profit_basis_price_per_bag,
        });
      }
    }
  }

  const { error } = await supabase
    .from('shipment_ledger')
    .update({ ...fields, ...profitUpdates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);

  const wasRestockable = oldEntry.return_reason === 'return' || !oldEntry.return_reason;
  const newReturnReason = fields.return_reason ?? oldEntry.return_reason ?? 'return';
  const isRestockable = newReturnReason === 'return';

  const { data: shipment } = await supabase
    .from('shipments')
    .select('remaining_jb, remaining_sb')
    .eq('id', shipmentId)
    .single();
  if (shipment) {
    // Entry jb/sb are JB/SB UNITS; bags_returned is an INDIVIDUAL BAG count;
    // remaining_jb/remaining_sb are INDIVIDUAL BAGS. Convert entry units to
    // bags on both the reverse (old) and apply (new) side.
    const oldJbReturnedBags =
      wasRestockable && oldEntry.bags_returned > 0 && oldEntry.bag_returned_type === 'JB'
        ? oldEntry.bags_returned
        : 0;
    const oldSbReturnedBags =
      wasRestockable && oldEntry.bags_returned > 0 && oldEntry.bag_returned_type === 'SB'
        ? oldEntry.bags_returned
        : 0;
    const newJbOut = fields.jb ?? oldEntry.jb;
    const newSbOut = fields.sb ?? oldEntry.sb;
    const newReturned = fields.bags_returned ?? oldEntry.bags_returned;
    const newReturnedType = fields.bag_returned_type ?? oldEntry.bag_returned_type;
    const newJbReturnedBags =
      isRestockable && newReturned > 0 && newReturnedType === 'JB' ? newReturned : 0;
    const newSbReturnedBags =
      isRestockable && newReturned > 0 && newReturnedType === 'SB' ? newReturned : 0;

    // Round each unit→bag term individually so the integer result is exact
    // even when entry jb/sb are fractional (manual DRs entered in bags).
    const correctedJb =
      (shipment.remaining_jb ?? 0) +
      Math.round(Number(oldEntry.jb) * BAG_EQUIVALENT.JB) -
      oldJbReturnedBags -
      Math.round(Number(newJbOut) * BAG_EQUIVALENT.JB) +
      newJbReturnedBags;
    const correctedSb =
      (shipment.remaining_sb ?? 0) +
      Math.round(Number(oldEntry.sb) * BAG_EQUIVALENT.SB) -
      oldSbReturnedBags -
      Math.round(Number(newSbOut) * BAG_EQUIVALENT.SB) +
      newSbReturnedBags;

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

  await logActivity(supabase, userId, 'ledger_entry_updated', 'shipment_ledger', id, fields);
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

// ─────────────────────────────────────────────────────────────────────────
// PO revenue cap (client-feedback round 3, Issue 3)
//
// A purchase order's selling value may be recognized at most once, no matter
// how many DRs deliver against it. Partial dispatches book their prorated
// share; anything delivered past the PO total — replacements and
// redeliveries for bags the client already paid for — books ¥0.
//
// The cap is keyed on a PO *family*: a redelivery order gets its own
// `po_number` and points at the original through `linked_po_number`, so
// summing only the original PO's ledger rows would miss every redelivery
// dispatch that came after it.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Every `po_number` whose ledger revenue rolls up to `rootPoNumber`: the PO
 * itself plus the distinct PO number of every redelivery order linked to it.
 */
async function collectPoFamilyNumbers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rootPoNumber: string,
): Promise<string[]> {
  const poNumbers = new Set<string>([rootPoNumber]);
  const { data: linked } = await supabase
    .from('orders')
    .select('po_number')
    .eq('linked_po_number', rootPoNumber);
  // Array.isArray rather than `for (const row of linked ?? [])`: a driver
  // that resolves to a single object instead of a row array must not throw
  // here — an empty list just means "no redelivery orders yet".
  if (Array.isArray(linked)) {
    for (const row of linked) {
      if (row?.po_number) poNumbers.add(row.po_number);
    }
  }
  return [...poNumbers];
}

/**
 * Sum of `shipment_ledger.total_sales` already booked against a PO family.
 * Call this BEFORE writing a new dispatch row so the new row never counts
 * against itself.
 */
export async function sumLedgerSalesForPoFamily(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rootPoNumber: string | null | undefined,
): Promise<number> {
  if (!rootPoNumber) return 0;
  const poNumbers = await collectPoFamilyNumbers(supabase, rootPoNumber);
  const { data, error } = await supabase
    .from('shipment_ledger')
    .select('total_sales')
    .in('po_number', poNumbers);
  if (error || !Array.isArray(data)) return 0;
  return data.reduce((sum, row) => sum + (Number(row.total_sales) || 0), 0);
}

/**
 * The total selling value a PO family may recognize, or `null` when the PO
 * cannot be resolved to an order.
 *
 * Returning `null` (rather than `0`) is deliberate: an unresolvable PO means
 * "we don't know the cap", and callers must leave the amount alone in that
 * case instead of silently zeroing a historically correct sale.
 */
export async function getPoSalesCap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rootPoNumber: string | null | undefined,
): Promise<number | null> {
  if (!rootPoNumber) return null;
  const { data: order } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('po_number', rootPoNumber)
    .maybeSingle();
  if (!order) return null;
  return Number(order.total_amount) || 0;
}
