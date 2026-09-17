import { ACCOUNTS, DEFAULT_TREASURY } from './accountsConfig';
import type { AccountData, WorkshopState } from '../types';
import seededState from '../data/defaultState.json';

const STORAGE_KEY = 'workshop-budget-v1';

function emptyAccount(): AccountData {
  return { gold: [], usd: [] };
}

function countEntries(state: WorkshopState): number {
  return Object.values(state.accounts).reduce((sum, acc) => sum + acc.gold.length + acc.usd.length, 0);
}

/** البيانات الافتراضية من ملف Excel ميزانية-05-2026 */
export function getDefaultState(): WorkshopState {
  const base = seededState as WorkshopState;
  return {
    ...base,
    accounts: { ...base.accounts },
    treasury: base.treasury.map((t) => ({ ...t })),
    updatedAt: new Date().toISOString(),
  };
}

export function createEmptyState(periodLabel = '05-2026'): WorkshopState {
  const accounts: Record<string, AccountData> = {};
  for (const a of ACCOUNTS) {
    accounts[a.id] = emptyAccount();
  }
  return {
    version: 1,
    periodLabel,
    accounts,
    treasury: DEFAULT_TREASURY.map((t) => ({ ...t })),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(parsed: WorkshopState): WorkshopState {
  for (const a of ACCOUNTS) {
    if (!parsed.accounts[a.id]) parsed.accounts[a.id] = emptyAccount();
  }
  if (!parsed.treasury?.length) parsed.treasury = DEFAULT_TREASURY.map((t) => ({ ...t }));
  return parsed;
}

export function loadState(): WorkshopState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = normalizeState(JSON.parse(raw) as WorkshopState);
    if (parsed.version !== 1) return getDefaultState();
    // إذا المحفوظ فاضي — حمّل بيانات Excel الافتراضية
    if (countEntries(parsed) === 0) return getDefaultState();
    return parsed;
  } catch {
    return getDefaultState();
  }
}

export function saveState(state: WorkshopState): void {
  const next = { ...state, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function exportStateJson(state: WorkshopState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workshop-backup-${state.periodLabel}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
