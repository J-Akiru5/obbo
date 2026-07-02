import { http, HttpResponse } from 'msw';
import { mockOrders } from '../fixtures/orders';

let orderIdCounter = 100;

export const orderHandlers = [
  http.get('*/rest/v1/orders', ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const status = url.searchParams.get('status')?.replace('eq.', '');
    const orderId = url.searchParams.get('order_id')?.replace('eq.', '');

    let result = [...mockOrders];
    if (id) result = result.filter((o) => o.id === id);
    if (status) result = result.filter((o) => o.status === status);
    if (orderId) result = result.filter((o) => o.id === orderId);

    return HttpResponse.json(result);
  }),

  http.post('*/rest/v1/orders', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newOrder = {
      id: `order-${++orderIdCounter}`,
      status: 'pending',
      tracking_status: 'pending_dispatch',
      order_type: 'new',
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockOrders.push(newOrder as (typeof mockOrders)[0]);
    return HttpResponse.json([newOrder]);
  }),

  http.patch('*/rest/v1/orders', async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const body = (await request.json()) as Record<string, unknown>;
    const idx = mockOrders.findIndex((o) => o.id === id);
    if (idx !== -1) {
      mockOrders[idx] = {
        ...mockOrders[idx],
        ...body,
        updated_at: new Date().toISOString(),
      } as (typeof mockOrders)[0];
    }
    return HttpResponse.json([]);
  }),
];
