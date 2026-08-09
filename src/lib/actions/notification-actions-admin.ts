'use server';

import { requireAdmin } from './admin-helpers';
import { safeAction } from './action-result';

export async function fetchAdminNotifications() {
  const { supabase, userId } = await requireAdmin();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function fetchUnreadAdminNotificationCount() {
  const { supabase, userId } = await requireAdmin();
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count ?? 0;
}

// Internal implementation unchanged — safeAction() wraps the export below.
async function _markAdminNotificationRead(notificationId: string) {
  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export const markAdminNotificationRead = safeAction(_markAdminNotificationRead);

// Internal implementation unchanged — safeAction() wraps the export below.
async function _markAllAdminNotificationsRead() {
  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw new Error(error.message);
  return { success: true };
}

export const markAllAdminNotificationsRead = safeAction(_markAllAdminNotificationsRead);
