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

const { submitOrder } = await import('./client-actions');

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
  });
});
