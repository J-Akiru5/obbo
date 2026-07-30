import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchOrder, finalConfirmCheck } from './orders-actions';

// ── Mock Supabase client ─────────────────────────────────────────
// BUG-3 tests need precise control over join-query responses, which
// MSW can't easily provide (embedded items/client get stripped during
// Supabase's .single() parsing). We mock at the module level instead.

const { mockSupabase, setTableData, clearTableData } = vi.hoisted(() => {
  const store = new Map<string, any>();

  function resultFor(table: string) {
    return { data: store.get(table) ?? null, error: null };
  }

  function thenable(handler: () => any) {
    const obj: Record<string, any> = {};
    obj.eq = () => obj;
    obj.then = (resolve: (v: any) => any) => Promise.resolve(handler()).then(resolve);
    return obj;
  }

  function buildChain(table: string) {
    const chain: Record<string, any> = {};

    chain.select = () => chain;
    chain.eq = () => chain;
    chain.order = () => chain;

    chain.single = () => thenable(() => resultFor(table));
    chain.maybeSingle = () => thenable(() => resultFor(table));
    chain.insert = (data: any) => thenable(() => ({ data, error: null }));
    chain.update = (data: any) => thenable(() => ({ data, error: null }));
    chain.upsert = (_data: any) => ({
      select: () => ({
        single: () => thenable(() => ({ data: { id: 'dr-new-001' }, error: null })),
      }),
      then: (resolve: (v: any) => any) =>
        Promise.resolve({ data: null, error: null }).then(resolve),
    });

    chain.then = (resolve: (v: any) => any) => Promise.resolve(resultFor(table)).then(resolve);

    return chain;
  }

  const mockFrom = vi.fn((table: string) => buildChain(table));

  function rpcResult() {
    return {
      then: (resolve: (v: any) => any) =>
        Promise.resolve(store.get('rpc:dispatch_order_v2') ?? { data: null, error: null }).then(
          resolve,
        ),
    };
  }

  const mockSupabaseObj = {
    from: mockFrom,
    rpc: vi.fn((_name: string, _params: any) => rpcResult()),
  };

  return {
    mockSupabase: mockSupabaseObj,
    setTableData: (table: string, data: any) => store.set(table, data),
    clearTableData: () => store.clear(),
  };
});

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/actions/admin-helpers', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/actions/admin-helpers')>();
  return {
    ...mod,
    requireAdmin: async () => ({
      supabase: mockSupabase,
      userId: 'admin-001',
      role: 'admin' as const,
    }),
    getCostConfig: async () => ({
      landed_cost_per_bag: 147.64,
      local_expenses_per_bag: 20,
    }),
  };
});

// ── Fixtures ──────────────────────────────────────────────────────

const orderFixture = {
  id: 'order-001',
  client_id: 'client-001',
  status: 'pending',
  total_amount: 5000,
  payment_method: 'cash',
  po_number: 'PO-2026-001',
  po_image_url: null,
  source: 'warehouse',
  service_type: 'pickup',
  shipping_fee: 0,
  tracking_status: 'pending_dispatch',
  order_type: 'new',
  is_split_delivery: false,
  deliver_now_jb: null,
  deliver_now_sb: null,
  deliver_now_qty: null,
  check_number: null,
  linked_po_number: null,
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
  client: {
    id: 'client-001',
    full_name: 'Juan Dela Cruz',
    company_name: 'ACME Construction',
    email: 'juan@acme.com',
    phone: '09171234567',
    avatar_url: null,
    address_street: '123 Rizal St',
    address_city: 'Manila',
    address_province: 'NCR',
  },
  items: [
    {
      id: 'item-001',
      order_id: 'order-001',
      product_id: 'prod-jb-001',
      bag_type: 'JB',
      requested_qty: 100,
      approved_qty: 0,
      dispatched_qty: 0,
      product: { name: 'Portland Cement Type 1', bag_type: 'JB', price_per_bag: 250 },
    },
  ],
};

const shipmentFixture = {
  id: 'ship-001',
  batch_name: 'BATCH-TEST-001',
  remaining_jb: 500,
  remaining_sb: 500,
  good_stock: 1000,
};

// ── Tests ─────────────────────────────────────────────────────────

describe('BUG-3: dispatchOrder', () => {
  beforeEach(() => {
    clearTableData();
    // dispatchOrder uses .single() on orders and shipments,
    // so store single objects (not arrays)
    setTableData('orders', orderFixture);
    setTableData('shipments', shipmentFixture);
    setTableData('purchase_orders', null);
    setTableData('delivery_receipts', null);
    setTableData('customer_balances', null);
    setTableData('rpc:dispatch_order_v2', {
      data: { success: true, dr_id: 'dr-new-001' },
      error: null,
    });
  });

  it('throws when no approved quantity exists', async () => {
    await expect(
      dispatchOrder('order-001', 'ship-001', 'DR-TEST-ZERO', null, 'Driver', 'PLATE'),
    ).rejects.toThrow(/no approved quantity/i);
  });

  it('throws when order is already dispatched', async () => {
    setTableData('orders', { ...orderFixture, status: 'dispatched' });

    await expect(
      dispatchOrder('order-001', 'ship-001', 'DR-TEST-DISP', null, 'Driver', 'PLATE'),
    ).rejects.toThrow(/already been dispatched/i);
  });

  it('succeeds on happy path with approved quantities', async () => {
    const approvedItems = orderFixture.items.map((item) => ({ ...item, approved_qty: 100 }));
    setTableData('orders', { ...orderFixture, items: approvedItems });

    const result = await dispatchOrder(
      'order-001',
      'ship-001',
      'DR-TEST-HAPPY',
      null,
      'Happy Driver',
      'HAPPY1',
    );
    expect(result).toEqual({ success: true });
  });
});

describe('BUG-3: finalConfirmCheck', () => {
  beforeEach(() => {
    clearTableData();
    setTableData('orders', orderFixture);
  });

  it('backfills approved_qty for never-approved orders', async () => {
    const result = await finalConfirmCheck('order-001');
    expect(result).toEqual({ success: true });
  });
});
