import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { addLedgerEntry, updateLedgerEntry } from './ledger-actions';

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
