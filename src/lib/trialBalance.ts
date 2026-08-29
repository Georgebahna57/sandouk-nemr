import { CURRENCIES } from '../config';
import type { Currency, Customer, CustomerSummary, FundId, Transaction } from '../types';
import { createAccountTransaction, formatValueWithUnit } from './utils';
import { TRIAL_BALANCE_IMPORT_NOTE } from './trialBalanceImport';

export interface TrialBalanceRow {
  summary: CustomerSummary;
  fundId: FundId;
  currency: Currency;
  debit: number;
  credit: number;
  balance: number;
  customer?: Customer;
  phone?: string;
  accountNumber?: string;
}

function resolveTrialBalanceCustomer(
  summary: CustomerSummary,
  customers: Customer[],
  fundId: FundId,
): Customer | undefined {
  const names = [summary.name, ...(summary.aliases ?? [])];
  for (const name of names) {
    const found = customers.find(c => c.id === summary.customerId)
      ?? customers.find(c => c.name === name && (c.fundId === fundId || c.sharedFundIds?.includes(fundId)));
    if (found) return found;
  }
  return undefined;
}

function buildTrialBalanceLine(
  summary: CustomerSummary,
  customers: Customer[],
  currency: Currency,
  defaultFundId: FundId,
  transactions?: Transaction[],
): TrialBalanceRow {
  const fundId = summary.fundId ?? defaultFundId;
  const b = summary.balances[currency];
  const balance = b?.balance ?? 0;
  const movement = transactions
    ? trialBalanceMovementTotals(
      transactions,
      fundId,
      summary.name,
      summary.aliases,
      currency,
    )
    : null;
  const debit = movement?.debit ?? (b?.receipts ?? 0);
  const credit = movement?.credit ?? (b?.payments ?? 0);
  const customer = resolveTrialBalanceCustomer(summary, customers, fundId);
  return {
    summary,
    fundId,
    currency,
    debit,
    credit,
    balance,
    customer,
    phone: customer?.phone?.trim() || undefined,
    accountNumber: customer?.accountNumber ?? summary.accountNumber,
  };
}

export function buildTrialBalanceLines(
  summaries: CustomerSummary[],
  customers: Customer[],
  defaultFundId: FundId,
  transactions?: Transaction[],
  options?: { currency?: Currency; hideZero?: boolean },
): TrialBalanceRow[] {
  const currencies = options?.currency
    ? [options.currency]
    : CURRENCIES.map(c => c.id);

  const lines: TrialBalanceRow[] = [];
  for (const summary of summaries) {
    for (const currency of currencies) {
      const line = buildTrialBalanceLine(summary, customers, currency, defaultFundId, transactions);
      if (options?.hideZero
        && line.debit === 0
        && line.credit === 0
        && line.balance === 0) {
        continue;
      }
      lines.push(line);
    }
  }

  return lines.sort((a, b) => {
    const nameCmp = a.summary.name.localeCompare(b.summary.name, 'ar');
    if (nameCmp !== 0) return nameCmp;
    return a.currency.localeCompare(b.currency);
  });
}

export function buildTrialBalanceRows(
  summaries: CustomerSummary[],
  customers: Customer[],
  currency: Currency,
  defaultFundId: FundId,
  transactions?: Transaction[],
): TrialBalanceRow[] {
  return buildTrialBalanceLines(summaries, customers, defaultFundId, transactions, { currency });
}

function trialBalanceMovementTotals(
  transactions: Transaction[],
  fundId: FundId,
  accountName: string,
  aliases: string[] | undefined,
  currency: Currency,
): { debit: number; credit: number } | null {
  const names = new Set([accountName, ...(aliases ?? [])]);
  const importTxs = transactions.filter(t =>
    t.ledger === 'account'
    && t.status === 'posted'
    && t.fundId === fundId
    && names.has(t.party)
    && t.currency === currency
    && (t.note ?? '').includes(TRIAL_BALANCE_IMPORT_NOTE),
  );
  if (importTxs.length === 0) return null;

  let debit = 0;
  let credit = 0;
  for (const tx of importTxs) {
    if (tx.kind === 'receipt') debit += tx.amount;
    if (tx.kind === 'payment') credit += tx.amount;
  }
  return { debit, credit };
}

export function buildAccountOpeningTransactions(
  fundId: FundId,
  accountName: string,
  currency: Currency,
  debit: number,
  credit: number,
  date: string,
): Transaction[] {
  const txs: Transaction[] = [];
  const note = 'رصيد افتتاحي — ميزان مراجعة';
  if (debit > 0) {
    txs.push(createAccountTransaction({
      fundId,
      party: accountName,
      kind: 'receipt',
      currency,
      amount: debit,
      date,
      status: 'posted',
      note,
    }));
  }
  if (credit > 0) {
    txs.push(createAccountTransaction({
      fundId,
      party: accountName,
      kind: 'payment',
      currency,
      amount: credit,
      date,
      status: 'posted',
      note,
    }));
  }
  return txs;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatTrialAmount(value: number, currency: Currency): string {
  if (value === 0) return '-';
  return formatValueWithUnit(value, currency);
}

export function downloadTrialBalanceExcel(
  rows: TrialBalanceRow[],
  label?: string,
): void {
  const lines = [
    label ?? 'ميزان مراجعة بالعملات',
    '',
    'اسم الحساب,رقم الحساب,عملة,مدين (عليه),دائن (له),الرصيد النهائي,واتساب',
  ];

  for (const row of rows) {
    lines.push([
      csvEscape(row.summary.name),
      csvEscape(row.accountNumber ?? row.summary.accountNumber ?? ''),
      row.currency,
      formatTrialAmount(row.debit, row.currency),
      formatTrialAmount(row.credit, row.currency),
      formatTrialAmount(row.balance, row.currency),
      csvEscape(row.phone ?? ''),
    ].join(','));
  }

  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const currencies = new Set(rows.map(r => r.currency));
  const fileCur = currencies.size === 1 ? [...currencies][0] : 'كل';
  a.download = `ميزان-${fileCur}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
