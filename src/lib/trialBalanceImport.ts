import { isFundAccountName } from '../config';
import type { Currency, FundId, Transaction } from '../types';
import { isFeeAccountName } from './fees';
import { computeAccountBalances, createAccountTransaction, todayIso } from './utils';

export const TRIAL_BALANCE_IMPORT_NOTE = 'استيراد ميزان مراجعة';
export const TRIAL_BALANCE_OPENING_NOTE = 'رصيد مرحّل - استيراد';

export interface TrialBalanceCurrencyRow {
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceImportAccount {
  code: string;
  name: string;
  currencies: Partial<Record<Currency, TrialBalanceCurrencyRow>>;
}

export interface TrialBalanceImportResult {
  importedCount: number;
  createdAccounts: string[];
  matchedByNumber: { importName: string; existingName: string; code: string }[];
  /** حسابات صندوق/أجور — لا تُستورد لأنها لا تخص الزبائن */
  skippedNames: string[];
}

export interface TrialBalanceImportFilterResult {
  accounts: TrialBalanceImportAccount[];
  skippedNames: string[];
}

/** يستبعد حسابات الصناديق والأجور — الاستيراد للزبائن فقط */
export function filterImportableTrialBalanceAccounts(
  accounts: TrialBalanceImportAccount[],
): TrialBalanceImportFilterResult {
  const skippedNames: string[] = [];
  const filtered = accounts.filter(acc => {
    const name = acc.name.trim();
    if (isFundAccountName(name) || isFeeAccountName(name)) {
      skippedNames.push(name);
      return false;
    }
    return true;
  });
  return { accounts: filtered, skippedNames };
}

/** تأكيد أن الاستيراد لا يُنشئ حركات صندوق */
export function assertAccountOnlyImportTransactions(txs: Transaction[]): void {
  for (const tx of txs) {
    if ((tx.ledger ?? 'fund') !== 'account') {
      throw new Error('الاستيراد يجب أن يكون حركات حساب فقط — لا يمس الصندوق');
    }
  }
}

const SHEET_CURRENCY: Record<string, Currency> = {
  'USD': 'USD',
  'EUR': 'EUR',
  'SYP': 'SYP',
  'GOLD': 'GOLD',
  'SILVER': 'SILVER',
  'LBP': 'LBP',
  'GBP': 'GBP',
  'CAD': 'CAD',
};

export function sheetNameToCurrency(sheetName: string): Currency | null {
  const key = sheetName.split('-')[0].trim();
  return SHEET_CURRENCY[key] ?? null;
}

export function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '').trim();
  if (!s || s === '-') return 0;
  const negative = s.includes('(') && s.includes(')');
  const n = parseFloat(s.replace(/[^0.0-9.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return negative && n > 0 ? -n : n;
}

/** يدمج صفوف كل العملات لنفس الحساب */
export function mergeTrialBalanceSheetRows(
  sheetName: string,
  rows: unknown[][],
): TrialBalanceImportAccount[] {
  const currency = sheetNameToCurrency(sheetName);
  if (!currency) return [];

  const accounts: TrialBalanceImportAccount[] = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    const code = String(row[0] ?? '').trim();
    const name = String(row[1] ?? '').trim();
    if (!name || name.includes('مجموع')) continue;

    const debit = num(row[2]);
    const credit = num(row[3]);
    const balance = num(row[4]);
    if (debit === 0 && credit === 0 && balance === 0) {
      accounts.push({ code, name, currencies: {} });
      continue;
    }

    accounts.push({
      code,
      name,
      currencies: { [currency]: { debit, credit, balance } },
    });
  }
  return accounts;
}

export function mergeTrialBalanceAccounts(
  chunks: TrialBalanceImportAccount[],
): TrialBalanceImportAccount[] {
  const map = new Map<string, TrialBalanceImportAccount>();
  for (const acc of chunks) {
    const key = acc.name.trim();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        code: acc.code,
        name: acc.name,
        currencies: { ...acc.currencies },
      });
      continue;
    }
    if (!existing.code && acc.code) existing.code = acc.code;
    Object.assign(existing.currencies, acc.currencies);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

export function buildTrialBalanceImportTransactions(
  fundId: FundId,
  accountName: string,
  currency: Currency,
  row: TrialBalanceCurrencyRow,
  date = todayIso(),
): Transaction[] {
  const { debit, credit, balance } = row;
  const txs: Transaction[] = [];
  const base = {
    fundId,
    party: accountName,
    currency,
    date,
    status: 'posted' as const,
  };

  if (debit > 0) {
    txs.push(createAccountTransaction({
      ...base,
      kind: 'receipt',
      amount: debit,
      note: TRIAL_BALANCE_IMPORT_NOTE,
    }));
  }
  if (credit > 0) {
    txs.push(createAccountTransaction({
      ...base,
      kind: 'payment',
      amount: credit,
      note: TRIAL_BALANCE_IMPORT_NOTE,
    }));
  }

  const openingNet = balance - (debit - credit);
  if (openingNet > 0) {
    txs.push(createAccountTransaction({
      ...base,
      kind: 'receipt',
      amount: openingNet,
      note: TRIAL_BALANCE_OPENING_NOTE,
    }));
  } else if (openingNet < 0) {
    txs.push(createAccountTransaction({
      ...base,
      kind: 'payment',
      amount: Math.abs(openingNet),
      note: TRIAL_BALANCE_OPENING_NOTE,
    }));
  }

  return txs;
}

export function buildAllImportTransactions(
  accounts: TrialBalanceImportAccount[],
  fundId: FundId,
  date = todayIso(),
): Transaction[] {
  const all: Transaction[] = [];
  for (const acc of accounts) {
    for (const [currency, row] of Object.entries(acc.currencies)) {
      if (!row) continue;
      all.push(...buildTrialBalanceImportTransactions(
        fundId,
        acc.name,
        currency as Currency,
        row,
        date,
      ));
    }
  }
  return all;
}

/** حركة واحدة لضبط الرصيد على المطلوب — بدون مسح الحركات اليدوية */
export function buildBalanceSyncTransaction(
  fundId: FundId,
  accountName: string,
  currency: Currency,
  targetBalance: number,
  currentBalance: number,
  date = todayIso(),
): Transaction[] {
  const delta = Math.round((targetBalance - currentBalance) * 100) / 100;
  if (Math.abs(delta) < 1e-9) return [];
  const base = {
    fundId,
    party: accountName,
    currency,
    date,
    status: 'posted' as const,
    note: TRIAL_BALANCE_OPENING_NOTE,
  };
  if (delta > 0) {
    return [createAccountTransaction({ ...base, kind: 'receipt', amount: delta })];
  }
  return [createAccountTransaction({ ...base, kind: 'payment', amount: Math.abs(delta) })];
}

/** يضبط أرصدة الحسابات على الملف — يحذف فقط حركات الاستيراد السابقة */
export function buildAllImportBalanceSyncTransactions(
  accounts: TrialBalanceImportAccount[],
  fundId: FundId,
  transactions: Transaction[],
  date = todayIso(),
): Transaction[] {
  const all: Transaction[] = [];
  for (const acc of accounts) {
    for (const [currency, row] of Object.entries(acc.currencies)) {
      if (!row) continue;
      const cur = currency as Currency;
      const current = computeAccountBalances(transactions, fundId, acc.name)[cur].balance;
      all.push(...buildBalanceSyncTransaction(fundId, acc.name, cur, row.balance, current, date));
    }
  }
  for (const tx of all) {
    if ((tx.ledger ?? 'fund') !== 'account') {
      throw new Error('خطأ داخلي: حركة استيراد غير حساب');
    }
  }
  return all;
}

export function isTrialBalanceImportTransaction(tx: Transaction): boolean {
  const note = tx.note ?? '';
  return note.includes(TRIAL_BALANCE_IMPORT_NOTE) || note.includes(TRIAL_BALANCE_OPENING_NOTE);
}

/** يقرأ ملف Excel ويُرجع الحسابات المدمجة */
export function parseTrialBalanceWorkbook(
  sheetNames: string[],
  getSheetRows: (name: string) => unknown[][],
): TrialBalanceImportAccount[] {
  const chunks: TrialBalanceImportAccount[] = [];
  for (const sheetName of sheetNames) {
    const rows = getSheetRows(sheetName);
    if (!rows?.length) continue;
    chunks.push(...mergeTrialBalanceSheetRows(sheetName, rows));
  }
  return mergeTrialBalanceAccounts(chunks);
}
