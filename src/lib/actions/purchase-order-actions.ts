'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, logActivity, createOrderForClientPortal } from './admin-helpers';
import { generateGlobalNextPoNumber } from './po-utils';
import { createUserNotification } from './notification-actions';
import { unitsFromIndividualBags } from './profit-utils';
import { purchaseOrderUpdateSchema } from './schemas';
import type { OrderSource, ServiceType } from '@/lib/types/database';
import { safeAction } from './action-result';

export async function fetchPurchaseOrders() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from('purchase_orders')
    .select('*, order:orders(id, status, po_number, dr_number)')
    .order('date', { ascending: false })
    .limit(10000);
  return data ?? [];
}

export async function generateAdminPoNumber() {
  return generateGlobalNextPoNumber();
}

// Internal implementation unchanged — safeAction() wraps the export below.
async function _createPurchaseOrder(po: {
  po_number?: string;
  client_name?: string;
  client_id?: string | null;
  jb?: number;
  sb?: number;
  quantity?: number;
  bag_type?: string;
  status?: string;
  source?: string;
  service_type?: string;
  shipment_id?: string;
  check_number?: string | null;
  check_amount?: number | null;
  cash_amount?: number | null;
  photo_url?: string;
}) {
  const { supabase, userId } = await requireAdmin();

  let finalPoNumber = po.po_number?.trim();
  if (!finalPoNumber) {
    finalPoNumber = await generateGlobalNextPoNumber();
  }

  // The manual-PO form is filled in with INDIVIDUAL BAGS — the same
  // convention as manual DRs (client-feedback round 3) and the dialog's
  // auto-total, which prices at `bags × price_per_bag`. purchase_orders.jb/sb
  // (and the order_items created below) are JB/SB UNITS, so convert once here
  // at the boundary. 7 JB bags = 0.28 units; the columns are numeric(14,4).
  const jbBags = po.jb ?? (po.bag_type === 'JB' ? (po.quantity ?? 0) : 0);
  const sbBags = po.sb ?? (po.bag_type === 'SB' ? (po.quantity ?? 0) : 0);
  const jb = unitsFromIndividualBags('JB', jbBags);
  const sb = unitsFromIndividualBags('SB', sbBags);

  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({
      ...po,
      jb,
      sb,
      po_number: finalPoNumber,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (data.client_id) {
    try {
      const orderData = await createOrderForClientPortal(supabase, {
        clientId: data.client_id,
        poNumber: finalPoNumber,
        jbQty: jb,
        sbQty: sb,
        source: (po.source || 'warehouse') as OrderSource,
        serviceType: (po.service_type || 'pickup') as ServiceType,
        checkNumber: po.check_number ?? null,
        checkAmount: po.check_amount ?? null,
        cashAmount: po.cash_amount ?? null,
        photoUrl: po.photo_url ?? null,
        status: 'approved',
      });

      const { error: poLinkError } = await supabase
        .from('purchase_orders')
        .update({ order_id: orderData.id })
        .eq('id', data.id);
      if (poLinkError) console.error('Failed to link PO to order:', poLinkError);
      data.order_id = orderData.id;

      await createUserNotification({
        userId: data.client_id,
        title: 'Order Created',
        message: `Order PO-${finalPoNumber} (${jbBags} JB bags / ${sbBags} SB bags) has been created for your account by the warehouse.`,
        href: '/client/orders',
        severity: 'success',
      });

      revalidatePath('/client/orders');
      revalidatePath('/client/dashboard');
    } catch (e) {
      console.error('Failed to create client portal order from manual PO:', e);
    }
  }

  await logActivity(supabase, userId, 'po_created', 'purchase_order', data.id, po);
  return data;
}

export const createPurchaseOrder = safeAction(_createPurchaseOrder);

// Internal implementation unchanged — safeAction() wraps the export below.
async function _updatePurchaseOrder(id: string, rawUpdates: Record<string, unknown>) {
  const { supabase, userId } = await requireAdmin();

  const parsed = purchaseOrderUpdateSchema.safeParse(rawUpdates);
  if (!parsed.success) {
    throw new Error(`Invalid purchase order updates: ${parsed.error.message}`);
  }

  const updates = parsed.data;
  if (updates.quantity !== undefined && updates.bag_type !== undefined) {
    updates.jb = updates.bag_type === 'JB' ? updates.quantity : 0;
    updates.sb = updates.bag_type === 'SB' ? updates.quantity : 0;
  }

  // The edit form sends INDIVIDUAL BAGS; purchase_orders.jb/sb are JB/SB
  // UNITS. Convert once, up front — same as createDeliveryReceipt/update-
  // DeliveryReceipt — so every caller (this dialog included) stays in bags.
  if (updates.jb !== undefined) updates.jb = unitsFromIndividualBags('JB', updates.jb);
  if (updates.sb !== undefined) updates.sb = unitsFromIndividualBags('SB', updates.sb);

  const { error } = await supabase
    .from('purchase_orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'po_updated', 'purchase_order', id, parsed.data);
  return { success: true };
}

export const updatePurchaseOrder = safeAction(_updatePurchaseOrder);
