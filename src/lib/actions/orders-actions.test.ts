import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { fetchOrders, rejectOrder, dispatchOrder } from './orders-actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/actions/admin-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/actions/admin-helpers')>();
  return {
    ...actual,
    requireAdmin: async () => {
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
    getCostConfig: async () => ({
      landed_cost_per_bag: 147.64,
      local_expenses_per_bag: 20,
    }),
  };
});

describe('Orders Server Actions', () => {
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

  describe('rejectOrder', () => {
    it('rejects an order with a reason', async () => {
      server.use(http.patch('*/rest/v1/orders', () => HttpResponse.json([])));

      const result = await rejectOrder('order-001', 'Out of stock');
      expect(result).toEqual({ success: true });
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
        http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          capturedLedgers.push(body);
          return HttpResponse.json({ id: 'ledger-captured', ...body });
        }),
      );

      await dispatchOrder('order-profit-0', 'ship-profit-test', 'DR-PROFIT-0', null, null, null);
      await dispatchOrder(
        'order-profit-500',
        'ship-profit-test',
        'DR-PROFIT-500',
        null,
        null,
        null,
      );

      expect(capturedLedgers).toHaveLength(2);
      expect(capturedLedgers[0].total_sales).toBe(capturedLedgers[1].total_sales);
      expect(capturedLedgers[0].gross_profit).toBe(capturedLedgers[1].gross_profit);
      expect(capturedLedgers[0].net_profit).toBe(capturedLedgers[1].net_profit);
    });
  });
});
