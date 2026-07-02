import { http, HttpResponse } from 'msw';
import { mockOrderItems } from '../fixtures/orders';

export const orderItemHandlers = [
  http.get('*/rest/v1/order_items', ({ request }) => {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('order_id')?.replace('eq.', '');
    if (orderId) {
      return HttpResponse.json(mockOrderItems.filter((i) => i.order_id === orderId));
    }
    return HttpResponse.json(mockOrderItems);
  }),

  http.post('*/rest/v1/order_items', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const items = Array.isArray(body) ? body : [body];
    for (const item of items) {
      mockOrderItems.push({
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...item,
      } as (typeof mockOrderItems)[0]);
    }
    return HttpResponse.json([]);
  }),

  http.patch('*/rest/v1/order_items', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const idx = mockOrderItems.findIndex((i) => i.id === id);
    if (idx !== -1) {
      mockOrderItems[idx] = { ...mockOrderItems[idx], ...body } as (typeof mockOrderItems)[0];
    }
    return HttpResponse.json([]);
  }),
];
