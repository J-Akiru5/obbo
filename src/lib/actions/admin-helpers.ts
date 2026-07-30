'use server';

import { createClient } from '@/lib/supabase/server';
import type {
  OrderSource,
  ServiceType,
  PaymentMethod,
  OrderStatus,
  BagType,
} from '@/lib/types/database';

export function getSourcePrice(
  product:
    | { price_per_bag: number; price_port?: number | null; price_warehouse?: number | null }
    | null
    | undefined,
  source: string,
): number {
  if (!product) return 0;
  if (source === 'port') return product.price_port || product.price_per_bag || 0;
  return product.price_warehouse || product.price_per_bag || 0;
}

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
  const { error } = await supabase.from('activity_log').insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? {},
  });
  if (error) {
    console.error('Failed to log activity:', error);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface DispatchProfitFields {
  total_sales: number;
  gross_profit: number;
  net_profit: number;
  selling_price_per_bag: number;
  landed_cost_per_bag: number;
  local_expenses_per_bag: number;
}

/**
 * Profit fields for a dispatch (a bag actually going out the door).
 * Callers pass whichever rates should apply — live cost config for a brand
 * new dispatch, or the row's own stored rates when recomputing an edit.
 */
export function computeDispatchProfit(params: {
  totalBags: number;
  totalSales: number;
  landedCostPerBag: number;
  localExpensesPerBag: number;
}): DispatchProfitFields {
  const { totalBags, totalSales, landedCostPerBag, localExpensesPerBag } = params;
  const sellingPricePerBag = totalBags > 0 ? round2(totalSales / totalBags) : 0;
  return {
    total_sales: totalSales,
    gross_profit: round2(totalSales - totalBags * landedCostPerBag),
    net_profit: round2(totalSales - totalBags * (landedCostPerBag + localExpensesPerBag)),
    selling_price_per_bag: sellingPricePerBag,
    landed_cost_per_bag: landedCostPerBag,
    local_expenses_per_bag: localExpensesPerBag,
  };
}

/**
 * Profit DELTA for a return/waste/damage event, reversing a slice of an
 * ORIGINAL sale. Always uses that original sale's own stored rates —
 * never live cost config — so a later cost-config change can't retroactively
 * change what a past return was worth.
 *
 * - Restockable returns ('return'): the bag goes back to good stock, so both
 *   the revenue and the landed-cost/local-expense "spend" for that bag are
 *   reversed. Gross/net profit deltas are smaller in magnitude than the
 *   sales delta.
 * - Non-restockable returns ('waste' / 'damage'): the bag is gone and the
 *   cost to bring it here was already sunk and isn't recovered. The client
 *   isn't charged for it, so revenue reverses in full, and — since nothing
 *   about the incurred cost changes — that same full amount drops straight
 *   through to both gross and net profit.
 */
export function computeReturnProfitDelta(params: {
  returnedBags: number;
  sellingPricePerBag: number;
  landedCostPerBag: number;
  localExpensesPerBag: number;
  isRestockable: boolean;
}): DispatchProfitFields {
  const { returnedBags, sellingPricePerBag, landedCostPerBag, localExpensesPerBag, isRestockable } =
    params;
  const totalSalesDelta = -round2(returnedBags * sellingPricePerBag);
  const grossProfitDelta = isRestockable
    ? -round2(returnedBags * (sellingPricePerBag - landedCostPerBag))
    : totalSalesDelta;
  const netProfitDelta = isRestockable
    ? -round2(returnedBags * (sellingPricePerBag - landedCostPerBag - localExpensesPerBag))
    : totalSalesDelta;
  return {
    total_sales: totalSalesDelta,
    gross_profit: grossProfitDelta,
    net_profit: netProfitDelta,
    selling_price_per_bag: sellingPricePerBag,
    landed_cost_per_bag: landedCostPerBag,
    local_expenses_per_bag: localExpensesPerBag,
  };
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
  const jbPrice = getSourcePrice(jbProduct, params.source);
  const sbPrice = getSourcePrice(sbProduct, params.source);
  if (totalAmount === 0 && params.jbQty + params.sbQty > 0) {
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
      selling_price_per_bag: jbPrice,
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
      selling_price_per_bag: sbPrice,
    });
  }
  if (orderItems.length > 0) {
    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) {
      await supabase.from('orders').delete().eq('id', orderData.id);
      throw new Error(`Failed to save order items: ${itemsError.message}`);
    }
  }

  return orderData;
}
