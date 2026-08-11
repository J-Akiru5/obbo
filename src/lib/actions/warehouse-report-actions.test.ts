import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { fetchDispatchesForDate } from './warehouse-report-actions';

// fetchDispatchesForDate replaces the old orders-derived dispatch list (see
// generateDailyReportData / app/admin/reports/page.tsx / reports-tab.tsx
// before this fix), which read orders.dr_number and filtered orders by
// updated_at. Both of those columns are overwritten on every new DR against
// the same order (see delivery-receipt-actions.ts's _createDeliveryReceipt),
// so any order dispatched more than once — split deliveries, or the same
// order touched again on a later day — silently lost all but its most
// recent DR. This suite exercises that regression directly against
// delivery_receipts, the actual source of truth (one row per DR, never
// overwritten).

interface MockDr {
  dr_number: string;
  client_name: string | null;
  po_number: string | null;
  order_id: string | null;
  jb: number;
  sb: number;
  received_date: string;
}

function parseIn(value: string | null): string[] | null {
  if (!value || !value.startsWith('in.(') || !value.endsWith(')')) return null;
  const inner = value.slice(4, -1);
  return inner === '' ? [] : inner.split(',').map(decodeURIComponent);
}

function mockDeliveryReceiptsEndpoint(drs: MockDr[]) {
  server.use(
    http.get('*/rest/v1/delivery_receipts', ({ request }) => {
      const url = new URL(request.url);
      const receivedDate = url.searchParams.get('received_date')?.replace('eq.', '');
      const result = receivedDate ? drs.filter((dr) => dr.received_date === receivedDate) : drs;
      return HttpResponse.json(result);
    }),
  );
}

function mockOrdersEndpoint(orders: { id: string; service_type: string }[]) {
  server.use(
    http.get('*/rest/v1/orders', ({ request }) => {
      const url = new URL(request.url);
      const ids = parseIn(url.searchParams.get('id'));
      const result = ids ? orders.filter((o) => ids.includes(o.id)) : orders;
      return HttpResponse.json(result);
    }),
  );
}

function mockPurchaseOrdersEndpoint(pos: { po_number: string; service_type: string }[]) {
  server.use(
    http.get('*/rest/v1/purchase_orders', ({ request }) => {
      const url = new URL(request.url);
      const poNumbers = parseIn(url.searchParams.get('po_number'));
      const result = poNumbers ? pos.filter((p) => poNumbers.includes(p.po_number)) : pos;
      return HttpResponse.json(result);
    }),
  );
}

describe('fetchDispatchesForDate', () => {
  it('returns an empty array when there are no DRs for the date', async () => {
    mockDeliveryReceiptsEndpoint([]);

    const rows = await fetchDispatchesForDate('2026-08-10');
    expect(rows).toEqual([]);
  });

  it('returns one row for a single-DR order (regression baseline)', async () => {
    mockDeliveryReceiptsEndpoint([
      {
        dr_number: 'DR-001',
        client_name: 'ACME Construction',
        po_number: 'PO-001',
        order_id: 'order-1',
        jb: 20,
        sb: 0,
        received_date: '2026-08-10',
      },
    ]);
    mockOrdersEndpoint([{ id: 'order-1', service_type: 'deliver' }]);

    const rows = await fetchDispatchesForDate('2026-08-10');
    expect(rows).toEqual([
      { client: 'ACME Construction', dr: 'DR-001', service: 'deliver', jb: 20, sb: 0 },
    ]);
  });

  it('lists every DR separately for a multi-DR-same-day split delivery (previously collapsed to the latest DR only)', async () => {
    mockDeliveryReceiptsEndpoint([
      {
        dr_number: 'DR-A',
        client_name: 'ACME Construction',
        po_number: 'PO-001',
        order_id: 'order-1',
        jb: 10,
        sb: 0,
        received_date: '2026-08-10',
      },
      {
        dr_number: 'DR-B',
        client_name: 'ACME Construction',
        po_number: 'PO-001',
        order_id: 'order-1',
        jb: 10,
        sb: 0,
        received_date: '2026-08-10',
      },
    ]);
    mockOrdersEndpoint([{ id: 'order-1', service_type: 'deliver' }]);

    const rows = await fetchDispatchesForDate('2026-08-10');
    expect(rows.map((r) => r.dr)).toEqual(['DR-A', 'DR-B']);
    expect(rows.every((r) => r.client === 'ACME Construction')).toBe(true);
  });

  it("keeps each day's report isolated — a DR on a later day does not erase an earlier day's dispatch for the same order (regression: orders.updated_at overwrite)", async () => {
    // Same order, dispatched on two different days. The old implementation
    // filtered `orders` by updated_at, which is overwritten by every new DR
    // — so re-viewing day 1's report after day 2's DR landed showed zero
    // dispatches for day 1. Reading delivery_receipts.received_date directly
    // keeps each day's DR where it belongs regardless of order state.
    mockDeliveryReceiptsEndpoint([
      {
        dr_number: 'DR-DAY1',
        client_name: 'ACME Construction',
        po_number: 'PO-001',
        order_id: 'order-1',
        jb: 10,
        sb: 0,
        received_date: '2026-08-09',
      },
      {
        dr_number: 'DR-DAY2',
        client_name: 'ACME Construction',
        po_number: 'PO-001',
        order_id: 'order-1',
        jb: 5,
        sb: 0,
        received_date: '2026-08-10',
      },
    ]);
    mockOrdersEndpoint([{ id: 'order-1', service_type: 'deliver' }]);

    const day1 = await fetchDispatchesForDate('2026-08-09');
    const day2 = await fetchDispatchesForDate('2026-08-10');
    expect(day1.map((r) => r.dr)).toEqual(['DR-DAY1']);
    expect(day2.map((r) => r.dr)).toEqual(['DR-DAY2']);
  });

  it('resolves service_type from purchase_orders for a walk-in DR with no linked order', async () => {
    mockDeliveryReceiptsEndpoint([
      {
        dr_number: 'DR-WALKIN',
        client_name: null,
        po_number: 'PO-WALKIN',
        order_id: null,
        jb: 0,
        sb: 40,
        received_date: '2026-08-10',
      },
    ]);
    mockPurchaseOrdersEndpoint([{ po_number: 'PO-WALKIN', service_type: 'pickup' }]);

    const rows = await fetchDispatchesForDate('2026-08-10');
    expect(rows).toEqual([
      { client: 'Walk-in', dr: 'DR-WALKIN', service: 'pickup', jb: 0, sb: 40 },
    ]);
  });

  it('falls back to "Walk-in"/"pickup" when a DR has no order and no matching PO', async () => {
    mockDeliveryReceiptsEndpoint([
      {
        dr_number: 'DR-ORPHAN',
        client_name: null,
        po_number: null,
        order_id: null,
        jb: 5,
        sb: 0,
        received_date: '2026-08-10',
      },
    ]);

    const rows = await fetchDispatchesForDate('2026-08-10');
    expect(rows).toEqual([{ client: 'Walk-in', dr: 'DR-ORPHAN', service: 'pickup', jb: 5, sb: 0 }]);
  });
});
