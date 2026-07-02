'use server';

import { requireAdminOnly, logActivity } from './admin-helpers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function updateProfileRole(
  profileId: string,
  role: 'client' | 'warehouse_manager' | 'admin',
) {
  const { supabase, userId } = await requireAdminOnly();
  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', profileId)
    .single();
  if (targetError) throw new Error(targetError.message);
  if (!target || target.role === role) return { success: true };

  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', profileId);
  if (error) throw new Error(error.message);

  await logActivity(supabase, userId, 'profile_role_updated', 'profile', profileId, {
    from: target.role,
    to: role,
  });
  return { success: true };
}

export async function createManualClient(input: {
  email: string;
  fullName: string;
  password: string;
  phone?: string;
  companyName?: string;
  accountType?: 'individual' | 'company';
  addressStreet?: string;
  addressCity?: string;
  addressProvince?: string;
  addressPostalCode?: string;
  businessPermitNo?: string;
  tinNo?: string;
}) {
  const { supabase, userId } = await requireAdminOnly();
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      phone: input.phone ?? null,
      company_name: input.companyName ?? null,
      account_type: input.accountType ?? (input.companyName ? 'company' : 'individual'),
      address_street: input.addressStreet ?? null,
      address_city: input.addressCity ?? null,
      address_province: input.addressProvince ?? null,
      address_postal_code: input.addressPostalCode ?? null,
      business_permit_no: input.businessPermitNo ?? null,
      tin_no: input.tinNo ?? null,
      role: 'client',
      kyc_status: 'verified',
    },
  });

  if (error) throw new Error(error.message);
  if (!data.user?.id) throw new Error('Supabase did not return a client id.');

  await logActivity(supabase, userId, 'manual_client_created', 'profile', data.user.id, {
    email: input.email,
    fullName: input.fullName,
  });

  return { success: true, userId: data.user.id };
}
