import { getCurrencyLabel } from '../config';
import type { Currency, Customer, CustomerSummary, FundId, Transaction } from '../types';
import { createAccountTransaction, formatValueWithUnit } from './utils';

export type TrialBalanceStatus = 'زايد' | 'ناقص' | 'متعادل';

export interface TrialBalanceRow {
  summary: CustomerSummary;
  fundId: FundId;
  debit: number;
  credit: number;
  balance: number;
  status: TrialBalanceStatus;
  customer?: Customer;
  phone?: string;
}

export function trialBalanceStatus(balance: number): TrialBalanceStatus {
  if (balance > 0) return 'زايد';
  if (balance < 0) return 'ناقص';
  return 'متعادل';
}

export function buildTrialBalanceRows(
  summaries: CustomerSummary[],
  customers: Customer[],
  currency: Currency,
  defaultFundId: FundId,
): TrialBalanceRow[] {
  return summaries.map(summary => {
    const fundId = summary.fundId ?? defaultFundId;
    const b = summary.balances[currency];
    const debit = b?.payments ?? 0;
    const credit = b?.receipts ?? 0;
    const balance = b?.balance ?? 0;
    const names = [summary.name, ...(summary.aliases ?? [])];
    let customer: Customer | undefined;
    for (const name of names) {
      customer = customers.find(c => c.id === summary.customerId)
        ?? customers.find(c => c.name === name && (c.fundId === fundId || c.sharedFundIds?.includes(fundId)));
      if (customer) break;
    }
    return {
      summary,
      fundId,
      debit,
      credit,
      balance,
      status: trialBalanceStatus(balance),
      customer,
      phone: customer?.phone?.trim() || undefined,
    };
  }).sort((a, b) => a.summary.name.localeCompare(b.summary.name, 'ar'));
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
  if (credit > 0) {
    txs.push(createAccountTransaction({
      fundId,
      party: accountName,
      kind: 'receipt',
      currency,
      amount: credit,
      date,
      status: 'posted',
      note,
    }));
  }
  if (debit > 0) {
    txs.push(createAccountTransaction({
      fundId,
      party: accountName,
      kind: 'payment',
      currency,
      amount: debit,
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
  currency: Currency,
  rows: TrialBalanceRow[],
): void {
  const label = getCurrencyLabel(currency);
  const lines = [
    `${currency} - ${label}`,
    'ميزان مراجعة بالعملات',
    '',
    'اسم الحساب,مدين (صادر),دائن (وارد),الرصيد النهائي,الحالة,واتساب',
  ];

  for (const row of rows) {
    lines.push([
      csvEscape(row.summary.name),
      formatTrialAmount(row.debit, currency),
      formatTrialAmount(row.credit, currency),
      formatTrialAmount(row.balance, currency),
      row.status,
      csvEscape(row.phone ?? ''),
    ].join(','));
  }

  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ميزان-${currency}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
