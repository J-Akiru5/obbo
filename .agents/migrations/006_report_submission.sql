-- Add `submitted` column to warehouse_reports
-- When true, the report has been sent to admin for review.
-- Admin can only see today's report if submitted=true.
alter table public.warehouse_reports add column if not exists submitted boolean not null default false;
