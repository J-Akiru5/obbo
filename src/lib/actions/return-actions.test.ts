import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { fetchOrderReturns, approveOrderReturn, rejectOrderReturn } from './return-actions';

// requireAdmin is globally stubbed in vitest.setup.ts. approveOrderReturn's
// internal call to applyBagReturnToLedger -> addLedgerEntry never hits the
// dispatch (getCostConfig) branch here since these are all return rows, so
// no admin-helpers override is needed beyond the global stub.

const pendingReturnId = '550e8400-e29b-41d4-a716-446655440020';
const orderId = '550e8400-e29b-41d4-a716-446655440021';

const pendingReturnFixture = {
  id: pendingReturnId,
  order_id: orderId,
  client_id: 'client-001',
  jb_qty: 5,
  sb_qty: 0,
  reason: 'Bags arrived damaged',
  status: 'pending',
  admin_note: null,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
  order: {
    po_number: 'PO-RET-001',
    dr_number: 'DR-RET-001',
    client: { full_name: 'Juan Dela Cruz', company_name: 'ACME Construction' },
  },
};

const orderFixture = {
  id: orderId,
  shipment_id: 'ship-ret-001',
  po_number: 'PO-RET-001',
  dr_number: 'DR-RET-001',
  client_id: 'client-001',
  bags_returned_jb: 0,
  bags_returned_sb: 0,
};

const originalDispatchLedgerRow = {
  id: 'ledger-ret-original',
  shipment_id: 'ship-ret-001',
  dr_number: 'DR-RET-001',
  jb: 20,
  sb: 0,
  selling_price_per_bag: 250,
  landed_cost_per_bag: 147.64,
  local_expenses_per_bag: 20,
  created_at: '2026-06-01T00:00:00.000Z',
};

describe('Return Server Actions', () => {
  describe('fetchOrderReturns', () => {
    it('returns the joined order/client shape for pending requests', async () => {
      server.use(
        http.get('*/rest/v1/order_returns', () => HttpResponse.json([pendingReturnFixture])),
      );

      const returns = await fetchOrderReturns();
      expect(returns).toHaveLength(1);
      expect((returns[0] as typeof pendingReturnFixture).order.po_number).toBe('PO-RET-001');
    });
  });

  describe('approveOrderReturn', () => {
    let patchedReturns: Record<string, unknown>[];
    let patchedOrders: Record<string, unknown>[];
    let postedLedgerEntries: Record<string, unknown>[];

    const setupApproveMocks = () => {
      patchedReturns = [];
      patchedOrders = [];
      postedLedgerEntries = [];
      server.use(
        http.get('*/rest/v1/order_returns', () => HttpResponse.json(pendingReturnFixture)),
        http.patch('*/rest/v1/order_returns', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          patchedReturns.push(body);
          return HttpResponse.json([]);
        }),
        http.get('*/rest/v1/orders', () => HttpResponse.json(orderFixture)),
        http.patch('*/rest/v1/orders', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          patchedOrders.push(body);
          return HttpResponse.json([]);
        }),
        http.get('*/rest/v1/profiles', () =>
          HttpResponse.json({ id: 'client-001', full_name: 'Juan Dela Cruz', company_name: null }),
        ),
        http.get('*/rest/v1/delivery_receipts', () =>
          HttpResponse.json({ id: '550e8400-e29b-41d4-a716-446655440099' }),
        ),
        http.get('*/rest/v1/shipment_ledger', () => HttpResponse.json(originalDispatchLedgerRow)),
        http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          postedLedgerEntries.push(body);
          return HttpResponse.json({ id: `ledger-new-${postedLedgerEntries.length}`, ...body });
        }),
        http.get('*/rest/v1/shipments', () =>
          HttpResponse.json({ id: 'ship-ret-001', remaining_jb: 100, remaining_sb: 100 }),
        ),
        http.patch('*/rest/v1/shipments', () => HttpResponse.json([])),
        http.post('*/rest/v1/activity_log', () => HttpResponse.json([])),
      );
    };

    it.each(['return', 'waste', 'damage'] as const)(
      'approving with reason "%s" writes a ledger entry with that exact return_reason',
      async (reason) => {
        setupApproveMocks();

        const result = await approveOrderReturn(pendingReturnId, reason);

        expect(result.success).toBe(true);
        expect(postedLedgerEntries).toHaveLength(1);
        expect(postedLedgerEntries[0].return_reason).toBe(reason);
        expect(postedLedgerEntries[0].bag_returned_type).toBe('JB');
      },
    );

    it('increments orders.bags_returned_jb/sb and flips order_returns.status to "approved"', async () => {
      setupApproveMocks();

      const result = await approveOrderReturn(pendingReturnId, 'return');

      expect(result.success).toBe(true);
      expect(patchedOrders).toHaveLength(1);
      expect(patchedOrders[0].bags_returned_jb).toBe(5);
      expect(patchedOrders[0].bags_returned_sb).toBe(0);
      expect(patchedReturns).toHaveLength(1);
      expect(patchedReturns[0].status).toBe('approved');
    });

    it('fails cleanly (not a throw) when the return request is not pending', async () => {
      server.use(
        http.get('*/rest/v1/order_returns', () =>
          HttpResponse.json({ ...pendingReturnFixture, status: 'approved' }),
        ),
      );

      const result = await approveOrderReturn(pendingReturnId, 'return');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/already been resolved/i);
      }
    });
  });

  describe('rejectOrderReturn', () => {
    const setupRejectMocks = () => {
      const patched: Record<string, unknown>[] = [];
      server.use(
        http.get('*/rest/v1/order_returns', () => HttpResponse.json(pendingReturnFixture)),
        http.patch('*/rest/v1/order_returns', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          patched.push(body);
          return HttpResponse.json([]);
        }),
        http.post('*/rest/v1/activity_log', () => HttpResponse.json([])),
      );
      return patched;
    };

    it('sets status "rejected" and stores the admin note', async () => {
      const patched = setupRejectMocks();

      const result = await rejectOrderReturn(pendingReturnId, 'Return window has expired');

      expect(result.success).toBe(true);
      expect(patched).toHaveLength(1);
      expect(patched[0].status).toBe('rejected');
      expect(patched[0].admin_note).toBe('Return window has expired');
    });

    it('stores a null admin_note when no note is given', async () => {
      const patched = setupRejectMocks();

      const result = await rejectOrderReturn(pendingReturnId);

      expect(result.success).toBe(true);
      expect(patched[0].admin_note).toBeNull();
    });

    it('fails cleanly (not a throw) when the return request is not pending', async () => {
      server.use(
        http.get('*/rest/v1/order_returns', () =>
          HttpResponse.json({ ...pendingReturnFixture, status: 'rejected' }),
        ),
      );

      const result = await rejectOrderReturn(pendingReturnId, 'note');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/already been resolved/i);
      }
    });
  });
});
