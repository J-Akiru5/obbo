import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { updatePurchaseOrder } from './purchase-order-actions';

describe('PurchaseOrder Server Actions — Zod validation', () => {
  it('accepts valid partial updates', async () => {
    server.use(http.patch('*/rest/v1/purchase_orders', () => HttpResponse.json([])));

    const result = await updatePurchaseOrder('po-001', { status: 'dispatched' });
    expect(result).toEqual({ success: true });
  });

  it('rejects update with unknown fields (Zod strip)', async () => {
    // The schema does not include `hacked_field`, so it gets stripped.
    // This prevents malicious payload injection.
    server.use(
      http.patch('*/rest/v1/purchase_orders', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        // The stripped schema should not contain the hacked field
        if ('hacked_field' in body) {
          return HttpResponse.json({ error: 'Field should have been stripped' }, { status: 400 });
        }
        return HttpResponse.json([]);
      }),
    );

    const result = await updatePurchaseOrder('po-001', {
      status: 'dispatched',
      hacked_field: 'malicious value',
    } as unknown as Record<string, unknown>);
    expect(result).toEqual({ success: true });
  });

  it('rejects update with invalid field types', async () => {
    await expect(
      updatePurchaseOrder('po-001', { jb: -5 } as unknown as Record<string, unknown>),
    ).rejects.toThrow('Invalid purchase order updates');
  });

  it('rejects update with invalid enum value', async () => {
    await expect(
      updatePurchaseOrder('po-001', { source: 'invalid_source' } as unknown as Record<
        string,
        unknown
      >),
    ).rejects.toThrow('Invalid purchase order updates');
  });
});
