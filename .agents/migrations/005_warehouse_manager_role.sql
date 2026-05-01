-- ============================================================
-- OBBO iManage — Migration 005: Warehouse Manager Role
-- Run this in Supabase SQL Editor AFTER migration 004
-- ============================================================

-- ── PROFILES: extend role constraint ─────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'client', 'warehouse_manager'));

-- ── HELPERS: allow warehouse manager access ─────────────────-
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'warehouse_manager')
  );
$$;
