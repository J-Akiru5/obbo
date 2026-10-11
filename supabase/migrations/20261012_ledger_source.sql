-- Migration: add Port/Warehouse "source" to the shipment ledger.
--
-- Why (client chat): the shipment ledger table shows who and what was
-- delivered but not where the order came from. `shipment_ledger.source`
-- records 'port' or 'warehouse' per row. It is a LABEL ONLY — it never feeds
-- price, sales, gross, or net.
--
-- What this migration does:
--   1. Adds the nullable `source` column (NULL = unknown / not yet resolved).
--   2. Backfills existing rows from the order (then PO) on the same po_number,
--      but ONLY where exactly one distinct source exists. JB and SB orders can
--      share a PO number, so an ambiguous PO is left NULL on purpose rather
--      than guessed. gross_profit / net_profit / total_sales are never touched.
--   3. Re-creates dispatch_order_v2 so automated dispatches write
--      v_order.source onto the ledger row. The SIGNATURE IS UNCHANGED (same
--      numeric-quantity signature as 20261011_dr_ledger_numeric_quantities.sql),
--      so CREATE OR REPLACE is enough — no DROP, no second overload. The body is
--      a verbatim copy of 20261011 apart from the two additions marked
--      "-- [source]" below.
--
-- Prerequisite: 20261011_dr_ledger_numeric_quantities.sql must already be
-- applied (this function replaces that one in place).
--
-- Run in: Supabase Dashboard -> SQL Editor. Safe to re-run.

-- 1. Column --------------------------------------------------------------
alter table public.shipment_ledger
  add column if not exists source text check (source in ('port', 'warehouse'));

-- 2. Backfill ------------------------------------------------------------
do $$
declare
  v_from_orders   integer := 0;
  v_from_pos      integer := 0;
  v_still_null    integer := 0;
begin
  -- 2a. From the ORIGINAL (non-redelivery) order(s) on the same po_number.
  --     A redelivery order reuses its original's po_number, so excluding
  --     order_type = 'redelivery' makes the original the source of truth for
  --     every ledger row on that PO, redelivery dispatches included.
  with order_src as (
    select o.po_number, min(o.source) as source
    from public.orders o
    where o.po_number is not null
      and o.order_type is distinct from 'redelivery'
      and o.source in ('port', 'warehouse')
    group by o.po_number
    having count(distinct o.source) = 1
  )
  update public.shipment_ledger l
  set source = s.source
  from order_src s
  where l.source is null
    and l.po_number = s.po_number;
  get diagnostics v_from_orders = row_count;

  -- 2b. Fallback: the purchase_orders row for the same po_number, same
  --     exactly-one-distinct-source rule. Only touches rows 2a left NULL.
  with po_src as (
    select p.po_number, min(p.source) as source
    from public.purchase_orders p
    where p.po_number is not null
      and p.source in ('port', 'warehouse')
    group by p.po_number
    having count(distinct p.source) = 1
  )
  update public.shipment_ledger l
  set source = s.source
  from po_src s
  where l.source is null
    and l.po_number = s.po_number;
  get diagnostics v_from_pos = row_count;

  select count(*) into v_still_null from public.shipment_ledger where source is null;

  raise notice 'shipment_ledger.source backfill: % filled from orders, % filled from purchase_orders, % left NULL (ambiguous or no PO link)',
    v_from_orders, v_from_pos, v_still_null;
end;
$$;

-- 3. dispatch_order_v2 (same signature as 20261011; body unchanged except [source]) --
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
    landed_cost_per_bag, local_expenses_per_bag,
    source                                  -- [source]
  ) values (
    p_shipment_id, p_dr_number, p_po_number, p_client_name, p_driver_name, p_plate_number,
    p_destination, v_order.service_type, p_jb_qty, p_sb_qty,
    v_order.payment_method, v_order.check_number, p_total_sales,
    p_total_sales, p_gross_profit, p_net_profit, p_selling_price_per_bag,
    p_landed_cost_per_bag, p_local_expenses_per_bag,
    v_order.source                          -- [source]
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
