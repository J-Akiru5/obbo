import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { fetchDispatchesForDate, generateDailyReportData } from './warehouse-report-actions';

// warehouse-report-actions.ts transitively imports next/cache via
// notification-actions — mock it like orders-actions.test.ts does.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// ── Fixtures ─────────────────────────────────────────────────────
// Shape mirrors a delivery_receipts row PLUS the PostgREST-embedded
// `order:orders(service_type)` join row that fetchDispatchesForDate selects.
function drRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dr-0001',
    shipment_id: 'ship-001',
    dr_number: 'DR-2026-001',
    quantity: 50,
    bag_type: 'JB',
    received_date: '2026-08-01',
    notes: null,
    po_number: 'PO-2026-100',
    client_name: 'ACME Construction',
    client_id: 'client-001',
    jb: 2,
    sb: 0,
    driver: 'Danny Driver',
    plate_number: 'ABC1234',
    shipping_fee: 0,
    dr_image_url: null,
    destination: null,
    order_id: 'order-001',
    created_at: '2026-08-01T08:00:00.000Z',
    order: { service_type: 'deliver' },
    ...overrides,
  };
}

// MSW handler that emulates PostgREST's received_date=eq.<date> filter,
// since the default mock handler ignores that query param.
function useDeliveryReceipts(rows: ReturnType<typeof drRow>[]) {
  server.use(
    http.get('*/rest/v1/delivery_receipts', ({ request }) => {
      const url = new URL(request.url);
      const date = url.searchParams.get('received_date')?.replace('eq.', '');
      return HttpResponse.json(date ? rows.filter((r) => r.received_date === date) : rows);
    }),
  );
}

function usePurchaseOrders(rows: { po_number: string; service_type: string }[]) {
  server.use(
    http.get('*/rest/v1/purchase_orders', ({ request }) => {
      const url = new URL(request.url);
      const poParam = url.searchParams.get('po_number') ?? '';
      // supabase-js .in('po_number', [...]) serializes as po_number=in.(A,B)
      if (poParam.startsWith('in.(')) {
        const wanted = poParam.slice(4, -1).split(',');
        return HttpResponse.json(rows.filter((r) => wanted.includes(r.po_number)));
      }
      return HttpResponse.json(rows);
    }),
  );
}

// ── Tests ────────────────────────────────────────────────────────

describe('fetchDispatchesForDate', () => {
  it('returns one dispatch row for a single order with a single DR (baseline)', async () => {
    useDeliveryReceipts([drRow()]);

    const rows = await fetchDispatchesForDate('2026-08-01');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      client: 'ACME Construction',
      dr: 'DR-2026-001',
      service: 'deliver',
      jb: 2,
      sb: 0,
    });
  });

  it('returns 3 dispatch rows for a single order with 3 DRs on the same day', async () => {
    useDeliveryReceipts([
      drRow({ id: 'dr-1', dr_number: 'DR-001' }),
      drRow({ id: 'dr-2', dr_number: 'DR-002' }),
      drRow({ id: 'dr-3', dr_number: 'DR-003' }),
    ]);

    const rows = await fetchDispatchesForDate('2026-08-01');

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.dr)).toEqual(['DR-001', 'DR-002', 'DR-003']);
  });

  it('returns exactly the queried day\u2019s DR when an order has DRs on different days', async () => {
    useDeliveryReceipts([
      drRow({ id: 'dr-1', dr_number: 'DR-DAY1', received_date: '2026-08-01' }),
      drRow({ id: 'dr-2', dr_number: 'DR-DAY2', received_date: '2026-08-02' }),
    ]);

    const day1 = await fetchDispatchesForDate('2026-08-01');
    const day2 = await fetchDispatchesForDate('2026-08-02');

    expect(day1.map((r) => r.dr)).toEqual(['DR-DAY1']);
    expect(day2.map((r) => r.dr)).toEqual(['DR-DAY2']);
    // Never 0 or 1 across the two days — the old orders.updated_at dependency
    // would hide DR-DAY1 once DR-DAY2 overwrote the order row.
    expect(day1.length + day2.length).toBe(2);
  });

  it('keeps a walk-in DR with no linked order, using the DR row itself', async () => {
    useDeliveryReceipts([
      drRow({
        id: 'dr-walkin',
        dr_number: 'DR-WALKIN',
        order_id: null,
        order: null,
        po_number: 'PO-WALKIN',
        client_name: 'Walk-in Buyer',
        client_id: null,
        jb: 0,
        sb: 1,
      }),
    ]);
    usePurchaseOrders([{ po_number: 'PO-WALKIN', service_type: 'deliver' }]);

    const rows = await fetchDispatchesForDate('2026-08-01');

    expect(rows).toHaveLength(1);
    expect(rows[0].client).toBe('Walk-in Buyer');
    // service_type resolved via the po_number fallback lookup
    expect(rows[0].service).toBe('deliver');
    expect(rows[0].sb).toBe(1);
  });

  it('falls back to pickup / Walk-in when a DR has no order, PO, or client name', async () => {
    useDeliveryReceipts([
      drRow({
        id: 'dr-bare',
        dr_number: 'DR-BARE',
        order_id: null,
        order: null,
        po_number: null,
        client_name: null,
        client_id: null,
      }),
    ]);

    const rows = await fetchDispatchesForDate('2026-08-01');

    expect(rows).toHaveLength(1);
    expect(rows[0].client).toBe('Walk-in');
    expect(rows[0].service).toBe('pickup');
  });

  it('rejects a malformed date parameter', async () => {
    await expect(fetchDispatchesForDate('08/01/2026')).rejects.toThrow();
  });
});

describe('generateDailyReportData dispatches', () => {
  it('includes every same-day DR (not just the order\u2019s latest)', async () => {
    useDeliveryReceipts([
      drRow({ id: 'dr-1', dr_number: 'DR-001' }),
      drRow({ id: 'dr-2', dr_number: 'DR-002' }),
      drRow({ id: 'dr-3', dr_number: 'DR-003' }),
    ]);
    server.use(
      // No prior report → yesterday's closing defaults to 0 (maybeSingle → null)
      http.get('*/rest/v1/warehouse_reports', () => HttpResponse.json(null)),
      http.get('*/rest/v1/shipments', () => HttpResponse.json([])),
      http.get('*/rest/v1/shipment_ledger', () => HttpResponse.json([])),
      http.get('*/rest/v1/customer_balances', () => HttpResponse.json([])),
    );

    const data = await generateDailyReportData('2026-08-01');

    expect(data.dispatches).toHaveLength(3);
    expect(data.dispatches.map((d) => d.dr)).toEqual(['DR-001', 'DR-002', 'DR-003']);
  });
});
