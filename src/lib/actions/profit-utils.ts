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

export function getSourcePrice(
  product:
    | { price_per_bag: number; price_port?: number | null; price_warehouse?: number | null }
    | null
    | undefined,
  source: string,
): number {
  if (!product) return 0;
  if (source === 'port') return product.price_port || product.price_per_bag || 0;
  return product.price_warehouse || product.price_per_bag || 0;
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

/**
 * Profit delta for a return/waste/damage event, using the original sale's
 * stored rates. Restockable returns reverse sales and landed cost only;
 * local expenses remain sunk. Waste/damage reverses sales only.
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
  const totalSalesDelta = quantity.mul(sellingPrice).neg();
  const grossProfitDelta = isRestockable
    ? totalSalesDelta.plus(quantity.mul(landed))
    : totalSalesDelta;
  const netProfitDelta = grossProfitDelta;

  return {
    total_sales: asNumber(totalSalesDelta),
    gross_profit: asNumber(grossProfitDelta),
    net_profit: asNumber(netProfitDelta),
    selling_price_per_bag: asNumber(sellingPrice),
    landed_cost_per_bag: asNumber(landed),
    local_expenses_per_bag: asNumber(local),
  };
}
