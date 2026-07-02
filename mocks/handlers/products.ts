import { http, HttpResponse } from 'msw';
import { mockProducts } from '../fixtures/products';

export const productHandlers = [
  http.get('*/rest/v1/products', ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (id) {
      const product = mockProducts.find((p) => p.id === id.replace('eq.', ''));
      return HttpResponse.json(product ? [product] : []);
    }
    return HttpResponse.json(mockProducts);
  }),

  http.post('*/rest/v1/products', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newProduct = {
      id: `prod-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
    };
    mockProducts.push(newProduct as (typeof mockProducts)[0]);
    return HttpResponse.json([newProduct], {
      status: 201,
      headers: { Prefer: 'return=representation' },
    });
  }),

  http.patch('*/rest/v1/products', async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const body = (await request.json()) as Record<string, unknown>;
    const idx = mockProducts.findIndex((p) => p.id === id);
    if (idx !== -1) {
      mockProducts[idx] = { ...mockProducts[idx], ...body } as (typeof mockProducts)[0];
    }
    return HttpResponse.json([]);
  }),
];
