import type { Customer, CustomerSummary } from '../types';

export const DEFAULT_ACCOUNT_GROUP = 'عام';

export function normalizeAccountGroup(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function accountGroupLabel(group?: string): string {
  return normalizeAccountGroup(group) ?? DEFAULT_ACCOUNT_GROUP;
}

export function collectAccountGroups(customers: Customer[]): string[] {
  const groups = new Set<string>();
  for (const customer of customers) {
    const group = normalizeAccountGroup(customer.accountGroup);
    if (group) groups.add(group);
  }
  return [...groups].sort((a, b) => a.localeCompare(b, 'ar'));
}

export interface AccountGroupSection {
  id: string;
  label: string;
  summaries: CustomerSummary[];
}

export function groupSummariesBySection(summaries: CustomerSummary[]): AccountGroupSection[] {
  const byGroup = new Map<string, CustomerSummary[]>();

  for (const summary of summaries) {
    const label = accountGroupLabel(summary.accountGroup);
    const bucket = byGroup.get(label) ?? [];
    bucket.push(summary);
    byGroup.set(label, bucket);
  }

  const sections = [...byGroup.entries()].map(([label, items]) => ({
    id: label,
    label,
    summaries: items.sort((a, b) => a.name.localeCompare(b.name, 'ar')),
  }));

  sections.sort((a, b) => {
    if (a.label === DEFAULT_ACCOUNT_GROUP) return 1;
    if (b.label === DEFAULT_ACCOUNT_GROUP) return -1;
    return a.label.localeCompare(b.label, 'ar');
  });

  return sections;
}
