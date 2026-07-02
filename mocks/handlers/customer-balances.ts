import { http, HttpResponse } from 'msw';
import { mockCustomerBalances } from '../fixtures/orders';

export const customerBalanceHandlers = [
  http.get('*/rest/v1/customer_balances', ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const status = url.searchParams.get('status')?.replace('eq.', '');
    let result = [...mockCustomerBalances];
    if (id) result = result.filter((b) => b.id === id);
    if (status) result = result.filter((b) => b.status === status);
    return HttpResponse.json(result);
  }),

  http.post('*/rest/v1/customer_balances', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    mockCustomerBalances.push({
      id: `bal-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
    } as (typeof mockCustomerBalances)[0]);
    return HttpResponse.json([]);
  }),

  http.patch('*/rest/v1/customer_balances', async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const body = (await request.json()) as Record<string, unknown>;
    const idx = mockCustomerBalances.findIndex((b) => b.id === id);
    if (idx !== -1) {
      mockCustomerBalances[idx] = {
        ...mockCustomerBalances[idx],
        ...body,
      } as (typeof mockCustomerBalances)[0];
    }
    return HttpResponse.json([]);
  }),
];
