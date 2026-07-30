// Plain, synchronous helpers used by the server actions in this directory.
//
// Deliberately NOT a 'use server' file: Next.js requires every export from a
// 'use server' file to be an async function (it treats each export as a
// potential Server Action reference). getSourcePrice/computeDispatchProfit/
// computeReturnProfitDelta are pure math/lookup functions with no I/O, so
// they live here instead and get imported directly by the action files that
// need them.

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface DispatchProfitFields {
  total_sales: number;
  gross_profit: number;
  net_profit: number;
  selling_price_per_bag: number;
  landed_cost_per_bag: number;
  local_expenses_per_bag: number;
}

/**
 * Profit fields for a dispatch (a bag actually going out the door).
 * Callers pass whichever rates should apply — live cost config for a brand
 * new dispatch, or the row's own stored rates when recomputing an edit.
 */
export function computeDispatchProfit(params: {
  totalBags: number;
  totalSales: number;
  landedCostPerBag: number;
  localExpensesPerBag: number;
}): DispatchProfitFields {
  const { totalBags, totalSales, landedCostPerBag, localExpensesPerBag } = params;
  const sellingPricePerBag = totalBags > 0 ? round2(totalSales / totalBags) : 0;
  return {
    total_sales: totalSales,
    gross_profit: round2(totalSales - totalBags * landedCostPerBag),
    net_profit: round2(totalSales - totalBags * (landedCostPerBag + localExpensesPerBag)),
    selling_price_per_bag: sellingPricePerBag,
    landed_cost_per_bag: landedCostPerBag,
    local_expenses_per_bag: localExpensesPerBag,
  };
}

/**
 * Profit DELTA for a return/waste/damage event, reversing a slice of an
 * ORIGINAL sale. Always uses that original sale's own stored rates —
 * never live cost config — so a later cost-config change can't retroactively
 * change what a past return was worth.
 *
 * - Restockable returns ('return'): the bag goes back to good stock, so both
 *   the revenue and the landed-cost/local-expense "spend" for that bag are
 *   reversed. Gross/net profit deltas are smaller in magnitude than the
 *   sales delta.
 * - Non-restockable returns ('waste' / 'damage'): the bag is gone and the
 *   cost to bring it here was already sunk and isn't recovered. The client
 *   isn't charged for it, so revenue reverses in full, and — since nothing
 *   about the incurred cost changes — that same full amount drops straight
 *   through to both gross and net profit.
 */
export function computeReturnProfitDelta(params: {
  returnedBags: number;
  sellingPricePerBag: number;
  landedCostPerBag: number;
  localExpensesPerBag: number;
  isRestockable: boolean;
}): DispatchProfitFields {
  const { returnedBags, sellingPricePerBag, landedCostPerBag, localExpensesPerBag, isRestockable } =
    params;
  const totalSalesDelta = -round2(returnedBags * sellingPricePerBag);
  const grossProfitDelta = isRestockable
    ? -round2(returnedBags * (sellingPricePerBag - landedCostPerBag))
    : totalSalesDelta;
  const netProfitDelta = isRestockable
    ? -round2(returnedBags * (sellingPricePerBag - landedCostPerBag - localExpensesPerBag))
    : totalSalesDelta;
  return {
    total_sales: totalSalesDelta,
    gross_profit: grossProfitDelta,
    net_profit: netProfitDelta,
    selling_price_per_bag: sellingPricePerBag,
    landed_cost_per_bag: landedCostPerBag,
    local_expenses_per_bag: localExpensesPerBag,
  };
}
