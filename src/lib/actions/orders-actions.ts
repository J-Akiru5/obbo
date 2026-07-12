'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, logActivity, getCostConfig } from './admin-helpers';
import { addLedgerEntry } from './ledger-actions';
import { createRoleNotification, createUserNotification } from './notification-actions';

export async function fetchOrders(status?: string) {
  const { supabase } = await requireAdmin();
  let query = supabase
    .from('orders')
    .select(
      '*, client:profiles!orders_client_id_fkey(id, full_name, company_name, email, phone, avatar_url), items:order_items(*, product:products(name, bag_type, price_per_bag))',
    )
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return data ?? [];
}

export async function approveOrder(
  orderId: string,
  approvedItems: { itemId: string; qty: number }[],
  shippingFee?: number,
) {
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
    const splitTarget = Math.min(order.deliver_now_qty, requestedOrderQty);
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
    await supabase.from('order_items').update({ approved_qty: item.qty }).eq('id', item.itemId);
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

  await supabase.from('orders').update(updates).eq('id', orderId);

  // Create customer balance records for partial quantities
  if (isPartial) {
    for (const ai of constrainedApprovedItems) {
      const original = order.items.find((i: { id: string }) => i.id === ai.itemId);
      if (original && ai.qty < original.requested_qty) {
        const remaining = original.requested_qty - ai.qty;
        await supabase.from('customer_balances').insert({
          client_id: order.client_id,
          order_id: orderId,
          product_id: original.product_id,
          bag_type: original.bag_type,
          remaining_qty: remaining,
          status: 'pending',
        });
      }
    }
  }

  // Notify client when order transitions to awaiting_check
  if (newStatus === 'awaiting_check') {
    try {
      const finalShippingFee = shippingFee ?? order.shipping_fee ?? 0;
      const totalDue = Number(order.total_amount) + Number(finalShippingFee);
      await createUserNotification({
        userId: order.client_id,
        title: 'Order approved — payment due',
        message:
          `Your order is approved. Total due: ₱${totalDue.toLocaleString()} ` +
          `(includes ₱${Number(finalShippingFee).toLocaleString()} shipping). ` +
          `Please upload your check to proceed.`,
      });
    } catch (notifError) {
      console.error('Failed to send awaiting_check notification:', notifError);
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

export async function rejectOrder(orderId: string, reason: string) {
  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase
    .from('orders')
    .update({ status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'order_rejected', 'order', orderId, { reason });
  return { success: true };
}

export async function finalConfirmCheck(orderId: string) {
  const { supabase, userId } = await requireAdmin();

  // Check if order was partially approved by looking at items
  const { data: order } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .single();
  if (!order) throw new Error('Order not found');

  const isPartial = order.items.some(
    (i: { approved_qty: number; requested_qty: number }) => i.approved_qty < i.requested_qty,
  );
  const newStatus = isPartial ? 'partially_approved' : 'approved';

  await supabase
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  await logActivity(supabase, userId, 'order_check_confirmed', 'order', orderId, {
    status: newStatus,
  });
  return { success: true };
}

export async function dispatchOrder(
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

  // Calculate JB and SB quantities
  const jbQty = order.items
    .filter((i: { bag_type: string }) => i.bag_type === 'JB')
    .reduce((s: number, i: { approved_qty: number }) => s + i.approved_qty, 0);
  const sbQty = order.items
    .filter((i: { bag_type: string }) => i.bag_type === 'SB')
    .reduce((s: number, i: { approved_qty: number }) => s + i.approved_qty, 0);

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

  // Deduct stock
  const { error: stockError } = await supabase
    .from('shipments')
    .update({
      remaining_jb: shipment.remaining_jb - jbQty,
      remaining_sb: shipment.remaining_sb - sbQty,
      good_stock: (shipment.good_stock || 0) - (jbQty + sbQty),
    })
    .eq('id', shipmentId);
  if (stockError) throw new Error(`Failed to deduct stock: ${stockError.message}`);

  // Create ledger row (with all new fields)
  const clientName = order.client?.company_name || order.client?.full_name || 'Unknown Client';
  const destination =
    [order.client?.address_street, order.client?.address_city, order.client?.address_province]
      .filter(Boolean)
      .join(', ') || null;

  const poNumber = order.po_number || `SYS-${orderId.slice(0, 8).toUpperCase()}`;
  const dispatchDate = new Date().toISOString().split('T')[0];

  // Compute profit values
  const costConfig = await getCostConfig();
  const totalBags = jbQty * 25 + sbQty * 50;
  // INVARIANT: total_amount is the goods subtotal only. shipping_fee is tracked
  // separately and must NEVER be folded into total_amount or included in profit.
  // See: implementation-plan §3.4 / structure diagrams §7 (Financial Invariant).
  const totalSales = Number(order.total_amount) || 0;
  const sellingPricePerBag = totalBags > 0 ? Math.round((totalSales / totalBags) * 100) / 100 : 0;
  const grossProfit =
    Math.round((totalSales - totalBags * costConfig.landed_cost_per_bag) * 100) / 100;
  const netProfit =
    Math.round(
      (totalSales -
        totalBags * (costConfig.landed_cost_per_bag + costConfig.local_expenses_per_bag)) *
        100,
    ) / 100;

  const { error: ledgerError } = await supabase.from('shipment_ledger').insert({
    shipment_id: shipmentId,
    dr_number: drNumber,
    po_number: poNumber,
    client_name: clientName,
    driver_name: driverName,
    plate_number: plateNumber,
    destination,
    service_type: order.service_type,
    jb: jbQty,
    sb: sbQty,
    payment_method: order.payment_method,
    check_number: order.payment_method === 'check' ? order.check_number : null,
    amount: totalSales || null,
    total_sales: totalSales,
    gross_profit: grossProfit,
    net_profit: netProfit,
    selling_price_per_bag: sellingPricePerBag,
    landed_cost_per_bag: costConfig.landed_cost_per_bag,
    local_expenses_per_bag: costConfig.local_expenses_per_bag,
  });
  if (ledgerError) throw new Error(`Failed to create ledger entry: ${ledgerError.message}`);

  // Handle Split Delivery: Create customer balance for remaining quantities
  for (const item of order.items) {
    if ((item.approved_qty || 0) < (item.requested_qty || 0)) {
      const remaining = item.requested_qty - item.approved_qty;

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
          total_purchase: item.requested_qty,
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
        const dispatchedQty = item.approved_qty || 0;
        if (dispatchedQty <= 0) continue;

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

  // Update order status
  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({
      status: 'dispatched',
      tracking_status: 'pending_dispatch',
      dr_number: drNumber,
      dr_image_url: drImageUrl,
      driver_name: driverName,
      plate_number: plateNumber,
      shipment_id: shipmentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);
  if (orderUpdateError)
    throw new Error(`Failed to update order status: ${orderUpdateError.message}`);

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

  // ── AUTO-GENERATE DR RECORD ──────────────────────────────
  const { data: drRecord, error: drError } = await supabase
    .from('delivery_receipts')
    .upsert(
      {
        dr_number: drNumber,
        shipment_id: shipmentId,
        client_name: clientName,
        client_id: order.client_id,
        po_number: poNumber,
        jb: jbQty,
        sb: sbQty,
        quantity: jbQty + sbQty,
        bag_type: jbQty > 0 ? 'JB' : 'SB',
        received_date: dispatchDate,
        driver: driverName,
        plate_number: plateNumber,
        shipping_fee: Number(order.shipping_fee) || 0,
        dr_image_url: drImageUrl,
        destination: destination,
        order_id: orderId,
      },
      { onConflict: 'dr_number' },
    )
    .select()
    .single();

  if (drError) throw new Error(`Failed to auto-generate DR record: ${drError.message}`);

  if (drRecord?.id) {
    await supabase
      .from('shipment_ledger')
      .update({ delivery_receipt_id: drRecord.id })
      .eq('dr_number', drNumber)
      .eq('shipment_id', shipmentId);
  }

  await logActivity(supabase, userId, 'order_dispatched', 'order', orderId, {
    shipment: shipment.batch_name,
    dr: drNumber,
    jb: jbQty,
    sb: sbQty,
  });

  return { success: true };
}

export async function updateTrackingStatus(
  orderId: string,
  trackingStatus: string,
  bagsReturnedJb?: number,
  bagsReturnedSb?: number,
  returnReason?: string,
) {
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
  await supabase.from('orders').update(updates).eq('id', orderId);
  await logActivity(supabase, userId, 'tracking_updated', 'order', orderId, { trackingStatus });

  if (isReturn && (bagsReturnedJb || bagsReturnedSb)) {
    const { data: order } = await supabase
      .from('orders')
      .select('shipment_id, po_number, dr_number, client_id')
      .eq('id', orderId)
      .single();
    if (order?.shipment_id) {
      let clientLabel = 'Unknown';
      if (order.client_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, company_name')
          .eq('id', order.client_id)
          .single();
        clientLabel = profile?.company_name || profile?.full_name || 'Unknown';
      }
      const reason = trackingStatus === 'returned_waste' ? 'waste' : 'return';
      const { data: drRecord } = await supabase
        .from('delivery_receipts')
        .select('id')
        .eq('dr_number', order.dr_number)
        .maybeSingle();
      await addLedgerEntry(order.shipment_id, {
        date: new Date().toISOString().split('T')[0],
        po_number: order.po_number,
        dr_number: order.dr_number,
        client_name: clientLabel,
        jb: 0,
        sb: 0,
        bags_returned: (bagsReturnedJb || 0) + (bagsReturnedSb || 0),
        bag_returned_type: bagsReturnedJb ? 'JB' : 'SB',
        return_reason: reason,
        client_reason: returnReason || undefined,
        delivery_receipt_id: drRecord?.id || null,
      });
    }
  }

  return { success: true };
}
