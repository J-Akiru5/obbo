'use server';

import { createClient } from '@/lib/supabase/server';
import type {
  OrderSource,
  ServiceType,
  PaymentMethod,
  OrderStatus,
  BagType,
} from '@/lib/types/database';

export interface CostConfig {
  landed_cost_per_bag: number;
  local_expenses_per_bag: number;
}

const DEFAULT_COST_CONFIG: CostConfig = {
  landed_cost_per_bag: 147.64,
  local_expenses_per_bag: 20.0,
};

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin' && profile?.role !== 'warehouse_manager') {
    throw new Error('Forbidden');
  }
  return { supabase, userId: user.id, role: profile.role as 'admin' | 'warehouse_manager' };
}

export async function requireAdminOnly() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') {
    throw new Error('Forbidden');
  }
  return { supabase, userId: user.id };
}

export async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  await supabase.from('activity_log').insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? {},
  });
}

export async function getCostConfig(): Promise<CostConfig> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'cost_config')
    .single();
  if (!data?.value) return DEFAULT_COST_CONFIG;
  const v = data.value as Record<string, unknown>;
  return {
    landed_cost_per_bag: Number(v.landed_cost_per_bag) || DEFAULT_COST_CONFIG.landed_cost_per_bag,
    local_expenses_per_bag:
      Number(v.local_expenses_per_bag) || DEFAULT_COST_CONFIG.local_expenses_per_bag,
  };
}

export async function createOrderForClientPortal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    clientId: string;
    poNumber: string;
    jbQty: number;
    sbQty: number;
    source: OrderSource;
    serviceType: ServiceType;
    checkNumber: string | null;
    checkAmount: number | null;
    cashAmount: number | null;
    photoUrl: string | null;
    status: OrderStatus;
    drNumber?: string | null;
    drImageUrl?: string | null;
    driverName?: string | null;
    plateNumber?: string | null;
    shipmentId?: string | null;
    shippingFee?: number;
  },
) {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .in('bag_type', ['JB', 'SB']);

  const jbProduct = products?.find((p) => p.bag_type === 'JB');
  const sbProduct = products?.find((p) => p.bag_type === 'SB');

  const paymentMethod: PaymentMethod =
    params.checkNumber && params.checkAmount && params.checkAmount > 0 ? 'check' : 'cash';

  let totalAmount = (params.checkAmount || 0) + (params.cashAmount || 0);
  if (totalAmount === 0 && params.jbQty + params.sbQty > 0) {
    const jbPrice =
      params.source === 'port'
        ? jbProduct?.price_port || jbProduct?.price_per_bag || 0
        : jbProduct?.price_warehouse || jbProduct?.price_per_bag || 0;
    const sbPrice =
      params.source === 'port'
        ? sbProduct?.price_port || sbProduct?.price_per_bag || 0
        : sbProduct?.price_warehouse || sbProduct?.price_per_bag || 0;
    totalAmount = params.jbQty * jbPrice + params.sbQty * sbPrice;
  }

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      client_id: params.clientId,
      status: params.status,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      po_number: params.poNumber,
      po_image_url: params.photoUrl,
      source: params.source,
      service_type: params.serviceType,
      check_number: params.checkNumber || null,
      dr_number: params.drNumber || null,
      dr_image_url: params.drImageUrl || null,
      driver_name: params.driverName || null,
      plate_number: params.plateNumber || null,
      shipment_id: params.shipmentId || null,
      shipping_fee: params.shippingFee || 0,
      tracking_status: params.status === 'dispatched' ? 'pending_dispatch' : 'pending_dispatch',
      order_type: 'new',
    })
    .select()
    .single();

  if (orderError || !orderData) {
    throw new Error(orderError?.message || 'Failed to create order');
  }

  const isDispatched = params.status === 'dispatched';
  const orderItems: Array<{
    order_id: string;
    product_id: string;
    bag_type: BagType;
    requested_qty: number;
    approved_qty: number;
    dispatched_qty: number;
    selling_price_per_bag: number;
  }> = [];
  if (params.jbQty > 0 && jbProduct) {
    orderItems.push({
      order_id: orderData.id,
      product_id: jbProduct.id,
      bag_type: 'JB',
      requested_qty: params.jbQty,
      approved_qty: params.jbQty,
      dispatched_qty: isDispatched ? params.jbQty : 0,
      selling_price_per_bag: Number(jbProduct.price_per_bag),
    });
  }
  if (params.sbQty > 0 && sbProduct) {
    orderItems.push({
      order_id: orderData.id,
      product_id: sbProduct.id,
      bag_type: 'SB',
      requested_qty: params.sbQty,
      approved_qty: params.sbQty,
      dispatched_qty: isDispatched ? params.sbQty : 0,
      selling_price_per_bag: Number(sbProduct.price_per_bag),
    });
  }
  if (orderItems.length > 0) {
    await supabase.from('order_items').insert(orderItems);
  }

  return orderData;
}
