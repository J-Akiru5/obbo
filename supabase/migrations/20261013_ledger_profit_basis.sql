-- Migration: fixed per-bag margin for ledger gross/net via a stored profit basis.
--
-- Why (client chat): gross and net must NOT move with the selling price. A
-- 100-bag sale at P185 or at P180 earns the same gross (qty x 37.36) and net
-- (qty x 17.36), where 37.36 = reference price 185 - landed cost 147.64 and
-- 17.36 = 37.36 - local expenses 20. Previously gross was `sales - qty x
-- landed`, so a P180 sale reported 3,236 / 1,236 instead of 3,736 / 1,736.
--
-- How: every NEW dispatch row records the per-bag price its margin was
-- measured at in `profit_basis_price_per_bag`:
--   basis = round2(reference_price_per_bag x recognized_fraction)
--   gross = qty x (basis - landed)        net = gross - qty x local
-- The recognized fraction is 1 for a normal sale and 0 when the PO revenue cap
-- zeroed the sale (a redelivery of bags the client already paid for), so that
-- redelivery books -landed per bag instead of booking the margin a second time.
-- Returns reverse at the ORIGINAL row's basis, which is why it is stored.
--
-- NULL = a LEGACY row, written before this migration. Legacy rows are NOT
-- restated: this migration does not touch any existing gross/net value, and an
-- edited legacy row keeps being recomputed with the old formula.
--
-- Prerequisite: 20261012_ledger_source.sql must already be applied. This
-- migration re-creates dispatch_order_v2 on top of it (keeps v_order.source).
--
-- Function signature change: a parameter is ADDED, which creates a NEW
-- overload instead of replacing the old one. So the CURRENT signature is
-- dropped explicitly first. NOTE this is the numeric-quantity signature left
-- by 20261011/20261012 -- NOT the integer-quantity one that 20261011 line 36
-- drops (that one no longer exists, and `drop ... if exists` on it would
-- silently no-op and leave two live overloads).
--
-- AFTER APPLYING, verify exactly one definition remains:
--   select oid::regprocedure from pg_proc where proname = 'dispatch_order_v2';
-- It must return exactly ONE row, ending in (..., numeric) with 18 arguments.
--
-- Deploy order: apply this BEFORE (or together with) the app release that
-- sends p_profit_basis_price_per_bag and writes profit_basis_price_per_bag.
--
-- Run in: Supabase Dashboard -> SQL Editor. Safe to re-run.

-- 1. Column --------------------------------------------------------------
alter table public.shipment_ledger
  add column if not exists profit_basis_price_per_bag numeric(10, 2);

comment on column public.shipment_ledger.profit_basis_price_per_bag is
  'Per-bag price this row''s gross/net margin was measured at (reference price x recognized fraction). NULL = legacy row whose gross/net derives from the actual selling price.';

-- 2. dispatch_order_v2 ---------------------------------------------------
drop function if exists public.dispatch_order_v2(uuid, uuid, text, numeric, numeric, text, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric);

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
  p_local_expenses_per_bag numeric default 0,
  p_profit_basis_price_per_bag numeric default null  -- [basis]
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
    landed_cost_per_bag, local_expenses_per_bag,
    source,                                 -- [source] (20261012)
    profit_basis_price_per_bag              -- [basis]
  ) values (
    p_shipment_id, p_dr_number, p_po_number, p_client_name, p_driver_name, p_plate_number,
    p_destination, v_order.service_type, p_jb_qty, p_sb_qty,
    v_order.payment_method, v_order.check_number, p_total_sales,
    p_total_sales, p_gross_profit, p_net_profit, p_selling_price_per_bag,
    p_landed_cost_per_bag, p_local_expenses_per_bag,
    v_order.source,                         -- [source] (20261012)
    p_profit_basis_price_per_bag            -- [basis]
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

notify pgrst, 'reload schema';
