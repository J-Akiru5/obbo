-- Add dispatch_order_v2 RPC for atomic dispatch writes
-- Wraps stock deduction + ledger + DR + order status update in a
-- single database transaction to prevent partial writes on failure.

create or replace function public.dispatch_order_v2(
  p_order_id uuid,
  p_shipment_id uuid,
  p_dr_number text,
  p_jb_qty integer,
  p_sb_qty integer,
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
begin
  -- Lock shipment and validate existence + stock
  select * into v_shipment
  from public.shipments
  where id = p_shipment_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Shipment not found');
  end if;

  if v_shipment.remaining_jb < p_jb_qty or v_shipment.remaining_sb < p_sb_qty then
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

  -- 1. Deduct stock
  update public.shipments
  set
    remaining_jb = remaining_jb - p_jb_qty,
    remaining_sb = remaining_sb - p_sb_qty,
    good_stock = greatest(0, good_stock - (p_jb_qty + p_sb_qty))
  where id = p_shipment_id;

  -- 2. Create shipment_ledger entry
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

  -- 4. Upsert delivery_receipt
  insert into public.delivery_receipts (
    dr_number, shipment_id, client_name, client_id, po_number, jb, sb,
    quantity, bag_type, received_date, driver, plate_number,
    shipping_fee, dr_image_url, destination, order_id
  ) values (
    p_dr_number, p_shipment_id, p_client_name, v_order.client_id,
    p_po_number, p_jb_qty, p_sb_qty,
    p_jb_qty + p_sb_qty, v_bag_type,
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
