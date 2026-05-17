-- Add damaged_jb and damaged_sb columns to shipments for per-type damage tracking
alter table public.shipments add column if not exists damaged_jb integer not null default 0;
alter table public.shipments add column if not exists damaged_sb integer not null default 0;
