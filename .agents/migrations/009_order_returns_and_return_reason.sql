-- Add return_reason and client_reason to shipment_ledger
alter table public.shipment_ledger add column if not exists return_reason text not null default 'return';
alter table public.shipment_ledger drop constraint if exists shipment_ledger_return_reason_check;
alter table public.shipment_ledger add constraint shipment_ledger_return_reason_check check (return_reason in ('return', 'waste', 'damage'));
alter table public.shipment_ledger add column if not exists client_reason text;

-- Create order_returns table for client-submitted return requests
create table if not exists public.order_returns (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  client_id   uuid not null references public.profiles(id),
  jb_qty      integer not null default 0,
  sb_qty      integer not null default 0,
  reason      text not null default '',
  status      text not null default 'pending' check (status in ('pending', 'processed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Enable RLS
alter table public.order_returns enable row level security;

-- RLS policies
drop policy if exists "order_returns: client own" on public.order_returns;
drop policy if exists "order_returns: client insert own" on public.order_returns;
drop policy if exists "order_returns: admin all" on public.order_returns;
create policy "order_returns: client own"
  on public.order_returns for select using (client_id = auth.uid());
create policy "order_returns: client insert own"
  on public.order_returns for insert with check (client_id = auth.uid());
create policy "order_returns: admin all"
  on public.order_returns for all using (public.is_admin());
