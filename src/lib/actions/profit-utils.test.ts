import { describe, it, expect } from 'vitest';
import {
  getSourcePrice,
  computeDispatchProfit,
  prorateOrderSales,
  prorateOrderSalesByValue,
  computeReturnProfitDelta,
  individualBagsFromUnits,
  unitsFromIndividualBags,
  BAG_EQUIVALENT,
} from './profit-utils';

describe('individualBagsFromUnits (customer_balances unit-mismatch fix)', () => {
  it('converts JB units to individual bags (1 JB = 25 bags)', () => {
    expect(individualBagsFromUnits('JB', 1)).toBe(25);
    expect(individualBagsFromUnits('JB', 4)).toBe(100);
  });

  it('converts SB units to individual bags (1 SB = 50 bags)', () => {
    expect(individualBagsFromUnits('SB', 1)).toBe(50);
    expect(individualBagsFromUnits('SB', 2)).toBe(100);
  });

  it('reproduces the reported scenario: 4 JB ordered, 2 approved -> balance owed', () => {
    // Client ordered 4 JB, admin approved 2 -> owed 2 JB units = 50 individual bags,
    // NOT the raw "2" that was previously written to customer_balances.remaining_qty.
    const remainingUnits = 4 - 2;
    expect(individualBagsFromUnits('JB', remainingUnits)).toBe(50);
  });

  it('BAG_EQUIVALENT matches the domain spec constants exactly', () => {
    expect(BAG_EQUIVALENT.JB).toBe(25);
    expect(BAG_EQUIVALENT.SB).toBe(50);
  });
});

describe('unitsFromIndividualBags', () => {
  it('round-trips individual bags back to whole units for unit-aligned amounts', () => {
    expect(unitsFromIndividualBags('JB', 100)).toBe(4);
    expect(unitsFromIndividualBags('SB', 500)).toBe(10);
  });
});

describe('getSourcePrice', () => {
  it('returns price_port when source is port', () => {
    const product = { price_per_bag: 185, price_port: 210, price_warehouse: 185 };
    expect(getSourcePrice(product, 'port')).toBe(210);
  });

  it('returns price_warehouse when source is warehouse', () => {
    const product = { price_per_bag: 185, price_port: 210, price_warehouse: 185 };
    expect(getSourcePrice(product, 'warehouse')).toBe(185);
  });

  it('falls back to price_per_bag when the source-specific price is null', () => {
    const product = { price_per_bag: 185, price_port: null, price_warehouse: null };
    expect(getSourcePrice(product, 'port')).toBe(185);
    expect(getSourcePrice(product, 'warehouse')).toBe(185);
  });

  it('returns 0 for a null/undefined product', () => {
    expect(getSourcePrice(null, 'port')).toBe(0);
    expect(getSourcePrice(undefined, 'warehouse')).toBe(0);
  });

  it('a genuinely free product (price 0) is NOT overridden by price_per_bag (?? vs ||)', () => {
    // This is the exact bug the || -> ?? fix addresses: 0 is a valid price
    // and must not fall through to price_per_bag.
    const product = { price_per_bag: 185, price_port: 0, price_warehouse: 0 };
    expect(getSourcePrice(product, 'port')).toBe(0);
    expect(getSourcePrice(product, 'warehouse')).toBe(0);
  });
});

describe('computeDispatchProfit', () => {
  it('computes total_sales/gross_profit/net_profit/selling_price_per_bag correctly', () => {
    const result = computeDispatchProfit({
      totalBags: 100,
      totalSales: 18000,
      landedCostPerBag: 147.64,
      localExpensesPerBag: 20,
    });
    expect(result.selling_price_per_bag).toBe(180);
    expect(result.total_sales).toBe(18000);
    expect(result.gross_profit).toBe(3236); // 18000 - 100*147.64
    expect(result.net_profit).toBe(1236); // 18000 - 100*(147.64+20)
  });

  it('returns 0 selling_price_per_bag when totalBags is 0', () => {
    const result = computeDispatchProfit({
      totalBags: 0,
      totalSales: 0,
      landedCostPerBag: 147.64,
      localExpensesPerBag: 20,
    });
    expect(result.selling_price_per_bag).toBe(0);
  });

  it('throws on a negative or non-integer totalBags', () => {
    expect(() =>
      computeDispatchProfit({
        totalBags: -5,
        totalSales: 1000,
        landedCostPerBag: 147.64,
        localExpensesPerBag: 20,
      }),
    ).toThrow();
    expect(() =>
      computeDispatchProfit({
        totalBags: 10.5,
        totalSales: 1000,
        landedCostPerBag: 147.64,
        localExpensesPerBag: 20,
      }),
    ).toThrow();
  });
});

describe('prorateOrderSales (weight-based)', () => {
  it('prorates proportionally to weight when dispatch is partial', () => {
    // 500 total bags, dispatching 250 = half
    expect(prorateOrderSales(10000, 500, 250)).toBe(5000);
  });

  it('returns the full amount when dispatchedBags equals totalOrderBags', () => {
    expect(prorateOrderSales(10000, 500, 500)).toBe(10000);
  });

  it('throws when dispatchedBags exceeds totalOrderBags', () => {
    expect(() => prorateOrderSales(10000, 500, 600)).toThrow();
  });
});

describe('prorateOrderSalesByValue (value-based — the Issue 1 fix)', () => {
  it('prorates by DOLLAR VALUE, not weight, for mixed-price items', () => {
    // Order: 1 JB (25 bags) at 228/bag = 5700, + 100 SB (5000 bags) at 4.80/bag = 24000
    // Total order value = 29700, matching total_amount.
    // Dispatch ONLY the JB (fully approved), 0 of the SB approved.
    const items = [
      { requested_qty: 1, approved_qty: 1, selling_price_per_bag: 5700 }, // 1 JB "unit" priced as a line
      { requested_qty: 100, approved_qty: 0, selling_price_per_bag: 240 }, // 100 SB "units", none dispatched
    ];
    const result = prorateOrderSalesByValue(29700, items);
    // Value-based: only the JB's value (5700) of the total value (5700 + 24000 = 29700) ships.
    expect(result).toBe(5700);
  });

  it('matches weight-based proration when all items share the same per-bag price', () => {
    // Sanity check: if prices are uniform, value-based and weight-based agree.
    const items = [
      { requested_qty: 4, approved_qty: 2, selling_price_per_bag: 4500 }, // half approved
    ];
    const result = prorateOrderSalesByValue(18000, items);
    expect(result).toBe(9000);
  });

  it('throws on an empty items array', () => {
    expect(() => prorateOrderSalesByValue(1000, [])).toThrow();
  });

  it('throws when approved_qty exceeds requested_qty on any item', () => {
    const items = [{ requested_qty: 5, approved_qty: 10, selling_price_per_bag: 100 }];
    expect(() => prorateOrderSalesByValue(1000, items)).toThrow();
  });

  it('throws when total order value is zero (all prices zero)', () => {
    const items = [{ requested_qty: 5, approved_qty: 5, selling_price_per_bag: 0 }];
    expect(() => prorateOrderSalesByValue(1000, items)).toThrow();
  });
});

describe('computeReturnProfitDelta', () => {
  it('restockable return reverses sales, landed cost, AND local expenses', () => {
    const result = computeReturnProfitDelta({
      returnedBags: 5,
      sellingPricePerBag: 250,
      landedCostPerBag: 147.64,
      localExpensesPerBag: 20,
      isRestockable: true,
    });
    expect(result.total_sales).toBe(-1250); // -5 * 250
    expect(result.gross_profit).toBeCloseTo(-511.8, 2); // -5 * (250 - 147.64)
    // The regression fix: net now ALSO recovers local expenses for restockable returns.
    expect(result.net_profit).toBeCloseTo(-411.8, 2); // -5 * (250 - 147.64 - 20)
  });

  it('waste/damage return reverses sales only — cost is sunk on both lines', () => {
    const result = computeReturnProfitDelta({
      returnedBags: 5,
      sellingPricePerBag: 250,
      landedCostPerBag: 147.64,
      localExpensesPerBag: 20,
      isRestockable: false,
    });
    expect(result.total_sales).toBe(-1250);
    expect(result.gross_profit).toBe(-1250);
    expect(result.net_profit).toBe(-1250);
  });

  it('throws on zero or negative returnedBags', () => {
    expect(() =>
      computeReturnProfitDelta({
        returnedBags: 0,
        sellingPricePerBag: 250,
        landedCostPerBag: 147.64,
        localExpensesPerBag: 20,
        isRestockable: true,
      }),
    ).toThrow();
  });
});
