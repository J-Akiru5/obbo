-- ============================================================
-- OBBO iManage — Complete Supabase Schema (v2)
-- Idempotent: safe to run on fresh OR existing databases.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── PROFILES ─────────────────────────────────────────────────
create table if not exists public.profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  email                       text not null,
  full_name                   text not null default '',
  first_name                  text,
  surname                     text,
  account_type                text check (account_type in ('individual', 'company')),
  company_name                text,
  contact_person_first_name   text,
  contact_person_surname      text,
  phone                       text,
  address_street              text,
  address_city                text,
  address_province            text,
  address_postal_code         text,
  business_permit_no          text,
  tin_no                      text,
  kyc_documents               text[],
  kyc_status                  text not null default 'pending_verification'
                                check (kyc_status in ('pending_verification', 'verified', 'rejected')),
  role                        text not null default 'client'
                                check (role in ('admin', 'client', 'warehouse_manager')),
  avatar_url                  text,
  notification_preferences    jsonb default '{"order_approval":true,"payment_required":true,"dispatch":true,"delivery_status":true}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Patch constraints for existing DBs
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'client', 'warehouse_manager'));
alter table public.profiles
  add column if not exists notification_preferences jsonb
  default '{"order_approval":true,"payment_required":true,"dispatch":true,"delivery_status":true}'::jsonb;

-- ── Auto-create profile on signup ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (
    id, email, full_name, first_name, surname, account_type,
    company_name, contact_person_first_name, contact_person_surname,
    phone, address_street, address_city, address_province,
    address_postal_code, business_permit_no, tin_no, role, kyc_status
  ) values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'surname',
    new.raw_user_meta_data->>'account_type',
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'contact_person_first_name',
    new.raw_user_meta_data->>'contact_person_surname',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'address_street',
    new.raw_user_meta_data->>'address_city',
    new.raw_user_meta_data->>'address_province',
    new.raw_user_meta_data->>'address_postal_code',
    new.raw_user_meta_data->>'business_permit_no',
    new.raw_user_meta_data->>'tin_no',
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'kyc_status', 'pending_verification')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── PRODUCTS ─────────────────────────────────────────────────
-- price_port:      price when client picks up at port
-- price_warehouse: price when delivered from warehouse
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text not null default '',
  bag_type        text not null check (bag_type in ('JB', 'SB')),
  price_per_bag   numeric(12, 2) not null,
  price_port      numeric(12, 2),
  price_warehouse numeric(12, 2),
  image_url       text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
-- For existing DBs
alter table public.products add column if not exists price_port      numeric(12,2);
alter table public.products add column if not exists price_warehouse numeric(12,2);
update public.products
  set price_port = price_per_bag, price_warehouse = price_per_bag
  where price_port is null or price_warehouse is null;

-- ── SHIPMENTS ────────────────────────────────────────────────
create table if not exists public.shipments (
  id               uuid primary key default gen_random_uuid(),
  batch_name       text not null unique,
  product_id       uuid references public.products(id) on delete set null,
  bag_type         text check (bag_type in ('JB', 'SB')),
  initial_quantity integer not null default 0 check (initial_quantity >= 0),
  good_stock       integer not null default 0 check (good_stock >= 0),
  damaged_stock    integer not null default 0 check (damaged_stock >= 0),
  total_jb         integer not null default 0,
  total_sb         integer not null default 0,
  remaining_jb     integer not null default 0,
  remaining_sb     integer not null default 0,
  arrival_date     date not null,
  notes            text,
  created_at       timestamptz not null default now()
);
-- For existing DBs
alter table public.shipments add column if not exists total_jb     integer not null default 0;
alter table public.shipments add column if not exists total_sb     integer not null default 0;
alter table public.shipments add column if not exists remaining_jb integer not null default 0;
alter table public.shipments add column if not exists remaining_sb integer not null default 0;
alter table public.shipments alter column product_id drop not null;
alter table public.shipments alter column bag_type   drop not null;

-- ── SHIPMENT LEDGER ──────────────────────────────────────────
create table if not exists public.shipment_ledger (
  id            uuid primary key default gen_random_uuid(),
  shipment_id   uuid not null references public.shipments(id) on delete cascade,
  date          date not null default current_date,
  dr_number     text,
  po_number     text,
  client_name   text,
  jb            integer not null default 0,
  sb            integer not null default 0,
  bags_returned integer not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── DELIVERY RECEIPTS ────────────────────────────────────────
create table if not exists public.delivery_receipts (
  id            uuid primary key default gen_random_uuid(),
  shipment_id   uuid not null references public.shipments(id) on delete cascade,
  dr_number     text not null unique,
  quantity      integer not null check (quantity > 0),
  bag_type      text not null check (bag_type in ('JB', 'SB')),
  received_date date not null,
  notes         text,
  po_number     text,
  client_name   text,
  client_id     uuid references public.profiles(id) on delete set null,
  jb            integer not null default 0,
  sb            integer not null default 0,
  driver        text,
  plate_number  text,
  shipping_fee  numeric(12, 2),
  dr_image_url  text,
  created_at    timestamptz not null default now()
);
-- For existing DBs
alter table public.delivery_receipts add column if not exists po_number    text;
alter table public.delivery_receipts add column if not exists client_name  text;
alter table public.delivery_receipts add column if not exists client_id    uuid references public.profiles(id) on delete set null;
alter table public.delivery_receipts add column if not exists jb           integer not null default 0;
alter table public.delivery_receipts add column if not exists sb           integer not null default 0;
alter table public.delivery_receipts add column if not exists driver       text;
alter table public.delivery_receipts add column if not exists plate_number text;
alter table public.delivery_receipts add column if not exists shipping_fee numeric(12, 2);
alter table public.delivery_receipts add column if not exists dr_image_url text;
alter table public.delivery_receipts add column if not exists destination  text;
alter table public.delivery_receipts add column if not exists order_id     uuid references public.orders(id) on delete set null;

-- ── ORDERS ───────────────────────────────────────────────────
create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.profiles(id),
  status               text not null default 'pending'
                         check (status in ('pending','approved','partially_approved',
                                           'awaiting_check','dispatched','completed','rejected')),
  total_amount         numeric(14, 2) not null default 0,
  payment_method       text not null check (payment_method in ('cash', 'check')),
  check_image_url      text,
  check_number         text,
  notes                text,
  po_number            text,
  po_image_url         text,
  source               text not null default 'port' check (source in ('port', 'warehouse')),
  service_type         text not null default 'deliver' check (service_type in ('pickup', 'deliver')),
  shipping_fee         numeric(12, 2) not null default 0,
  dr_number            text,
  dr_image_url         text,
  driver_name          text,
  plate_number         text,
  rejection_reason     text,
  tracking_status      text not null default 'pending_dispatch'
                         check (tracking_status in ('pending_dispatch','in_transit','delivered','bags_returned')),
  bags_returned_jb     integer not null default 0,
  bags_returned_sb     integer not null default 0,
  shipment_id          uuid references public.shipments(id) on delete set null,
  is_split_delivery    boolean not null default false,
  deliver_now_qty      integer not null default 0,
  supplier_name        text,
  preferred_pickup_date date,
  order_type           text not null default 'new'
                         check (order_type in ('new', 'redelivery', 'draft')),
  linked_po_number     text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
-- For existing DBs
alter table public.orders add column if not exists po_number             text;
alter table public.orders add column if not exists po_image_url          text;
alter table public.orders add column if not exists source                text not null default 'port';
alter table public.orders add column if not exists service_type          text not null default 'deliver';
alter table public.orders add column if not exists shipping_fee          numeric(12,2) not null default 0;
alter table public.orders add column if not exists dr_number             text;
alter table public.orders add column if not exists dr_image_url          text;
alter table public.orders add column if not exists driver_name           text;
alter table public.orders add column if not exists plate_number          text;
alter table public.orders add column if not exists rejection_reason      text;
alter table public.orders add column if not exists tracking_status       text not null default 'pending_dispatch';
alter table public.orders add column if not exists bags_returned_jb      integer not null default 0;
alter table public.orders add column if not exists bags_returned_sb      integer not null default 0;
alter table public.orders add column if not exists shipment_id           uuid references public.shipments(id) on delete set null;
alter table public.orders add column if not exists is_split_delivery     boolean not null default false;
alter table public.orders add column if not exists deliver_now_qty       integer not null default 0;
alter table public.orders add column if not exists supplier_name         text;
alter table public.orders add column if not exists preferred_pickup_date date;
alter table public.orders add column if not exists order_type            text not null default 'new';
alter table public.orders add column if not exists linked_po_number      text;

alter table public.orders drop constraint if exists orders_order_type_check;
alter table public.orders add  constraint orders_order_type_check
  check (order_type in ('new', 'redelivery', 'draft'));

-- ── ORDER ITEMS ──────────────────────────────────────────────
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  product_id     uuid not null references public.products(id),
  bag_type       text not null check (bag_type in ('JB', 'SB')),
  requested_qty  integer not null check (requested_qty > 0),
  approved_qty   integer not null default 0 check (approved_qty >= 0),
  dispatched_qty integer not null default 0 check (dispatched_qty >= 0)
);

-- ── CUSTOMER BALANCES ────────────────────────────────────────
create table if not exists public.customer_balances (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id),
  order_id      uuid not null references public.orders(id),
  product_id    uuid not null references public.products(id),
  bag_type      text not null check (bag_type in ('JB', 'SB')),
  remaining_qty integer not null check (remaining_qty > 0),
  status        text not null default 'pending' check (status in ('pending', 'fulfilled')),
  created_at    timestamptz not null default now()
);

-- ── PURCHASE ORDERS ──────────────────────────────────────────
create table if not exists public.purchase_orders (
  id           uuid primary key default gen_random_uuid(),
  date         date not null default current_date,
  po_number    text not null unique,
  client_id    uuid references public.profiles(id) on delete set null,
  client_name  text,
  jb           integer not null default 0,
  sb           integer not null default 0,
  status       text not null default 'pending',
  source       text check (source in ('port', 'warehouse')),
  service_type text check (service_type in ('pickup', 'deliver')),
  shipment_id  uuid references public.shipments(id) on delete set null,
  order_id     uuid references public.orders(id) on delete set null,
  check_number text,
  check_amount numeric(12, 2),
  cash_amount  numeric(12, 2),
  photo_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- For existing DBs
alter table public.purchase_orders add column if not exists check_number text;
alter table public.purchase_orders add column if not exists check_amount numeric(12, 2);
alter table public.purchase_orders add column if not exists cash_amount  numeric(12, 2);
alter table public.purchase_orders add column if not exists photo_url    text;

-- ── WAREHOUSE REPORTS ────────────────────────────────────────
create table if not exists public.warehouse_reports (
  id             uuid primary key default gen_random_uuid(),
  report_date    date not null unique,
  yesterday_jb   integer not null default 0,
  yesterday_sb   integer not null default 0,
  received_jb    integer not null default 0,
  received_sb    integer not null default 0,
  dispatched_jb  integer not null default 0,
  dispatched_sb  integer not null default 0,
  returned_jb    integer not null default 0,
  returned_sb    integer not null default 0,
  waste_jb       integer not null default 0,
  waste_sb       integer not null default 0,
  closing_jb     integer not null default 0,
  closing_sb     integer not null default 0,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── ADMIN SETTINGS ───────────────────────────────────────────
create table if not exists public.admin_settings (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ── ACTIVITY LOG ─────────────────────────────────────────────
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ── NOTIFICATIONS ───────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  message    text not null,
  href       text,
  severity   text not null default 'info' check (severity in ('info','warning','success')),
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── ENABLE RLS ───────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.products          enable row level security;
alter table public.shipments         enable row level security;
alter table public.shipment_ledger   enable row level security;
alter table public.delivery_receipts enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.customer_balances enable row level security;
alter table public.purchase_orders   enable row level security;
alter table public.warehouse_reports enable row level security;
alter table public.admin_settings    enable row level security;
alter table public.activity_log      enable row level security;
alter table public.notifications     enable row level security;

-- ── HELPER FUNCTIONS ─────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'warehouse_manager')
  );
$$;

create or replace function public.is_verified_client()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'client' and kyc_status = 'verified'
  );
$$;

-- ── RLS POLICIES ─────────────────────────────────────────────
-- profiles
drop policy if exists "profiles: own read"   on public.profiles;
drop policy if exists "profiles: own update" on public.profiles;
drop policy if exists "profiles: admin all"  on public.profiles;
create policy "profiles: own read"   on public.profiles for select using (id = auth.uid());
create policy "profiles: own update" on public.profiles for update using (id = auth.uid());
create policy "profiles: admin all"  on public.profiles for all    using (public.is_admin());

-- products
drop policy if exists "products: verified clients read" on public.products;
drop policy if exists "products: admin all"             on public.products;
create policy "products: verified clients read"
  on public.products for select using (is_active = true and public.is_verified_client());
create policy "products: admin all"
  on public.products for all using (public.is_admin());

-- shipments
drop policy if exists "shipments: admin all" on public.shipments;
create policy "shipments: admin all" on public.shipments for all using (public.is_admin());

-- shipment_ledger
drop policy if exists "shipment_ledger: admin all" on public.shipment_ledger;
create policy "shipment_ledger: admin all" on public.shipment_ledger for all using (public.is_admin());

-- delivery_receipts
drop policy if exists "delivery_receipts: admin all" on public.delivery_receipts;
create policy "delivery_receipts: admin all" on public.delivery_receipts for all using (public.is_admin());

-- orders
drop policy if exists "orders: client insert"   on public.orders;
drop policy if exists "orders: client read own" on public.orders;
drop policy if exists "orders: admin all"       on public.orders;
create policy "orders: client insert"
  on public.orders for insert with check (client_id = auth.uid() and public.is_verified_client());
create policy "orders: client read own"
  on public.orders for select using (client_id = auth.uid());
create policy "orders: admin all"
  on public.orders for all using (public.is_admin());

-- order_items
drop policy if exists "order_items: client read own"   on public.order_items;
drop policy if exists "order_items: client insert own" on public.order_items;
drop policy if exists "order_items: admin all"         on public.order_items;
create policy "order_items: client read own"
  on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.client_id = auth.uid()));
create policy "order_items: client insert own"
  on public.order_items for insert
  with check (exists (select 1 from public.orders o where o.id = order_id and o.client_id = auth.uid()));
create policy "order_items: admin all"
  on public.order_items for all using (public.is_admin());

-- customer_balances
drop policy if exists "balances: client read own" on public.customer_balances;
drop policy if exists "balances: admin all"       on public.customer_balances;
create policy "balances: client read own"
  on public.customer_balances for select using (client_id = auth.uid());
create policy "balances: admin all"
  on public.customer_balances for all using (public.is_admin());

-- purchase_orders
drop policy if exists "purchase_orders: admin all" on public.purchase_orders;
create policy "purchase_orders: admin all" on public.purchase_orders for all using (public.is_admin());

-- warehouse_reports
drop policy if exists "warehouse_reports: admin all" on public.warehouse_reports;
create policy "warehouse_reports: admin all" on public.warehouse_reports for all using (public.is_admin());

-- admin_settings
drop policy if exists "admin_settings: admin all" on public.admin_settings;
create policy "admin_settings: admin all" on public.admin_settings for all using (public.is_admin());

-- activity_log
drop policy if exists "activity_log: admin all" on public.activity_log;
create policy "activity_log: admin all" on public.activity_log for all using (public.is_admin());

-- notifications
drop policy if exists "notifications: own read"    on public.notifications;
drop policy if exists "notifications: own update"  on public.notifications;
drop policy if exists "notifications: admin insert" on public.notifications;
create policy "notifications: own read"    on public.notifications for select using (user_id = auth.uid());
create policy "notifications: own update"  on public.notifications for update using (user_id = auth.uid());
create policy "notifications: admin insert" on public.notifications for insert with check (public.is_admin());

-- ── CANONICAL PRODUCT SEED ───────────────────────────────────
-- Only Portland Cement Type 1 — SB (₱235 port / ₱240 warehouse)
-- and JB (₱5,700 port / ₱5,800 warehouse).
-- On conflict: do nothing (preserves any price edits made via admin UI).
insert into public.products (name, description, bag_type, price_per_bag, price_port, price_warehouse, is_active)
values
  ('Portland Cement Type 1', 'General-purpose Portland cement. 40 kg per bag.', 'SB', 240,  235,  240,  true),
  ('Portland Cement Type 1', 'General-purpose Portland cement. 1-ton jumbo bag.','JB', 5800, 5700, 5800, true)
on conflict do nothing;

-- ── PROMOTE ADMIN ─────────────────────────────────────────────
-- After signing up, run the line below in the SQL Editor to grant admin access:
-- update public.profiles
--   set role = 'admin', kyc_status = 'verified'
--   where email = 'your-email@example.com';

-- ── REALTIME PUBLICATIONS ────────────────────────────────────
-- Uncomment and run separately if you want live updates:
-- alter publication supabase_realtime add table public.orders;
-- alter publication supabase_realtime add table public.activity_log;
-- alter publication supabase_realtime add table public.profiles;
-- alter publication supabase_realtime add table public.notifications;
-- alter publication supabase_realtime add table public.products;
