'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, logActivity, createOrderForClientPortal } from './admin-helpers';
import { addLedgerEntry, sumLedgerSalesForPoFamily, getPoSalesCap } from './ledger-actions';
import { applyRedeliveryToCustomerBalances } from './balance-actions';
import { BAG_EQUIVALENT, capSalesToPoTotal, unitsFromIndividualBags } from './profit-utils';
import { createUserNotification } from './notification-actions';
import { deliveryReceiptCreateSchema, deliveryReceiptUpdateSchema } from './schemas';
import { safeAction } from './action-result';
import type { OrderSource, ServiceType } from '@/lib/types/database';

export async function fetchDeliveryReceipts() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from('delivery_receipts')
    .select('*, shipment:shipments(batch_name), order:orders(id, status, po_number, dr_number)')
    .order('received_date', { ascending: false })
    .limit(10000);
  return data ?? [];
}

// Internal implementation unchanged — safeAction() wraps the export below.
async function _createDeliveryReceipt(rawDr: Record<string, unknown>) {
  const { supabase, userId } = await requireAdmin();

  const parsed = deliveryReceiptCreateSchema.safeParse(rawDr);
  if (!parsed.success) {
    throw new Error(`Invalid delivery receipt data: ${parsed.error.message}`);
  }

  const dr = parsed.data;

  let poData = null;
  if (dr.po_number) {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('po_number', dr.po_number)
      .single();
    if (po) poData = po;
  }

  const clientName = dr.client_name || poData?.client_name || 'Unknown';
  const effectiveClientId = dr.client_id || poData?.client_id || null;

  // The manual-DR form is filled in with INDIVIDUAL BAGS (client-feedback
  // round 3 — the warehouse counts bags off the truck, not internal units).
  // delivery_receipts.jb/sb stay JB/SB UNITS so the existing
  // `bags = units * 25 / * 50` formulas keep working; convert once here at
  // the boundary.
  const jbBags = dr.jb ?? (dr.bag_type === 'JB' ? (dr.quantity ?? 0) : 0);
  const sbBags = dr.sb ?? (dr.bag_type === 'SB' ? (dr.quantity ?? 0) : 0);
  const jb = unitsFromIndividualBags('JB', jbBags);
  const sb = unitsFromIndividualBags('SB', sbBags);

  const { data, error } = await supabase
    .from('delivery_receipts')
    .insert({
      ...dr,
      client_name: clientName,
      client_id: effectiveClientId,
      jb,
      sb,
      quantity: jbBags + sbBags,
      bag_type: dr.bag_type ?? (jbBags > 0 ? 'JB' : 'SB'),
      received_date: dr.received_date ?? new Date().toISOString().split('T')[0],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // ── PO revenue cap (client-feedback round 3) ────────────────────────────
  // Without it, every manual DR booked the PO's FULL selling value, so a
  // second DR for the same PO doubled TOTAL PURCHASED. Book at most the PO's
  // remaining un-recognized value: a replacement or redelivery DR for bags
  // the client already paid for records ¥0 while the bag counts and delivery
  // log still update.
  const poAmountFromPoRecord =
    (Number(poData?.check_amount) || 0) + (Number(poData?.cash_amount) || 0);
  const poSalesCap = await getPoSalesCap(supabase, dr.po_number);
  const poTotal = poAmountFromPoRecord || poSalesCap || 0;
  let amount: number | undefined;
  if (poTotal > 0) {
    const alreadyRecorded = await sumLedgerSalesForPoFamily(supabase, dr.po_number);
    amount = capSalesToPoTotal({ poTotal, alreadyRecorded, desired: poTotal });
  }

  const ledgerResult = await addLedgerEntry(dr.shipment_id, {
    dr_number: dr.dr_number,
    po_number: dr.po_number,
    date: dr.received_date,
    client_name: clientName,
    destination: dr.destination ?? undefined,
    service_type: poData?.service_type || 'pickup',
    jb,
    sb,
    driver_name: dr.driver,
    plate_number: dr.plate_number,
    payment_method: poData?.check_number ? 'check' : poData?.cash_amount ? 'cash' : undefined,
    check_number: poData?.check_number,
    amount,
    delivery_receipt_id: data.id,
  });
  // addLedgerEntry no longer throws — matches this function's own
  // throw-on-error convention (see `if (error) throw` above) rather than
  // silently dropping a financial ledger entry.
  if (!ledgerResult.success) {
    throw new Error(`Failed to create ledger entry: ${ledgerResult.error}`);
  }

  if (effectiveClientId) {
    try {
      const drPoNumber = dr.po_number || poData?.po_number || null;

      // Resolve the ORIGINAL order for this PO BEFORE any status write below.
      // Only an order that was already dispatched/completed before this DR
      // can have a withheld balance this DR is fulfilling; a first dispatch
      // (approved -> dispatched) must not clear the balance it is creating.
      let balanceTargetOrderId: string | null = null;
      if (drPoNumber) {
        const { data: originalOrders } = await supabase
          .from('orders')
          .select('id, status')
          .eq('po_number', drPoNumber)
          .neq('order_type', 'redelivery')
          .order('created_at', { ascending: true })
          .limit(1);
        const originalOrder = originalOrders?.[0];
        if (
          originalOrder &&
          (originalOrder.status === 'dispatched' || originalOrder.status === 'completed')
        ) {
          balanceTargetOrderId = originalOrder.id;
        }
      }

      if (poData?.order_id) {
        const { error: syncError } = await supabase
          .from('orders')
          .update({
            status: 'dispatched',
            tracking_status: 'pending_dispatch',
            dr_number: dr.dr_number,
            dr_image_url: dr.dr_image_url || null,
            driver_name: dr.driver || null,
            plate_number: dr.plate_number || null,
            shipment_id: dr.shipment_id,
            shipping_fee: dr.shipping_fee || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', poData.order_id);
        if (syncError) console.error('Failed to sync order status:', syncError);

        const { data: orderItems } = await supabase
          .from('order_items')
          .select('id, bag_type')
          .eq('order_id', poData.order_id);
        if (orderItems) {
          for (const item of orderItems) {
            const dispatchedQty = item.bag_type === 'JB' ? jb : sb;
            if (dispatchedQty > 0) {
              const { error: itemError } = await supabase
                .from('order_items')
                .update({ dispatched_qty: dispatchedQty })
                .eq('id', item.id);
              if (itemError) console.error('Failed to sync order item dispatch:', itemError);
            }
          }
        }

        const { error: drLinkError } = await supabase
          .from('delivery_receipts')
          .update({ order_id: poData.order_id })
          .eq('id', data.id);
        if (drLinkError) console.error('Failed to link DR to order:', drLinkError);
        data.order_id = poData.order_id;

        await createUserNotification({
          userId: effectiveClientId,
          title: 'Order Dispatched',
          message: `Your order PO-${dr.po_number} has been dispatched. DR: ${dr.dr_number}.`,
          href: '/client/orders',
          severity: 'success',
        });
      } else {
        const orderData = await createOrderForClientPortal(supabase, {
          clientId: effectiveClientId,
          poNumber: poData?.po_number || dr.po_number || '',
          jbQty: jb,
          sbQty: sb,
          source: (poData?.source || 'warehouse') as OrderSource,
          serviceType: (poData?.service_type || 'pickup') as ServiceType,
          checkNumber: poData?.check_number || null,
          checkAmount: poData?.check_amount || null,
          cashAmount: poData?.cash_amount || null,
          photoUrl: poData?.photo_url || null,
          status: 'dispatched',
          drNumber: dr.dr_number,
          drImageUrl: dr.dr_image_url || null,
          driverName: dr.driver || null,
          plateNumber: dr.plate_number || null,
          shipmentId: dr.shipment_id,
          shippingFee: dr.shipping_fee || 0,
        });

        if (poData?.id) {
          const { error: poLinkError } = await supabase
            .from('purchase_orders')
            .update({ order_id: orderData.id })
            .eq('id', poData.id);
          if (poLinkError) console.error('Failed to link PO to order:', poLinkError);
        }
        const { error: drLinkError } = await supabase
          .from('delivery_receipts')
          .update({ order_id: orderData.id })
          .eq('id', data.id);
        if (drLinkError) console.error('Failed to link DR to new order:', drLinkError);
        data.order_id = orderData.id;

        await createUserNotification({
          userId: effectiveClientId,
          title: 'Order Created & Dispatched',
          message: `Order PO-${dr.po_number} (DR: ${dr.dr_number}) has been created and dispatched for your account by the warehouse.`,
          href: '/client/orders',
          severity: 'success',
        });
      }

      // Fulfil (decrement/clear) the original order's pending balance when
      // this manual DR is a re-dispatch against an already-dispatched PO.
      // Covers BOTH cases: a DR linked to a redelivery order and a DR linked
      // straight to the original order.
      if (balanceTargetOrderId && drPoNumber) {
        const { data: originalItems } = await supabase
          .from('order_items')
          .select('product_id, bag_type')
          .eq('order_id', balanceTargetOrderId);
        const balanceResult = await applyRedeliveryToCustomerBalances({
          linkedPoNumber: drPoNumber,
          items: (originalItems ?? []).map((item) => ({
            productId: item.product_id,
            bagType: item.bag_type,
            dispatchedUnits: item.bag_type === 'JB' ? jb : sb,
          })),
        });
        if (balanceResult.failed > 0) {
          console.error(
            `Manual DR ${dr.dr_number}: balance clearing failed for PO ${drPoNumber}. ${balanceResult.errors.join('; ')}`,
          );
        }
      }

      revalidatePath('/client/orders');
      revalidatePath('/client/dashboard');
    } catch (e) {
      console.error('Failed to sync client portal order from manual DR:', e);
    }
  }

  await logActivity(supabase, userId, 'dr_created', 'delivery_receipt', data.id, dr);
  return data;
}

export const createDeliveryReceipt = safeAction(_createDeliveryReceipt);

// Internal implementation unchanged — safeAction() wraps the export below.
async function _updateDeliveryReceipt(id: string, rawUpdates: Record<string, unknown>) {
  const { supabase, userId } = await requireAdmin();

  const parsed = deliveryReceiptUpdateSchema.safeParse(rawUpdates);
  if (!parsed.success) {
    throw new Error(`Invalid delivery receipt updates: ${parsed.error.message}`);
  }

  const updates = parsed.data;

  // The edit form sends INDIVIDUAL BAGS; delivery_receipts.jb/sb and
  // shipment_ledger.jb/sb are JB/SB UNITS. Convert once, up front, so every
  // use below (ledger write, stock correction) sees the storage unit.
  if (updates.jb !== undefined) updates.jb = unitsFromIndividualBags('JB', updates.jb);
  if (updates.sb !== undefined) updates.sb = unitsFromIndividualBags('SB', updates.sb);
  if (updates.quantity !== undefined && updates.bag_type !== undefined) {
    updates.jb = updates.bag_type === 'JB' ? unitsFromIndividualBags('JB', updates.quantity) : 0;
    updates.sb = updates.bag_type === 'SB' ? unitsFromIndividualBags('SB', updates.quantity) : 0;
  }

  const { data: oldDr } = await supabase
    .from('delivery_receipts')
    .select('*')
    .eq('id', id)
    .single();
  if (!oldDr) throw new Error('Delivery receipt not found');

  const newJb = updates.jb ?? oldDr.jb;
  const newSb = updates.sb ?? oldDr.sb;
  const newDrNumber = updates.dr_number ?? oldDr.dr_number;
  const newShipmentId = updates.shipment_id ?? oldDr.shipment_id;

  const { error } = await supabase.from('delivery_receipts').update(updates).eq('id', id);
  if (error) throw new Error(error.message);

  if (
    updates.jb !== undefined ||
    updates.sb !== undefined ||
    updates.dr_number !== undefined ||
    updates.client_name !== undefined ||
    updates.driver !== undefined ||
    updates.plate_number !== undefined
  ) {
    let { data: ledgerEntry } = await supabase
      .from('shipment_ledger')
      .select('*')
      .eq('delivery_receipt_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ledgerEntry && oldDr.dr_number) {
      const { data: fallback } = await supabase
        .from('shipment_ledger')
        .select('*')
        .eq('dr_number', oldDr.dr_number)
        .eq('shipment_id', oldDr.shipment_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      ledgerEntry = fallback;
      if (fallback) {
        const { error: ledgerLinkError } = await supabase
          .from('shipment_ledger')
          .update({ delivery_receipt_id: id })
          .eq('id', fallback.id);
        if (ledgerLinkError) console.error('Failed to link ledger entry to DR:', ledgerLinkError);
      }
    }

    if (ledgerEntry) {
      const { data: shipment } = await supabase
        .from('shipments')
        .select('remaining_jb, remaining_sb')
        .eq('id', oldDr.shipment_id)
        .single();

      if (shipment) {
        // DR jb/sb columns are JB/SB UNITS; shipment remaining columns are
        // INDIVIDUAL BAGS. Convert both the reverse (old) and apply (new)
        // side before correcting, rounding each term so fractional units
        // (0.28 JB units = 7 bags) resolve to the exact whole-bag stock.
        const oldJbBags = Math.round(Number(oldDr.jb || 0) * BAG_EQUIVALENT.JB);
        const oldSbBags = Math.round(Number(oldDr.sb || 0) * BAG_EQUIVALENT.SB);
        const newJbBags = Math.round(Number(newJb) * BAG_EQUIVALENT.JB);
        const newSbBags = Math.round(Number(newSb) * BAG_EQUIVALENT.SB);
        const correctedJb = Math.max(0, (shipment.remaining_jb ?? 0) + oldJbBags - newJbBags);
        const correctedSb = Math.max(0, (shipment.remaining_sb ?? 0) + oldSbBags - newSbBags);

        const { error: correctError } = await supabase
          .from('shipments')
          .update({
            remaining_jb: correctedJb,
            remaining_sb: correctedSb,
            good_stock: correctedJb + correctedSb,
          })
          .eq('id', oldDr.shipment_id);
        if (correctError) console.error('Failed to correct shipment stock:', correctError);
      }

      if (updates.shipment_id && updates.shipment_id !== oldDr.shipment_id) {
        const { data: newShipment } = await supabase
          .from('shipments')
          .select('remaining_jb, remaining_sb')
          .eq('id', newShipmentId)
          .single();
        if (newShipment) {
          const newJbBags = Math.round(Number(newJb) * BAG_EQUIVALENT.JB);
          const newSbBags = Math.round(Number(newSb) * BAG_EQUIVALENT.SB);
          const newRemJb = Math.max(0, (newShipment.remaining_jb ?? 0) - newJbBags);
          const newRemSb = Math.max(0, (newShipment.remaining_sb ?? 0) - newSbBags);
          const { error: newCorrectError } = await supabase
            .from('shipments')
            .update({
              remaining_jb: newRemJb,
              remaining_sb: newRemSb,
              good_stock: newRemJb + newRemSb,
            })
            .eq('id', newShipmentId);
          if (newCorrectError)
            console.error('Failed to correct new shipment stock:', newCorrectError);
        }
      }

      const { error: ledgerUpdateError } = await supabase
        .from('shipment_ledger')
        .update({
          dr_number: newDrNumber,
          shipment_id: newShipmentId,
          jb: newJb,
          sb: newSb,
          client_name: updates.client_name ?? ledgerEntry.client_name,
          driver_name: updates.driver ?? ledgerEntry.driver_name,
          plate_number: updates.plate_number ?? ledgerEntry.plate_number,
          date: updates.received_date ?? ledgerEntry.date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ledgerEntry.id);
      if (ledgerUpdateError) console.error('Failed to update ledger entry:', ledgerUpdateError);
    } else if (updates.jb !== undefined || updates.sb !== undefined) {
      const ledgerResult = await addLedgerEntry(newShipmentId, {
        dr_number: newDrNumber,
        client_name: updates.client_name ?? oldDr.client_name ?? 'Unknown',
        jb: newJb,
        sb: newSb,
        driver_name: updates.driver ?? oldDr.driver,
        plate_number: updates.plate_number ?? oldDr.plate_number,
        date: updates.received_date ?? oldDr.received_date,
        delivery_receipt_id: id,
      });
      // Matches the sibling ledger-update branch just above, which also
      // logs and continues rather than failing the whole DR update over a
      // ledger side-effect issue.
      if (!ledgerResult.success) {
        console.error('Failed to create ledger entry:', ledgerResult.error);
      }
    }
  }

  await logActivity(supabase, userId, 'dr_updated', 'delivery_receipt', id, updates);
  return { success: true };
}

export const updateDeliveryReceipt = safeAction(_updateDeliveryReceipt);
