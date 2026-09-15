import { CENTERS_FUND_ID } from '../config';
import { supabase } from './supabase';
import type { AccountBranchId, Customer, CustomerSummary, FundId } from '../types';

export interface AccountSection {
  id: string;
  name: string;
  branch: AccountBranchId;
}

export interface AccountSectionsState {
  sections: AccountSection[];
  assignments: Record<string, string>;
}

export const UNASSIGNED_SECTION_LABEL = 'بدون قسم';

const SETTINGS_KEY = 'account_sections_v1';
const LOCAL_CACHE = 'sandouk-account-sections-v1';

export function emptyAccountSectionsState(): AccountSectionsState {
  return { sections: [], assignments: {} };
}

export function normalizeAccountSectionsState(raw: unknown): AccountSectionsState {
  if (!raw || typeof raw !== 'object') return emptyAccountSectionsState();
  const record = raw as Record<string, unknown>;
  const sections: AccountSection[] = [];
  if (Array.isArray(record.sections)) {
    for (const item of record.sections) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id : '';
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      const branch = row.branch === 'centers' ? 'centers' : row.branch === 'customers' ? 'customers' : null;
      if (!id || !name || !branch) continue;
      sections.push({ id, name, branch });
    }
  }
  const assignments: Record<string, string> = {};
  if (record.assignments && typeof record.assignments === 'object' && !Array.isArray(record.assignments)) {
    for (const [key, value] of Object.entries(record.assignments as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) assignments[key] = value.trim();
    }
  }
  return { sections, assignments };
}

export function loadAccountSectionsLocal(): AccountSectionsState {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE);
    if (!raw) return emptyAccountSectionsState();
    return normalizeAccountSectionsState(JSON.parse(raw));
  } catch {
    return emptyAccountSectionsState();
  }
}

export function saveAccountSectionsLocal(state: AccountSectionsState): void {
  try {
    localStorage.setItem(LOCAL_CACHE, JSON.stringify(state));
  } catch {
    // تجاهل
  }
}

export async function fetchAccountSections(): Promise<AccountSectionsState> {
  const local = loadAccountSectionsLocal();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    console.warn('app_settings account_sections:', error.message);
    return local;
  }

  if (!data?.value) return local;
  const remote = normalizeAccountSectionsState(data.value);
  saveAccountSectionsLocal(remote);
  return remote;
}

export async function saveAccountSections(state: AccountSectionsState): Promise<void> {
  const normalized = normalizeAccountSectionsState(state);
  saveAccountSectionsLocal(normalized);
  if (!supabase) return;

  const { error } = await supabase.from('app_settings').upsert({
    key: SETTINGS_KEY,
    value: normalized,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.warn('app_settings save account_sections:', error.message);
    if (error.message.includes('app_settings') || error.code === 'PGRST205' || error.code === '42P01') {
      return;
    }
    throw error;
  }
}

export function accountSummaryKey(summary: CustomerSummary, fallbackFundId: FundId): string {
  if (summary.customerId) return `c:${summary.customerId}`;
  const fundId = summary.fundId ?? fallbackFundId;
  return `a:${fundId}:${summary.name.trim()}`;
}

export function sectionNameById(state: AccountSectionsState, sectionId?: string): string | undefined {
  if (!sectionId) return undefined;
  return state.sections.find(section => section.id === sectionId)?.name;
}

export function sectionsForBranch(state: AccountSectionsState, branch: AccountBranchId): AccountSection[] {
  return state.sections
    .filter(section => section.branch === branch)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

export function resolveSummarySectionId(
  summary: CustomerSummary,
  state: AccountSectionsState,
  branch: AccountBranchId,
  fallbackFundId: FundId,
  customers: Customer[],
): string | undefined {
  const key = accountSummaryKey(summary, fallbackFundId);
  const assigned = state.assignments[key];
  if (assigned) return assigned;

  const customer = summary.customerId
    ? customers.find(c => c.id === summary.customerId)
    : customers.find(c => c.name === summary.name && (c.fundId === summary.fundId || c.fundId === fallbackFundId));
  const legacy = customer?.accountGroup?.trim();
  if (!legacy) return undefined;

  const byId = state.sections.find(section => section.id === legacy && section.branch === branch);
  if (byId) return byId.id;

  const byName = state.sections.find(section => section.name === legacy && section.branch === branch);
  if (byName) return byName.id;

  return undefined;
}

export function migrateLegacyAccountGroups(
  state: AccountSectionsState,
  customers: Customer[],
  branch: AccountBranchId,
): AccountSectionsState {
  let next = state;
  let changed = false;

  for (const customer of customers) {
    const legacy = customer.accountGroup?.trim();
    if (!legacy) continue;
    const customerBranch = customer.accountBranch ?? (customer.fundId === CENTERS_FUND_ID ? 'centers' : 'customers');
    if (customerBranch !== branch) continue;

    let section = next.sections.find(item => item.name === legacy && item.branch === branch);
    if (!section) {
      section = { id: crypto.randomUUID(), name: legacy, branch };
      next = { ...next, sections: [...next.sections, section] };
      changed = true;
    }

    const key = `c:${customer.id}`;
    if (next.assignments[key] !== section.id) {
      next = {
        ...next,
        assignments: { ...next.assignments, [key]: section.id },
      };
      changed = true;
    }
  }

  return changed ? next : state;
}

export function enrichSummariesWithSections(
  summaries: CustomerSummary[],
  state: AccountSectionsState,
  branch: AccountBranchId,
  fallbackFundId: FundId,
  customers: Customer[],
): CustomerSummary[] {
  return summaries.map(summary => {
    const sectionId = resolveSummarySectionId(summary, state, branch, fallbackFundId, customers);
    return {
      ...summary,
      accountSectionId: sectionId,
      accountGroup: sectionNameById(state, sectionId),
    };
  });
}

export function assignSummaryToSection(
  state: AccountSectionsState,
  summary: CustomerSummary,
  fallbackFundId: FundId,
  sectionId: string | null,
): AccountSectionsState {
  const key = accountSummaryKey(summary, fallbackFundId);
  const assignments = { ...state.assignments };
  if (sectionId) assignments[key] = sectionId;
  else delete assignments[key];
  return { ...state, assignments };
}

export function addAccountSection(
  state: AccountSectionsState,
  name: string,
  branch: AccountBranchId,
): AccountSectionsState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const exists = state.sections.some(section => section.branch === branch && section.name === trimmed);
  if (exists) return state;
  return {
    ...state,
    sections: [...state.sections, { id: crypto.randomUUID(), name: trimmed, branch }],
  };
}

export function removeAccountSection(state: AccountSectionsState, sectionId: string): AccountSectionsState {
  const assignments = { ...state.assignments };
  for (const [key, value] of Object.entries(assignments)) {
    if (value === sectionId) delete assignments[key];
  }
  return {
    sections: state.sections.filter(section => section.id !== sectionId),
    assignments,
  };
}
