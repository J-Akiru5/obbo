-- Migration: widen DR/ledger quantity columns to allow fractional JB/SB units.
--
-- Why (client-feedback round 3): manual delivery receipts are entered by the
-- warehouse manager in INDIVIDUAL BAGS — e.g. a replacement DR for 7 damaged
-- JB bags. Storage keeps the JB/SB UNITS denomination (1 JB = 25 bags,
-- 1 SB = 50 bags) so every existing `bags = units * 25 / 50` formula keeps
-- working unchanged, but 7 bags is 0.28 units and an integer column cannot
-- express that. Widening to numeric makes the division exact: 0.28 * 25 = 7.
--
-- Columns widened:
--   delivery_receipts.jb / sb / quantity
--   shipment_ledger.jb / sb
--
-- shipments.remaining_jb / remaining_sb / good_stock STAY integer — they are
-- whole physical bags, and every writer rounds bag math to integers.
--
-- dispatch_order_v2 is dropped and re-created with numeric parameters so the
-- automated dispatch path keeps working against the widened columns (it still
-- passes whole units; the extra precision is unused there). A DROP is
-- required because CREATE OR REPLACE only accepts an identical signature.
--
-- Both tables are empty in the client testing database, so the integer ->
-- numeric rewrite is free — no backfill, no long-held lock.
--
-- Run in: Supabase Dashboard -> SQL Editor. Safe to re-run.

alter table public.delivery_receipts
  alter column jb       type numeric(14, 4) using jb::numeric,
  alter column sb       type numeric(14, 4) using sb::numeric,
  alter column quantity type numeric(14, 4) using quantity::numeric;

alter table public.shipment_ledger
  alter column jb type numeric(14, 4) using jb::numeric,
  alter column sb type numeric(14, 4) using sb::numeric;

drop function if exists public.dispatch_order_v2(uuid, uuid, text, integer, integer, text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric);

create or replace function public.dispatch_order_v2(
  p_order_id uuid,
  p_shipment_id uuid,
  p_dr_number text,
  p_jb_qty numeric,
  p_sb_qty numeric,
  p_driver_name text default null,
  p_plate_number text default null,
  p_dr_image_url text default null,
  p_client_name text default null,
  p_destination text default null,
  p_po_number text default null,
  p_total_sales numeric default 0,
  p_gross_profit numeric default 0,
  p_net_profit numeric default 0,
  p_selling_price_per_bag numeric default 0,
  p_landed_cost_per_bag numeric default 0,
  p_local_expenses_per_bag numeric default 0
) returns jsonb
language plpgsql
as $$
declare
  v_shipment record;
  v_order record;
  v_dr_id uuid;
  v_ledger_id uuid;
  v_bag_type text;
  v_jb_bags integer;
  v_sb_bags integer;
begin
  -- p_jb_qty / p_sb_qty are JB/SB UNITS; stock columns are INDIVIDUAL BAGS.
  -- Round at the boundary: physical stock is whole bags, and the automated
  -- dispatch path only ever passes whole unit counts (a fractional bag
  -- remainder would be a caller bug, not a legitimate dispatch).
  v_jb_bags := round(coalesce(p_jb_qty, 0) * 25)::integer;
  v_sb_bags := round(coalesce(p_sb_qty, 0) * 50)::integer;

  -- Lock shipment and validate existence + stock (in individual bags)
  select * into v_shipment
  from public.shipments
  where id = p_shipment_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Shipment not found');
  end if;

  if v_shipment.remaining_jb < v_jb_bags or v_shipment.remaining_sb < v_sb_bags then
    return jsonb_build_object('error', 'Insufficient stock in selected batch');
  end if;

  -- Lock order and validate existence + not already dispatched
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Order not found');
  end if;

  if v_order.status = 'dispatched' then
    return jsonb_build_object('error', 'This order has already been dispatched.');
  end if;

  -- 1. Deduct stock (individual bags)
  update public.shipments
  set
    remaining_jb = greatest(0, remaining_jb - v_jb_bags),
    remaining_sb = greatest(0, remaining_sb - v_sb_bags),
    good_stock = greatest(0, good_stock - (v_jb_bags + v_sb_bags))
  where id = p_shipment_id;

  -- 2. Create shipment_ledger entry (jb/sb stay in UNITS)
  insert into public.shipment_ledger (
    shipment_id, dr_number, po_number, client_name, driver_name, plate_number,
    destination, service_type, jb, sb, payment_method, check_number, amount,
    total_sales, gross_profit, net_profit, selling_price_per_bag,
    landed_cost_per_bag, local_expenses_per_bag
  ) values (
    p_shipment_id, p_dr_number, p_po_number, p_client_name, p_driver_name, p_plate_number,
    p_destination, v_order.service_type, p_jb_qty, p_sb_qty,
    v_order.payment_method, v_order.check_number, p_total_sales,
    p_total_sales, p_gross_profit, p_net_profit, p_selling_price_per_bag,
    p_landed_cost_per_bag, p_local_expenses_per_bag
  )
  returning id into v_ledger_id;

  -- 3. Determine bag_type for DR (use JB if any JB bags exist, else SB)
  v_bag_type := case when p_jb_qty > 0 then 'JB' else 'SB' end;

  -- 4. Upsert delivery_receipt (jb/sb stay in UNITS, matching ledger)
  insert into public.delivery_receipts (
    dr_number, shipment_id, client_name, client_id, po_number, jb, sb,
    quantity, bag_type, received_date, driver, plate_number,
    shipping_fee, dr_image_url, destination, order_id
  ) values (
    p_dr_number, p_shipment_id, p_client_name, v_order.client_id,
    p_po_number, p_jb_qty, p_sb_qty,
    coalesce(p_jb_qty, 0) + coalesce(p_sb_qty, 0), v_bag_type,
    current_date, p_driver_name, p_plate_number,
    v_order.shipping_fee, p_dr_image_url, p_destination, p_order_id
  )
  on conflict (dr_number) do update set
    shipment_id    = excluded.shipment_id,
    client_name    = excluded.client_name,
    client_id      = excluded.client_id,
    po_number      = excluded.po_number,
    jb             = excluded.jb,
    sb             = excluded.sb,
    quantity       = excluded.quantity,
    bag_type       = excluded.bag_type,
    received_date  = excluded.received_date,
    driver         = excluded.driver,
    plate_number   = excluded.plate_number,
    shipping_fee   = excluded.shipping_fee,
    dr_image_url   = excluded.dr_image_url,
    destination    = excluded.destination,
    order_id       = excluded.order_id
  returning id into v_dr_id;

  -- 5. Update order status
  update public.orders
  set
    status          = 'dispatched',
    tracking_status = 'pending_dispatch',
    dr_number       = p_dr_number,
    dr_image_url    = p_dr_image_url,
    driver_name     = p_driver_name,
    plate_number    = p_plate_number,
    shipment_id     = p_shipment_id,
    updated_at      = now()
  where id = p_order_id;

  -- 6. Link DR to ledger entry
  update public.shipment_ledger
  set delivery_receipt_id = v_dr_id
  where id = v_ledger_id;

  return jsonb_build_object(
    'success', true,
    'dr_id', v_dr_id,
    'ledger_id', v_ledger_id
  );
end;
$$;
