-- ============================================================
-- OBBO iManage — Migration 005: Warehouse Manager Role & Schema
-- Run this in Supabase SQL Editor AFTER migration 004
-- Adds all missing warehouse manager database structures
-- ============================================================

-- ── PROFILES: extend role constraint ─────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'client', 'warehouse_manager'));

-- ── SHIPMENT ENHANCEMENTS ────────────────────────────────────
-- Enhance shipments table to better support batch concept
alter table public.shipments add column if not exists source text check (source in ('PORT', 'WAREHOUSE'));
alter table public.shipments add column if not exists warehouse_manager_id uuid references public.profiles(id);

-- ── SHIPMENT LEDGER: Track transactions within each batch ──────
create table if not exists public.shipment_ledger (
  id                uuid primary key default gen_random_uuid(),
  shipment_id       uuid not null references public.shipments(id) on delete cascade,
  transaction_date  date not null,
  dr_number         text,
  po_number         text,
  client_id         uuid references public.profiles(id),
  client_name       text,
  driver_name       text,
  plate_number      text,
  jb_quantity       integer not null default 0 check (jb_quantity >= 0),
  sb_quantity       integer not null default 0 check (sb_quantity >= 0),
  bags_returned     integer not null default 0 check (bags_returned >= 0),
  total_bags        integer not null default 0 check (total_bags >= 0),
  remaining_balance integer not null default 0 check (remaining_balance >= 0),
  notes             text,
  created_by        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── PURCHASE ORDERS (PO): Manual and walk-in orders ──────────
create table if not exists public.purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  po_number       text not null unique,
  po_date         date not null,
  client_id       uuid references public.profiles(id),
  client_name     text not null,
  jb_quantity     integer not null default 0 check (jb_quantity >= 0),
  sb_quantity     integer not null default 0 check (sb_quantity >= 0),
  total_bags      integer not null default 0 check (total_bags >= 0),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'partially_approved', 'rejected', 'completed')),
  source          text not null check (source in ('PORT', 'WAREHOUSE')),
  service_type    text not null check (service_type in ('pick-up', 'delivery')),
  payment_method  text check (payment_method in ('cash', 'check')),
  shipping_fee    numeric(12, 2),
  notes           text,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── DELIVERY RECEIPTS: Enhanced with all required fields ───────
alter table public.delivery_receipts add column if not exists po_number text;
alter table public.delivery_receipts add column if not exists client_id uuid references public.profiles(id);
alter table public.delivery_receipts add column if not exists client_name text;
alter table public.delivery_receipts add column if not exists driver_name text;
alter table public.delivery_receipts add column if not exists driver_plate_number text;
alter table public.delivery_receipts add column if not exists source text check (source in ('PORT', 'WAREHOUSE'));
alter table public.delivery_receipts add column if not exists service_type text check (service_type in ('pick-up', 'delivery'));
alter table public.delivery_receipts add column if not exists shipping_fee numeric(12, 2);
alter table public.delivery_receipts add column if not exists dispatch_notes text;
alter table public.delivery_receipts add column if not exists created_by uuid references public.profiles(id);
alter table public.delivery_receipts add column if not exists updated_at timestamptz;

-- ── WAREHOUSE SETTINGS ───────────────────────────────────────
create table if not exists public.warehouse_settings (
  id                uuid primary key default gen_random_uuid(),
  warehouse_manager_id uuid not null unique references public.profiles(id) on delete cascade,
  email             text,
  phone             text,
  business_hours    text,
  appearance_mode   text default 'light' check (appearance_mode in ('light', 'dark', 'system')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── REPORTS: Track Daily Reports (Physical Inventory, Customer Movement, Obligations) ──
create table if not exists public.daily_reports (
  id                  uuid primary key default gen_random_uuid(),
  report_date         date not null,
  warehouse_manager_id uuid not null references public.profiles(id),
  -- Physical Warehouse Inventory Report
  prev_day_inventory_jb integer,
  prev_day_inventory_sb integer,
  stock_received_jb   integer default 0 check (stock_received_jb >= 0),
  stock_received_sb   integer default 0 check (stock_received_sb >= 0),
  stock_waste_jb      integer default 0 check (stock_waste_jb >= 0),
  stock_waste_sb      integer default 0 check (stock_waste_sb >= 0),
  stock_movement_notes text,
  -- Customer Movement Today Report (stored as JSONB for flexibility)
  customer_movement   jsonb,
  -- Customer Obligation Report (remaining balances, stored as JSONB)
  customer_balances   jsonb,
  -- Report Status
  status              text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  submitted_at        timestamptz,
  rejection_reason    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── AUDIT ENHANCEMENTS: Better logging for warehouse manager actions ──
alter table public.activity_log add column if not exists warehouse_manager_id uuid references public.profiles(id);
alter table public.activity_log add column if not exists target_client_id uuid references public.profiles(id);

-- ── HELPERS: Updated is_admin() to include warehouse_manager ──
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'warehouse_manager')
  );
$$;

-- ── HELPER: is_warehouse_manager() ──────────────────────────
create or replace function public.is_warehouse_manager()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'warehouse_manager'
  );
$$;

-- ── RLS: Enable security on new tables ──────────────────────-
alter table public.shipment_ledger enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.warehouse_settings enable row level security;
alter table public.daily_reports enable row level security;

-- ── RLS POLICIES: shipment_ledger ──────────────────────────-
drop policy if exists "shipment_ledger: admin/manager all" on public.shipment_ledger;
create policy "shipment_ledger: admin/manager all"
  on public.shipment_ledger for all using (public.is_admin());

-- ── RLS POLICIES: purchase_orders ──────────────────────────
drop policy if exists "purchase_orders: admin/manager all" on public.purchase_orders;
create policy "purchase_orders: admin/manager all"
  on public.purchase_orders for all using (public.is_admin());

-- ── RLS POLICIES: warehouse_settings ──────────────────────
drop policy if exists "warehouse_settings: own update" on public.warehouse_settings;
drop policy if exists "warehouse_settings: own read" on public.warehouse_settings;
drop policy if exists "warehouse_settings: admin all" on public.warehouse_settings;
create policy "warehouse_settings: own read"
  on public.warehouse_settings for select using (warehouse_manager_id = auth.uid());
create policy "warehouse_settings: own update"
  on public.warehouse_settings for update using (warehouse_manager_id = auth.uid());
create policy "warehouse_settings: admin all"
  on public.warehouse_settings for all using (public.is_admin());

-- ── RLS POLICIES: daily_reports ────────────────────────────
drop policy if exists "daily_reports: manager own" on public.daily_reports;
drop policy if exists "daily_reports: admin all" on public.daily_reports;
create policy "daily_reports: manager own"
  on public.daily_reports for select using (warehouse_manager_id = auth.uid());
create policy "daily_reports: manager insert own"
  on public.daily_reports for insert with check (warehouse_manager_id = auth.uid());
create policy "daily_reports: manager update own draft"
  on public.daily_reports for update using (warehouse_manager_id = auth.uid() and status = 'draft');
create policy "daily_reports: admin all"
  on public.daily_reports for all using (public.is_admin());

-- ── RLS POLICIES: delivery_receipts (updated for warehouse manager) ──
drop policy if exists "delivery_receipts: admin all" on public.delivery_receipts;
create policy "delivery_receipts: admin/manager all"
  on public.delivery_receipts for all using (public.is_admin());

-- ── HELPER: Function to calculate net available stock ────────
create or replace function public.get_net_available_stock(
  p_shipment_id uuid
)
returns table (
  jb_stock integer,
  sb_stock integer,
  grand_total integer
) language sql security definer as $$
  select
    coalesce((select sum(jb_quantity) from public.shipment_ledger where shipment_id = p_shipment_id), 0) as jb_stock,
    coalesce((select sum(sb_quantity) from public.shipment_ledger where shipment_id = p_shipment_id), 0) as sb_stock,
    coalesce((select sum(jb_quantity) + sum(sb_quantity) from public.shipment_ledger where shipment_id = p_shipment_id), 0) as grand_total;
$$;

-- ── HELPER: Function to calculate total client balances ──────
create or replace function public.get_total_client_balances()
returns table (
  jb_owed integer,
  sb_owed integer,
  grand_total integer
) language sql security definer as $$
  select
    coalesce(sum(case when jb_quantity > jb_quantity - bags_returned then jb_quantity - bags_returned else 0 end), 0) as jb_owed,
    coalesce(sum(case when sb_quantity > sb_quantity - bags_returned then sb_quantity - bags_returned else 0 end), 0) as sb_owed,
    coalesce(sum(remaining_balance), 0) as grand_total
  from public.shipment_ledger;
$$;
