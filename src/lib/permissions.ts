import type { FundId } from '../types';

export type FundAccess = 'edit' | 'view' | 'hidden';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export interface FundPermissionRow {
  userId: string;
  fundId: FundId;
  permission: 'edit' | 'view';
}

export const PERMISSION_LABELS: Record<FundAccess, string> = {
  edit: 'تعديل',
  view: 'مراجعة',
  hidden: 'مخفي',
};

export function resolveFundAccess(
  fundId: FundId,
  isAdmin: boolean,
  permissions: Partial<Record<FundId, 'edit' | 'view'>>,
): FundAccess {
  if (isAdmin) return 'edit';
  return permissions[fundId] ?? 'hidden';
}

export function canEditFund(access: FundAccess): boolean {
  return access === 'edit';
}

export function canViewFund(access: FundAccess): boolean {
  return access === 'edit' || access === 'view';
}
