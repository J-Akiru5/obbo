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
}

/** Profit fields for a dispatch (a bag actually going out the door). */
export function computeDispatchProfit(params: {
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
 */
export function computeReturnProfitDelta(params: {
  returnedBags: number;
  sellingPricePerBag: Decimal.Value;
  landedCostPerBag: Decimal.Value;
  localExpensesPerBag: Decimal.Value;
  isRestockable: boolean;
}): DispatchProfitFields {
  const { returnedBags, sellingPricePerBag, landedCostPerBag, localExpensesPerBag, isRestockable } =
    params;
  if (!Number.isSafeInteger(returnedBags) || returnedBags <= 0) {
    throw new Error('Returned bags must be a positive integer.');
  }

  const sellingPrice = money(sellingPricePerBag);
  const landed = money(landedCostPerBag);
  const local = money(localExpensesPerBag);

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
    };
  }

  const quantity = new Decimal(returnedBags);

  // Restockable: the client isn't charged for these bags and the bag itself
  // (plus its handling cost) is recovered, so sales reverse in full and both
  // cost lines reverse with it.
  const totalSalesDelta = quantity.mul(sellingPrice).neg();
  const grossProfitDelta = totalSalesDelta.plus(quantity.mul(landed));
  const netProfitDelta = grossProfitDelta.plus(quantity.mul(local));

  return {
    total_sales: asNumber(totalSalesDelta),
    gross_profit: asNumber(grossProfitDelta),
    net_profit: asNumber(netProfitDelta),
    selling_price_per_bag: asNumber(sellingPrice),
    landed_cost_per_bag: asNumber(landed),
    local_expenses_per_bag: asNumber(local),
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
