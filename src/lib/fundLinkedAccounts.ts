import type { FundId } from '../types';

/** حساب مربوط بكل صندوق — كل عملية صندوق تُرحَل تلقائياً على هذا الحساب */
export const FUND_LINKED_ACCOUNTS: Partial<Record<FundId, string>> = {
  nemr: 'حساب النمر',
  zalqa: 'صندوق داخلي',
  george: 'شركة جورج ابو عيون السود -جورج',
};

function normalizeLabel(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getLinkedAccountForFund(fundId: FundId): string | undefined {
  return FUND_LINKED_ACCOUNTS[fundId];
}

export function fundRequiresAccountLink(fundId: FundId): boolean {
  return !!getLinkedAccountForFund(fundId);
}

export function getFundForLinkedAccount(accountName: string): FundId | undefined {
  const trimmed = normalizeLabel(accountName);
  for (const [fundId, linked] of Object.entries(FUND_LINKED_ACCOUNTS) as [FundId, string][]) {
    if (normalizeLabel(linked) === trimmed) return fundId;
  }
  for (const [fundId, linked] of Object.entries(FUND_LINKED_ACCOUNTS) as [FundId, string][]) {
    const norm = normalizeLabel(linked);
    if (trimmed.includes(norm) || norm.includes(trimmed)) return fundId;
  }
  return undefined;
}

/** يطابق اسم الحساب المربوط من قائمة الحسابات المسجّلة */
export function resolveLinkedAccountName(fundId: FundId, accountNames: readonly string[]): string {
  const linked = getLinkedAccountForFund(fundId);
  if (!linked) return '';

  const target = normalizeLabel(linked);
  const exact = accountNames.find(n => normalizeLabel(n) === target);
  if (exact) return exact;

  const partial = accountNames.find(n => {
    const norm = normalizeLabel(n);
    return norm.includes(target) || target.includes(norm);
  });
  if (partial) return partial;

  return linked;
}
