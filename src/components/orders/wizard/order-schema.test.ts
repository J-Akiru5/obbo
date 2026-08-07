import { describe, it, expect } from 'vitest';
import {
  getTotalIndividualBags,
  getSubtotal,
  getSubtotalByBagType,
  getSplitDeliveryUnits,
} from './order-schema';

describe('getTotalIndividualBags', () => {
  it('converts JB/SB unit counts to individual 40kg bag counts (1 JB=25, 1 SB=50)', () => {
    expect(getTotalIndividualBags(1, 0)).toBe(25);
    expect(getTotalIndividualBags(0, 1)).toBe(50);
    expect(getTotalIndividualBags(4, 10)).toBe(4 * 25 + 10 * 50); // 600
  });

  it('reproduces the reported screenshot scenario: 1,200 SB units', () => {
    expect(getTotalIndividualBags(0, 1200)).toBe(60_000);
  });
});

describe('getSubtotal', () => {
  it('multiplies an already-converted individual-bag count by price', () => {
    expect(getSubtotal(100, 185)).toBe(18500);
  });
});

describe('getSubtotalByBagType (regression: 25x/50x undercharge bug)', () => {
  it('prices SB quantity by individual bag count, not raw unit count', () => {
    // Exact reported bug: 1,200 SB @ 185 warehouse price.
    // Buggy result was 222,000 (1,200 * 185). Correct is 11,100,000.
    const subtotal = getSubtotalByBagType(0, 1200, 0, 185);
    expect(subtotal).toBe(11_100_000);
    expect(subtotal).not.toBe(222_000);
  });

  it('prices JB quantity by individual bag count, not raw unit count', () => {
    // 1 JB @ 210 port price. Buggy result would be 210. Correct is 25*210=5250.
    expect(getSubtotalByBagType(1, 0, 210, 0)).toBe(5250);
  });

  it('correctly sums a mixed JB + SB order with different per-bag prices', () => {
    // 4 JB @ 210 (100 bags) + 10 SB @ 185 (500 bags)
    // = (4*25*210) + (10*50*185) = 21000 + 92500 = 113500
    expect(getSubtotalByBagType(4, 10, 210, 185)).toBe(113500);
  });

  it('returns 0 for an empty order', () => {
    expect(getSubtotalByBagType(0, 0, 210, 185)).toBe(0);
  });
});

describe('getSplitDeliveryUnits (regression: bags-vs-units split bug)', () => {
  it('splits a bag-denominated amount into whole units by bag-share, not unit-share', () => {
    // 4 JB (100 bags) + 10 SB (500 bags) = 600 bags total. Deliver 300 now.
    // JB share in bags is 100/600 → 50 JB bags = 2 JB units; remainder 250 bags = 5 SB units.
    // The old code used jbQty UNITS / total BAGS (4/600) and then subtracted
    // units from bags, recording 2 JB + 10 SB = 550 bags for a 300-bag request.
    expect(getSplitDeliveryUnits(4, 10, 300)).toEqual({ deliverNowJB: 2, deliverNowSB: 5 });
  });

  it('allocated bags add up to the requested amount when units divide evenly', () => {
    const { deliverNowJB, deliverNowSB } = getSplitDeliveryUnits(4, 10, 300);
    expect(deliverNowJB * 25 + deliverNowSB * 50).toBe(300);
  });

  it('allocates the full order when delivering everything now', () => {
    expect(getSplitDeliveryUnits(4, 10, 600)).toEqual({ deliverNowJB: 4, deliverNowSB: 10 });
  });

  it('handles JB-only and SB-only orders', () => {
    expect(getSplitDeliveryUnits(2, 0, 50)).toEqual({ deliverNowJB: 2, deliverNowSB: 0 });
    expect(getSplitDeliveryUnits(2, 0, 25)).toEqual({ deliverNowJB: 1, deliverNowSB: 0 });
    expect(getSplitDeliveryUnits(0, 3, 100)).toEqual({ deliverNowJB: 0, deliverNowSB: 2 });
  });

  it('clamps to the ordered quantity and never exceeds available units per type', () => {
    const result = getSplitDeliveryUnits(4, 10, 10_000);
    expect(result).toEqual({ deliverNowJB: 4, deliverNowSB: 10 });
    expect(result.deliverNowJB).toBeLessThanOrEqual(4);
    expect(result.deliverNowSB).toBeLessThanOrEqual(10);
  });

  it('returns zero units for a zero/negative amount or an empty order', () => {
    expect(getSplitDeliveryUnits(4, 10, 0)).toEqual({ deliverNowJB: 0, deliverNowSB: 0 });
    expect(getSplitDeliveryUnits(4, 10, -50)).toEqual({ deliverNowJB: 0, deliverNowSB: 0 });
    expect(getSplitDeliveryUnits(0, 0, 100)).toEqual({ deliverNowJB: 0, deliverNowSB: 0 });
  });
});
