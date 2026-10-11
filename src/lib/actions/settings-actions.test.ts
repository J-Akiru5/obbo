import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { costConfigSchema } from './schemas';
import { saveCostConfig, saveCostConfiguration } from './settings-actions';

const { getCostConfigMock } = vi.hoisted(() => ({ getCostConfigMock: vi.fn() }));

// getCostConfig() calls requireAdmin() as a same-module reference, bypassing
// the global stub — replace it (and requireAdmin) here, same approach as the
// other action tests.
vi.mock('@/lib/actions/admin-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/actions/admin-helpers')>();
  return {
    ...actual,
    getCostConfig: getCostConfigMock,
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
  };
});

function captureCostConfigUpserts() {
  const upserts: { key: string; value: Record<string, unknown> }[] = [];
  server.use(
    http.post('*/rest/v1/admin_settings', async ({ request }) => {
      const body = (await request.json()) as { key: string; value: Record<string, unknown> };
      upserts.push(body);
      return HttpResponse.json([body]);
    }),
    http.post('*/rest/v1/activity_log', () => HttpResponse.json([])),
  );
  return upserts;
}

describe('cost config — reference_price_per_bag', () => {
  beforeEach(() => {
    getCostConfigMock.mockReset();
    getCostConfigMock.mockResolvedValue({
      landed_cost_per_bag: 147.64,
      local_expenses_per_bag: 20,
      reference_price_per_bag: 190,
    });
  });

  describe('saveCostConfiguration (the Inventory cost tab)', () => {
    it('carries the stored reference price over instead of dropping it from the JSON', async () => {
      const upserts = captureCostConfigUpserts();

      const result = await saveCostConfiguration(150, 25);

      expect(result.success).toBe(true);
      expect(upserts).toHaveLength(1);
      expect(upserts[0].key).toBe('cost_config');
      // The whole JSON is overwritten, so the reference price must be passed through.
      expect(upserts[0].value).toEqual({
        landed_cost_per_bag: 150,
        local_expenses_per_bag: 25,
        reference_price_per_bag: 190,
      });
    });

    it('saves an explicitly supplied reference price', async () => {
      const upserts = captureCostConfigUpserts();

      const result = await saveCostConfiguration(150, 25, 195);

      expect(result.success).toBe(true);
      expect(upserts[0].value.reference_price_per_bag).toBe(195);
    });
  });

  describe('saveCostConfig (the Settings page)', () => {
    const full = {
      landed_cost_per_bag: 147.64,
      local_expenses_per_bag: 20,
      reference_price_per_bag: 185,
    };

    it('saves all three keys', async () => {
      const upserts = captureCostConfigUpserts();

      const result = await saveCostConfig(full);

      expect(result.success).toBe(true);
      expect(upserts[0].value).toEqual(full);
    });

    it('rejects the old two-key shape (it would silently reset the reference price)', async () => {
      const upserts = captureCostConfigUpserts();

      const result = await saveCostConfig({
        landed_cost_per_bag: 147.64,
        local_expenses_per_bag: 20,
      } as never);

      expect(result.success).toBe(false);
      expect(upserts).toHaveLength(0);
    });

    it('rejects unknown keys and a non-positive reference price', async () => {
      const upserts = captureCostConfigUpserts();

      expect((await saveCostConfig({ ...full, margin: 37.36 } as never)).success).toBe(false);
      expect((await saveCostConfig({ ...full, reference_price_per_bag: 0 })).success).toBe(false);
      expect((await saveCostConfig({ ...full, reference_price_per_bag: -5 })).success).toBe(false);
      expect(upserts).toHaveLength(0);
    });
  });

  describe('costConfigSchema', () => {
    it('is strict', () => {
      const ok = {
        landed_cost_per_bag: 147.64,
        local_expenses_per_bag: 20,
        reference_price_per_bag: 185,
      };
      expect(costConfigSchema.safeParse(ok).success).toBe(true);
      expect(costConfigSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    });
  });
});
