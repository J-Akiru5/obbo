'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, logActivity, createOrderForClientPortal } from './admin-helpers';
import { addLedgerEntry } from './ledger-actions';
import { createUserNotification } from './notification-actions';
import { deliveryReceiptCreateSchema, deliveryReceiptUpdateSchema } from './schemas';
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

export async function createDeliveryReceipt(rawDr: Record<string, unknown>) {
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

  const jb = dr.jb ?? (dr.bag_type === 'JB' ? (dr.quantity ?? 0) : 0);
  const sb = dr.sb ?? (dr.bag_type === 'SB' ? (dr.quantity ?? 0) : 0);

  const { data, error } = await supabase
    .from('delivery_receipts')
    .insert({
      ...dr,
      client_name: clientName,
      client_id: effectiveClientId,
      jb,
      sb,
      quantity: dr.quantity ?? jb + sb,
      bag_type: dr.bag_type ?? (jb > 0 ? 'JB' : 'SB'),
      received_date: dr.received_date ?? new Date().toISOString().split('T')[0],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await addLedgerEntry(dr.shipment_id, {
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
    amount: poData
      ? Number(poData.check_amount) || Number(poData.cash_amount) || undefined
      : undefined,
    delivery_receipt_id: data.id,
  });

  if (effectiveClientId) {
    try {
      if (poData?.order_id) {
        await supabase
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

        const { data: orderItems } = await supabase
          .from('order_items')
          .select('id, bag_type')
          .eq('order_id', poData.order_id);
        if (orderItems) {
          for (const item of orderItems) {
            const dispatchedQty = item.bag_type === 'JB' ? jb : sb;
            if (dispatchedQty > 0) {
              await supabase
                .from('order_items')
                .update({ dispatched_qty: dispatchedQty })
                .eq('id', item.id);
            }
          }
        }

        await supabase
          .from('delivery_receipts')
          .update({ order_id: poData.order_id })
          .eq('id', data.id);
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
          await supabase
            .from('purchase_orders')
            .update({ order_id: orderData.id })
            .eq('id', poData.id);
        }
        await supabase
          .from('delivery_receipts')
          .update({ order_id: orderData.id })
          .eq('id', data.id);
        data.order_id = orderData.id;

        await createUserNotification({
          userId: effectiveClientId,
          title: 'Order Created & Dispatched',
          message: `Order PO-${dr.po_number} (DR: ${dr.dr_number}) has been created and dispatched for your account by the warehouse.`,
          href: '/client/orders',
          severity: 'success',
        });
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

export async function updateDeliveryReceipt(id: string, rawUpdates: Record<string, unknown>) {
  const { supabase, userId } = await requireAdmin();

  const parsed = deliveryReceiptUpdateSchema.safeParse(rawUpdates);
  if (!parsed.success) {
    throw new Error(`Invalid delivery receipt updates: ${parsed.error.message}`);
  }

  const updates = parsed.data;

  const { data: oldDr } = await supabase
    .from('delivery_receipts')
    .select('*')
    .eq('id', id)
    .single();
  if (!oldDr) throw new Error('Delivery receipt not found');

  if (updates.quantity !== undefined && updates.bag_type !== undefined) {
    updates.jb = updates.bag_type === 'JB' ? updates.quantity : 0;
    updates.sb = updates.bag_type === 'SB' ? updates.quantity : 0;
  }

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
        await supabase
          .from('shipment_ledger')
          .update({ delivery_receipt_id: id })
          .eq('id', fallback.id);
      }
    }

    if (ledgerEntry) {
      const { data: shipment } = await supabase
        .from('shipments')
        .select('remaining_jb, remaining_sb')
        .eq('id', oldDr.shipment_id)
        .single();

      if (shipment) {
        const correctedJb = Math.max(0, (shipment.remaining_jb ?? 0) + (oldDr.jb || 0) - newJb);
        const correctedSb = Math.max(0, (shipment.remaining_sb ?? 0) + (oldDr.sb || 0) - newSb);

        await supabase
          .from('shipments')
          .update({
            remaining_jb: correctedJb,
            remaining_sb: correctedSb,
            good_stock: correctedJb + correctedSb,
          })
          .eq('id', oldDr.shipment_id);
      }

      if (updates.shipment_id && updates.shipment_id !== oldDr.shipment_id) {
        const { data: newShipment } = await supabase
          .from('shipments')
          .select('remaining_jb, remaining_sb')
          .eq('id', newShipmentId)
          .single();
        if (newShipment) {
          const newRemJb = Math.max(0, (newShipment.remaining_jb ?? 0) - newJb);
          const newRemSb = Math.max(0, (newShipment.remaining_sb ?? 0) - newSb);
          await supabase
            .from('shipments')
            .update({
              remaining_jb: newRemJb,
              remaining_sb: newRemSb,
              good_stock: newRemJb + newRemSb,
            })
            .eq('id', newShipmentId);
        }
      }

      await supabase
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
    } else if (updates.jb !== undefined || updates.sb !== undefined) {
      await addLedgerEntry(newShipmentId, {
        dr_number: newDrNumber,
        client_name: updates.client_name ?? oldDr.client_name ?? 'Unknown',
        jb: newJb,
        sb: newSb,
        driver_name: updates.driver ?? oldDr.driver,
        plate_number: updates.plate_number ?? oldDr.plate_number,
        date: updates.received_date ?? oldDr.received_date,
        delivery_receipt_id: id,
      });
    }
  }

  await logActivity(supabase, userId, 'dr_updated', 'delivery_receipt', id, updates);
  return { success: true };
}
