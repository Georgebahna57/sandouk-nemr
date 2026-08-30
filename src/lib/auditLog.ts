import { supabase } from './supabase';
import type { FundId } from '../types';

export type AuditAction =
  | 'customer_update'
  | 'customer_move'
  | 'customer_delete'
  | 'reconciliation'
  | 'transaction_delete'
  | 'transaction_edit';

export interface AuditEntry {
  id: string;
  at: string;
  userId?: string;
  userName: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  fundId?: FundId;
  details?: string;
}

const LOCAL_KEY = 'sandouk-audit-log';
const LOCAL_LIMIT = 200;

function readLocal(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AuditEntry[];
  } catch {
    return [];
  }
}

function writeLocal(entries: AuditEntry[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(entries.slice(0, LOCAL_LIMIT)));
}

export async function logAudit(entry: Omit<AuditEntry, 'id' | 'at'>): Promise<void> {
  const full: AuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  };

  const local = [full, ...readLocal()].slice(0, LOCAL_LIMIT);
  writeLocal(local);

  if (!supabase) return;

  const { error } = await supabase.from('audit_log').insert({
    user_id: full.userId ?? null,
    user_name: full.userName,
    action: full.action,
    entity_type: full.entityType,
    entity_id: full.entityId ?? null,
    fund_id: full.fundId ?? null,
    details: full.details ?? null,
    at: full.at,
  });

  if (error) {
    console.warn('audit_log:', error.message);
  }
}

export async function fetchAuditLog(limit = 100): Promise<AuditEntry[]> {
  if (!supabase) return readLocal().slice(0, limit);

  const { data, error } = await supabase
    .from('audit_log')
    .select('id, at, user_id, user_name, action, entity_type, entity_id, fund_id, details')
    .order('at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('audit_log fetch:', error.message);
    return readLocal().slice(0, limit);
  }

  return (data ?? []).map(row => ({
    id: row.id,
    at: row.at,
    userId: row.user_id ?? undefined,
    userName: row.user_name,
    action: row.action as AuditAction,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    fundId: row.fund_id as FundId | undefined,
    details: row.details ?? undefined,
  }));
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  customer_update: 'تعديل حساب',
  customer_move: 'نقل حساب',
  customer_delete: 'حذف حساب',
  reconciliation: 'مطابقة',
  transaction_delete: 'حذف حركة',
  transaction_edit: 'تعديل حركة',
};
