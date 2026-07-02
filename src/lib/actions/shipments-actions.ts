'use server';

import { requireAdmin, logActivity } from './admin-helpers';
import { createRoleNotification } from './notification-actions';

export async function fetchShipments() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10000);
  return data ?? [];
}

export async function createShipment(
  batchName: string,
  totalJb: number,
  totalSb: number,
  arrivalDate?: string,
  damagedJb: number = 0,
  damagedSb: number = 0,
) {
  const { supabase, userId } = await requireAdmin();
  const totalBags = totalJb + totalSb;
  const goodJb = totalJb - damagedJb;
  const goodSb = totalSb - damagedSb;

  const { data, error } = await supabase
    .from('shipments')
    .insert({
      batch_name: batchName,
      total_jb: totalJb,
      total_sb: totalSb,
      remaining_jb: goodJb,
      remaining_sb: goodSb,
      initial_quantity: totalBags,
      good_stock: goodJb + goodSb,
      damaged_stock: damagedJb + damagedSb,
      damaged_jb: damagedJb,
      damaged_sb: damagedSb,
      arrival_date: arrivalDate ?? new Date().toISOString().split('T')[0],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'shipment_created', 'shipment', data.id, {
    batchName,
    totalJb,
    totalSb,
    damagedJb,
    damagedSb,
  });

  await createRoleNotification({
    targetRole: 'warehouse_manager',
    title: 'New Shipment Arrived',
    message: `Batch "${batchName}" with ${totalJb} JB / ${totalSb} SB bags has been recorded.`,
    href: '/admin/inventory?tab=shipments',
    severity: 'info',
  });

  return data;
}

export async function updateShipment(
  id: string,
  updates: Partial<{
    batch_name: string;
    total_jb: number;
    total_sb: number;
    remaining_jb: number;
    remaining_sb: number;
    good_stock: number;
    arrival_date: string;
  }>,
) {
  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase
    .from('shipments')
    .update({
      ...updates,
      ...(updates.remaining_jb !== undefined || updates.remaining_sb !== undefined
        ? {
            good_stock: (updates.remaining_jb ?? 0) + (updates.remaining_sb ?? 0),
          }
        : {}),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'shipment_updated', 'shipment', id, updates);
  return { success: true };
}

export async function fetchShipmentLedger(shipmentId: string) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from('shipment_ledger')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('date', { ascending: false });
  return data ?? [];
}
