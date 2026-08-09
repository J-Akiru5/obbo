-- Migration: revive order_returns workflow + close shipment_ledger column drift
--
-- order_returns is declared in supabase/schema.sql (the hand-maintained
-- "canonical" doc) and in .agents/migrations/009_order_returns_and_return_reason.sql,
-- but was never promoted into supabase/migrations/ — the directory actually
-- deployed to the live database. Same for shipment_ledger.client_reason
-- (.agents/migrations/009) and shipment_ledger.delivery_receipt_id
-- (.agents/migrations/017_delivery_receipt_id_on_ledger.sql). This migration
-- closes all three gaps. Fully idempotent — safe to run even if some pieces
-- already partially landed.
--
-- Run in: Supabase Dashboard → SQL Editor.

-- ── order_returns ────────────────────────────────────────────
create table if not exists public.order_returns (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  client_id   uuid not null references public.profiles(id) on delete set null,
  jb_qty      integer not null default 0,
  sb_qty      integer not null default 0,
  reason      text not null default '',
  status      text not null default 'pending',
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Widen status enum from ('pending','processed') to ('pending','approved','rejected')
-- — we now have a distinct rejection state for the admin review workflow.
alter table public.order_returns drop constraint if exists order_returns_status_check;
alter table public.order_returns
  add constraint order_returns_status_check check (status in ('pending', 'approved', 'rejected'));

-- Any pre-existing 'processed' rows (shouldn't exist live since the table was
-- never promoted, but guard anyway for safety) become approved.
update public.order_returns set status = 'approved' where status = 'processed';

alter table public.order_returns add column if not exists admin_note text;

alter table public.order_returns enable row level security;

drop policy if exists "order_returns: client own" on public.order_returns;
drop policy if exists "order_returns: client insert own" on public.order_returns;
drop policy if exists "order_returns: admin all" on public.order_returns;
create policy "order_returns: client own"
  on public.order_returns for select using (client_id = auth.uid());
create policy "order_returns: client insert own"
  on public.order_returns for insert with check (client_id = auth.uid());
create policy "order_returns: admin all"
  on public.order_returns for all using (public.is_admin());

-- ── shipment_ledger.client_reason ───────────────────────────────
alter table public.shipment_ledger add column if not exists client_reason text;

-- ── shipment_ledger.delivery_receipt_id ─────────────────────────
alter table public.shipment_ledger add column if not exists delivery_receipt_id uuid;

-- Backfill existing rows by matching dr_number + shipment_id, most-recent DR wins.
update public.shipment_ledger sl
set delivery_receipt_id = (
    select dr.id
    from public.delivery_receipts dr
    where dr.dr_number = sl.dr_number
      and dr.shipment_id = sl.shipment_id
    order by dr.created_at desc
    limit 1
)
where sl.dr_number is not null
  and sl.delivery_receipt_id is null;

alter table public.shipment_ledger drop constraint if exists fk_shipment_ledger_delivery_receipt;
alter table public.shipment_ledger
  add constraint fk_shipment_ledger_delivery_receipt
  foreign key (delivery_receipt_id)
  references public.delivery_receipts(id)
  on delete set null;

create index if not exists idx_shipment_ledger_delivery_receipt_id
  on public.shipment_ledger(delivery_receipt_id);
