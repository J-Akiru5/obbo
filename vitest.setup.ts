import '@testing-library/jest-dom/vitest';
import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './mocks/server';

// Mock Supabase server client (uses cookies() — unavailable in jsdom)
vi.mock('@/lib/supabase/server', async () => {
  const { createBrowserClient } = await import('@supabase/ssr');
  return {
    createClient: () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test-project.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key',
      ),
  };
});

// Stub auth / role checks so unit tests can focus on business logic.
// Full auth flow is tested via Playwright E2E tests.
vi.mock('@/lib/actions/admin-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/actions/admin-helpers')>(
    '@/lib/actions/admin-helpers',
  );
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
    requireAdminOnly: async () => {
      const { createBrowserClient } = await import('@supabase/ssr');
      return {
        supabase: createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test-project.supabase.co',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key',
        ),
        userId: 'admin-001',
      };
    },
  };
});

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
