'use server';

import { requireAdmin } from './admin-helpers';

export async function fetchDashboardKPIs() {
  const { supabase } = await requireAdmin();

  const today = new Date().toISOString().split('T')[0];

  const [
    shipments,
    balances,
    pendingOrders,
    pendingKyc,
    activeClients,
    pendingFulfillment,
    todayLedger,
  ] = await Promise.all([
    supabase.from('shipments').select('remaining_jb, remaining_sb, total_jb, total_sb'),
    supabase.from('customer_balances').select('bag_type, remaining_qty').eq('status', 'pending'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('kyc_status', 'pending_verification')
      .eq('role', 'client'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('kyc_status', 'verified')
      .eq('role', 'client'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['approved', 'partially_approved', 'awaiting_check']),
    supabase
      .from('shipment_ledger')
      .select('total_sales, gross_profit, net_profit')
      .eq('date', today),
  ]);

  const totalJB = shipments.data?.reduce((s, r) => s + (r.remaining_jb ?? 0), 0) ?? 0;
  const totalSB = shipments.data?.reduce((s, r) => s + (r.remaining_sb ?? 0), 0) ?? 0;
  const jbBalance =
    balances.data?.filter((b) => b.bag_type === 'JB').reduce((s, b) => s + b.remaining_qty, 0) ?? 0;
  const sbBalance =
    balances.data?.filter((b) => b.bag_type === 'SB').reduce((s, b) => s + b.remaining_qty, 0) ?? 0;

  const todayRows = todayLedger.data ?? [];
  const todayRevenue = todayRows.reduce((s, r) => s + (Number(r.total_sales) || 0), 0);
  const todayGrossProfit = todayRows.reduce((s, r) => s + (Number(r.gross_profit) || 0), 0);
  const todayNetProfit = todayRows.reduce((s, r) => s + (Number(r.net_profit) || 0), 0);

  return {
    jbGood: totalJB,
    sbGood: totalSB,
    jbBalance,
    sbBalance,
    jbNet: totalJB - jbBalance,
    sbNet: totalSB - sbBalance,
    grandTotal: totalJB + totalSB,
    grandBalance: jbBalance + sbBalance,
    grandNet: totalJB + totalSB - (jbBalance + sbBalance),
    pendingOrders: pendingOrders.count ?? 0,
    pendingKyc: pendingKyc.count ?? 0,
    activeClients: activeClients.count ?? 0,
    pendingFulfillment: pendingFulfillment.count ?? 0,
    todayRevenue,
    todayGrossProfit,
    todayNetProfit,
  };
}

export async function fetchDashboardFinancials() {
  const { supabase } = await requireAdmin();
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('shipment_ledger')
    .select('total_sales, gross_profit, net_profit')
    .eq('date', today);
  const rows = data ?? [];
  return {
    todayRevenue: rows.reduce((s, r) => s + (Number(r.total_sales) || 0), 0),
    todayGrossProfit: rows.reduce((s, r) => s + (Number(r.gross_profit) || 0), 0),
    todayNetProfit: rows.reduce((s, r) => s + (Number(r.net_profit) || 0), 0),
  };
}
