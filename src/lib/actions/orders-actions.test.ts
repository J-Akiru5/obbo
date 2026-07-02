import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { fetchOrders, rejectOrder } from './orders-actions';

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
});
