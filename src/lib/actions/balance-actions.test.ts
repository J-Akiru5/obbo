import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { applyRedeliveryToCustomerBalances } from './balance-actions';

// balance-actions transitively imports next/cache via admin-helpers in some
// environments — mock it like the other action tests do.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Mirrors the LIVE customer_balances schema: these are the only columns a
// PATCH may touch (schema.sql + migration
// 20261006_customer_balances_fulfilled_state.sql). Any other key — notably
// the updated_at column before that migration — is rejected by PostgREST, and
// the test handler reproduces that so schema drift can never pass silently
// again (the exact failure that left fulfilled obligations 'pending').
const ALLOWED_BALANCE_COLUMNS = new Set([
  'remaining_qty',
  'status',
  'updated_at',
  'total_purchase',
  'bag_type',
  'order_id',
  'product_id',
  'client_id',
]);

interface BalancePatchCapture {
  body: Record<string, unknown>;
  orderId: string | null;
}

function useBalanceMocks(options: {
  originalOrders?: Record<string, unknown>[];
  balances?: Record<string, unknown>[];
  allowUpdatedAt?: boolean;
  captured: BalancePatchCapture[];
  orderLookupUrls?: string[];
  balanceLookupUrls?: string[];
}) {
  const {
    originalOrders = [{ id: 'orig-1', status: 'dispatched' }],
    balances = [{ id: 'bal-1', remaining_qty: 100, status: 'pending' }],
    allowUpdatedAt = true,
    captured,
    orderLookupUrls,
    balanceLookupUrls,
  } = options;

  server.use(
    http.get('*/rest/v1/orders', ({ request }) => {
      const url = new URL(request.url);
      orderLookupUrls?.push(url.toString());
      const poNumber = url.searchParams.get('po_number')?.replace('eq.', '');
      const includeRedelivery = url.searchParams.get('order_type') !== 'neq.redelivery';
      let rows = originalOrders;
      if (poNumber) rows = rows.filter((o) => o.po_number === poNumber || !('po_number' in o));
      if (!includeRedelivery) rows = rows.filter((o) => o.order_type !== 'redelivery');
      return HttpResponse.json(rows.slice(0, 1));
    }),
    http.get('*/rest/v1/customer_balances', ({ request }) => {
      const url = new URL(request.url);
      balanceLookupUrls?.push(url.toString());
      const orderId = url.searchParams.get('order_id')?.replace('eq.', '');
      const rows = orderId
        ? balances.filter((b) => b.order_id === orderId || !('order_id' in b))
        : balances;
      return HttpResponse.json(rows);
    }),
    http.patch('*/rest/v1/customer_balances', async ({ request }) => {
      const url = new URL(request.url);
      const body = (await request.json()) as Record<string, unknown>;
      for (const key of Object.keys(body)) {
        if (!ALLOWED_BALANCE_COLUMNS.has(key) || (key === 'updated_at' && !allowUpdatedAt)) {
          return HttpResponse.json(
            {
              message: `Could not find the '${key}' column of 'customer_balances' in the schema cache`,
            },
            { status: 400 },
          );
        }
      }
      if (typeof body.remaining_qty === 'number' && body.remaining_qty < 0) {
        return HttpResponse.json(
          { message: 'new row violates check constraint "customer_balances_remaining_qty_check"' },
          { status: 400 },
        );
      }
      captured.push({
        body,
        orderId: url.searchParams.get('id')?.replace('eq.', '') ?? null,
      });
      return HttpResponse.json([]);
    }),
  );
}

describe('applyRedeliveryToCustomerBalances', () => {
  it('decrements a partially-delivered balance in individual bags (units × 25)', async () => {
    const captured: BalancePatchCapture[] = [];
    useBalanceMocks({ captured });

    const result = await applyRedeliveryToCustomerBalances({
      linkedPoNumber: 'PO-2026-002',
      items: [{ productId: 'prod-jb-1', bagType: 'JB', dispatchedUnits: 1 }],
    });

    expect(result.updated).toBe(1);
    expect(result.failed).toBe(0);
    expect(captured).toHaveLength(1);
    expect(captured[0].body.remaining_qty).toBe(75); // 100 − 25
    expect(captured[0].body.status).toBe('pending');
    expect(typeof captured[0].body.updated_at).toBe('string');
  });

  it('marks a fully-covered balance fulfilled with remaining_qty 0', async () => {
    const captured: BalancePatchCapture[] = [];
    useBalanceMocks({ captured });

    const result = await applyRedeliveryToCustomerBalances({
      linkedPoNumber: 'PO-2026-002',
      items: [{ productId: 'prod-jb-1', bagType: 'JB', dispatchedUnits: 4 }],
    });

    expect(result.updated).toBe(1);
    expect(captured).toHaveLength(1);
    expect(captured[0].body.remaining_qty).toBe(0);
    expect(captured[0].body.status).toBe('fulfilled');
    expect(captured[0].orderId).toBe('bal-1');
  });

  it('resolves the ORIGINAL order (excluding redelivery rows) before touching balances', async () => {
    const captured: BalancePatchCapture[] = [];
    const orderLookupUrls: string[] = [];
    const balanceLookupUrls: string[] = [];
    useBalanceMocks({ captured, orderLookupUrls, balanceLookupUrls });

    await applyRedeliveryToCustomerBalances({
      linkedPoNumber: 'PO-2026-002',
      excludeOrderId: 'redelivery-order-9',
      items: [{ productId: 'prod-jb-1', bagType: 'JB', dispatchedUnits: 4 }],
    });

    // The duplicate-PO trap: the lookup must exclude redelivery rows and the
    // dispatching order itself, or PostgREST returns multiple rows and the
    // balance update is skipped.
    expect(orderLookupUrls[0]).toContain('order_type=neq.redelivery');
    expect(orderLookupUrls[0]).toContain('id=neq.redelivery-order-9');
    expect(balanceLookupUrls[0]).toContain('order_id=eq.orig-1');
    expect(balanceLookupUrls[0]).toContain('status=eq.pending');
  });

  it('reports (not swallows) a PATCH rejected by the live schema — the pre-migration failure mode', async () => {
    const captured: BalancePatchCapture[] = [];
    useBalanceMocks({ captured, allowUpdatedAt: false });

    const result = await applyRedeliveryToCustomerBalances({
      linkedPoNumber: 'PO-2026-002',
      items: [{ productId: 'prod-jb-1', bagType: 'JB', dispatchedUnits: 4 }],
    });

    expect(result.updated).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/updated_at|column/i);
    expect(captured).toHaveLength(0);
  });

  it('is a no-op when there is no pending balance row', async () => {
    const captured: BalancePatchCapture[] = [];
    useBalanceMocks({ captured, balances: [] });

    const result = await applyRedeliveryToCustomerBalances({
      linkedPoNumber: 'PO-2026-002',
      items: [{ productId: 'prod-jb-1', bagType: 'JB', dispatchedUnits: 4 }],
    });

    expect(result.updated).toBe(0);
    expect(result.failed).toBe(0);
    expect(captured).toHaveLength(0);
  });
});
