import { CURRENCIES, emptyCustomerBalances } from '../config';
import {
  isFeeAccountName,
  normalizeFeeSourceAccount,
  SEPARATE_FEE_ACCOUNTS,
} from './fees';
import type { CustomerBalances, CustomerSummary } from '../types';

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

export function mergeAccountSummaries(summaries: CustomerSummary[]): CustomerSummary[] {
  const byKey = new Map<string, CustomerSummary>();

  for (const s of summaries) {
    const key = canonicalAccountKey(s.name);
    const existing = byKey.get(key);

    if (!existing) {
      const fundIds = s.fundId ? [s.fundId] : [];
      byKey.set(key, {
        ...s,
        name: canonicalAccountDisplayName(key),
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

    byKey.set(key, {
      ...existing,
      name: canonicalAccountDisplayName(key),
      balances: mergeCustomerBalances(existing.balances, s.balances),
      hasActivity: existing.hasActivity || s.hasActivity,
      customerId: existing.customerId ?? s.customerId,
      reconciliation: existing.reconciliation ?? s.reconciliation,
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
