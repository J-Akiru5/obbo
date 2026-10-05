import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { updateDeliveryReceipt } from './delivery-receipt-actions';

// delivery-receipt-actions transitively imports next/cache via
// notification-actions — mock it like the other action tests do.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

describe('updateDeliveryReceipt — shipment stock correction in INDIVIDUAL BAGS', () => {
  it('reverses the old DR units × bag-equivalent and applies the new ones, not raw units', async () => {
    const oldDr = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      shipment_id: '550e8400-e29b-41d4-a716-446655440002',
      dr_number: 'DR-BAG-1',
      jb: 2, // 2 JB units = 50 bags originally deducted
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

    const result = await updateDeliveryReceipt(oldDr.id, { jb: 4 });
    expect(result.success).toBe(true);

    // 200 bags + old 2×25 reversed − new 4×25 applied = 150.
    // (Raw-unit math would incorrectly give 198.)
    expect(shipmentPatches).toHaveLength(1);
    expect(shipmentPatches[0].remaining_jb).toBe(150);
    expect(shipmentPatches[0].good_stock).toBe(150);
  });
});
