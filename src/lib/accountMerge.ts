import { CURRENCIES, emptyCustomerBalances } from '../config';
import {
  isFeeAccountName,
  normalizeFeeSourceAccount,
  SEPARATE_FEE_ACCOUNTS,
} from './fees';
import type { AccountReconciliation, Customer, CustomerBalances, CustomerSummary } from '../types';

/** مفتاح موحّد لدمج الحسابات المتكررة (كندا، نور، أجور كندا، أجور نور…) */
export function canonicalAccountKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const normalized = normalizeFeeSourceAccount(trimmed);
  if (normalized === 'كندا') return 'كندا';
  if (normalized === 'نور') return 'نور';

  if (trimmed === SEPARATE_FEE_ACCOUNTS.كندا) return SEPARATE_FEE_ACCOUNTS.كندا;
  if (trimmed === SEPARATE_FEE_ACCOUNTS.نور) return SEPARATE_FEE_ACCOUNTS.نور;

  if (isFeeAccountName(trimmed)) return trimmed;
  return trimmed;
}

export function canonicalAccountDisplayName(key: string): string {
  return key;
}

/** توحيد رقم الحساب للمقارنة (4011-1114 = 40111114) */
export function normalizeAccountNumber(num: string): string {
  return num.trim().replace(/[\s-]/g, '').toLowerCase();
}

/** هل رقما حسابين يطابقان (4011-1114 = 1114) */
export function accountNumbersMatch(a: string, b: string): boolean {
  const na = normalizeAccountNumber(a);
  const nb = normalizeAccountNumber(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length > nb.length && na.endsWith(nb)) return true;
  if (nb.length > na.length && nb.endsWith(na)) return true;
  return false;
}

function buildAccountNumberMaps(customers: Customer[]) {
  const nameToNormalized = new Map<string, string>();
  const normalizedToDisplay = new Map<string, string>();
  for (const c of customers) {
    const raw = c.accountNumber?.trim();
    if (!raw) continue;
    const norm = normalizeAccountNumber(raw);
    nameToNormalized.set(c.name.trim(), norm);
    if (!normalizedToDisplay.has(norm)) normalizedToDisplay.set(norm, raw);
  }
  return { nameToNormalized, normalizedToDisplay };
}

function resolveSummaryAccountNumber(
  summary: CustomerSummary,
  nameToNormalized: Map<string, string>,
): string | undefined {
  const direct = summary.accountNumber?.trim();
  if (direct) return normalizeAccountNumber(direct);
  return nameToNormalized.get(summary.name.trim());
}

function accountMergeKey(
  summary: CustomerSummary,
  nameToNormalized: Map<string, string>,
): string {
  if (isFeeAccountName(summary.name)) {
    return `name:${canonicalAccountKey(summary.name)}`;
  }
  const num = resolveSummaryAccountNumber(summary, nameToNormalized);
  if (num) return `num:${num}`;
  return `name:${canonicalAccountKey(summary.name)}`;
}

function pickMergedDisplayName(names: string[]): string {
  return [...names].sort((a, b) => a.length - b.length || a.localeCompare(b, 'ar'))[0];
}

function pickMergedReconciliation(
  a?: AccountReconciliation,
  b?: AccountReconciliation,
): AccountReconciliation | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.throughDate <= b.throughDate ? a : b;
}

function displayAccountNumber(
  normalized: string | undefined,
  normalizedToDisplay: Map<string, string>,
  summaries: CustomerSummary[],
): string | undefined {
  if (!normalized) return undefined;
  const fromMap = normalizedToDisplay.get(normalized);
  if (fromMap) return fromMap;
  for (const s of summaries) {
    const raw = s.accountNumber?.trim();
    if (raw && normalizeAccountNumber(raw) === normalized) return raw;
  }
  return undefined;
}

export function mergeCustomerBalances(a: CustomerBalances, b: CustomerBalances): CustomerBalances {
  const result = emptyCustomerBalances();
  for (const c of CURRENCIES) {
    const id = c.id;
    result[id].receipts = (a[id]?.receipts ?? 0) + (b[id]?.receipts ?? 0);
    result[id].payments = (a[id]?.payments ?? 0) + (b[id]?.payments ?? 0);
    result[id].balance = (a[id]?.balance ?? 0) + (b[id]?.balance ?? 0);
  }
  return result;
}

/** دمج حسابات بنفس الاسم أو بنفس رقم الحساب */
export function mergeAccountSummaries(
  summaries: CustomerSummary[],
  customers: Customer[] = [],
): CustomerSummary[] {
  const { nameToNormalized, normalizedToDisplay } = buildAccountNumberMaps(customers);
  const byKey = new Map<string, CustomerSummary>();

  for (const s of summaries) {
    const key = accountMergeKey(s, nameToNormalized);
    const existing = byKey.get(key);

    if (!existing) {
      const fundIds = s.fundId ? [s.fundId] : [];
      const norm = key.startsWith('num:') ? key.slice(4) : undefined;
      byKey.set(key, {
        ...s,
        name: pickMergedDisplayName([s.name]),
        accountNumber: s.accountNumber ?? (norm ? displayAccountNumber(norm, normalizedToDisplay, [s]) : undefined),
        aliases: [s.name],
        fundIds,
        fundId: s.fundId,
        merged: false,
      });
      continue;
    }

    const fundIds = [...new Set([
      ...(existing.fundIds ?? (existing.fundId ? [existing.fundId] : [])),
      ...(s.fundId ? [s.fundId] : []),
    ])];
    const aliases = [...new Set([...(existing.aliases ?? [existing.name]), s.name])];
    const displayName = pickMergedDisplayName(aliases);
    const norm = key.startsWith('num:') ? key.slice(4) : undefined;

    byKey.set(key, {
      ...existing,
      name: displayName,
      accountNumber: existing.accountNumber ?? s.accountNumber ?? (norm ? displayAccountNumber(norm, normalizedToDisplay, [existing, s]) : undefined),
      balances: mergeCustomerBalances(existing.balances, s.balances),
      hasActivity: existing.hasActivity || s.hasActivity,
      customerId: existing.customerId ?? s.customerId,
      accountGroup: existing.accountGroup ?? s.accountGroup,
      reconciliation: pickMergedReconciliation(existing.reconciliation, s.reconciliation),
      sharedFundIds: existing.sharedFundIds ?? s.sharedFundIds,
      fundIds,
      fundId: existing.fundId ?? s.fundId ?? fundIds[0],
      aliases,
      merged: fundIds.length > 1 || aliases.length > 1,
    });
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

export function isMergedAccountSummary(summary: CustomerSummary): boolean {
  return summary.merged
    || (summary.fundIds?.length ?? 0) > 1
    || (summary.aliases?.length ?? 0) > 1;
}

/** أسماء إضافية مدمجة (غير الاسم المعروض) */
export function mergedAccountAliasLabels(summary: CustomerSummary): string[] {
  const aliases = summary.aliases ?? [];
  return aliases.filter(a => a.trim() !== summary.name.trim());
}
