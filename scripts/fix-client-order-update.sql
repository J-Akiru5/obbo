-- Run this in Supabase Dashboard → SQL Editor
-- Adds RLS policy that allows clients to UPDATE their own orders
-- This fixes the "error occurred in server components" when uploading check details

drop policy if exists "orders: client update own" on public.orders;
create policy "orders: client update own"
  on public.orders for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid());
