'use server';

import { requireAdmin } from './admin-helpers';

export async function fetchAuditLog(page: number = 1, perPage: number = 50) {
  const { supabase } = await requireAdmin();
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, count } = await supabase
    .from('activity_log')
    .select('*, actor:profiles!activity_log_actor_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  return { entries: data ?? [], total: count ?? 0 };
}

export async function fetchActivityFeed(limit: number = 20) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from('activity_log')
    .select('*, actor:profiles!activity_log_actor_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}
