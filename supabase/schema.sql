-- ============================================================
-- OBBO iManage — Complete Supabase Schema
-- Run this ONCE in your Supabase SQL Editor (Dashboard → SQL Editor)
-- This script is fully idempotent (safe to run on a fresh database)
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── PROFILES ─────────────────────────────────────────────────
create table if not exists public.profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  email                       text not null,
  -- Name fields
  full_name                   text not null default '',
  first_name                  text,
  surname                     text,
  -- Account type
  account_type                text check (account_type in ('individual', 'company')),
  -- Company / contact person fields (used when account_type = 'company')
  company_name                text,
  contact_person_first_name   text,
  contact_person_surname      text,
  -- Contact
  phone                       text,
  -- Address
  address_street              text,
  address_city                text,
  address_province            text,
  address_postal_code         text,
  -- Business verification fields
  business_permit_no          text,
  tin_no                      text,
  -- KYC
  kyc_documents               text[],
  kyc_status                  text not null default 'pending_verification'
                                check (kyc_status in ('pending_verification', 'verified', 'rejected')),
  -- Auth
  role                        text not null default 'client' check (role in ('admin', 'client')),
  avatar_url                  text,
  -- Timestamps
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ── Auto-create profile on signup ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    first_name,
    surname,
    account_type,
    company_name,
    contact_person_first_name,
    contact_person_surname,
    phone,
    address_street,
    address_city,
    address_province,
    address_postal_code,
    business_permit_no,
    tin_no,
    role,
    kyc_status
  )
  values (
    new.id,
    new.email,
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
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text not null default '',
  bag_type        text not null check (bag_type in ('JB', 'SB')),
  price_per_bag   numeric(12, 2) not null,
  image_url       text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ── SHIPMENTS ────────────────────────────────────────────────
create table if not exists public.shipments (
  id               uuid primary key default gen_random_uuid(),
  batch_name       text not null unique,
  product_id       uuid not null references public.products(id),
  bag_type         text not null check (bag_type in ('JB', 'SB')),
  initial_quantity integer not null check (initial_quantity >= 0),
  good_stock       integer not null check (good_stock >= 0),
  damaged_stock    integer not null default 0 check (damaged_stock >= 0),
  arrival_date     date not null,
  notes            text,
  created_at       timestamptz not null default now()
);

-- ── DELIVERY RECEIPTS ────────────────────────────────────────
create table if not exists public.delivery_receipts (
  id              uuid primary key default gen_random_uuid(),
  shipment_id     uuid not null references public.shipments(id) on delete cascade,
  dr_number       text not null unique,
  quantity        integer not null check (quantity > 0),
  bag_type        text not null check (bag_type in ('JB', 'SB')),
  received_date   date not null,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ── ORDERS ───────────────────────────────────────────────────
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles(id),
  status           text not null default 'pending'
                     check (status in (
                       'pending','approved','partially_approved',
                       'awaiting_check','dispatched','completed','rejected'
                     )),
  total_amount     numeric(14, 2) not null default 0,
  payment_method   text not null check (payment_method in ('cash', 'check')),
  check_image_url  text,
  check_number     text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── ORDER ITEMS ──────────────────────────────────────────────
create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  product_id      uuid not null references public.products(id),
  bag_type        text not null check (bag_type in ('JB', 'SB')),
  requested_qty   integer not null check (requested_qty > 0),
  approved_qty    integer not null default 0 check (approved_qty >= 0),
  dispatched_qty  integer not null default 0 check (dispatched_qty >= 0)
);

-- ── CUSTOMER BALANCES ────────────────────────────────────────
create table if not exists public.customer_balances (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.profiles(id),
  order_id        uuid not null references public.orders(id),
  product_id      uuid not null references public.products(id),
  bag_type        text not null check (bag_type in ('JB', 'SB')),
  remaining_qty   integer not null check (remaining_qty > 0),
  status          text not null default 'pending' check (status in ('pending', 'fulfilled')),
  created_at      timestamptz not null default now()
);

-- ── ACTIVITY LOG ─────────────────────────────────────────────
create table if not exists public.activity_log (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references public.profiles(id) on delete set null,
  action          text not null,
  entity_type     text not null,
  entity_id       uuid not null,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

-- ── ENABLE RLS ───────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.products          enable row level security;
alter table public.shipments         enable row level security;
alter table public.delivery_receipts enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.customer_balances enable row level security;
alter table public.activity_log      enable row level security;

-- ── HELPER: is_admin() ───────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── HELPER: is_verified_client() ─────────────────────────────
create or replace function public.is_verified_client()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'client' and kyc_status = 'verified'
  );
$$;

-- ── RLS POLICIES: profiles ───────────────────────────────────
drop policy if exists "profiles: own read"   on public.profiles;
drop policy if exists "profiles: own update" on public.profiles;
drop policy if exists "profiles: admin all"  on public.profiles;
create policy "profiles: own read"   on public.profiles for select using (id = auth.uid());
create policy "profiles: own update" on public.profiles for update using (id = auth.uid());
create policy "profiles: admin all"  on public.profiles for all using (public.is_admin());

-- ── RLS POLICIES: products ───────────────────────────────────
drop policy if exists "products: verified clients read" on public.products;
drop policy if exists "products: admin all"             on public.products;
create policy "products: verified clients read"
  on public.products for select using (is_active = true and public.is_verified_client());
create policy "products: admin all"
  on public.products for all using (public.is_admin());

-- ── RLS POLICIES: shipments ──────────────────────────────────
drop policy if exists "shipments: admin all" on public.shipments;
create policy "shipments: admin all"
  on public.shipments for all using (public.is_admin());

-- ── RLS POLICIES: delivery_receipts ─────────────────────────
drop policy if exists "delivery_receipts: admin all" on public.delivery_receipts;
create policy "delivery_receipts: admin all"
  on public.delivery_receipts for all using (public.is_admin());

-- ── RLS POLICIES: orders ─────────────────────────────────────
drop policy if exists "orders: client insert"   on public.orders;
drop policy if exists "orders: client read own" on public.orders;
drop policy if exists "orders: admin all"       on public.orders;
create policy "orders: client insert"
  on public.orders for insert with check (client_id = auth.uid() and public.is_verified_client());
create policy "orders: client read own"
  on public.orders for select using (client_id = auth.uid());
create policy "orders: admin all"
  on public.orders for all using (public.is_admin());

-- ── RLS POLICIES: order_items ────────────────────────────────
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

-- ── RLS POLICIES: customer_balances ─────────────────────────
drop policy if exists "balances: client read own" on public.customer_balances;
drop policy if exists "balances: admin all"       on public.customer_balances;
create policy "balances: client read own"
  on public.customer_balances for select using (client_id = auth.uid());
create policy "balances: admin all"
  on public.customer_balances for all using (public.is_admin());

-- ── RLS POLICIES: activity_log ───────────────────────────────
drop policy if exists "activity_log: admin all" on public.activity_log;
create policy "activity_log: admin all"
  on public.activity_log for all using (public.is_admin());

-- ── SEED: initial products ───────────────────────────────────
insert into public.products (name, description, bag_type, price_per_bag, is_active) values
  ('Portland Cement Type I',         'General-purpose cement suitable for most construction applications. 40kg per bag.', 'SB', 250,  true),
  ('Portland Cement Type I (Jumbo)', 'General-purpose cement in jumbo bags for large-scale projects. 1 ton per bag.',      'JB', 5800, true),
  ('Portland Cement Type II',        'Moderate sulfate-resistant cement for structures exposed to soil/water. 40kg per bag.', 'SB', 275, true),
  ('Blended Cement Premium',         'High-performance blended cement for specialized structural work. 40kg per bag.',     'SB', 290,  true)
on conflict do nothing;

-- ── PROMOTE ADMIN ─────────────────────────────────────────────
-- After signing up via the /register page, run the line below
-- (replace the email with yours) to grant yourself admin access:
--
-- update public.profiles
-- set role = 'admin', kyc_status = 'verified'
-- where email = 'your-email@example.com';

-- ── REALTIME PUBLICATIONS (optional) ────────────────────────
-- Uncomment and run separately if you want live updates on the dashboard:
-- alter publication supabase_realtime add table public.orders;
-- alter publication supabase_realtime add table public.activity_log;
-- alter publication supabase_realtime add table public.profiles;
