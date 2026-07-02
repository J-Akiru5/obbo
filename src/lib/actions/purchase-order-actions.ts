'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, logActivity, createOrderForClientPortal } from './admin-helpers';
import { generateGlobalNextPoNumber } from './po-utils';
import { createUserNotification } from './notification-actions';
import { purchaseOrderUpdateSchema } from './schemas';
import type { OrderSource, ServiceType } from '@/lib/types/database';

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

export async function createPurchaseOrder(po: {
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

  const jb = po.jb ?? (po.bag_type === 'JB' ? (po.quantity ?? 0) : 0);
  const sb = po.sb ?? (po.bag_type === 'SB' ? (po.quantity ?? 0) : 0);

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

      await supabase.from('purchase_orders').update({ order_id: orderData.id }).eq('id', data.id);
      data.order_id = orderData.id;

      await createUserNotification({
        userId: data.client_id,
        title: 'Order Created',
        message: `Order PO-${finalPoNumber} (${jb} JB / ${sb} SB) has been created for your account by the warehouse.`,
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

export async function updatePurchaseOrder(id: string, rawUpdates: Record<string, unknown>) {
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

  const { error } = await supabase
    .from('purchase_orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'po_updated', 'purchase_order', id, parsed.data);
  return { success: true };
}
