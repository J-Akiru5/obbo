import { describe, it, expect } from 'vitest';
import { createOrderForClientPortal } from './admin-helpers';

// createOrderForClientPortal takes its supabase client as a direct parameter,
// so it can be tested with a lightweight chainable mock instead of the full
// MSW/requireAdmin machinery used elsewhere in this directory.
function buildMockSupabase(products: Array<Record<string, unknown>>) {
  const insertedOrders: Record<string, unknown>[] = [];
  const insertedItems: Record<string, unknown>[] = [];

  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => Promise.resolve({ data: products, error: null }),
    insert: (payload: Record<string, unknown> | Record<string, unknown>[]) => {
      if (Array.isArray(payload)) {
        insertedItems.push(...payload);
        return { error: null };
      }
      insertedOrders.push(payload);
      return {
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'order-new-001', ...payload }, error: null }),
        }),
      };
    },
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
  };

  const supabase = { from: () => chain };
  return { supabase, insertedOrders, insertedItems };
}

const jbProduct = {
  id: 'prod-jb-001',
  bag_type: 'JB',
  price_per_bag: 250,
  price_port: 210,
  price_warehouse: 185,
};
const sbProduct = {
  id: 'prod-sb-001',
  bag_type: 'SB',
  price_per_bag: 260,
  price_port: 210,
  price_warehouse: 185,
};

describe('createOrderForClientPortal — totalAmount calculation', () => {
  it('prices SB quantity by INDIVIDUAL bag count, not unit count (regression: undercharge bug)', async () => {
    const { supabase, insertedOrders } = buildMockSupabase([jbProduct, sbProduct]);

    // The exact scenario from the reported bug: 1,200 SB units, warehouse source.
    // Correct: 1,200 * 50 individual bags * 185/bag = 11,100,000.
    // Buggy (pre-fix) result was 1,200 * 185 = 222,000.
    await createOrderForClientPortal(supabase as unknown as never, {
      clientId: 'client-001',
      poNumber: 'PO-2026-002',
      jbQty: 0,
      sbQty: 1200,
      source: 'warehouse',
      serviceType: 'pickup',
      checkNumber: null,
      checkAmount: null,
      cashAmount: null,
      photoUrl: null,
      status: 'pending',
    });

    expect(insertedOrders).toHaveLength(1);
    expect(insertedOrders[0].total_amount).toBe(11_100_000);
  });

  it("prices a mixed JB + SB order correctly using each unit type's bag equivalent", async () => {
    const { supabase, insertedOrders } = buildMockSupabase([jbProduct, sbProduct]);

    // 4 JB (100 individual bags) @ 210 + 10 SB (500 individual bags) @ 210, port source.
    await createOrderForClientPortal(supabase as unknown as never, {
      clientId: 'client-001',
      poNumber: 'PO-2026-003',
      jbQty: 4,
      sbQty: 10,
      source: 'port',
      serviceType: 'pickup',
      checkNumber: null,
      checkAmount: null,
      cashAmount: null,
      photoUrl: null,
      status: 'pending',
    });

    // (4*25*210) + (10*50*210) = 21000 + 105000 = 126000
    expect(insertedOrders[0].total_amount).toBe(126000);
  });

  it('does not override an explicit cash/check amount with the calculated total', async () => {
    const { supabase, insertedOrders } = buildMockSupabase([jbProduct, sbProduct]);

    await createOrderForClientPortal(supabase as unknown as never, {
      clientId: 'client-001',
      poNumber: 'PO-2026-004',
      jbQty: 4,
      sbQty: 0,
      source: 'port',
      serviceType: 'pickup',
      checkNumber: null,
      checkAmount: null,
      cashAmount: 5000, // explicit walk-in cash amount, unrelated to catalog price
      photoUrl: null,
      status: 'pending',
    });

    expect(insertedOrders[0].total_amount).toBe(5000);
  });
});
