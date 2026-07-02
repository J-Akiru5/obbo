'use server';

import { requireAdmin, logActivity, getCostConfig } from './admin-helpers';

export async function addLedgerEntry(
  shipmentId: string,
  entry: {
    date?: string;
    po_number?: string;
    dr_number?: string;
    client_name?: string;
    driver_name?: string;
    plate_number?: string;
    destination?: string;
    service_type?: string;
    jb?: number;
    sb?: number;
    payment_method?: string;
    check_number?: string;
    amount?: number;
    bags_returned?: number;
    bag_returned_type?: string;
    return_reason?: string;
    client_reason?: string;
    notes?: string;
    delivery_receipt_id?: string | null;
  },
) {
  const { supabase, userId } = await requireAdmin();
  const jbOut = entry.jb ?? 0;
  const sbOut = entry.sb ?? 0;
  const returned = entry.bags_returned ?? 0;
  const returnedType = entry.bag_returned_type ?? null;
  const returnReason = entry.return_reason ?? 'return';

  const isDispatch = !entry.bags_returned || entry.bags_returned === 0;
  let profitFields = {};
  if (isDispatch && (jbOut > 0 || sbOut > 0)) {
    const costConfig = await getCostConfig();
    const totalBags = jbOut * 25 + sbOut * 50;
    const totalSales = entry.amount ?? 0;
    const sellingPricePerBag = totalBags > 0 ? Math.round((totalSales / totalBags) * 100) / 100 : 0;
    const grossProfit =
      Math.round((totalSales - totalBags * costConfig.landed_cost_per_bag) * 100) / 100;
    const netProfit =
      Math.round(
        (totalSales -
          totalBags * (costConfig.landed_cost_per_bag + costConfig.local_expenses_per_bag)) *
          100,
      ) / 100;
    profitFields = {
      total_sales: totalSales,
      gross_profit: grossProfit,
      net_profit: netProfit,
      selling_price_per_bag: sellingPricePerBag,
      landed_cost_per_bag: costConfig.landed_cost_per_bag,
      local_expenses_per_bag: costConfig.local_expenses_per_bag,
    };
  }

  const { data, error } = await supabase
    .from('shipment_ledger')
    .insert({
      shipment_id: shipmentId,
      ...entry,
      ...profitFields,
      date: entry.date ?? new Date().toISOString().split('T')[0],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const { data: shipment } = await supabase
    .from('shipments')
    .select('remaining_jb, remaining_sb, good_stock')
    .eq('id', shipmentId)
    .single();
  if (shipment) {
    const restockReturned = returnReason === 'return' && returned > 0;
    const jbReturned = restockReturned && returnedType === 'JB' ? returned : 0;
    const sbReturned = restockReturned && returnedType === 'SB' ? returned : 0;
    const newRemainingJb = Math.max(0, (shipment.remaining_jb ?? 0) - jbOut + jbReturned);
    const newRemainingSb = Math.max(0, (shipment.remaining_sb ?? 0) - sbOut + sbReturned);
    await supabase
      .from('shipments')
      .update({
        remaining_jb: newRemainingJb,
        remaining_sb: newRemainingSb,
        good_stock: newRemainingJb + newRemainingSb,
      })
      .eq('id', shipmentId);
  }

  await logActivity(supabase, userId, 'ledger_entry_added', 'shipment_ledger', data.id, entry);
  return data;
}

export async function updateLedgerEntry(
  id: string,
  shipmentId: string,
  oldEntry: {
    jb: number;
    sb: number;
    bags_returned: number;
    bag_returned_type: string | null;
    return_reason: string | null;
  },
  updates: Partial<{
    date: string;
    po_number: string;
    dr_number: string;
    client_name: string;
    driver_name: string;
    plate_number: string;
    destination: string;
    service_type: string;
    jb: number;
    sb: number;
    payment_method: string;
    check_number: string;
    amount: number;
    bags_returned: number;
    bag_returned_type: string;
    return_reason: string;
    notes: string;
  }>,
) {
  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase
    .from('shipment_ledger')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);

  const wasRestockable = oldEntry.return_reason === 'return' || !oldEntry.return_reason;
  const newReturnReason = updates.return_reason ?? oldEntry.return_reason ?? 'return';
  const isRestockable = newReturnReason === 'return';

  const { data: shipment } = await supabase
    .from('shipments')
    .select('remaining_jb, remaining_sb')
    .eq('id', shipmentId)
    .single();
  if (shipment) {
    const oldJbReturned =
      wasRestockable && oldEntry.bags_returned > 0 && oldEntry.bag_returned_type === 'JB'
        ? oldEntry.bags_returned
        : 0;
    const oldSbReturned =
      wasRestockable && oldEntry.bags_returned > 0 && oldEntry.bag_returned_type === 'SB'
        ? oldEntry.bags_returned
        : 0;
    const newJbOut = updates.jb ?? oldEntry.jb;
    const newSbOut = updates.sb ?? oldEntry.sb;
    const newReturned = updates.bags_returned ?? oldEntry.bags_returned;
    const newReturnedType = updates.bag_returned_type ?? oldEntry.bag_returned_type;
    const newJbReturned =
      isRestockable && newReturned > 0 && newReturnedType === 'JB' ? newReturned : 0;
    const newSbReturned =
      isRestockable && newReturned > 0 && newReturnedType === 'SB' ? newReturned : 0;

    const correctedJb =
      (shipment.remaining_jb ?? 0) + oldEntry.jb - oldJbReturned - newJbOut + newJbReturned;
    const correctedSb =
      (shipment.remaining_sb ?? 0) + oldEntry.sb - oldSbReturned - newSbOut + newSbReturned;

    await supabase
      .from('shipments')
      .update({
        remaining_jb: Math.max(0, correctedJb),
        remaining_sb: Math.max(0, correctedSb),
        good_stock: Math.max(0, correctedJb) + Math.max(0, correctedSb),
      })
      .eq('id', shipmentId);
  }

  await logActivity(supabase, userId, 'ledger_entry_updated', 'shipment_ledger', id, updates);
  return { success: true };
}
