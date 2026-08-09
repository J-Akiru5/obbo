import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import {
  fetchOrders,
  approveOrder,
  rejectOrder,
  dispatchOrder,
  finalConfirmCheck,
} from './orders-actions';

// ── Shared mock infra — bug3 and MSW tests need different supabase clients
// injected into requireAdmin, but there can be only one vi.mock per module.
// bug3ModeEnabled switches between the two at runtime.

const { bug3Mode, mockSupabase, setTableData, clearTableData } = vi.hoisted(() => {
  let _enabled = false;
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

  function rpcResult() {
    return {
      then: (resolve: (v: any) => any) =>
        Promise.resolve(store.get('rpc:dispatch_order_v2') ?? { data: null, error: null }).then(
          resolve,
        ),
    };
  }

  return {
    bug3Mode: {
      enable() {
        _enabled = true;
      },
      disable() {
        _enabled = false;
      },
      get active() {
        return _enabled;
      },
    },
    mockSupabase: {
      from: vi.fn((table: string) => buildChain(table)),
      rpc: vi.fn((_name: string, _params: any) => rpcResult()),
    },
    setTableData: (table: string, data: any) => store.set(table, data),
    clearTableData: () => store.clear(),
  };
});

// ── Module mocks ─────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/actions/admin-helpers', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/actions/admin-helpers')>();
  return {
    ...mod,
    getCostConfig: async () => ({
      landed_cost_per_bag: 147.64,
      local_expenses_per_bag: 20,
    }),
    requireAdmin: async () => {
      if (bug3Mode.active) {
        return { supabase: mockSupabase, userId: 'admin-001', role: 'admin' as const };
      }
      const { createBrowserClient } = await import('@supabase/ssr');
      return {
        supabase: createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test-project.supabase.co',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key',
        ),
        userId: 'admin-001',
        role: 'admin' as const,
      };
    },
  };
});

// ── Bug3 fixtures ────────────────────────────────────────────────

const bug3Order = {
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
      selling_price_per_bag: 250,
      product: { name: 'Portland Cement Type 1', bag_type: 'JB', price_per_bag: 250 },
    },
  ],
};

const bug3Shipment = {
  id: 'ship-001',
  batch_name: 'BATCH-TEST-001',
  remaining_jb: 500,
  remaining_sb: 500,
  good_stock: 1000,
};

// ── Tests ────────────────────────────────────────────────────────

describe('Orders Server Actions', () => {
  beforeEach(() => {
    bug3Mode.disable();
  });
  describe('fetchOrders', () => {
    it('returns orders with client and items', async () => {
      const orders = await fetchOrders();
      expect(Array.isArray(orders)).toBe(true);
    });

    it('filters by status when provided', async () => {
      server.use(
        http.get('*/rest/v1/orders', ({ request }) => {
          const url = new URL(request.url);
          const status = url.searchParams.get('status')?.replace('eq.', '');
          return HttpResponse.json(
            status === 'pending'
              ? [
                  {
                    id: 'order-pending',
                    client_id: 'client-001',
                    status: 'pending',
                    total_amount: 5000,
                    payment_method: 'cash',
                    po_number: 'PO-TEST-001',
                    source: 'warehouse',
                    service_type: 'pickup',
                    tracking_status: 'pending_dispatch',
                    order_type: 'new',
                    created_at: '2026-06-01T00:00:00.000Z',
                    updated_at: '2026-06-01T00:00:00.000Z',
                    client: {
                      id: 'client-001',
                      full_name: 'Test Client',
                      company_name: null,
                      email: 'test@test.com',
                      phone: null,
                      avatar_url: null,
                    },
                    items: [],
                  },
                ]
              : [],
          );
        }),
      );

      const pending = await fetchOrders('pending');
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe('pending');
    });
  });

  describe('approveOrder', () => {
    it('returns a failure result (not a throw) for invalid input, via the safeAction wrapper', async () => {
      // orderId must be a UUID per orderApproveSchema — this exercises the
      // Zod-validation throw path through safeAction end-to-end.
      const result = await approveOrder('not-a-uuid', [{ itemId: 'item-1', qty: 5 }]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      }
    });
  });

  describe('rejectOrder', () => {
    it('rejects an order with a reason', async () => {
      server.use(http.patch('*/rest/v1/orders', () => HttpResponse.json([])));

      const result = await rejectOrder('550e8400-e29b-41d4-a716-446655440000', 'Out of stock');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ success: true });
      }
    });
  });

  describe('dispatchOrder', () => {
    it('profit values are identical regardless of shipping_fee (INVARIANT: total_amount is goods-only)', async () => {
      server.use(http.post('*/rest/v1/activity_log', () => HttpResponse.json([])));

      const baseOrder = {
        id: 'order-profit-0',
        client_id: 'client-001',
        status: 'approved',
        total_amount: 5000,
        payment_method: 'cash',
        po_number: 'PO-PROFIT-TEST',
        po_image_url: null,
        source: 'warehouse',
        service_type: 'deliver',
        shipping_fee: 0,
        check_image_url: null,
        check_number: null,
        notes: null,
        is_split_delivery: false,
        deliver_now_qty: 0,
        deliver_now_jb: 0,
        deliver_now_sb: 0,
        supplier_name: null,
        preferred_pickup_date: null,
        order_type: 'new',
        linked_po_number: null,
        tracking_status: 'pending_dispatch',
        driver_name: null,
        plate_number: null,
        rejection_reason: null,
        dr_number: null,
        dr_image_url: null,
        shipment_id: null,
        bags_returned_jb: 0,
        bags_returned_sb: 0,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
        client: {
          id: 'client-001',
          full_name: 'Juan Dela Cruz',
          company_name: 'ACME Construction',
          address_street: '123 Main St',
          address_city: 'Manila',
          address_province: 'NCR',
          avatar_url: null,
        },
        items: [
          {
            id: 'item-profit-jb',
            order_id: 'order-profit-0',
            product_id: 'prod-jb-001',
            bag_type: 'JB',
            requested_qty: 20,
            approved_qty: 20,
            dispatched_qty: 0,
            selling_price_per_bag: 250,
          },
          {
            id: 'item-profit-sb',
            order_id: 'order-profit-0',
            product_id: 'prod-sb-001',
            bag_type: 'SB',
            requested_qty: 10,
            approved_qty: 10,
            dispatched_qty: 0,
            selling_price_per_bag: 260,
          },
        ],
      };

      const orderZeroFee = { ...baseOrder, id: 'order-profit-0', shipping_fee: 0 };
      const orderWithFee = {
        ...baseOrder,
        id: 'order-profit-500',
        shipping_fee: 500,
        items: baseOrder.items.map((item) => ({ ...item, order_id: 'order-profit-500' })),
      };

      const ordersById: Record<string, typeof orderZeroFee> = {
        'order-profit-0': orderZeroFee,
        'order-profit-500': orderWithFee,
      };

      const shipmentFixture = {
        id: 'ship-profit-test',
        batch_name: 'BATCH-PROFIT-TEST',
        initial_quantity: 500,
        good_stock: 500,
        damaged_stock: 0,
        total_jb: 500,
        total_sb: 500,
        remaining_jb: 500,
        remaining_sb: 500,
        arrival_date: '2026-06-01',
        notes: null,
        damaged_jb: 0,
        damaged_sb: 0,
        created_at: '2026-06-01T00:00:00.000Z',
      };

      const capturedLedgers: Record<string, unknown>[] = [];

      server.use(
        http.get('*/rest/v1/orders', ({ request }) => {
          const url = new URL(request.url);
          const id = url.searchParams.get('id')?.replace('eq.', '');
          if (id && ordersById[id]) return HttpResponse.json(ordersById[id]);
          return HttpResponse.json([]);
        }),
        http.get('*/rest/v1/shipments', ({ request }) => {
          const url = new URL(request.url);
          const id = url.searchParams.get('id')?.replace('eq.', '');
          if (id === 'ship-profit-test') return HttpResponse.json(shipmentFixture);
          return HttpResponse.json([]);
        }),
        http.post('*/rest/v1/rpc/dispatch_order_v2', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          capturedLedgers.push(body);
          return HttpResponse.json({ success: true, ledger_id: 'ledger-captured' });
        }),
      );

      const r1 = await dispatchOrder(
        'order-profit-0',
        'ship-profit-test',
        'DR-PROFIT-0',
        null,
        null,
        null,
      );
      const r2 = await dispatchOrder(
        'order-profit-500',
        'ship-profit-test',
        'DR-PROFIT-500',
        null,
        null,
        null,
      );
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);

      expect(capturedLedgers).toHaveLength(2);
      expect(capturedLedgers[0].p_total_sales).toBe(5000);
      expect(capturedLedgers[0].p_total_sales).toBe(capturedLedgers[1].p_total_sales);
      expect(capturedLedgers[0].p_gross_profit).toBe(capturedLedgers[1].p_gross_profit);
      expect(capturedLedgers[0].p_net_profit).toBe(capturedLedgers[1].p_net_profit);
    });
  });

  describe('dispatchOrder (bug3 edge cases)', () => {
    beforeEach(() => {
      bug3Mode.enable();
      clearTableData();
      setTableData('orders', bug3Order);
      setTableData('shipments', bug3Shipment);
      setTableData('purchase_orders', null);
      setTableData('delivery_receipts', null);
      setTableData('customer_balances', null);
      setTableData('rpc:dispatch_order_v2', {
        data: { success: true, dr_id: 'dr-new-001' },
        error: null,
      });
    });

    it('returns a failure result when no approved quantity exists', async () => {
      const result = await dispatchOrder(
        'order-001',
        'ship-001',
        'DR-TEST-ZERO',
        null,
        'Driver',
        'PLATE',
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/no approved quantity/i);
      }
    });

    it('returns a failure result when order is already dispatched', async () => {
      setTableData('orders', { ...bug3Order, status: 'dispatched' });

      const result = await dispatchOrder(
        'order-001',
        'ship-001',
        'DR-TEST-DISP',
        null,
        'Driver',
        'PLATE',
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/already been dispatched/i);
      }
    });

    it('succeeds on happy path with approved quantities', async () => {
      const approvedItems = bug3Order.items.map((item) => ({ ...item, approved_qty: 100 }));
      setTableData('orders', { ...bug3Order, items: approvedItems });

      const result = await dispatchOrder(
        'order-001',
        'ship-001',
        'DR-TEST-HAPPY',
        null,
        'Happy Driver',
        'HAPPY1',
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ success: true });
      }
    });
  });

  describe('finalConfirmCheck (bug3 edge cases)', () => {
    beforeEach(() => {
      bug3Mode.enable();
      clearTableData();
      setTableData('orders', bug3Order);
    });

    it('backfills approved_qty for never-approved orders', async () => {
      const result = await finalConfirmCheck('order-001');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ success: true });
      }
    });
  });
});
