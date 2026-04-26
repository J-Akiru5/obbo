-- ============================================================
-- OBBO iManage — Migration 002: OTP + Storage + Profile Columns
-- Run this in Supabase SQL Editor AFTER running schema.sql
-- ============================================================

-- ── EMAIL VERIFICATIONS (OTP temp table) ─────────────────────
create table if not exists public.email_verifications (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code        text not null,
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Index for fast lookup
create index if not exists idx_email_verifications_email on public.email_verifications(email);

-- Enable RLS (only service role can access via API routes)
alter table public.email_verifications enable row level security;

-- No user-level policies — API routes use service role key only

-- ── ADD COLUMNS TO PROFILES ───────────────────────────────────
alter table public.profiles add column if not exists account_type              text check (account_type in ('individual', 'company'));
alter table public.profiles add column if not exists address_street             text;
alter table public.profiles add column if not exists address_city               text;
alter table public.profiles add column if not exists address_province           text;
alter table public.profiles add column if not exists address_postal_code        text;
alter table public.profiles add column if not exists first_name                 text;
alter table public.profiles add column if not exists surname                    text;
alter table public.profiles add column if not exists contact_person_first_name  text;
alter table public.profiles add column if not exists contact_person_surname     text;
alter table public.profiles add column if not exists business_permit_no         text;
alter table public.profiles add column if not exists tin_no                     text;

-- ── UPDATE handle_new_user TRIGGER ───────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (
    id, email, full_name, company_name, phone, role, kyc_status,
    account_type, address_street, address_city, address_province, address_postal_code,
    first_name, surname, contact_person_first_name, contact_person_surname,
    business_permit_no, tin_no
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'kyc_status', 'pending_verification'),
    new.raw_user_meta_data->>'account_type',
    new.raw_user_meta_data->>'address_street',
    new.raw_user_meta_data->>'address_city',
    new.raw_user_meta_data->>'address_province',
    new.raw_user_meta_data->>'address_postal_code',
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'surname',
    new.raw_user_meta_data->>'contact_person_first_name',
    new.raw_user_meta_data->>'contact_person_surname',
    new.raw_user_meta_data->>'business_permit_no',
    new.raw_user_meta_data->>'tin_no'
  );
  return new;
end;
$$;

-- ── STORAGE BUCKETS ──────────────────────────────────────────
-- NOTE: If these fail with "duplicate key", the buckets already exist — skip.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760, -- 10MB
  array['image/jpeg','image/png','image/webp','application/pdf']
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-attachments',
  'order-attachments',
  false,
  10485760, -- 10MB
  array['image/jpeg','image/png','image/webp','application/pdf']
) on conflict (id) do nothing;

-- ── STORAGE RLS POLICIES — kyc-documents ─────────────────────
-- Authenticated users can upload to their own folder
create policy "kyc-documents: auth upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own documents
create policy "kyc-documents: own read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all kyc documents
create policy "kyc-documents: admin read"
  on storage.objects for select
  using (bucket_id = 'kyc-documents' and public.is_admin());

-- ── STORAGE RLS POLICIES — order-attachments ─────────────────
create policy "order-attachments: auth upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'order-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "order-attachments: own read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'order-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "order-attachments: admin read"
  on storage.objects for select
  using (bucket_id = 'order-attachments' and public.is_admin());
