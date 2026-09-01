import type { FundId, Transaction } from '../types';
import { todayIso } from './utils';

export type FundAccess = 'edit' | 'view' | 'hidden';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  accountsOnly: boolean;
  /** تعديل حركات أقدم من اليوم الحالي */
  canEditPast: boolean;
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

export function isTransactionEditableToday(tx: Transaction, today = todayIso()): boolean {
  return tx.date === today;
}

/** هل يمكن للمستخدم تعديل هالحركة؟ */
export function canEditTransaction(
  tx: Transaction,
  opts: {
    isAdmin: boolean;
    canEditPast: boolean;
    hasFundEdit: boolean;
    today?: string;
  },
): boolean {
  if (opts.isAdmin) return true;
  if (!opts.hasFundEdit) return false;
  if (tx.status === 'pending') return true;
  const today = opts.today ?? todayIso();
  if (isTransactionEditableToday(tx, today)) return true;
  return opts.canEditPast;
}
