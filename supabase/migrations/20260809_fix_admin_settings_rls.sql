-- Migration: 20260809_fix_admin_settings_rls
--
-- BUG FIX: admin_settings writes silently discarded by Postgres RLS.
--
-- Root cause: `for all using (...)` without `with check` defaults the
-- WITH CHECK expression to FALSE in Postgres, which silently blocks all
-- INSERT and UPSERT operations. The admin Settings page showed "success"
-- toasts but never actually wrote any data because the server action only
-- checked `error` (null), not the row count (0).
--
-- Fix: Replace the single broken policy with explicit read + write policies.
-- Also add a narrow client-read policy so getContactInfo() in client-actions.ts
-- can continue to read the contact_info row from a client session.
-- Finally, seed the missing contact_info row.

-- ── Drop old broken policy ────────────────────────────────────────────────────
drop policy if exists "admin_settings: admin all"                on public.admin_settings;
drop policy if exists "admin_settings: admin write"              on public.admin_settings;
drop policy if exists "admin_settings: admin read"               on public.admin_settings;
drop policy if exists "admin_settings: client read contact_info" on public.admin_settings;

-- ── Admin read (all rows) ─────────────────────────────────────────────────────
create policy "admin_settings: admin read"
  on public.admin_settings for select
  using (public.is_admin());

-- ── Admin write — WITH CHECK is required to unlock INSERT / UPSERT ─────────────
create policy "admin_settings: admin write"
  on public.admin_settings for all
  using  (public.is_admin())
  with check (public.is_admin());

-- ── Verified clients: read contact_info only ──────────────────────────────────
-- Required by getContactInfo() in client-actions.ts which runs under a
-- verified-client session (not a service-role session).
create policy "admin_settings: client read contact_info"
  on public.admin_settings for select
  using (key = 'contact_info' and public.is_verified_client());

-- ── Seed missing contact_info row ─────────────────────────────────────────────
-- The original schema.sql only seeded cost_config. Fresh and existing DBs
-- that never had this key will load empty fields on the Settings page.
insert into public.admin_settings (key, value)
values (
  'contact_info',
  '{"email": "support@obbo.com", "phone": "+63 912 345 6789", "address": "Pototan, Iloilo", "businessHours": "Mon - Fri, 8:00 AM - 5:00 PM"}'::jsonb
)
on conflict (key) do nothing;
