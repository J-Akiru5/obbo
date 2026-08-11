'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, logActivity, getCostConfig } from './admin-helpers';
import {
  computeDispatchProfit,
  prorateOrderSalesByValue,
  individualBagsFromUnits,
} from './profit-utils';
import { orderApproveSchema, orderRejectSchema, orderTrackingUpdateSchema } from './schemas';
import { applyBagReturnToLedger } from './ledger-actions';
import { createRoleNotification } from './notification-actions';
import { safeAction } from './action-result';

export async function fetchOrders(status?: string) {
  const { supabase } = await requireAdmin();
  let query = supabase
    .from('orders')
    .select(
      '*, client:profiles!orders_client_id_fkey(id, full_name, company_name, email, phone, avatar_url), items:order_items(*, product:products(name, bag_type, price_per_bag)), delivery_receipts(id, dr_number, dr_image_url, driver, plate_number, received_date, created_at)',
    )
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return data ?? [];
}

// Internal implementation unchanged — safeAction() wraps the export below.
async function _approveOrder(
  orderId: string,
  approvedItems: { itemId: string; qty: number }[],
  shippingFee?: number,
) {
  const parsed = orderApproveSchema.safeParse({ orderId, approvedItems, shippingFee });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  const { supabase, userId } = await requireAdmin();

  // Get order
  const { data: order } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .single();
  if (!order) throw new Error('Order not found');
  const requestedOrderQty = order.items.reduce(
    (sum: number, item: { requested_qty: number }) => sum + item.requested_qty,
    0,
  );

  const approvedLookup = new Map(
    approvedItems.map((item: { itemId: string; qty: number }) => [item.itemId, item.qty]),
  );
  let constrainedApprovedItems: { itemId: string; qty: number }[] = order.items.map(
    (item: { id: string; requested_qty: number }) => ({
      itemId: item.id,
      qty: Math.max(0, Math.min(item.requested_qty, approvedLookup.get(item.id) ?? 0)),
    }),
  );

  if (order.is_split_delivery && order.deliver_now_qty > 0) {
    // deliver_now_qty is denominated in individual bags, but approved
    // quantities are JB/SB units — cap against the per-type unit split, which
    // is also what the approval dialog pre-fills. Fall back to deliver_now_qty
    // for legacy rows that predate the per-type split columns.
    const splitUnits = (order.deliver_now_jb || 0) + (order.deliver_now_sb || 0);
    const splitTarget = Math.min(
      splitUnits > 0 ? splitUnits : order.deliver_now_qty,
      requestedOrderQty,
    );
    const totalApprovedQty = constrainedApprovedItems.reduce(
      (sum: number, item: { itemId: string; qty: number }) => sum + item.qty,
      0,
    );
    if (totalApprovedQty > splitTarget) {
      let remainingToApprove = splitTarget;
      constrainedApprovedItems = constrainedApprovedItems.map(
        (item: { itemId: string; qty: number }) => {
          const nextQty = Math.max(0, Math.min(item.qty, remainingToApprove));
          remainingToApprove -= nextQty;
          return { ...item, qty: nextQty };
        },
      );
    }
  }

  // Update each item's approved_qty
  for (const item of constrainedApprovedItems) {
    const { error: itemError } = await supabase
      .from('order_items')
      .update({ approved_qty: item.qty })
      .eq('id', item.itemId);
    if (itemError) throw new Error(`Failed to update item ${item.itemId}: ${itemError.message}`);
  }

  // Check if any item is partially approved
  const isPartial = constrainedApprovedItems.some((ai: { itemId: string; qty: number }) => {
    const original = order.items.find((i: { id: string }) => i.id === ai.itemId);
    return original && ai.qty < original.requested_qty;
  });

  // Determine status based on payment method
  let newStatus: string;
  if (order.payment_method === 'check') {
    newStatus = 'awaiting_check';
  } else if (isPartial) {
    newStatus = 'partially_approved';
  } else {
    newStatus = 'approved';
  }

  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (shippingFee !== undefined) updates.shipping_fee = shippingFee;

  const { error: orderError } = await supabase.from('orders').update(updates).eq('id', orderId);
  if (orderError) throw new Error(`Failed to update order: ${orderError.message}`);

  // Create customer balance records for partial quantities
  if (isPartial) {
    for (const ai of constrainedApprovedItems) {
      const original = order.items.find((i: { id: string }) => i.id === ai.itemId);
      if (original && ai.qty < original.requested_qty) {
        // requested_qty/approved_qty are JB/SB UNITS — but
        // customer_balances.remaining_qty (and total_purchase, since the
        // ledger UI computes total_purchase - remaining_qty) must be stored
        // in INDIVIDUAL bags, the unit the balance page and redelivery flow
        // already assume. Convert before storing.
        const bagType = original.bag_type as 'JB' | 'SB';
        const remaining = individualBagsFromUnits(bagType, original.requested_qty - ai.qty);
        const { error: balanceError } = await supabase.from('customer_balances').insert({
          client_id: order.client_id,
          order_id: orderId,
          product_id: original.product_id,
          bag_type: original.bag_type,
          total_purchase: individualBagsFromUnits(bagType, original.requested_qty),
          remaining_qty: remaining,
          status: 'pending',
        });
        if (balanceError) {
          console.error('Failed to create customer balance:', balanceError);
        }
      }
    }
  }

  await logActivity(supabase, userId, 'order_approved', 'order', orderId, {
    status: newStatus,
    approvedItems,
    splitDeliveryApplied: Boolean(order.is_split_delivery),
  });

  // Notify warehouse manager that order is ready for fulfillment
  const poNumber = order.po_number || orderId.slice(0, 8).toUpperCase();
  await createRoleNotification({
    targetRole: 'warehouse_manager',
    title: 'Order Ready for Fulfillment',
    message: `PO ${poNumber} has been approved. Review and dispatch from inventory.`,
    href: '/admin/orders?tab=fulfillment',
    severity: 'info',
  });

  return { success: true, newStatus };
}

export const approveOrder = safeAction(_approveOrder);

// Internal implementation unchanged — safeAction() wraps the export below.
async function _rejectOrder(orderId: string, reason: string) {
  const parsed = orderRejectSchema.safeParse({ orderId, reason });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase
    .from('orders')
    .update({ status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'order_rejected', 'order', orderId, { reason });
  return { success: true };
}

export const rejectOrder = safeAction(_rejectOrder);

// Internal implementation unchanged — safeAction() wraps the export below.
async function _finalConfirmCheck(orderId: string) {
  const { supabase, userId } = await requireAdmin();

  const { data: order } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .single();
  if (!order) throw new Error('Order not found');

  // Backfill approved_qty for orders that reached this step without ever
  // passing through approveOrder() (e.g. draft → submitPaymentDetails).
  // Left at the DB default of 0, approved_qty poisons every downstream
  // calculation and causes the "Net = Gross" profit bug.
  const neverApproved = order.items.every(
    (i: { approved_qty: number; requested_qty: number }) =>
      i.approved_qty === 0 && i.requested_qty > 0,
  );
  if (neverApproved) {
    for (const item of order.items) {
      const qty = order.is_split_delivery
        ? item.bag_type === 'JB'
          ? Math.min(item.requested_qty, order.deliver_now_jb || 0)
          : item.bag_type === 'SB'
            ? Math.min(item.requested_qty, order.deliver_now_sb || 0)
            : item.requested_qty
        : item.requested_qty;
      const { error } = await supabase
        .from('order_items')
        .update({ approved_qty: qty })
        .eq('id', item.id);
      if (error) throw new Error(`Failed to set approved quantity: ${error.message}`);
      item.approved_qty = qty;
    }
  }

  const isPartial = order.items.some(
    (i: { approved_qty: number; requested_qty: number }) => i.approved_qty < i.requested_qty,
  );
  const newStatus = isPartial ? 'partially_approved' : 'approved';

  const { error: confirmError } = await supabase
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (confirmError) throw new Error(`Failed to confirm order: ${confirmError.message}`);

  await logActivity(supabase, userId, 'order_check_confirmed', 'order', orderId, {
    status: newStatus,
  });
  return { success: true };
}

export const finalConfirmCheck = safeAction(_finalConfirmCheck);

// Internal implementation unchanged — safeAction() wraps the export below.
async function _dispatchOrder(
  orderId: string,
  shipmentId: string,
  drNumber: string,
  drImageUrl: string | null,
  driverName: string | null,
  plateNumber: string | null,
) {
  const { supabase, userId } = await requireAdmin();

  // Get order with items and full client profile
  const { data: order } = await supabase
    .from('orders')
    .select(
      '*, items:order_items(*), client:profiles!orders_client_id_fkey(id, full_name, company_name, address_street, address_city, address_province, avatar_url)',
    )
    .eq('id', orderId)
    .single();
  if (!order) throw new Error('Order not found');

  // Idempotency guard — a retry must never re-run the writes below
  // for an order that has already gone out.
  if (order.status === 'dispatched') {
    throw new Error('This order has already been dispatched.');
  }

  // Calculate JB and SB quantities
  const jbQty = order.items
    .filter((i: { bag_type: string }) => i.bag_type === 'JB')
    .reduce((s: number, i: { approved_qty: number }) => s + i.approved_qty, 0);
  const sbQty = order.items
    .filter((i: { bag_type: string }) => i.bag_type === 'SB')
    .reduce((s: number, i: { approved_qty: number }) => s + i.approved_qty, 0);

  // Fail fast — a zero-quantity order would pass 6+ writes before crashing
  // on the delivery_receipts CHECK (quantity > 0) constraint.
  if (jbQty + sbQty <= 0) {
    throw new Error(
      'Cannot dispatch: no approved quantity found for this order. ' +
        'Confirm the approved JB/SB quantities before dispatching.',
    );
  }

  // Get shipment
  const { data: shipment } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', shipmentId)
    .single();
  if (!shipment) throw new Error('Shipment batch not found');
  if (shipment.remaining_jb < jbQty || shipment.remaining_sb < sbQty) {
    throw new Error('Insufficient stock in selected batch');
  }

  const clientName = order.client?.company_name || order.client?.full_name || 'Unknown Client';
  const destination =
    [order.client?.address_street, order.client?.address_city, order.client?.address_province]
      .filter(Boolean)
      .join(', ') || null;

  const poNumber = order.po_number || `SYS-${orderId.slice(0, 8).toUpperCase()}`;
  const dispatchDate = new Date().toISOString().split('T')[0];

  // Compute profit values — prorate revenue to only the bags actually
  // going out on this dispatch, by value (price × qty) instead of weight.
  const costConfig = await getCostConfig();
  const totalBags = jbQty * 25 + sbQty * 50;
  const totalSales = prorateOrderSalesByValue(
    order.total_amount,
    order.items.map(
      (i: {
        requested_qty: number;
        approved_qty: number;
        selling_price_per_bag: number;
        bag_type: 'JB' | 'SB';
      }) => ({
        requested_qty: i.requested_qty || 0,
        approved_qty: i.approved_qty || 0,
        selling_price_per_bag: i.selling_price_per_bag || 0,
        bag_type: i.bag_type,
      }),
    ),
  );
  const profitFields = computeDispatchProfit({
    totalBags,
    totalSales,
    landedCostPerBag: costConfig.landed_cost_per_bag,
    localExpensesPerBag: costConfig.local_expenses_per_bag,
  });

  // ── ATOMIC CRITICAL WRITES VIA RPC ─────────────────────────
  // Stock deduction, ledger entry, DR upsert, order status update,
  // and DR-ledger linking all happen in a single DB transaction.
  const { data: rpcResult, error: rpcError } = await supabase.rpc('dispatch_order_v2', {
    p_order_id: orderId,
    p_shipment_id: shipmentId,
    p_dr_number: drNumber,
    p_jb_qty: jbQty,
    p_sb_qty: sbQty,
    p_driver_name: driverName,
    p_plate_number: plateNumber,
    p_dr_image_url: drImageUrl,
    p_client_name: clientName,
    p_destination: destination,
    p_po_number: poNumber,
    p_total_sales: profitFields.total_sales,
    p_gross_profit: profitFields.gross_profit,
    p_net_profit: profitFields.net_profit,
    p_selling_price_per_bag: profitFields.selling_price_per_bag,
    p_landed_cost_per_bag: profitFields.landed_cost_per_bag,
    p_local_expenses_per_bag: profitFields.local_expenses_per_bag,
  });
  if (rpcError) throw new Error(`Dispatch RPC failed: ${rpcError.message}`);
  const rpcData = rpcResult as { success?: boolean; error?: string } | null;
  if (!rpcData?.success) {
    throw new Error(rpcData?.error ?? 'Dispatch RPC returned an unknown error');
  }

  // Handle Split Delivery: Create customer balance for remaining quantities
  for (const item of order.items) {
    if ((item.approved_qty || 0) < (item.requested_qty || 0)) {
      // Same unit fix as approveOrder: requested_qty/approved_qty are JB/SB
      // UNITS, but customer_balances (both remaining_qty and total_purchase,
      // since the ledger UI computes total_purchase - remaining_qty) must be
      // in INDIVIDUAL bags.
      const bagType = item.bag_type as 'JB' | 'SB';
      const remaining = individualBagsFromUnits(bagType, item.requested_qty - item.approved_qty);
      const totalPurchase = individualBagsFromUnits(bagType, item.requested_qty);

      // Check if a balance already exists for this item in this order (idempotency)
      const { data: existing } = await supabase
        .from('customer_balances')
        .select('id')
        .eq('order_id', orderId)
        .eq('product_id', item.product_id)
        .eq('bag_type', item.bag_type)
        .single();

      if (!existing) {
        const { error: balanceError } = await supabase.from('customer_balances').insert({
          client_id: order.client_id,
          order_id: orderId,
          product_id: item.product_id,
          bag_type: item.bag_type,
          total_purchase: totalPurchase,
          remaining_qty: remaining,
          status: 'pending',
        });
        if (balanceError) console.error('Balance creation error:', balanceError);
      }
    }
  }

  // If this is a redelivery order, deduct dispatched qty from original customer balance
  if (order.order_type === 'redelivery' && order.linked_po_number) {
    const { data: originalOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('po_number', order.linked_po_number)
      .maybeSingle();

    if (originalOrder) {
      for (const item of order.items) {
        const dispatchedUnits = item.approved_qty || 0;
        if (dispatchedUnits <= 0) continue;
        // A redelivery order's approved_qty is also in JB/SB UNITS (it's an
        // order_items row like any other) — convert before touching a
        // balance that's now denominated in individual bags.
        const dispatchedQty = individualBagsFromUnits(
          item.bag_type as 'JB' | 'SB',
          dispatchedUnits,
        );

        const { data: balance } = await supabase
          .from('customer_balances')
          .select('id, remaining_qty')
          .eq('order_id', originalOrder.id)
          .eq('product_id', item.product_id)
          .eq('bag_type', item.bag_type)
          .eq('status', 'pending')
          .maybeSingle();

        if (balance && balance.remaining_qty > 0) {
          const newRemaining = balance.remaining_qty - dispatchedQty;
          const newStatus = newRemaining <= 0 ? 'fulfilled' : 'pending';
          const { error: balanceUpdateError } = await supabase
            .from('customer_balances')
            .update({
              remaining_qty: Math.max(0, newRemaining),
              status: newStatus,
            })
            .eq('id', balance.id);
          if (balanceUpdateError) {
            console.error('Balance deduction on redelivery dispatch failed:', balanceUpdateError);
          }
        }
      }
    }
  }

  revalidatePath('/client/ledger');

  // Update order items dispatched_qty
  for (const item of order.items) {
    const { error: itemError } = await supabase
      .from('order_items')
      .update({ dispatched_qty: item.approved_qty })
      .eq('id', item.id);
    if (itemError) console.error(`Failed to update item ${item.id}:`, itemError);
  }

  // ── AUTO-GENERATE PO RECORD ──────────────────────────────
  let checkNumberStr: string | null = null;
  let checkAmountNum: number | null = null;
  let cashAmountNum: number | null = null;

  if (order.payment_method === 'check') {
    checkNumberStr = order.check_number || null;
    checkAmountNum = Number(order.total_amount) || null;
  } else if (order.payment_method === 'cash') {
    cashAmountNum = Number(order.total_amount) || null;
  } else {
    cashAmountNum = Number(order.total_amount) || null;
  }

  const poPayload = {
    po_number: poNumber,
    client_id: order.client_id,
    client_name: clientName,
    jb: jbQty,
    sb: sbQty,
    date: dispatchDate,
    status: 'dispatched',
    source: order.source,
    service_type: order.service_type,
    shipment_id: shipmentId,
    order_id: orderId,
    check_number: checkNumberStr,
    check_amount: checkAmountNum,
    cash_amount: cashAmountNum,
    photo_url: order.po_image_url,
    updated_at: new Date().toISOString(),
  };

  const { data: existingPo } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('po_number', poNumber)
    .maybeSingle();

  let poResult;
  if (existingPo) {
    poResult = await supabase.from('purchase_orders').update(poPayload).eq('id', existingPo.id);
  } else {
    poResult = await supabase.from('purchase_orders').insert(poPayload);
  }

  if (poResult?.error) {
    console.error('PO Auto-generation error:', poResult.error);
  }

  await logActivity(supabase, userId, 'order_dispatched', 'order', orderId, {
    shipment: shipment.batch_name,
    dr: drNumber,
    jb: jbQty,
    sb: sbQty,
  });

  revalidatePath('/admin/orders');
  revalidatePath('/admin/dashboard');

  return { success: true };
}

export const dispatchOrder = safeAction(_dispatchOrder);

// Internal implementation unchanged — safeAction() wraps the export below.
async function _updateTrackingStatus(
  orderId: string,
  trackingStatus: string,
  bagsReturnedJb?: number,
  bagsReturnedSb?: number,
  returnReason?: string,
  // Only meaningful when trackingStatus === 'returned_waste' — lets the admin
  // distinguish waste vs damage for reporting. orders.tracking_status itself
  // stays a 2-value enum ('returned_waste' covers both); this only affects
  // what gets written to shipment_ledger.return_reason. Defaults to 'waste'
  // when omitted, reproducing the exact pre-existing behavior.
  wasteCategory?: 'waste' | 'damage',
) {
  const parsed = orderTrackingUpdateSchema.safeParse({
    orderId,
    trackingStatus,
    bagsReturnedJb,
    bagsReturnedSb,
    returnReason,
    wasteCategory,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  const { supabase, userId } = await requireAdmin();
  const updates: Record<string, unknown> = {
    tracking_status: trackingStatus,
    updated_at: new Date().toISOString(),
  };

  const isReturn =
    trackingStatus === 'bags_returned' ||
    trackingStatus === 'returned_good' ||
    trackingStatus === 'returned_waste';

  if (isReturn) {
    if (bagsReturnedJb !== undefined)
      updates.bags_returned_jb = ((updates.bags_returned_jb as number) || 0) + bagsReturnedJb;
    if (bagsReturnedSb !== undefined)
      updates.bags_returned_sb = ((updates.bags_returned_sb as number) || 0) + bagsReturnedSb;
  }
  if (trackingStatus === 'delivered' || isReturn) {
    updates.status = 'completed';
  }
  const { error: trackingError } = await supabase.from('orders').update(updates).eq('id', orderId);
  if (trackingError) throw new Error(`Failed to update tracking: ${trackingError.message}`);
  await logActivity(supabase, userId, 'tracking_updated', 'order', orderId, { trackingStatus });

  if (isReturn && (bagsReturnedJb || bagsReturnedSb)) {
    const { data: order } = await supabase
      .from('orders')
      .select('shipment_id, po_number, dr_number, client_id')
      .eq('id', orderId)
      .single();
    if (order?.shipment_id) {
      const reason = trackingStatus === 'returned_waste' ? (wasteCategory ?? 'waste') : 'return';
      const ledgerResult = await applyBagReturnToLedger(supabase, {
        shipmentId: order.shipment_id,
        poNumber: order.po_number,
        drNumber: order.dr_number,
        clientId: order.client_id,
        jbReturned: bagsReturnedJb,
        sbReturned: bagsReturnedSb,
        returnReason: reason,
        clientReason: returnReason,
      });
      // applyBagReturnToLedger no longer throws (it's wrapped in
      // safeAction) — it returns { success: false, error } instead.
      // Re-throw here so a failed return-profit ledger entry still fails the
      // WHOLE tracking update, exactly like the old throw-based behavior
      // did. Without this, a failure here would go completely silent: the
      // order's tracking status would update fine while its profit
      // adjustment quietly never got created.
      if (!ledgerResult.success) {
        throw new Error(ledgerResult.error);
      }
    }
  }

  return { success: true };
}

export const updateTrackingStatus = safeAction(_updateTrackingStatus);
