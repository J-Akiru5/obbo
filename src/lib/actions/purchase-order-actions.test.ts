import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { createPurchaseOrder, updatePurchaseOrder } from './purchase-order-actions';

describe('PurchaseOrder Server Actions — Zod validation', () => {
  it('accepts valid partial updates', async () => {
    server.use(http.patch('*/rest/v1/purchase_orders', () => HttpResponse.json([])));

    const result = await updatePurchaseOrder('po-001', { status: 'dispatched' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ success: true });
    }
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
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ success: true });
    }
  });

  it('returns a failure result (not a throw) for invalid field types', async () => {
    const result = await updatePurchaseOrder('po-001', {
      jb: -5,
    } as unknown as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch('Invalid purchase order updates');
    }
  });

  it('returns a failure result (not a throw) for invalid enum value', async () => {
    const result = await updatePurchaseOrder('po-001', {
      source: 'invalid_source',
    } as unknown as Record<string, unknown>);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch('Invalid purchase order updates');
    }
  });
});

describe('Purchase Order actions — manual forms send INDIVIDUAL BAGS', () => {
  it('updatePurchaseOrder converts bags to JB/SB units before the PATCH', async () => {
    const patches: Record<string, unknown>[] = [];
    server.use(
      http.patch('*/rest/v1/purchase_orders', async ({ request }) => {
        patches.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json([]);
      }),
    );

    // The edit form sends 100 JB bags + 50 SB bags.
    const result = await updatePurchaseOrder('po-001', { jb: 100, sb: 50 });
    expect(result.success).toBe(true);

    // Stored as UNITS: 100 bags / 25 = 4 JB, 50 bags / 50 = 1 SB — the same
    // denomination the DR List and dispatch flow already use.
    expect(patches[0]).toMatchObject({ jb: 4, sb: 1 });
  });

  it('updatePurchaseOrder keeps fractional units for partial-bag quantities', async () => {
    const patches: Record<string, unknown>[] = [];
    server.use(
      http.patch('*/rest/v1/purchase_orders', async ({ request }) => {
        patches.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json([]);
      }),
    );

    // 7 JB bags = 0.28 units — requires the numeric(14,4) column widening
    // (migration 20261012_purchase_orders_numeric_quantities.sql).
    const result = await updatePurchaseOrder('po-001', { jb: 7 });
    expect(result.success).toBe(true);
    expect(patches[0]).toMatchObject({ jb: 0.28 });
  });

  it('createPurchaseOrder converts bag quantities to units on insert', async () => {
    const inserts: Record<string, unknown>[] = [];
    server.use(
      http.post('*/rest/v1/purchase_orders', async ({ request }) => {
        inserts.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json([{ id: 'po-new' }]);
      }),
      http.post('*/rest/v1/activity_log', () => HttpResponse.json([])),
    );

    // No client_id → skips the client-portal order branch and notification.
    const result = await createPurchaseOrder({
      po_number: 'PO-TEST-001',
      client_name: 'Walk-in Client',
      client_id: null,
      jb: 150, // bags
      sb: 150, // bags
      source: 'port',
      service_type: 'pickup',
    });
    expect(result.success).toBe(true);

    // 150 JB bags = 6 units, 150 SB bags = 3 units — matching what DR-5 and
    // shipment_ledger already carry for the equivalent dispatch.
    expect(inserts[0]).toMatchObject({ jb: 6, sb: 3 });
  });
});
