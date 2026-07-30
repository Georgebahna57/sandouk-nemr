import { CURRENCIES, getFund, getFundAccountName } from '../config';
import type { Currency, FundId, Transaction, TransactionKind } from '../types';
import {
  computeBalances,
  describeTransaction,
  formatAmount,
  formatDateAr,
  formatValueWithUnit,
  groupTransactionsForDisplay,
} from './utils';

export interface DailyJournalRow {
  id: string;
  kind: TransactionKind;
  description: string;
  currency: Currency;
  debit?: number;
  credit?: number;
  counterparty?: string;
  note?: string;
}

export interface DailyJournalCurrencySummary {
  currency: Currency;
  openingBalance: number;
  totalReceipts: number;
  totalPayments: number;
  closingBalance: number;
}

export interface DailyJournalReport {
  fundId: FundId;
  date: string;
  rows: DailyJournalRow[];
  summaries: DailyJournalCurrencySummary[];
}

function fundLedgerPosted(transactions: Transaction[], fundId: FundId): Transaction[] {
  const party = getFundAccountName(fundId);
  return transactions.filter(
    tx => tx.fundId === fundId
      && tx.status === 'posted'
      && (tx.ledger ?? 'fund') === 'fund'
      && tx.party === party
      && !tx.feeSourceId,
  );
}

function sortByDateCreated(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.createdAt.localeCompare(b.createdAt);
  });
}

function dayMovementTotals(
  txs: Transaction[],
): Partial<Record<Currency, { receipts: number; payments: number }>> {
  const totals: Partial<Record<Currency, { receipts: number; payments: number }>> = {};
  function bump(currency: Currency, kind: 'receipt' | 'payment', amount: number) {
    const bucket = totals[currency] ?? { receipts: 0, payments: 0 };
    if (kind === 'receipt') bucket.receipts += amount;
    else bucket.payments += amount;
    totals[currency] = bucket;
  }

  for (const tx of txs) {
    if (tx.kind === 'exchange' && tx.exchangeToCurrency && tx.exchangeToAmount) {
      bump(tx.currency, 'payment', tx.amount);
      bump(tx.exchangeToCurrency, 'receipt', tx.exchangeToAmount);
      continue;
    }
    bump(tx.currency, tx.kind === 'receipt' ? 'receipt' : 'payment', tx.amount);
  }
  return totals;
}

function journalRowsFromDay(txs: Transaction[]): DailyJournalRow[] {
  const rows: DailyJournalRow[] = [];
  for (const item of groupTransactionsForDisplay(sortByDateCreated(txs))) {
    const groupTxs = item.kind === 'batch' ? item.transactions : [item.transaction];
    const lead = groupTxs[0];
    const description = groupTxs.length > 1
      ? `${describeTransaction(lead)} (+${groupTxs.length - 1})`
      : describeTransaction(lead);
    const counterparty = lead.counterparty;
    const note = lead.note;

    for (const tx of groupTxs) {
      if (tx.kind === 'exchange' && tx.exchangeToCurrency && tx.exchangeToAmount) {
        rows.push({
          id: `${tx.id}-pay`,
          kind: 'exchange',
          description,
          currency: tx.currency,
          debit: tx.amount,
          counterparty,
          note,
        });
        rows.push({
          id: `${tx.id}-recv`,
          kind: 'exchange',
          description: `↳ استلام ${tx.exchangeToCurrency}`,
          currency: tx.exchangeToCurrency,
          credit: tx.exchangeToAmount,
          counterparty,
          note,
        });
        continue;
      }
      rows.push({
        id: tx.id,
        kind: tx.kind,
        description,
        currency: tx.currency,
        debit: tx.kind === 'payment' ? tx.amount : undefined,
        credit: tx.kind === 'receipt' ? tx.amount : undefined,
        counterparty,
        note,
      });
    }
  }
  return rows;
}

export function buildDailyJournalReport(
  transactions: Transaction[],
  fundId: FundId,
  date: string,
): DailyJournalReport {
  const allFund = fundLedgerPosted(transactions, fundId);
  const beforeDay = allFund.filter(tx => tx.date < date);
  const dayTxs = allFund.filter(tx => tx.date === date);
  const throughDay = allFund.filter(tx => tx.date <= date);

  const openingBalances = computeBalances(
    beforeDay.map(tx => ({ ...tx, fundId })),
    fundId,
  );
  const closingBalances = computeBalances(
    throughDay.map(tx => ({ ...tx, fundId })),
    fundId,
  );
  const dayTotals = dayMovementTotals(dayTxs);

  const activeCurrencies = CURRENCIES.filter(c => {
    const o = openingBalances[c.id].balance;
    const cl = closingBalances[c.id].balance;
    const m = dayTotals[c.id];
    return o !== 0 || cl !== 0 || (m && (m.receipts !== 0 || m.payments !== 0));
  });

  const summaries: DailyJournalCurrencySummary[] = activeCurrencies.map(c => ({
    currency: c.id,
    openingBalance: openingBalances[c.id].balance,
    totalReceipts: dayTotals[c.id]?.receipts ?? 0,
    totalPayments: dayTotals[c.id]?.payments ?? 0,
    closingBalance: closingBalances[c.id].balance,
  }));

  return {
    fundId,
    date,
    rows: journalRowsFromDay(dayTxs),
    summaries,
  };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function downloadDailyJournalCsv(report: DailyJournalReport): void {
  const fundName = getFund(report.fundId).name;
  const lines = [
    `دفتر يومية,${fundName}`,
    `التاريخ,${formatDateAr(report.date)}`,
    '',
    'ملخص العملات',
    'العملة,رصيد افتتاح,وارد اليوم,صادر اليوم,رصيد إغلاق',
    ...report.summaries.map(s => [
      s.currency,
      formatAmount(s.openingBalance, s.currency),
      formatAmount(s.totalReceipts, s.currency),
      formatAmount(s.totalPayments, s.currency),
      formatAmount(s.closingBalance, s.currency),
    ].join(',')),
    '',
    'الحركات',
    'البيان,عملة,مدين,دائن,طرف,ملاحظة',
    ...report.rows.map(r => [
      csvEscape(r.description),
      r.currency,
      r.debit != null ? formatAmount(r.debit, r.currency) : '',
      r.credit != null ? formatAmount(r.credit, r.currency) : '',
      csvEscape(r.counterparty ?? ''),
      csvEscape(r.note ?? ''),
    ].join(',')),
  ];

  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `يومية-${report.fundId}-${report.date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printDailyJournal(report: DailyJournalReport): void {
  const fundName = getFund(report.fundId).name;
  const summaryRows = report.summaries.map(s => `
    <tr>
      <td>${s.currency}</td>
      <td class="num">${formatValueWithUnit(s.openingBalance, s.currency)}</td>
      <td class="num credit">${formatValueWithUnit(s.totalReceipts, s.currency)}</td>
      <td class="num debit">${formatValueWithUnit(s.totalPayments, s.currency)}</td>
      <td class="num">${formatValueWithUnit(s.closingBalance, s.currency)}</td>
    </tr>
  `).join('');

  const detailRows = report.rows.map(r => `
    <tr>
      <td>${r.description}${r.note ? `<br><small>${r.note}</small>` : ''}</td>
      <td>${r.currency}</td>
      <td class="num debit">${r.debit != null ? formatValueWithUnit(r.debit, r.currency) : '—'}</td>
      <td class="num credit">${r.credit != null ? formatValueWithUnit(r.credit, r.currency) : '—'}</td>
      <td>${r.counterparty ?? '—'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>دفتر يومية — ${fundName}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #555; font-size: 13px; margin-bottom: 20px; }
    h2 { font-size: 14px; margin: 24px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: right; vertical-align: top; }
    th { background: #f3f4f6; }
    .num { font-family: monospace; white-space: nowrap; }
    .debit { color: #b91c1c; }
    .credit { color: #047857; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>دفتر يومية — ${fundName}</h1>
  <div class="meta">${formatDateAr(report.date)}</div>
  <h2>ملخص العملات</h2>
  <table>
    <thead>
      <tr><th>العملة</th><th>افتتاح</th><th>وارد</th><th>صادر</th><th>إغلاق</th></tr>
    </thead>
    <tbody>${summaryRows}</tbody>
  </table>
  <h2>حركات اليوم (${report.rows.length})</h2>
  <table>
    <thead>
      <tr><th>البيان</th><th>عملة</th><th>مدين</th><th>دائن</th><th>طرف</th></tr>
    </thead>
    <tbody>${detailRows || '<tr><td colspan="5">لا حركات</td></tr>'}</tbody>
  </table>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
