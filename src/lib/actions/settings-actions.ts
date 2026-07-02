'use server';

import { requireAdmin, logActivity } from './admin-helpers';
import type { CostConfig } from './admin-helpers';

export async function getAdminSetting(key: string) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('admin_settings').select('*').eq('key', key).single();
  return data?.value ?? null;
}

export async function saveAdminSetting(key: string, value: Record<string, unknown>) {
  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase
    .from('admin_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
  await logActivity(supabase, userId, 'setting_updated', 'admin_settings', key, { key });
  return { success: true };
}

export async function saveCostConfig(config: CostConfig) {
  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase
    .from('admin_settings')
    .upsert(
      { key: 'cost_config', value: config, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
  if (error) throw new Error(error.message);
  await logActivity(
    supabase,
    userId,
    'setting_updated',
    'admin_settings',
    'cost_config',
    config as unknown as Record<string, unknown>,
  );
  return { success: true };
}

// Wrapper alias function for perfect frontend UI compatibility wizard sync matching
export async function saveCostConfiguration(landedCost: number, localExpenses: number) {
  return saveCostConfig({
    landed_cost_per_bag: landedCost,
    local_expenses_per_bag: localExpenses,
  });
}

export async function fetchSalesProfitReport(dateFrom: string, dateTo: string) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from('shipment_ledger')
    .select(
      'date, total_sales, gross_profit, net_profit, jb, sb, client_name, dr_number, po_number',
    )
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: false });
  const rows = data ?? [];
  return {
    totalSales: rows.reduce((s, r) => s + (Number(r.total_sales) || 0), 0),
    totalGrossProfit: rows.reduce((s, r) => s + (Number(r.gross_profit) || 0), 0),
    totalNetProfit: rows.reduce((s, r) => s + (Number(r.net_profit) || 0), 0),
    entries: rows,
  };
}
