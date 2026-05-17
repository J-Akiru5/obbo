-- Migration: Add RLS policy for clients to update their own orders
-- Fixes bug where submitPaymentDetails silently fails (no UPDATE policy for clients)

drop policy if exists "orders: client update own" on public.orders;
create policy "orders: client update own"
  on public.orders for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid());
