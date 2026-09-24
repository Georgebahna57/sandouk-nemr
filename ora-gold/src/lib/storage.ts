import { ACCOUNTS, DEFAULT_TREASURY } from './accountsConfig';
import { getAccountBalances } from './ledger';
import { DEFAULT_PROFIT_RATE } from './invoiceCalc';
import type { AccountData, WorkshopState } from '../types';
import seededState from '../data/defaultState.json';

const BOURSE_DASHBOARD_USD = 10000;

const STORAGE_KEY = 'workshop-budget-v2';

function emptyAccount(): AccountData {
  return { gold: [], usd: [] };
}

function countEntries(state: WorkshopState): number {
  return Object.values(state.accounts).reduce((sum, acc) => sum + acc.gold.length + acc.usd.length, 0);
}

/** البيانات الافتراضية من ملف Excel `data/new.xlsx` */
export function getDefaultState(): WorkshopState {
  const base = seededState as WorkshopState;
  const accounts = { ...base.accounts };
  migrateLegacyAccounts(accounts);
  return {
    ...base,
    accounts,
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
    invoices: [],
    settings: { profitRate: DEFAULT_PROFIT_RATE },
    updatedAt: new Date().toISOString(),
  };
}

function migrateLegacyAccounts(accounts: Record<string, AccountData>): void {
  // ترحيل بيانات قديمة: حساب bourse → cash
  if (accounts.bourse && !accounts.cash) {
    accounts.cash = accounts.bourse;
    delete accounts.bourse;
  }
}

/** بورصة في Excel = 10,000$ — تصحيح استيراد خاطئ أفرغ رصيد CASH */
function migrateCashBourse(state: WorkshopState): void {
  const cash = state.accounts.cash;
  if (!cash?.usd?.length) return;

  const { usd } = getAccountBalances(cash);
  if (usd !== 0) return;

  const first = cash.usd[0];
  const looksLikeBrokenImport =
    cash.usd.length > 1 &&
    first?.credit === BOURSE_DASHBOARD_USD &&
    first?.balance === BOURSE_DASHBOARD_USD;

  if (looksLikeBrokenImport) {
    state.accounts.cash = { gold: cash.gold, usd: [first] };
  }

  state.dashboardOverrides = state.dashboardOverrides ?? {};
  if (state.dashboardOverrides.cash?.usd == null) {
    state.dashboardOverrides.cash = { ...state.dashboardOverrides.cash, usd: BOURSE_DASHBOARD_USD };
  }
}

function normalizeState(parsed: WorkshopState): WorkshopState {
  migrateLegacyAccounts(parsed.accounts);
  for (const a of ACCOUNTS) {
    if (!parsed.accounts[a.id]) parsed.accounts[a.id] = emptyAccount();
  }
  if (!parsed.treasury?.length) parsed.treasury = DEFAULT_TREASURY.map((t) => ({ ...t }));
  if (!parsed.invoices) parsed.invoices = [];
  if (!parsed.manualDisbursementOrders) parsed.manualDisbursementOrders = [];
  if (!parsed.settings) parsed.settings = { profitRate: DEFAULT_PROFIT_RATE };
  if (!parsed.dashboardOverrides) parsed.dashboardOverrides = {};
  migrateCashBourse(parsed);
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
