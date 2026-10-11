-- Migration: widen purchase_orders quantity columns to allow fractional JB/SB
-- units, and backfill the one row the manual-PO unit bug contaminated.
--
-- Why: purchase_orders.jb/sb are JB/SB UNITS (1 JB = 25 individual bags,
-- 1 SB = 50), matching delivery_receipts/shipment_ledger/order_items. But the
-- manual-PO dialog historically stored its INDIVIDUAL-BAG inputs raw into the
-- unit columns (while pricing them correctly as bags — the dialog's auto-total
-- is `bags × price_per_bag`). The auto-generated POs (dispatch path) always
-- stored true units, so only manually-created PO rows are affected.
--
-- The dialog now converts bags -> units at the action boundary (same pattern
-- as manual DRs), and — since 7 JB bags = 0.28 units — the columns must be
-- numeric, mirroring migration 20261011_dr_ledger_numeric_quantities.sql.
--
-- Columns widened:
--   purchase_orders.jb / sb
--
-- Data backfill (client testing database):
--   PO-2026-004 was entered as 150 JB bags + 150 SB bags but stored as
--   150/150 UNITS. Its DR-5 and shipment_ledger row already carry the correct
--   6 JB / 3 SB units (150 + 150 bags), so only the PO row and its order_items
--   requested/approved quantities need correcting. The guard makes the
--   backfill idempotent — it no-ops once the row reads 6/3.
--
-- Run in: Supabase Dashboard -> SQL Editor (or `node scripts/apply-migration`
-- style psql run). Safe to re-run.

alter table public.purchase_orders
  alter column jb type numeric(14, 4) using jb::numeric,
  alter column sb type numeric(14, 4) using sb::numeric;

-- PO-2026-004: 150 bags JB -> 6 units, 150 bags SB -> 3 units.
update public.purchase_orders
set jb = 6,
    sb = 3,
    updated_at = now()
where po_number = 'PO-2026-004'
  and jb = 150
  and sb = 150;

-- Same order's order_items: requested/approved were stored as 150/150 (bags
-- raw) while dispatched_qty was already converted to 6/3 units by the
-- fulfillment flow. Align requested/approved with the unit convention.
-- (Multiple orders can share a po_number, hence `in` not `=`.)
update public.order_items
set requested_qty = 6,
    approved_qty  = 6
where order_id in (select id from public.orders where po_number = 'PO-2026-004')
  and bag_type = 'JB'
  and requested_qty = 150;

update public.order_items
set requested_qty = 3,
    approved_qty  = 3
where order_id in (select id from public.orders where po_number = 'PO-2026-004')
  and bag_type = 'SB'
  and requested_qty = 150;

-- delivery_receipts, shipment_ledger, customer_balances, and shipments stock
-- for PO-2026-004 were already in correct UNITS/bags — no touch needed.
