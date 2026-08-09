import { describe, it, expect } from 'vitest';
import { formatOrderItems } from './orders-client';
import type { OrderItem } from '@/lib/types/database';

// Regression test for §3.3: formatOrderItems summed jbQty + sbQty (JB/SB
// UNIT counts, two different physical denominations — 1 JB unit != 1 SB
// unit) and displayed the raw sum labeled "bags". Both understated the true
// bag count and mixed denominations as if they were the same thing.

function item(overrides: Partial<OrderItem>): OrderItem {
  return {
    id: 'item-1',
    order_id: 'order-1',
    product_id: 'product-1',
    bag_type: 'JB',
    requested_qty: 0,
    approved_qty: 0,
    dispatched_qty: 0,
    ...overrides,
  };
}

describe('formatOrderItems (regression: §3.3 denomination-mismatch bug)', () => {
  it('converts JB/SB units to individual bags before summing a mixed order', () => {
    // 4 JB units (100 bags) + 10 SB units (500 bags) = 600 bags total.
    // Buggy result was "14 bags (4 JB / 10 SB)".
    const label = formatOrderItems([
      item({ id: 'a', bag_type: 'JB', requested_qty: 4 }),
      item({ id: 'b', bag_type: 'SB', requested_qty: 10 }),
    ]);
    expect(label).toBe('600 bags (4 JB / 10 SB)');
  });

  it('converts a JB-only order to individual bags', () => {
    // 2 JB units = 50 individual bags. Buggy result was "2 JB bags".
    const label = formatOrderItems([item({ bag_type: 'JB', requested_qty: 2 })]);
    expect(label).toBe('50 bags (2 JB)');
  });

  it('converts an SB-only order to individual bags', () => {
    // 3 SB units = 150 individual bags. Buggy result was "3 SB bags".
    const label = formatOrderItems([item({ bag_type: 'SB', requested_qty: 3 })]);
    expect(label).toBe('150 bags (3 SB)');
  });

  it('reports 0 bags for an empty order', () => {
    expect(formatOrderItems([])).toBe('0 bags');
  });
});
