'use server';

import { requireAdmin, logActivity } from './admin-helpers';
import { createUserNotification } from './notification-actions';

export async function fetchPendingKyc() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('kyc_status', 'pending_verification')
    .eq('role', 'client')
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function fetchVerifiedClients() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('kyc_status', 'verified')
    .eq('role', 'client')
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function approveKyc(profileId: string) {
  const { supabase, userId } = await requireAdmin();

  const { error } = await supabase
    .from('profiles')
    .update({ kyc_status: 'verified', updated_at: new Date().toISOString() })
    .eq('id', profileId);

  if (error) throw new Error(error.message);

  await logActivity(supabase, userId, 'kyc_approved', 'profile', profileId, {
    status: 'verified',
  });

  await createUserNotification({
    userId: profileId,
    title: 'KYC Approved',
    message:
      'Your account has been verified. You can now place orders and access all portal features.',
    href: '/client/dashboard',
    severity: 'success',
  });

  return { success: true };
}

export async function rejectKyc(profileId: string, reason: string) {
  const { supabase, userId } = await requireAdmin();

  const { error } = await supabase
    .from('profiles')
    .update({
      kyc_status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId);

  if (error) throw new Error(error.message);

  await logActivity(supabase, userId, 'kyc_rejected', 'profile', profileId, {
    reason,
    status: 'rejected',
  });

  await createUserNotification({
    userId: profileId,
    title: 'KYC Rejected',
    message: `Your verification was not approved. Reason: ${reason}. Please contact support or re-submit your documents.`,
    href: '/client/profile',
    severity: 'warning',
  });

  return { success: true };
}
