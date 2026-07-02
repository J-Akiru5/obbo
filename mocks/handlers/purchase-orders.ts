import { http, HttpResponse } from 'msw';
import { mockPurchaseOrders } from '../fixtures/purchase-orders';

export const purchaseOrderHandlers = [
  http.get('*/rest/v1/purchase_orders', ({ request }) => {
    const url = new URL(request.url);
    const poNumber = url.searchParams.get('po_number')?.replace('eq.', '');
    const id = url.searchParams.get('id')?.replace('eq.', '');
    let result = [...mockPurchaseOrders];
    if (poNumber) result = result.filter((po) => po.po_number === poNumber);
    if (id) result = result.filter((po) => po.id === id);
    return HttpResponse.json(result);
  }),

  http.post('*/rest/v1/purchase_orders', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newPo = {
      id: `po-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockPurchaseOrders.push(newPo as (typeof mockPurchaseOrders)[0]);
    return HttpResponse.json([newPo]);
  }),

  http.patch('*/rest/v1/purchase_orders', async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const body = (await request.json()) as Record<string, unknown>;
    const idx = mockPurchaseOrders.findIndex((po) => po.id === id);
    if (idx !== -1) {
      mockPurchaseOrders[idx] = {
        ...mockPurchaseOrders[idx],
        ...body,
        updated_at: new Date().toISOString(),
      } as (typeof mockPurchaseOrders)[0];
    }
    return HttpResponse.json([]);
  }),
];
