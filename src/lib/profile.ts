import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { FundId } from '../types';
import type { FundPermissionRow, UserProfile } from './permissions';

function requireClient() {
  if (!supabase) throw new Error('Supabase غير مُعدّ');
  return supabase;
}

export async function ensureProfile(user: User): Promise<UserProfile> {
  const client = requireClient();

  const { data: existing } = await client
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  const fallbackName =
    (user.user_metadata?.display_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'مستخدم';

  const { error: upsertError } = await client.from('profiles').upsert({
    id: user.id,
    email: user.email ?? '',
    display_name: existing?.display_name || fallbackName,
  });
  if (upsertError) throw upsertError;

  const { data, error } = await client
    .from('profiles')
    .select('id, email, display_name, is_admin')
    .eq('id', user.id)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name || fallbackName,
    isAdmin: data.is_admin,
  };
}

export async function updateDisplayName(userId: string, displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) throw new Error('الاسم مطلوب');
  const { error } = await requireClient()
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', userId);
  if (error) throw error;
}

export async function fetchMyPermissions(userId: string): Promise<Partial<Record<FundId, 'edit' | 'view'>>> {
  const { data, error } = await requireClient()
    .from('user_fund_permissions')
    .select('fund_id, permission')
    .eq('user_id', userId);

  if (error) throw error;

  const map: Partial<Record<FundId, 'edit' | 'view'>> = {};
  for (const row of data ?? []) {
    map[row.fund_id as FundId] = row.permission as 'edit' | 'view';
  }
  return map;
}

export async function fetchAllProfiles(): Promise<UserProfile[]> {
  const { data, error } = await requireClient()
    .from('profiles')
    .select('id, email, display_name, is_admin')
    .order('email');

  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.email,
    isAdmin: row.is_admin,
  }));
}

export async function fetchAllPermissions(): Promise<FundPermissionRow[]> {
  const { data, error } = await requireClient()
    .from('user_fund_permissions')
    .select('user_id, fund_id, permission');

  if (error) throw error;

  return (data ?? []).map(row => ({
    userId: row.user_id,
    fundId: row.fund_id as FundId,
    permission: row.permission as 'edit' | 'view',
  }));
}

export async function saveUserFundPermissions(
  userId: string,
  permissions: Partial<Record<FundId, 'edit' | 'view' | 'hidden'>>,
) {
  const client = requireClient();

  const { error: deleteError } = await client
    .from('user_fund_permissions')
    .delete()
    .eq('user_id', userId);
  if (deleteError) throw deleteError;

  const rows = Object.entries(permissions)
    .filter(([, perm]) => perm === 'edit' || perm === 'view')
    .map(([fundId, permission]) => ({
      user_id: userId,
      fund_id: fundId,
      permission,
    }));

  if (rows.length > 0) {
    const { error: insertError } = await client.from('user_fund_permissions').insert(rows);
    if (insertError) throw insertError;
  }
}

export async function setUserAdmin(userId: string, isAdmin: boolean) {
  const { error } = await requireClient()
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', userId);
  if (error) throw error;
}
