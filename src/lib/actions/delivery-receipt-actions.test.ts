import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { createDeliveryReceipt, updateDeliveryReceipt } from './delivery-receipt-actions';

// delivery-receipt-actions transitively imports next/cache via
// notification-actions — mock it like the other action tests do.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// getCostConfig() calls requireAdmin() as a same-module reference, bypassing
// the global stub — override both here (same approach as ledger-actions.test).
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

describe('updateDeliveryReceipt — shipment stock correction in INDIVIDUAL BAGS', () => {
  it('reverses the old DR units × bag-equivalent and applies the new ones, not raw units', async () => {
    const oldDr = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      shipment_id: '550e8400-e29b-41d4-a716-446655440002',
      dr_number: 'DR-BAG-1',
      jb: 2, // stored as 2 JB UNITS = 50 bags originally deducted
      sb: 0,
      client_name: 'ACME Construction',
      client_id: null,
      driver: 'Danny Driver',
      plate_number: 'ABC1234',
      received_date: '2026-08-01',
    };
    const ledgerRow = { id: 'ledger-bag-1', delivery_receipt_id: oldDr.id };

    const shipmentPatches: Record<string, unknown>[] = [];

    server.use(
      http.get('*/rest/v1/delivery_receipts', () => HttpResponse.json(oldDr)),
      http.patch('*/rest/v1/delivery_receipts', () => HttpResponse.json([])),
      http.get('*/rest/v1/shipment_ledger', () => HttpResponse.json(ledgerRow)),
      http.patch('*/rest/v1/shipment_ledger', () => HttpResponse.json([])),
      http.get('*/rest/v1/shipments', () =>
        HttpResponse.json({ remaining_jb: 200, remaining_sb: 0, good_stock: 200 }),
      ),
      http.patch('*/rest/v1/shipments', async ({ request }) => {
        shipmentPatches.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json([]);
      }),
      http.post('*/rest/v1/activity_log', () => HttpResponse.json([])),
    );

    // The edit form (and updateDeliveryReceipt) works in INDIVIDUAL BAGS:
    // 100 bags = 4 JB units.
    const result = await updateDeliveryReceipt(oldDr.id, { jb: 100 });
    expect(result.success).toBe(true);

    // 200 bags + old 2×25 reversed − new 100 bags applied = 150.
    expect(shipmentPatches).toHaveLength(1);
    expect(shipmentPatches[0].remaining_jb).toBe(150);
    expect(shipmentPatches[0].good_stock).toBe(150);
  });

  it('rounds a fractional unit back to the whole bag it came from', async () => {
    const oldDr = {
      id: '550e8400-e29b-41d4-a716-446655440011',
      shipment_id: '550e8400-e29b-41d4-a716-446655440012',
      dr_number: 'DR-FRAC-1',
      // A manual DR for 7 JB bags stores 0.28 units.
      jb: 7 / 25,
      sb: 0,
      client_name: 'ACME Construction',
      client_id: null,
      driver: 'Danny Driver',
      plate_number: 'ABC1234',
      received_date: '2026-08-01',
    };
    const ledgerRow = { id: 'ledger-frac-1', delivery_receipt_id: oldDr.id };
    const shipmentPatches: Record<string, unknown>[] = [];

    server.use(
      http.get('*/rest/v1/delivery_receipts', () => HttpResponse.json(oldDr)),
      http.patch('*/rest/v1/delivery_receipts', () => HttpResponse.json([])),
      http.get('*/rest/v1/shipment_ledger', () => HttpResponse.json(ledgerRow)),
      http.patch('*/rest/v1/shipment_ledger', () => HttpResponse.json([])),
      http.get('*/rest/v1/shipments', () =>
        HttpResponse.json({ remaining_jb: 100, remaining_sb: 0, good_stock: 100 }),
      ),
      http.patch('*/rest/v1/shipments', async ({ request }) => {
        shipmentPatches.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json([]);
      }),
      http.post('*/rest/v1/activity_log', () => HttpResponse.json([])),
    );

    // Bump the DR to 14 bags — 14 / 25 = 0.56 units stored.
    const result = await updateDeliveryReceipt(oldDr.id, { jb: 14 });
    expect(result.success).toBe(true);

    // 100 + round(0.28×25)=7 reversed − round(0.56×25)=14 applied = 93.
    expect(shipmentPatches).toHaveLength(1);
    expect(shipmentPatches[0].remaining_jb).toBe(93);
  });
});

describe('createDeliveryReceipt — manual DR fulfils an already-dispatched PO balance', () => {
  const shipmentId = '550e8400-e29b-41d4-a716-446655440002';
  const clientId = 'ab6de10b-46d0-40a6-a454-5f3552e45fc8';
  const originalOrderId = '1a0fb8cd-8633-469f-8335-4123c7285170';
  const productId = 'b30add4d-5c8b-44d9-b8e1-562c7a4626b3';
  const poNumber = 'PO-2026-002';

  function setup(originalOrderStatus: string) {
    const balancePatches: Record<string, unknown>[] = [];
    server.use(
      http.post('*/rest/v1/delivery_receipts', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        // Valid UUID: the ledger entry's delivery_receipt_id is Zod-validated.
        return HttpResponse.json({ id: '550e8400-e29b-41d4-a716-446655440099', ...body });
      }),
      http.patch('*/rest/v1/delivery_receipts', () => HttpResponse.json([])),
      http.get('*/rest/v1/purchase_orders', () =>
        HttpResponse.json({ id: 'po-row-1', po_number: poNumber, order_id: originalOrderId }),
      ),
      // Serves both the pre-update original-order eligibility lookup and the
      // helper's original-order resolution.
      http.get('*/rest/v1/orders', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('po_number')) {
          return HttpResponse.json([{ id: originalOrderId, status: originalOrderStatus }]);
        }
        return HttpResponse.json([]);
      }),
      http.patch('*/rest/v1/orders', () => HttpResponse.json([])),
      http.get('*/rest/v1/order_items', () =>
        HttpResponse.json([
          { id: 'item-1', order_id: originalOrderId, product_id: productId, bag_type: 'JB' },
        ]),
      ),
      http.patch('*/rest/v1/order_items', () => HttpResponse.json([])),
      // addLedgerEntry (manual DR stock/profit write)
      http.get('*/rest/v1/shipments', () =>
        HttpResponse.json({ remaining_jb: 5000, remaining_sb: 5000, good_stock: 10000 }),
      ),
      http.patch('*/rest/v1/shipments', () => HttpResponse.json([])),
      http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'ledger-manual-1', ...body });
      }),
      http.get('*/rest/v1/customer_balances', () =>
        HttpResponse.json([
          {
            id: 'bal-1',
            order_id: originalOrderId,
            product_id: productId,
            bag_type: 'JB',
            remaining_qty: 100,
            status: 'pending',
          },
        ]),
      ),
      http.patch('*/rest/v1/customer_balances', async ({ request }) => {
        balancePatches.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json([]);
      }),
      http.post('*/rest/v1/notifications', () => HttpResponse.json([])),
      http.post('*/rest/v1/activity_log', () => HttpResponse.json([])),
    );
    return balancePatches;
  }

  it('clears the balance to fulfilled/0 when the original order is already dispatched', async () => {
    const balancePatches = setup('dispatched');

    const result = await createDeliveryReceipt({
      shipment_id: shipmentId,
      dr_number: 'DR-MANUAL-BAL-1',
      client_id: clientId,
      // The manual DR form is filled in with INDIVIDUAL BAGS: 100 bags = 4 JB units.
      jb: 100,
      sb: 0,
      po_number: poNumber,
    });

    expect(result.success).toBe(true);
    expect(balancePatches).toHaveLength(1);
    expect(balancePatches[0].remaining_qty).toBe(0);
    expect(balancePatches[0].status).toBe('fulfilled');
  });

  it('does NOT clear a balance for a first dispatch (order not yet dispatched)', async () => {
    const balancePatches = setup('partially_approved');

    const result = await createDeliveryReceipt({
      shipment_id: shipmentId,
      dr_number: 'DR-MANUAL-BAL-2',
      client_id: clientId,
      jb: 100,
      sb: 0,
      po_number: poNumber,
    });

    expect(result.success).toBe(true);
    expect(balancePatches).toHaveLength(0);
  });

  it('books ₱0 sales on a SECOND DR for the same PO (cumulative revenue cap)', async () => {
    setup('dispatched');

    const ledgerBodies: Record<string, unknown>[] = [];
    server.use(
      // The PO resolves to an order worth ₱10,000…
      http.get('*/rest/v1/orders', () =>
        HttpResponse.json({ id: originalOrderId, total_amount: 10000 }),
      ),
      // …and ₱10,000 is ALREADY recognized against this PO family, so there
      // is no revenue headroom left for this DR.
      http.get('*/rest/v1/shipment_ledger', () => HttpResponse.json([{ total_sales: 10000 }])),
      http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        ledgerBodies.push(body);
        return HttpResponse.json({ id: 'ledger-cap-1', ...body });
      }),
    );

    const result = await createDeliveryReceipt({
      shipment_id: shipmentId,
      dr_number: 'DR-MANUAL-CAP-1',
      client_id: clientId,
      jb: 100,
      sb: 0,
      po_number: poNumber,
    });

    expect(result.success).toBe(true);
    expect(ledgerBodies).toHaveLength(1);
    // The bag counts and delivery log still record; only the money line stops.
    expect(ledgerBodies[0].jb).toBeCloseTo(4, 10);
    expect(ledgerBodies[0].total_sales).toBe(0);
  });

  it('books the PO amount minus what is already recognized on a partial second DR', async () => {
    setup('dispatched');

    const ledgerBodies: Record<string, unknown>[] = [];
    server.use(
      http.get('*/rest/v1/orders', () =>
        HttpResponse.json({ id: originalOrderId, total_amount: 10000 }),
      ),
      http.get('*/rest/v1/shipment_ledger', () => HttpResponse.json([{ total_sales: 8000 }])),
      http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        ledgerBodies.push(body);
        return HttpResponse.json({ id: 'ledger-cap-2', ...body });
      }),
    );

    const result = await createDeliveryReceipt({
      shipment_id: shipmentId,
      dr_number: 'DR-MANUAL-CAP-2',
      client_id: clientId,
      jb: 100,
      sb: 0,
      po_number: poNumber,
    });

    expect(result.success).toBe(true);
    // ₱10,000 PO − ₱8,000 already recognized = ₱2,000 headroom left.
    expect(ledgerBodies[0].total_sales).toBe(2000);
  });

  describe('ledger source (Port/Warehouse) label', () => {
    function captureLedgerWithPoSource(source: unknown) {
      setup('dispatched');
      const ledgerBodies: Record<string, unknown>[] = [];
      server.use(
        http.get('*/rest/v1/purchase_orders', () =>
          HttpResponse.json({
            id: 'po-row-1',
            po_number: poNumber,
            order_id: originalOrderId,
            source,
          }),
        ),
        http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          ledgerBodies.push(body);
          return HttpResponse.json({ id: 'ledger-src-1', ...body });
        }),
      );
      return ledgerBodies;
    }

    it('writes the linked PO source onto the ledger row', async () => {
      const ledgerBodies = captureLedgerWithPoSource('port');

      const result = await createDeliveryReceipt({
        shipment_id: shipmentId,
        dr_number: 'DR-MANUAL-SRC-1',
        client_id: clientId,
        jb: 100,
        sb: 0,
        po_number: poNumber,
      });

      expect(result.success).toBe(true);
      expect(ledgerBodies[0].source).toBe('port');
    });

    it('an out-of-contract PO source never fails the DR — the label just stays blank', async () => {
      const ledgerBodies = captureLedgerWithPoSource('PORT');

      const result = await createDeliveryReceipt({
        shipment_id: shipmentId,
        dr_number: 'DR-MANUAL-SRC-2',
        client_id: clientId,
        jb: 100,
        sb: 0,
        po_number: poNumber,
      });

      expect(result.success).toBe(true);
      expect(ledgerBodies[0].source).toBeNull();
    });
  });
});
