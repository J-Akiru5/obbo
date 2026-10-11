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
      reference_price_per_bag: 185,
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
      // CHANGED (fixed-margin profit): this ₱180 sale used to report
      // 18000 − 100×147.64 = 3,236 gross / 1,236 net. Gross/net no longer
      // depend on the selling price: 100 × (185 − 147.64) = 3,736, and
      // 3,736 − 100 × 20 = 1,736.
      expect(entry.gross_profit).toBe(3736);
      expect(entry.net_profit).toBe(1736);
      expect(entry.profit_basis_price_per_bag).toBe(185);
      expect(entry.landed_cost_per_bag).toBe(147.64);
      expect(entry.local_expenses_per_bag).toBe(20);
    });

    it('a ₱185 sale of the same bags reports the SAME gross and net as the ₱180 one', async () => {
      noopHandlers();
      const captured: Record<string, unknown>[] = [];
      server.use(
        http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          captured.push(body);
          return HttpResponse.json({ id: 'ledger-new', ...body });
        }),
      );

      await addLedgerEntry('ship-001', { dr_number: 'DR-185', jb: 4, sb: 0, amount: 18500 });

      expect(captured[0].total_sales).toBe(18500);
      expect(captured[0].gross_profit).toBe(3736);
      expect(captured[0].net_profit).toBe(1736);
      expect(captured[0].profit_basis_price_per_bag).toBe(185);
    });

    it('a ₱0 manual row recognizes no sale → basis 0, −landed per bag (no margin booked)', async () => {
      noopHandlers();
      const captured: Record<string, unknown>[] = [];
      server.use(
        http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          captured.push(body);
          return HttpResponse.json({ id: 'ledger-new', ...body });
        }),
      );

      await addLedgerEntry('ship-001', { dr_number: 'DR-ZERO', jb: 4, sb: 0, amount: 0 });

      expect(captured[0].total_sales).toBe(0);
      expect(captured[0].profit_basis_price_per_bag).toBe(0);
      expect(captured[0].gross_profit).toBe(-14764);
      expect(captured[0].net_profit).toBe(-16764);
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

    it('waste/damage return records ZERO money deltas (only bag counts move)', async () => {
      // Client-feedback round 3, Issue 3: marking bags damaged must not claw
      // revenue out of SALES, GROSS, or NET — the sale was already recognized
      // when the bag left the warehouse. Only the bag counts and stock move.
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
        return_reason: 'damage',
      });

      const entry = captured[0];
      expect(entry.total_sales).toBe(0);
      expect(entry.gross_profit).toBe(0);
      expect(entry.net_profit).toBe(0);
      // The per-bag rates survive so the row still reports what the bag
      // originally sold and cost for.
      expect(entry.selling_price_per_bag).toBe(250);
      expect(entry.landed_cost_per_bag).toBe(147.64);
      expect(entry.local_expenses_per_bag).toBe(20);
    });
  });

  describe('addLedgerEntry — shipment stock moves in INDIVIDUAL BAGS (denomination fix)', () => {
    // shipments.remaining_jb/remaining_sb are INDIVIDUAL BAGS. Ledger jb/sb
    // entry columns are JB/SB UNITS and must be multiplied by 25/50 before
    // deducting; bags_returned is already an individual-bag count and is
    // credited exactly (no unit floor). Fixture shipment starts at
    // remaining_jb: 100 / remaining_sb: 100 (see noopHandlers).

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

    it('deducts individual bags — not raw units — when a dispatch is recorded', async () => {
      noopHandlers();
      const patches = captureShipmentPatch();
      // 4 JB UNITS = 100 individual bags. A unit-count deduction would leave
      // 96; the correct bag deduction is 100 - 100 = 0.
      await addLedgerEntry('ship-001', {
        dr_number: 'DR-NEW-002',
        jb: 4,
        sb: 0,
        amount: 18000,
      });
      expect(patches[0].remaining_jb).toBe(0);
      expect(patches[0].remaining_sb).toBe(100);
      expect(patches[0].good_stock).toBe(100);
    });

    it('deducts SB units at 50 bags per unit', async () => {
      noopHandlers();
      const patches = captureShipmentPatch();
      await addLedgerEntry('ship-001', {
        dr_number: 'DR-NEW-003',
        jb: 0,
        sb: 2,
        amount: 18500,
      });
      expect(patches[0].remaining_sb).toBe(0);
      expect(patches[0].remaining_jb).toBe(100);
    });

    it('credits the exact individual bag count on a restockable return (no unit floor)', async () => {
      noopHandlers();
      const patches = captureShipmentPatch();
      // 5 individual bags return to stock -> 100 + 5, no rounding loss.
      await addLedgerEntry('ship-001', {
        dr_number: 'DR-2026-001',
        jb: 0,
        sb: 0,
        bags_returned: 5,
        bag_returned_type: 'JB',
        return_reason: 'return',
      });
      expect(patches[0].remaining_jb).toBe(105);
    });

    it('credits non-multiple bag counts in full', async () => {
      noopHandlers();
      const patches = captureShipmentPatch();
      await addLedgerEntry('ship-001', {
        dr_number: 'DR-2026-001',
        jb: 0,
        sb: 0,
        bags_returned: 30,
        bag_returned_type: 'JB',
        return_reason: 'return',
      });
      expect(patches[0].remaining_jb).toBe(130); // 100 + 30
    });

    it('credits SB returns in exact bags too', async () => {
      noopHandlers();
      const patches = captureShipmentPatch();
      await addLedgerEntry('ship-001', {
        dr_number: 'DR-2026-001',
        jb: 0,
        sb: 0,
        bags_returned: 100,
        bag_returned_type: 'SB',
        return_reason: 'return',
      });
      expect(patches[0].remaining_sb).toBe(200); // 100 + 100
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

describe('Ledger Server Actions — source (Port/Warehouse) label', () => {
  const PROFIT_KEYS = ['total_sales', 'gross_profit', 'net_profit', 'selling_price_per_bag'];

  function captureLedgerPosts() {
    const captured: Record<string, unknown>[] = [];
    server.use(
      http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        captured.push(body);
        return HttpResponse.json({ id: 'ledger-src', ...body });
      }),
    );
    return captured;
  }

  function stubPoSource(source: unknown) {
    const lookups = { count: 0 };
    server.use(
      http.get('*/rest/v1/purchase_orders', () => {
        lookups.count += 1;
        return HttpResponse.json({ po_number: 'PO-SRC', source });
      }),
    );
    return lookups;
  }

  it('persists an explicit source, and the source never changes any profit field', async () => {
    noopHandlers();
    const captured = captureLedgerPosts();
    const base = { jb: 4, sb: 0, amount: 18000 };

    await addLedgerEntry('ship-001', { ...base, dr_number: 'DR-SRC-1', source: 'port' });
    await addLedgerEntry('ship-001', { ...base, dr_number: 'DR-SRC-2', source: 'warehouse' });

    expect(captured.map((c) => c.source)).toEqual(['port', 'warehouse']);
    for (const key of PROFIT_KEYS) expect(captured[0][key]).toBe(captured[1][key]);
  });

  it('stores an explicit null as null and does not look the PO up', async () => {
    noopHandlers();
    const lookups = stubPoSource('port');
    const captured = captureLedgerPosts();

    await addLedgerEntry('ship-001', {
      dr_number: 'DR-SRC-3',
      po_number: 'PO-SRC',
      jb: 4,
      amount: 18000,
      source: null,
    });

    expect(captured[0].source).toBeNull();
    expect(lookups.count).toBe(0);
  });

  it('defaults an omitted source from the linked PO', async () => {
    noopHandlers();
    stubPoSource('warehouse');
    const captured = captureLedgerPosts();

    await addLedgerEntry('ship-001', {
      dr_number: 'DR-SRC-4',
      po_number: 'PO-SRC',
      jb: 4,
      amount: 18000,
    });

    expect(captured[0].source).toBe('warehouse');
  });

  it('leaves source null when there is no PO number, or the PO value is out of contract', async () => {
    noopHandlers();
    const lookups = stubPoSource('PORT'); // uppercase is not a valid ledger source
    const captured = captureLedgerPosts();

    await addLedgerEntry('ship-001', { dr_number: 'DR-SRC-5', jb: 4, amount: 18000 });
    expect(captured[0].source).toBeNull();
    expect(lookups.count).toBe(0); // no po_number -> nothing to look up

    await addLedgerEntry('ship-001', {
      dr_number: 'DR-SRC-6',
      po_number: 'PO-SRC',
      jb: 4,
      amount: 18000,
    });
    expect(captured[1].source).toBeNull();
    expect(lookups.count).toBe(1);
  });

  it('a return row inherits the original dispatch row source', async () => {
    noopHandlers();
    server.use(
      http.get('*/rest/v1/shipment_ledger', () =>
        HttpResponse.json({
          id: 'ledger-orig',
          selling_price_per_bag: 250,
          landed_cost_per_bag: 147.64,
          local_expenses_per_bag: 20,
          source: 'port',
        }),
      ),
    );
    const captured = captureLedgerPosts();

    await addLedgerEntry('ship-001', {
      dr_number: 'DR-2026-001',
      jb: 0,
      sb: 0,
      bags_returned: 5,
      bag_returned_type: 'JB',
      return_reason: 'return',
    });

    expect(captured[0].source).toBe('port');
  });

  it('rejects a source outside port/warehouse and writes nothing', async () => {
    noopHandlers();
    const captured = captureLedgerPosts();

    const result = await addLedgerEntry('ship-001', {
      dr_number: 'DR-SRC-7',
      jb: 4,
      source: 'airport' as never,
    });

    expect(result.success).toBe(false);
    expect(captured).toHaveLength(0);
  });

  it('is strict: an unknown key fails the call instead of reaching the database', async () => {
    noopHandlers();
    const captured = captureLedgerPosts();

    const result = await addLedgerEntry('ship-001', {
      dr_number: 'DR-SRC-8',
      jb: 4,
      bogus_column: 1,
    } as never);

    expect(result.success).toBe(false);
    expect(captured).toHaveLength(0);
  });

  it('inserts the PARSED data (trimmed strings), not the raw caller object', async () => {
    noopHandlers();
    stubPoSource('port');
    const captured = captureLedgerPosts();

    await addLedgerEntry('ship-001', {
      dr_number: '  DR-SRC-9  ',
      po_number: '  PO-SRC  ',
      jb: 4,
      amount: 18000,
    });

    expect(captured[0].dr_number).toBe('DR-SRC-9');
    expect(captured[0].po_number).toBe('PO-SRC');
  });

  it('a source-only edit patches source and does NOT recompute any profit field', async () => {
    noopHandlers();
    const patched: Record<string, unknown>[] = [];
    server.use(
      http.patch('*/rest/v1/shipment_ledger', async ({ request }) => {
        patched.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json([]);
      }),
    );

    const result = await updateLedgerEntry(
      'ledger-001',
      'ship-001',
      { jb: 20, sb: 10, bags_returned: 0, bag_returned_type: null, return_reason: 'return' },
      { source: 'port' },
    );

    expect(result.success).toBe(true);
    expect(patched[0].source).toBe('port');
    for (const key of PROFIT_KEYS) expect(patched[0][key]).toBeUndefined();
  });

  it('edit accepts client_reason (the ledger dialog always sends it) but rejects unknown keys', async () => {
    noopHandlers();
    const patched: Record<string, unknown>[] = [];
    server.use(
      http.patch('*/rest/v1/shipment_ledger', async ({ request }) => {
        patched.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json([]);
      }),
    );
    const oldEntry = {
      jb: 20,
      sb: 10,
      bags_returned: 0,
      bag_returned_type: null,
      return_reason: 'return',
    };

    const ok = await updateLedgerEntry('ledger-001', 'ship-001', oldEntry, {
      client_reason: 'Wet bags',
    });
    expect(ok.success).toBe(true);
    expect(patched[0].client_reason).toBe('Wet bags');

    const rejected = await updateLedgerEntry('ledger-001', 'ship-001', oldEntry, {
      bogus_column: 1,
    } as never);
    expect(rejected.success).toBe(false);
    expect(patched).toHaveLength(1);
  });
});

describe('Ledger Server Actions — fixed-margin returns and edits (profit basis)', () => {
  // A new-style dispatch row: ₱180/bag sale of 100 bags, margin measured at the
  // ₱185 reference (basis 185). A legacy row has profit_basis_price_per_bag NULL.
  const basisRow = {
    id: 'ledger-basis',
    jb: 4,
    sb: 0,
    amount: 18000,
    bags_returned: 0,
    return_reason: 'return',
    dr_number: 'DR-BASIS',
    selling_price_per_bag: 180,
    landed_cost_per_bag: 147.64,
    local_expenses_per_bag: 20,
    profit_basis_price_per_bag: 185,
  };
  const legacyRow = { ...basisRow, id: 'ledger-legacy', profit_basis_price_per_bag: null };
  // A PO-capped ₱0 redelivery: sales 0, margin basis 0.
  const redeliveryRow = {
    ...basisRow,
    id: 'ledger-redelivery',
    amount: 0,
    selling_price_per_bag: 0,
    profit_basis_price_per_bag: 0,
  };
  const dispatchOldEntry = {
    jb: 4,
    sb: 0,
    bags_returned: 0,
    bag_returned_type: null,
    return_reason: 'return',
  };

  /** Serves `row` for BOTH the by-id current-row read and the by-DR original lookup. */
  function serveRow(row: Record<string, unknown>) {
    const patched: Record<string, unknown>[] = [];
    const posted: Record<string, unknown>[] = [];
    noopHandlers();
    server.use(
      http.get('*/rest/v1/shipment_ledger', () => HttpResponse.json(row)),
      http.patch('*/rest/v1/shipment_ledger', async ({ request }) => {
        patched.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json([]);
      }),
      http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        posted.push(body);
        return HttpResponse.json({ id: 'ledger-ret', ...body });
      }),
    );
    return { patched, posted };
  }

  describe('returns', () => {
    const fullReturn = {
      dr_number: 'DR-BASIS',
      jb: 0,
      sb: 0,
      bags_returned: 100,
      bag_returned_type: 'JB' as const,
      return_reason: 'return',
    };

    it('full restockable return of the @₱180 sale → −18,000 | −3,736 | −1,736 (cumulative 0/0/0)', async () => {
      const { posted } = serveRow(basisRow);
      await addLedgerEntry('ship-001', fullReturn);

      expect(posted[0].total_sales).toBe(-18000);
      expect(posted[0].gross_profit).toBe(-3736);
      expect(posted[0].net_profit).toBe(-1736);
      // Sale (18,000 / 3,736 / 1,736) + this return = exactly 0 / 0 / 0.
      expect(18000 + (posted[0].total_sales as number)).toBe(0);
      expect(3736 + (posted[0].gross_profit as number)).toBe(0);
      expect(1736 + (posted[0].net_profit as number)).toBe(0);
    });

    it('return against a LEGACY row (NULL basis) → identical to the old behavior', async () => {
      const { posted } = serveRow({ ...legacyRow, selling_price_per_bag: 250 });
      await addLedgerEntry('ship-001', { ...fullReturn, bags_returned: 5 });

      expect(posted[0].total_sales).toBe(-1250);
      expect(posted[0].gross_profit).toBeCloseTo(-511.8, 2); // −5 × (250 − 147.64)
      expect(posted[0].net_profit).toBeCloseTo(-411.8, 2);
    });

    it('waste/damage against a basis row reverses nothing', async () => {
      const { posted } = serveRow(basisRow);
      await addLedgerEntry('ship-001', { ...fullReturn, return_reason: 'damage' });

      expect([posted[0].total_sales, posted[0].gross_profit, posted[0].net_profit]).toEqual([
        0, 0, 0,
      ]);
    });

    it('editing a return row reverses at the original row basis too', async () => {
      const { patched } = serveRow({ ...basisRow, bags_returned: 50 });
      await updateLedgerEntry(
        'ledger-ret',
        'ship-001',
        { ...dispatchOldEntry, jb: 0, bags_returned: 50, bag_returned_type: 'JB' },
        { bags_returned: 50 },
      );

      expect(patched[0].total_sales).toBe(-9000);
      expect(patched[0].gross_profit).toBe(-1868); // −50 × (185 − 147.64)
      expect(patched[0].net_profit).toBe(-868);
    });
  });

  describe('edits', () => {
    it('LEGACY row (NULL basis), amount edited to ₱18,000 → old formula 3,236 | 1,236', async () => {
      const { patched } = serveRow(legacyRow);
      await updateLedgerEntry('ledger-legacy', 'ship-001', dispatchOldEntry, { amount: 18000 });

      expect(patched[0].gross_profit).toBe(3236);
      expect(patched[0].net_profit).toBe(1236);
      expect(patched[0].profit_basis_price_per_bag).toBeNull(); // stays legacy
    });

    it('new-style row keeps its stored basis when the amount is edited', async () => {
      const { patched } = serveRow({ ...basisRow, amount: 18500, selling_price_per_bag: 185 });
      await updateLedgerEntry('ledger-basis', 'ship-001', dispatchOldEntry, { amount: 18000 });

      expect(patched[0].total_sales).toBe(18000);
      expect(patched[0].selling_price_per_bag).toBe(180);
      expect(patched[0].gross_profit).toBe(3736);
      expect(patched[0].net_profit).toBe(1736);
      expect(patched[0].profit_basis_price_per_bag).toBe(185);
    });

    it('a stored basis other than the current reference is reused, not replaced by live config', async () => {
      const { patched } = serveRow({ ...basisRow, profit_basis_price_per_bag: 190 });
      await updateLedgerEntry('ledger-basis', 'ship-001', dispatchOldEntry, { amount: 18000 });

      expect(patched[0].profit_basis_price_per_bag).toBe(190);
      expect(patched[0].gross_profit).toBe(4236); // 100 × (190 − 147.64)
    });

    it('a ₱0 redelivery row edited for any reason stays at basis 0 / −14,764 / −16,764', async () => {
      // The ledger dialog resends `amount` on every save, so an unrelated edit
      // (notes, client reason…) arrives with amount: 0 and must NOT flip a
      // capped redelivery to a full margin it never earned.
      const { patched } = serveRow(redeliveryRow);
      await updateLedgerEntry('ledger-redelivery', 'ship-001', dispatchOldEntry, {
        amount: 0,
        notes: 'driver changed',
      });

      expect(patched[0].profit_basis_price_per_bag).toBe(0);
      expect(patched[0].gross_profit).toBe(-14764);
      expect(patched[0].net_profit).toBe(-16764);
    });

    it('a basis-0 row edited UP to a positive amount takes the live reference (deliberate correction)', async () => {
      const { patched } = serveRow(redeliveryRow);
      await updateLedgerEntry('ledger-redelivery', 'ship-001', dispatchOldEntry, {
        amount: 18000,
      });

      expect(patched[0].profit_basis_price_per_bag).toBe(185); // from getCostConfig()
      expect(patched[0].gross_profit).toBe(3736);
      expect(patched[0].net_profit).toBe(1736);
    });

    it('a new-style row edited DOWN to ₱0 recognizes no margin (basis 0)', async () => {
      const { patched } = serveRow(basisRow);
      await updateLedgerEntry('ledger-basis', 'ship-001', dispatchOldEntry, { amount: 0 });

      expect(patched[0].total_sales).toBe(0);
      expect(patched[0].profit_basis_price_per_bag).toBe(0);
      expect(patched[0].gross_profit).toBe(-14764);
    });

    it('identity: gross − net = qty × local expenses on every edited dispatch row', async () => {
      for (const row of [basisRow, legacyRow, redeliveryRow]) {
        const { patched } = serveRow(row);
        await updateLedgerEntry(String(row.id), 'ship-001', dispatchOldEntry, { amount: 18000 });
        const gross = patched[0].gross_profit as number;
        const net = patched[0].net_profit as number;
        expect(Math.round((gross - net) * 100) / 100).toBe(100 * 20);
      }
    });
  });
});
