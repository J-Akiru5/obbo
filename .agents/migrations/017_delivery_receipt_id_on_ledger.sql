-- Migration 017: Add delivery_receipt_id FK to shipment_ledger
-- Links ledger entries directly to their source delivery receipt,
-- replacing the fragile dr_number text-only link.
--
-- Run this in Supabase SQL Editor.

-- 1. Add the column (nullable to avoid breaking existing rows)
alter table public.shipment_ledger
    add column if not exists delivery_receipt_id uuid;

-- 2. Backfill: match existing ledger rows to delivery_receipts by dr_number + shipment_id
--    Takes the most recent DR match per ledger entry to handle edge cases.
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

-- 3. Add FK constraint (ON DELETE SET NULL so deleting a DR doesn't cascade-delete ledger history)
alter table public.shipment_ledger
    add constraint fk_shipment_ledger_delivery_receipt
    foreign key (delivery_receipt_id)
    references public.delivery_receipts(id)
    on delete set null;

-- 4. Add an index for lookups by delivery_receipt_id
create index if not exists idx_shipment_ledger_delivery_receipt_id
    on public.shipment_ledger(delivery_receipt_id);
