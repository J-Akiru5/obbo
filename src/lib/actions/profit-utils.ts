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
}

/**
 * Prorate an order's total sales to a partial dispatch by the VALUE
 * (price × quantity) of the bags actually going out, not by weight.
 * Handles mixed-product orders where JB and SB have different per-bag prices.
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
    const price = money(item.selling_price_per_bag);
    approvedValue = approvedValue.plus(price.mul(item.approved_qty));
    totalOrderValue = totalOrderValue.plus(price.mul(item.requested_qty));
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
 * Non-restockable returns ('waste'/'damage'): the bag is destroyed.
 * Revenue reverses in full but no cost is recovered — the amount the
 * client wasn't charged for drops straight through to profit as a loss.
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

  const quantity = new Decimal(returnedBags);
  const sellingPrice = money(sellingPricePerBag);
  const landed = money(landedCostPerBag);
  const local = money(localExpensesPerBag);

  // Revenue always reverses in full (client isn't charged for returned bags)
  const totalSalesDelta = quantity.mul(sellingPrice).neg();

  // Gross reverses sales + landed cost (cost of the bag itself is recovered)
  // Non-restockable destroys the bag → landed cost is NOT recovered
  const grossProfitDelta = isRestockable
    ? totalSalesDelta.plus(quantity.mul(landed))
    : totalSalesDelta;

  // Net = gross + local-expense reversal when restockable.
  // Local expenses (handling, storage) also reverse for restockable because
  // those costs are tied to a bag that's going back into inventory.
  // For waste/damage, local stays sunk — only sales reverses on both lines.
  const netProfitDelta = isRestockable
    ? grossProfitDelta.plus(quantity.mul(local))
    : totalSalesDelta;

  return {
    total_sales: asNumber(totalSalesDelta),
    gross_profit: asNumber(grossProfitDelta),
    net_profit: asNumber(netProfitDelta),
    selling_price_per_bag: asNumber(sellingPrice),
    landed_cost_per_bag: asNumber(landed),
    local_expenses_per_bag: asNumber(local),
  };
}
