import { http, HttpResponse } from 'msw';
import { mockDeliveryReceipts } from '../fixtures/delivery-receipts';

export const deliveryReceiptHandlers = [
  http.get('*/rest/v1/delivery_receipts', ({ request }) => {
    const url = new URL(request.url);
    const drNumber = url.searchParams.get('dr_number')?.replace('eq.', '');
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const deliveryReceiptId = url.searchParams.get('delivery_receipt_id')?.replace('eq.', '');
    let result = [...mockDeliveryReceipts];
    if (drNumber) result = result.filter((dr) => dr.dr_number === drNumber);
    if (id) result = result.filter((dr) => dr.id === id);
    if (deliveryReceiptId) result = result.filter((dr) => dr.id === deliveryReceiptId);
    return HttpResponse.json(result);
  }),

  http.post('*/rest/v1/delivery_receipts', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newDr = {
      id: `dr-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
    };
    mockDeliveryReceipts.push(newDr as (typeof mockDeliveryReceipts)[0]);
    return HttpResponse.json([newDr]);
  }),

  http.patch('*/rest/v1/delivery_receipts', async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const body = (await request.json()) as Record<string, unknown>;
    const idx = mockDeliveryReceipts.findIndex((dr) => dr.id === id);
    if (idx !== -1) {
      mockDeliveryReceipts[idx] = {
        ...mockDeliveryReceipts[idx],
        ...body,
      } as (typeof mockDeliveryReceipts)[0];
    }
    return HttpResponse.json([]);
  }),
];
