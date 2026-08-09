import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { addLedgerEntry, updateLedgerEntry, applyBagReturnToLedger } from './ledger-actions';

// requireAdmin is globally stubbed in vitest.setup.ts, but getCostConfig()
// calls requireAdmin() as an internal same-module reference, which bypasses
// that mock. Override getCostConfig directly instead (same approach
// orders-actions.test.ts uses) so it returns fixed, known rates.
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

const noopHandlers = () =>
  server.use(
    http.get('*/rest/v1/shipments', () =>
      HttpResponse.json({ id: 'ship-001', remaining_jb: 100, remaining_sb: 100, good_stock: 200 }),
    ),
    http.patch('*/rest/v1/shipments', () => HttpResponse.json([])),
    http.post('*/rest/v1/activity_log', () => HttpResponse.json([])),
  );

describe('Ledger Server Actions — profit calculations', () => {
  describe('addLedgerEntry — dispatch', () => {
    it('computes total_sales/gross_profit/net_profit/selling_price_per_bag from live cost config', async () => {
      noopHandlers();
      const captured: Record<string, unknown>[] = [];
      server.use(
        http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          captured.push(body);
          return HttpResponse.json({ id: 'ledger-new', ...body });
        }),
      );

      // 4 JB = 100 bags, amount 18000 -> selling price 180/bag
      await addLedgerEntry('ship-001', {
        dr_number: 'DR-NEW-001',
        jb: 4,
        sb: 0,
        amount: 18000,
      });

      expect(captured).toHaveLength(1);
      const entry = captured[0];
      expect(entry.selling_price_per_bag).toBe(180);
      expect(entry.total_sales).toBe(18000);
      // 18000 - 100*147.64 = 3236
      expect(entry.gross_profit).toBe(3236);
      // 18000 - 100*(147.64+20) = 1236
      expect(entry.net_profit).toBe(1236);
      expect(entry.landed_cost_per_bag).toBe(147.64);
      expect(entry.local_expenses_per_bag).toBe(20);
    });
  });

  describe('addLedgerEntry — returns adjust profit (Q1)', () => {
    // Both cases below reuse the mockShipmentLedger fixture row 'ledger-001'
    // (shipment_id 'ship-001', dr_number 'DR-2026-001', selling_price_per_bag
    // 250, landed_cost_per_bag 147.64, local_expenses_per_bag 20) as the
    // ORIGINAL dispatch row the return must look up and reuse rates from.

    it('restockable return ("return") reverses revenue AND the cost the bag represents', async () => {
      noopHandlers();
      const captured: Record<string, unknown>[] = [];
      server.use(
        http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          captured.push(body);
          return HttpResponse.json({ id: 'ledger-return', ...body });
        }),
      );

      await addLedgerEntry('ship-001', {
        dr_number: 'DR-2026-001',
        jb: 0,
        sb: 0,
        bags_returned: 5,
        bag_returned_type: 'JB',
        return_reason: 'return',
      });

      const entry = captured[0];
      expect(entry.total_sales).toBe(-1250); // -5 * 250
      expect(entry.gross_profit).toBeCloseTo(-511.8, 2); // -5 * (250 - 147.64)
      // Restockable: local expenses also reverse — the bag is back in inventory
      expect(entry.net_profit).toBeCloseTo(-411.8, 2); // -511.8 + 5*20
      expect(entry.selling_price_per_bag).toBe(250);
      expect(entry.landed_cost_per_bag).toBe(147.64);
    });

    it('waste/damage return reverses full revenue with NO cost offset (cost already sunk)', async () => {
      noopHandlers();
      const captured: Record<string, unknown>[] = [];
      server.use(
        http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          captured.push(body);
          return HttpResponse.json({ id: 'ledger-waste', ...body });
        }),
      );

      await addLedgerEntry('ship-001', {
        dr_number: 'DR-2026-001',
        jb: 0,
        sb: 0,
        bags_returned: 5,
        bag_returned_type: 'JB',
        return_reason: 'waste',
      });

      const entry = captured[0];
      expect(entry.total_sales).toBe(-1250);
      // Unlike a restockable return, gross AND net take the FULL hit —
      // the landed/local cost already spent on these bags isn't recovered.
      expect(entry.gross_profit).toBe(-1250);
      expect(entry.net_profit).toBe(-1250);
    });
  });

  describe('addLedgerEntry — restockable return credits stock in whole UNITS, not raw bags (denomination-mismatch fix)', () => {
    // bags_returned is an INDIVIDUAL BAG count (same value computeReturnProfitDelta
    // uses above), but shipments.remaining_jb/remaining_sb are JB/SB UNIT-denominated.
    // The pre-fix code added bags_returned directly to a unit-denominated column —
    // e.g. "5 individual bags returned" would have credited back 5 whole JB units
    // (125 bags) instead of 0 (5 bags don't make a full 25-bag unit).

    function captureShipmentPatch() {
      const captured: Record<string, unknown>[] = [];
      server.use(
        http.patch('*/rest/v1/shipments', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          captured.push(body);
          return HttpResponse.json([body]);
        }),
        // Override the default shipment_ledger POST handler, which pushes
        // into the shared, cross-test mockShipmentLedger fixture array —
        // without this, each test's return row would leak into later tests'
        // "original dispatch" lookup for the same dr_number and break their
        // .maybeSingle() assumption (same pattern the existing return tests
        // above already follow).
        http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 'ledger-stock-test', ...body });
        }),
      );
      return captured;
    }

    it('credits 0 whole JB units when the returned bag count is below one full unit', async () => {
      noopHandlers();
      const patches = captureShipmentPatch();
      // fixture shipment starts at remaining_jb: 100 (see noopHandlers)
      await addLedgerEntry('ship-001', {
        dr_number: 'DR-2026-001',
        jb: 0,
        sb: 0,
        bags_returned: 5, // 5 individual bags -> floor(5/25) = 0 JB units
        bag_returned_type: 'JB',
        return_reason: 'return',
      });
      expect(patches[0].remaining_jb).toBe(100); // unchanged, not 105
    });

    it('credits whole units and drops the sub-unit remainder for a non-exact bag count', async () => {
      noopHandlers();
      const patches = captureShipmentPatch();
      // 30 individual JB bags -> floor(30/25) = 1 unit credited, 5 bags dropped
      await addLedgerEntry('ship-001', {
        dr_number: 'DR-2026-001',
        jb: 0,
        sb: 0,
        bags_returned: 30,
        bag_returned_type: 'JB',
        return_reason: 'return',
      });
      expect(patches[0].remaining_jb).toBe(101); // 100 + 1, not 100 + 30
    });

    it('credits the exact unit count for an exact-multiple bag return', async () => {
      noopHandlers();
      const patches = captureShipmentPatch();
      // 100 individual SB bags -> exactly 2 SB units, no rounding loss
      await addLedgerEntry('ship-001', {
        dr_number: 'DR-2026-001',
        jb: 0,
        sb: 0,
        bags_returned: 100,
        bag_returned_type: 'SB',
        return_reason: 'return',
      });
      expect(patches[0].remaining_sb).toBe(102); // 100 + 2
    });

    it('does not credit stock at all for a non-restockable (waste/damage) return', async () => {
      noopHandlers();
      const patches = captureShipmentPatch();
      await addLedgerEntry('ship-001', {
        dr_number: 'DR-2026-001',
        jb: 0,
        sb: 0,
        bags_returned: 50,
        bag_returned_type: 'JB',
        return_reason: 'waste',
      });
      expect(patches[0].remaining_jb).toBe(100); // unchanged — waste isn't restocked
    });
  });

  describe('applyBagReturnToLedger', () => {
    // Shared helper extracted from _updateTrackingStatus's inline loop, now
    // reused by both the tracking-tab flow and the order_returns approval
    // flow. Reuses the same 'DR-2026-001' / 'ship-001' original-dispatch
    // fixture row as the addLedgerEntry return tests above.
    const getTestSupabase = async () => {
      const { createBrowserClient } = await import('@supabase/ssr');
      return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test-project.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key',
      );
    };

    const mockProfileAndDr = () =>
      server.use(
        http.get('*/rest/v1/profiles', () =>
          HttpResponse.json({ id: 'client-001', full_name: 'Juan Dela Cruz', company_name: null }),
        ),
        http.get('*/rest/v1/delivery_receipts', () =>
          HttpResponse.json({ id: '550e8400-e29b-41d4-a716-446655440099' }),
        ),
      );

    it('creates a ledger row per bag type with count > 0, and none for count 0', async () => {
      noopHandlers();
      mockProfileAndDr();
      const captured: Record<string, unknown>[] = [];
      server.use(
        http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          captured.push(body);
          return HttpResponse.json({ id: `ledger-${captured.length}`, ...body });
        }),
      );

      const supabase = await getTestSupabase();
      const result = await applyBagReturnToLedger(supabase, {
        shipmentId: 'ship-001',
        drNumber: 'DR-2026-001',
        clientId: 'client-001',
        jbReturned: 5,
        sbReturned: 0,
        returnReason: 'return',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entriesCreated).toBe(1);
      }
      expect(captured).toHaveLength(1);
      expect(captured[0].bag_returned_type).toBe('JB');
      expect(captured[0].return_reason).toBe('return');
    });

    it('creates two ledger rows when both JB and SB counts are > 0', async () => {
      noopHandlers();
      mockProfileAndDr();
      const captured: Record<string, unknown>[] = [];
      server.use(
        http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          captured.push(body);
          return HttpResponse.json({ id: `ledger-${captured.length}`, ...body });
        }),
      );

      const supabase = await getTestSupabase();
      const result = await applyBagReturnToLedger(supabase, {
        shipmentId: 'ship-001',
        drNumber: 'DR-2026-001',
        clientId: 'client-001',
        jbReturned: 5,
        sbReturned: 5,
        returnReason: 'waste',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entriesCreated).toBe(2);
      }
      expect(captured).toHaveLength(2);
      expect(captured.every((c) => c.return_reason === 'waste')).toBe(true);
    });

    it('creates no ledger rows and returns entriesCreated: 0 when neither count is positive', async () => {
      noopHandlers();
      mockProfileAndDr();
      let postCalled = false;
      server.use(
        http.post('*/rest/v1/shipment_ledger', () => {
          postCalled = true;
          return HttpResponse.json({});
        }),
      );

      const supabase = await getTestSupabase();
      const result = await applyBagReturnToLedger(supabase, {
        shipmentId: 'ship-001',
        drNumber: 'DR-2026-001',
        returnReason: 'return',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entriesCreated).toBe(0);
      }
      expect(postCalled).toBe(false);
    });

    it('returns a failure result (not a throw) when the underlying ledger write fails', async () => {
      noopHandlers();
      mockProfileAndDr();
      server.use(
        http.post('*/rest/v1/shipment_ledger', () =>
          HttpResponse.json({ message: 'insert violates check constraint' }, { status: 400 }),
        ),
      );

      const supabase = await getTestSupabase();
      const result = await applyBagReturnToLedger(supabase, {
        shipmentId: 'ship-001',
        drNumber: 'DR-2026-001',
        jbReturned: 5,
        returnReason: 'damage',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/Failed to record return ledger entry/);
      }
    });
  });

  describe('updateLedgerEntry — T-1 regression', () => {
    it('recomputes profit fields when jb/amount change on an existing dispatch row', async () => {
      noopHandlers();
      const patched: Record<string, unknown>[] = [];
      server.use(
        http.get('*/rest/v1/shipment_ledger', () =>
          HttpResponse.json({
            id: 'ledger-001',
            jb: 20,
            sb: 10,
            amount: 7500,
            bags_returned: 0,
            return_reason: 'return',
            dr_number: 'DR-2026-001',
            landed_cost_per_bag: 147.64,
            local_expenses_per_bag: 20,
          }),
        ),
        http.patch('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          patched.push(body);
          return HttpResponse.json([]);
        }),
      );

      await updateLedgerEntry(
        'ledger-001',
        'ship-001',
        { jb: 20, sb: 10, bags_returned: 0, bag_returned_type: null, return_reason: 'return' },
        { jb: 30, amount: 9000 }, // jb 20 -> 30, amount 7500 -> 9000
      );

      expect(patched).toHaveLength(1);
      const patch = patched[0];
      // totalBags = 30*25 + 10*50 = 1250; sellingPricePerBag = 9000/1250 = 7.2
      expect(patch.selling_price_per_bag).toBe(7.2);
      expect(patch.gross_profit).toBe(-175550); // 9000 - 1250*147.64, rounded to 2dp
      expect(patch.net_profit).toBe(-200550); // 9000 - 1250*(147.64+20), rounded to 2dp
      // Recomputed from THIS row's own stored rates, never a fresh cost-config lookup
      expect(patch.landed_cost_per_bag).toBe(147.64);
      expect(patch.local_expenses_per_bag).toBe(20);
    });

    it('does not touch profit fields when the edit only changes unrelated fields', async () => {
      noopHandlers();
      const patched: Record<string, unknown>[] = [];
      server.use(
        http.patch('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          patched.push(body);
          return HttpResponse.json([]);
        }),
      );

      await updateLedgerEntry(
        'ledger-001',
        'ship-001',
        { jb: 20, sb: 10, bags_returned: 0, bag_returned_type: null, return_reason: 'return' },
        { notes: 'Updated delivery note only' },
      );

      const patch = patched[0];
      expect(patch.total_sales).toBeUndefined();
      expect(patch.gross_profit).toBeUndefined();
      expect(patch.net_profit).toBeUndefined();
    });
  });
});
