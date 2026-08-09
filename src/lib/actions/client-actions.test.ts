import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { createBrowserClient } from '@supabase/ssr';

// revalidatePath throws in jsdom — stub it
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => {
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test-project.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key',
    );
    (client.auth as unknown as { getUser: typeof mockGetUser }).getUser = mockGetUser;
    return client;
  },
}));

const { submitOrder, submitRedeliveryRequest } = await import('./client-actions');

let orderDeleteCalled = false;

describe('client-actions', () => {
  describe('submitOrder', () => {
    const validOrderData = {
      source: 'warehouse',
      service_type: 'pickup',
      payment_method: 'cash',
      po_image_url: 'https://example.com/po.jpg',
      driver_name: 'Test Driver',
      plate_number: 'ABC-123',
      total_amount: 25000,
      items: [
        { product_id: '550e8400-e29b-41d4-a716-446655440000', bag_type: 'JB', requested_qty: 100 },
      ],
    };

    beforeEach(() => {
      vi.clearAllMocks();
      orderDeleteCalled = false;

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'client-001', email: 'juan@acme.com' } },
        error: null,
      });

      server.use(
        // Return client profile for .single() requests (requireClient)
        http.get('*/rest/v1/profiles', ({ request }) => {
          const accept = request.headers.get('accept') || '';
          const isSingle = accept.includes('application/vnd.pgrst.object+json');
          const profile = {
            id: 'client-001',
            email: 'juan@acme.com',
            full_name: 'Juan Dela Cruz',
            company_name: 'ACME Construction',
            phone: '09171234567',
            role: 'client',
            account_type: 'company',
            kyc_status: 'verified',
            kyc_documents: null,
            avatar_url: null,
            notification_preferences: {
              order_approval: true,
              payment_required: true,
              dispatch: true,
              delivery_status: true,
            },
            created_at: '2026-01-15T00:00:00.000Z',
            updated_at: '2026-01-15T00:00:00.000Z',
          };
          if (isSingle) return HttpResponse.json(profile);
          return HttpResponse.json([profile]);
        }),

        // Track orders DELETE (rollback)
        http.delete('*/rest/v1/orders', () => {
          orderDeleteCalled = true;
          return HttpResponse.json([]);
        }),

        // Stub notifications insert (called by createRoleNotification)
        http.post('*/rest/v1/notifications', () => HttpResponse.json([])),

        // Product price lookup for the server-side total_amount verification
        // (Phase 4 hardening) — 100 JB units = 2500 individual bags, priced
        // at 10/bag = 25000, matching validOrderData.total_amount below.
        http.get('*/rest/v1/products', () =>
          HttpResponse.json([
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              price_per_bag: 10,
              price_port: 10,
              price_warehouse: 10,
            },
          ]),
        ),
      );
    });

    it('returns a failure result (not a throw) when order_items insert fails, and still rolls back the order', async () => {
      server.use(
        http.post('*/rest/v1/order_items', () =>
          HttpResponse.json({ message: 'violates foreign key constraint' }, { status: 409 }),
        ),
      );

      const result = await submitOrder(validOrderData);

      // This is the actual point of the fix: in production, a throw here would
      // have been redacted to a generic Next.js digest message. A returned
      // { success: false, error } is a normal value and is never redacted.
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/Failed to save order items/);
      }
      expect(orderDeleteCalled).toBe(true);
    });

    it('returns a success result with the created order when order_items insert succeeds', async () => {
      const result = await submitOrder(validOrderData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
      }
    });

    // Phase 4 of the sales/profit hardening plan: server is the source of
    // truth for money, always. total_amount is recomputed server-side from
    // the product catalog (never trusted from the client) and any mismatch
    // beyond floating-point tolerance is a hard reject — no legitimate
    // discount workflow exists that would make submitted and computed
    // totals differ (confirmed with the user before implementing this).
    it('rejects (not a throw — safeAction catches it) an order whose total_amount does not match the server-computed price', async () => {
      const result = await submitOrder({
        ...validOrderData,
        total_amount: 30000, // real price is 10/bag * 2500 bags = 25000
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/does not match the current catalog price/);
        expect(result.error).toMatch(/₱30000\.00/);
        expect(result.error).toMatch(/₱25000\.00/);
      }
      // No orders row should have been created — the check runs before any
      // write, so there's nothing to roll back and orderDeleteCalled must
      // stay false (a rollback firing here would mean a row was written
      // first, which is exactly the orphaned-row bug this ordering avoids).
      expect(orderDeleteCalled).toBe(false);
    });

    it('accepts an order whose total_amount matches within the 1-centavo floating-point tolerance', async () => {
      const result = await submitOrder({ ...validOrderData, total_amount: 25000.005 });
      expect(result.success).toBe(true);
    });
  });

  // Regression coverage for the requestedQty rounding fix: requestedBags
  // (individual bags) isn't guaranteed to land on an exact 25/50-bag unit
  // boundary for a partial split redelivery, so unitsFromIndividualBags can
  // return a fraction (e.g. 30 bags / 25 per JB = 1.2). requested_qty is a
  // non-nullable Postgres Int column, so the fraction must be rounded to a
  // whole unit — never written as-is, never rounded down to 0.
  describe('submitRedeliveryRequest (requestedQty rounding)', () => {
    const balanceId = '550e8400-e29b-41d4-a716-446655440111';
    let capturedOrderItemsPayload: Record<string, unknown> | null = null;

    beforeEach(() => {
      vi.clearAllMocks();
      capturedOrderItemsPayload = null;

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'client-001', email: 'juan@acme.com' } },
        error: null,
      });

      server.use(
        http.get('*/rest/v1/profiles', ({ request }) => {
          const accept = request.headers.get('accept') || '';
          const isSingle = accept.includes('application/vnd.pgrst.object+json');
          const profile = {
            id: 'client-001',
            email: 'juan@acme.com',
            full_name: 'Juan Dela Cruz',
            role: 'client',
            kyc_status: 'verified',
          };
          return isSingle ? HttpResponse.json(profile) : HttpResponse.json([profile]);
        }),

        // Balance: 50 individual bags remaining (2 JB units — 1 JB = 25
        // individual bags), linked to an order with a PO number.
        http.get('*/rest/v1/customer_balances', () =>
          HttpResponse.json({
            id: balanceId,
            client_id: 'client-001',
            bag_type: 'JB',
            remaining_qty: 50,
            product_id: 'prod-1',
            order: { po_number: 'PO-TEST-001' },
          }),
        ),

        http.post('*/rest/v1/orders', () =>
          HttpResponse.json({ id: 'order-redelivery-1', po_number: 'PO-TEST-001' }),
        ),

        http.get('*/rest/v1/products', () =>
          HttpResponse.json({ price_per_bag: 250, price_port: null, price_warehouse: null }),
        ),

        http.post('*/rest/v1/order_items', async ({ request }) => {
          capturedOrderItemsPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json([]);
        }),
      );
    });

    it('rounds a partial split request (30 of 50 bags, 30/25 = 1.2 JB units) to a valid positive integer requested_qty', async () => {
      const result = await submitRedeliveryRequest(
        balanceId,
        {
          source: 'warehouse',
          service_type: 'pickup',
          payment_method: 'cash',
          po_number: 'PO-TEST-001',
          po_image_url: 'https://example.com/po.jpg',
          driver_name: 'Test Driver',
          plate_number: 'ABC-123',
        },
        {
          wantsSplit: true,
          deliverNowQty: 30,
          deliverNowJB: 1,
          deliverNowSB: 0,
          splitNote: 'Redelivery split: Client requested 30 indiv bags now.',
        },
      );

      expect(result.success).toBe(true);
      expect(capturedOrderItemsPayload).not.toBeNull();
      const requestedQty = capturedOrderItemsPayload?.requested_qty;
      expect(Number.isInteger(requestedQty)).toBe(true);
      expect(requestedQty).toBeGreaterThan(0);
      expect(requestedQty).toBe(1); // Math.max(1, Math.round(30 / 25)) = Math.max(1, 1) = 1
    });

    it('rounds a non-split full-balance request the same way (50 bags / 25 = exactly 2, no rounding needed)', async () => {
      const result = await submitRedeliveryRequest(balanceId, {
        source: 'warehouse',
        service_type: 'pickup',
        payment_method: 'cash',
        po_number: 'PO-TEST-001',
        po_image_url: 'https://example.com/po.jpg',
        driver_name: 'Test Driver',
        plate_number: 'ABC-123',
      });

      expect(result.success).toBe(true);
      const requestedQty = capturedOrderItemsPayload?.requested_qty;
      expect(Number.isInteger(requestedQty)).toBe(true);
      expect(requestedQty).toBe(2);
    });
  });
});
