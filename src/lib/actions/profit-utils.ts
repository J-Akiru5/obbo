import Decimal from 'decimal.js';

// Plain, synchronous helpers used by the server actions in this directory.
//
// Deliberately NOT a 'use server' file: Next.js requires every export from a
// 'use server' file to be an async function (it treats each export as a
// potential Server Action reference). getSourcePrice/computeDispatchProfit/
// computeReturnProfitDelta are pure math/lookup functions with no I/O, so
// they live here instead and get imported directly by the action files that
// need them.

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

function money(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function asNumber(value: Decimal): number {
  return Number(value.toFixed(2));
}

// 1 Jumbo Bag (JB) unit = 25 individual 40kg bags. 1 Sling Bag (SB) unit = 50
// individual 40kg bags. order_items.requested_qty/approved_qty are stored in
// JB/SB UNITS (raw client wizard quantities) — but customer_balances.remaining_qty
// must be stored in INDIVIDUAL bags, because the balance/redelivery UI already
// treats it that way (labels it "individual bags" and divides by 25/50 when
// converting back to units). See sales-profit-tracking-module.md, formula #1.
// (Twin copy lives in order-schema.ts for client-bundle reasons — keep in sync.)
export const BAG_EQUIVALENT = { JB: 25, SB: 50 } as const;

export function individualBagsFromUnits(bagType: 'JB' | 'SB', unitQty: number): number {
  return unitQty * BAG_EQUIVALENT[bagType];
}

/**
 * units → individual bags, rounded to the nearest whole bag.
 *
 * jb/sb columns on `delivery_receipts` and `shipment_ledger` can hold
 * fractional units now (manual DRs are entered in whole bags: 7 JB bags = 0.28
 * units). Anything that turns those units back into bags for DISPLAY or for a
 * whole-bag aggregate must round, or `0.28 * 25` renders as
 * `7.000000000000001` and a `z.number().int()` save-schema rejects it.
 */
export function wholeBagsFromUnits(bagType: 'JB' | 'SB', unitQty: number): number {
  return Math.round(individualBagsFromUnits(bagType, unitQty));
}

export function unitsFromIndividualBags(bagType: 'JB' | 'SB', bags: number): number {
  return bags / BAG_EQUIVALENT[bagType];
}

/**
 * Human-readable per-bag-type quantity for list and table cells.
 *
 * One order can carry BOTH bag types, so a quantity must never collapse into a
 * single number under a single type label — "50 JB · 100 SB", never "150 JB".
 * Zero counts are omitted, and an all-zero pair renders "0".
 *
 * Takes individual BAGS, not JB/SB units. Convert first with
 * wholeBagsFromUnits() when the source column is denominated in units
 * (delivery_receipts.jb/sb, shipment_ledger.jb/sb).
 */
export function formatBagBreakdown(jbBags: number, sbBags: number): string {
  const parts = [
    jbBags > 0 ? `${jbBags.toLocaleString()} JB` : null,
    sbBags > 0 ? `${sbBags.toLocaleString()} SB` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '0';
}

export function getSourcePrice(
  product:
    | { price_per_bag: number; price_port?: number | null; price_warehouse?: number | null }
    | null
    | undefined,
  source: string,
): number {
  if (!product) return 0;
  if (source === 'port') return product.price_port ?? product.price_per_bag ?? 0;
  return product.price_warehouse ?? product.price_per_bag ?? 0;
}

export interface DispatchProfitFields {
  total_sales: number;
  gross_profit: number;
  net_profit: number;
  selling_price_per_bag: number;
  landed_cost_per_bag: number;
  local_expenses_per_bag: number;
  /**
   * The per-bag price this row's gross/net margin is measured at (see
   * computeDispatchProfit). `null` marks a LEGACY row, whose gross/net was
   * derived from the actual selling price. Stored as
   * `shipment_ledger.profit_basis_price_per_bag`.
   */
  profit_basis_price_per_bag: number | null;
}

/**
 * How much of a dispatch's prorated revenue was actually recognized:
 * 1 normally, 0 when the PO revenue cap zeroed the sale (a redelivery of bags
 * the client already paid for), a fraction when the cap clamped it partially.
 * 0 when there was nothing to prorate.
 */
export function computeRecognizedFraction(
  totalSales: Decimal.Value,
  proratedSales: Decimal.Value,
): Decimal {
  const prorated = money(proratedSales);
  if (!prorated.gt(0)) return new Decimal(0);
  return Decimal.min(Decimal.max(money(totalSales).div(prorated), 0), 1);
}

/**
 * Profit fields for a dispatch (a bag actually going out the door).
 *
 * Gross and net are a FIXED per-bag margin, independent of the selling price:
 *
 *   basisPrice = round2(referencePricePerBag × recognizedFraction)
 *   gross      = bags × (basisPrice − landed)
 *   net        = gross − bags × local
 *
 * so at the ₱185 reference, 147.64 landed and 20 local, every fully recognized
 * bag is worth 37.36 gross / 17.36 net whether it sold at ₱185 or ₱180.
 * `total_sales` stays the ACTUAL amount. The fraction is what keeps a ₱0
 * redelivery (cap-zeroed sale, fraction 0) booking −landed per bag instead of
 * booking the margin a second time.
 */
export function computeDispatchProfit(params: {
  totalBags: number;
  totalSales: Decimal.Value;
  landedCostPerBag: Decimal.Value;
  localExpensesPerBag: Decimal.Value;
  referencePricePerBag: Decimal.Value;
  recognizedFraction: Decimal.Value;
}): DispatchProfitFields {
  const { totalBags, totalSales, landedCostPerBag, localExpensesPerBag } = params;
  if (!Number.isSafeInteger(totalBags) || totalBags < 0) {
    throw new Error('Total bags must be a non-negative integer.');
  }
  const reference = money(params.referencePricePerBag);
  const fraction = new Decimal(params.recognizedFraction);
  if (reference.isNegative()) {
    throw new Error('Reference price per bag must not be negative.');
  }
  if (!fraction.isFinite() || fraction.lt(0) || fraction.gt(1)) {
    throw new Error('Recognized fraction must be between 0 and 1.');
  }

  const sales = money(totalSales);
  const landed = money(landedCostPerBag);
  const local = money(localExpensesPerBag);
  const quantity = new Decimal(totalBags);
  const basisPrice = money(reference.mul(fraction));
  const gross = quantity.mul(basisPrice.minus(landed));
  const net = gross.minus(quantity.mul(local));
  const sellingPricePerBag = totalBags > 0 ? sales.div(quantity) : new Decimal(0);

  return {
    total_sales: asNumber(sales),
    gross_profit: asNumber(gross),
    net_profit: asNumber(net),
    selling_price_per_bag: asNumber(sellingPricePerBag),
    landed_cost_per_bag: asNumber(landed),
    local_expenses_per_bag: asNumber(local),
    profit_basis_price_per_bag: asNumber(basisPrice),
  };
}

/**
 * The PRE-fixed-margin formula: gross = sales − bags × landed. Used ONLY to
 * re-compute an edited LEGACY ledger row (profit_basis_price_per_bag IS NULL),
 * so editing an old row keeps behaving exactly as it did when it was written.
 * Never use this for a new dispatch — see computeDispatchProfit.
 */
export function computeLegacyDispatchProfit(params: {
  totalBags: number;
  totalSales: Decimal.Value;
  landedCostPerBag: Decimal.Value;
  localExpensesPerBag: Decimal.Value;
}): DispatchProfitFields {
  const { totalBags, totalSales, landedCostPerBag, localExpensesPerBag } = params;
  if (!Number.isSafeInteger(totalBags) || totalBags < 0) {
    throw new Error('Total bags must be a non-negative integer.');
  }

  const sales = money(totalSales);
  const landed = money(landedCostPerBag);
  const local = money(localExpensesPerBag);
  const quantity = new Decimal(totalBags);
  const gross = sales.minus(quantity.mul(landed));
  const net = gross.minus(quantity.mul(local));
  const sellingPricePerBag = totalBags > 0 ? sales.div(quantity) : new Decimal(0);

  return {
    total_sales: asNumber(sales),
    gross_profit: asNumber(gross),
    net_profit: asNumber(net),
    selling_price_per_bag: asNumber(sellingPricePerBag),
    landed_cost_per_bag: asNumber(landed),
    local_expenses_per_bag: asNumber(local),
    profit_basis_price_per_bag: null,
  };
}

export function prorateOrderSales(
  totalOrderSales: Decimal.Value,
  totalOrderBags: number,
  dispatchedBags: number,
): number {
  if (!Number.isSafeInteger(totalOrderBags) || totalOrderBags <= 0) {
    throw new Error('Total order bags must be a positive integer.');
  }
  if (
    !Number.isSafeInteger(dispatchedBags) ||
    dispatchedBags < 0 ||
    dispatchedBags > totalOrderBags
  ) {
    throw new Error('Dispatched bags must be within the ordered quantity.');
  }

  return asNumber(
    money(totalOrderSales)
      .mul(dispatchedBags)
      .div(totalOrderBags)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  );
}

export interface OrderItemPrice {
  requested_qty: number;
  approved_qty: number;
  selling_price_per_bag: number;
  // JB/SB — required so this function can weight by INDIVIDUAL BAGS
  // (via individualBagsFromUnits), not raw JB/SB unit counts. 1 SB unit
  // (50 bags) is worth 2x as much volume as 1 JB unit (25 bags), so
  // weighting by raw units mis-prorates any order that mixes both bag
  // types with different per-item approval fractions — see
  // sales-profit-tracking-module.md formula #1.
  bag_type: 'JB' | 'SB';
}

/**
 * Prorate an order's total sales to a partial dispatch by the VALUE
 * (price × individual-bag quantity) of the bags actually going out, not by
 * weight. Handles mixed-product orders where JB and SB have different
 * per-bag prices AND different bag-per-unit counts.
 */
export function prorateOrderSalesByValue(
  totalOrderSales: Decimal.Value,
  items: OrderItemPrice[],
): number {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order items array must be non-empty.');
  }
  let approvedValue = new Decimal(0);
  let totalOrderValue = new Decimal(0);
  for (const item of items) {
    if (
      !Number.isSafeInteger(item.requested_qty) ||
      item.requested_qty < 0 ||
      !Number.isSafeInteger(item.approved_qty) ||
      item.approved_qty < 0 ||
      item.approved_qty > item.requested_qty
    ) {
      throw new Error(
        'Each item must have valid non-negative quantities with approved ≤ requested.',
      );
    }
    if (item.bag_type !== 'JB' && item.bag_type !== 'SB') {
      throw new Error(`Each item must have a bag_type of 'JB' or 'SB', got: ${item.bag_type}`);
    }
    const price = money(item.selling_price_per_bag);
    const approvedBags = individualBagsFromUnits(item.bag_type, item.approved_qty);
    const requestedBags = individualBagsFromUnits(item.bag_type, item.requested_qty);
    approvedValue = approvedValue.plus(price.mul(approvedBags));
    totalOrderValue = totalOrderValue.plus(price.mul(requestedBags));
  }
  if (totalOrderValue.isZero()) {
    throw new Error('Total order value must be greater than zero.');
  }
  return asNumber(
    money(totalOrderSales)
      .mul(approvedValue)
      .div(totalOrderValue)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  );
}

/**
 * Profit delta for a return/waste/damage event, using the original sale's
 * stored rates.
 *
 * Restockable returns ('return'): the bag goes back to good stock, so the
 * full revenue, landed cost, and local expenses for that bag all reverse.
 *
 * Non-restockable returns ('waste'/'damage'): the bag never comes back into
 * sellable stock, so nothing financial reverses — the sale was already
 * recognized when the bag left the warehouse and the client was charged for
 * it. Marking bags damaged must not silently claw revenue out of SALES,
 * GROSS, or NET. The returned-rate fields are still populated so the row
 * can report what that bag originally sold and cost for, and the bag counts
 * (bag_returned_type / bags_returned) still feed stock and waste reports.
 *
 * Client-feedback round 3, Issue 3: "the return should not affect sales,
 * gross, and net … the return should only mark the bags as damaged."
 *
 * Fixed-margin rows: the original dispatch booked its gross at its stored
 * profit basis price, NOT at what the bag sold for, so the reversal must use
 * that same basis — otherwise a full return of a ₱180 sale (basis ₱185) would
 * leave +5/bag of margin behind. Sales still reverse at the ACTUAL selling
 * price. `profitBasisPricePerBag` null/undefined = a legacy original row, which
 * reverses at the selling price exactly as before.
 */
export function computeReturnProfitDelta(params: {
  returnedBags: number;
  sellingPricePerBag: Decimal.Value;
  landedCostPerBag: Decimal.Value;
  localExpensesPerBag: Decimal.Value;
  isRestockable: boolean;
  profitBasisPricePerBag?: Decimal.Value | null;
}): DispatchProfitFields {
  const { returnedBags, sellingPricePerBag, landedCostPerBag, localExpensesPerBag, isRestockable } =
    params;
  if (!Number.isSafeInteger(returnedBags) || returnedBags <= 0) {
    throw new Error('Returned bags must be a positive integer.');
  }

  const sellingPrice = money(sellingPricePerBag);
  const landed = money(landedCostPerBag);
  const local = money(localExpensesPerBag);
  const hasBasis = params.profitBasisPricePerBag != null;
  const basisPrice = hasBasis ? money(params.profitBasisPricePerBag as Decimal.Value) : null;

  if (!isRestockable) {
    // Nothing is restocked and nothing is reversed — record zero deltas but
    // keep the per-bag rates so the row is still informative.
    return {
      total_sales: 0,
      gross_profit: 0,
      net_profit: 0,
      selling_price_per_bag: asNumber(sellingPrice),
      landed_cost_per_bag: asNumber(landed),
      local_expenses_per_bag: asNumber(local),
      profit_basis_price_per_bag: basisPrice ? asNumber(basisPrice) : null,
    };
  }

  const quantity = new Decimal(returnedBags);

  // Restockable: the client isn't charged for these bags and the bag itself
  // (plus its handling cost) is recovered, so sales reverse in full and both
  // cost lines reverse with it. Margin reverses at the original row's basis.
  const totalSalesDelta = quantity.mul(sellingPrice).neg();
  const grossProfitDelta = quantity
    .mul(basisPrice ?? sellingPrice)
    .neg()
    .plus(quantity.mul(landed));
  const netProfitDelta = grossProfitDelta.plus(quantity.mul(local));

  return {
    total_sales: asNumber(totalSalesDelta),
    gross_profit: asNumber(grossProfitDelta),
    net_profit: asNumber(netProfitDelta),
    selling_price_per_bag: asNumber(sellingPrice),
    landed_cost_per_bag: asNumber(landed),
    local_expenses_per_bag: asNumber(local),
    profit_basis_price_per_bag: basisPrice ? asNumber(basisPrice) : null,
  };
}

/**
 * Cumulative revenue-recognition cap (client-feedback round 3, Issue 3).
 *
 * A purchase order's full selling value may be recognized AT MOST ONCE,
 * across every dispatch that carries that PO number — original dispatch,
 * partial dispatches, and any replacement/redelivery DR. Anything delivered
 * past the PO total (redeliveries for bags that were already paid for) is
 * recorded as ¥0 so TOTAL PURCHASED / SALES / GROSS / NET never inflate.
 *
 * @param poTotal        the PO's selling value (order.total_amount)
 * @param alreadyRecorded sum of shipment_ledger.total_sales already booked
 *                       against this PO number
 * @param desired        the amount the caller would book without a cap
 * @returns clamped amount, never negative
 */
export function capSalesToPoTotal(params: {
  poTotal: Decimal.Value;
  alreadyRecorded: Decimal.Value;
  desired: Decimal.Value;
}): number {
  const remaining = money(params.poTotal).minus(money(params.alreadyRecorded));
  if (remaining.lte(0)) return 0;
  const desired = money(params.desired);
  const capped = Decimal.min(desired, remaining);
  return asNumber(capped.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
}
