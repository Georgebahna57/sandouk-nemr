import { getCurrencyLabel, getFund, isWeightCurrency } from '../config';
import type { Currency, FundId, Transaction } from '../types';
import { isTransactionReconciled } from './customerMeta';
import { describeTransaction, formatAmount, formatDateAr, formatValueWithUnit, groupTransactionsForDisplay } from './utils';

export interface AccountStatementRow {
  id: string;
  date: string;
  description: string;
  currency: Currency;
  debit?: number;
  credit?: number;
  runningBalance: number;
  reconciled: boolean;
  note?: string;
}

export interface AccountStatementOptions {
  dateFrom?: string;
  dateTo?: string;
  currency?: Currency;
  reconciledThroughDate?: string;
}

function accountTransactionsForStatement(
  transactions: Transaction[],
  fundId: FundId,
  accountName: string,
): Transaction[] {
  return transactions.filter(
    tx => tx.fundId === fundId
      && tx.status === 'posted'
      && (tx.ledger ?? 'fund') === 'account'
      && tx.party === accountName
      && !tx.feeSourceId,
  );
}

function sortStatementTxs(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return a.createdAt.localeCompare(b.createdAt);
  });
}


export function buildAccountStatementRows(
  transactions: Transaction[],
  fundId: FundId,
  accountName: string,
  opts: AccountStatementOptions = {},
): AccountStatementRow[] {
  const allTxs = accountTransactionsForStatement(transactions, fundId, accountName);
  const sortedAll = sortStatementTxs(allTxs);

  const runningByCurrency: Partial<Record<Currency, number>> = {};
  let txs = sortedAll;
  const dateFrom = opts.dateFrom;
  if (dateFrom) {
    for (const tx of sortedAll) {
      if (tx.date >= dateFrom) break;
      applyStatementTxToRunning(runningByCurrency, tx, opts.currency);
    }
    txs = sortedAll.filter(tx => tx.date >= dateFrom);
  }
  if (opts.dateTo) txs = txs.filter(tx => tx.date <= opts.dateTo!);

  const rows: AccountStatementRow[] = [];

  for (const item of groupTransactionsForDisplay(txs)) {
    const groupTxs = item.kind === 'batch' ? item.transactions : [item.transaction];
    const lead = groupTxs[0];
    const description = groupTxs.length > 1
      ? `${describeTransaction(lead)} (+${groupTxs.length - 1})`
      : describeTransaction(lead);

    for (const tx of groupTxs) {
      if (opts.currency && tx.kind !== 'exchange' && tx.currency !== opts.currency) continue;
      if (opts.currency && tx.kind === 'exchange' && tx.currency !== opts.currency && tx.exchangeToCurrency !== opts.currency) {
        continue;
      }

      if (tx.kind === 'exchange' && tx.exchangeToCurrency && tx.exchangeToAmount) {
        if (!opts.currency || tx.currency === opts.currency) {
          runningByCurrency[tx.currency] = (runningByCurrency[tx.currency] ?? 0) - tx.amount;
          rows.push({
            id: `${tx.id}-from`,
            date: tx.date,
            description,
            currency: tx.currency,
            debit: tx.amount,
            runningBalance: runningByCurrency[tx.currency] ?? 0,
            reconciled: isTransactionReconciled(tx.date, opts.reconciledThroughDate),
            note: tx.note,
          });
        }
        if (!opts.currency || tx.exchangeToCurrency === opts.currency) {
          runningByCurrency[tx.exchangeToCurrency] = (runningByCurrency[tx.exchangeToCurrency] ?? 0) + tx.exchangeToAmount;
          rows.push({
            id: `${tx.id}-to`,
            date: tx.date,
            description: `↳ ${getCurrencyLabel(tx.exchangeToCurrency)}`,
            currency: tx.exchangeToCurrency,
            credit: tx.exchangeToAmount,
            runningBalance: runningByCurrency[tx.exchangeToCurrency] ?? 0,
            reconciled: isTransactionReconciled(tx.date, opts.reconciledThroughDate),
            note: tx.note,
          });
        }
        continue;
      }

      runningByCurrency[tx.currency] = tx.kind === 'receipt'
        ? (runningByCurrency[tx.currency] ?? 0) + tx.amount
        : (runningByCurrency[tx.currency] ?? 0) - tx.amount;

      rows.push({
        id: tx.id,
        date: tx.date,
        description,
        currency: tx.currency,
        debit: tx.kind === 'payment' ? tx.amount : undefined,
        credit: tx.kind === 'receipt' ? tx.amount : undefined,
        runningBalance: runningByCurrency[tx.currency] ?? 0,
        reconciled: isTransactionReconciled(tx.date, opts.reconciledThroughDate),
        note: tx.note,
      });
    }
  }

  return rows;
}

function applyStatementTxToRunning(
  runningByCurrency: Partial<Record<Currency, number>>,
  tx: Transaction,
  currencyFilter?: Currency,
): void {
  if (tx.kind === 'exchange' && tx.exchangeToCurrency && tx.exchangeToAmount) {
    if (!currencyFilter || tx.currency === currencyFilter) {
      runningByCurrency[tx.currency] = (runningByCurrency[tx.currency] ?? 0) - tx.amount;
    }
    if (!currencyFilter || tx.exchangeToCurrency === currencyFilter) {
      runningByCurrency[tx.exchangeToCurrency] = (runningByCurrency[tx.exchangeToCurrency] ?? 0) + tx.exchangeToAmount;
    }
    return;
  }
  if (currencyFilter && tx.currency !== currencyFilter) return;
  runningByCurrency[tx.currency] = tx.kind === 'receipt'
    ? (runningByCurrency[tx.currency] ?? 0) + tx.amount
    : (runningByCurrency[tx.currency] ?? 0) - tx.amount;
}

export function statementActiveCurrencies(
  transactions: Transaction[],
  fundId: FundId,
  accountName: string,
): Currency[] {
  const set = new Set<Currency>();
  for (const tx of accountTransactionsForStatement(transactions, fundId, accountName)) {
    set.add(tx.currency);
    if (tx.exchangeToCurrency) set.add(tx.exchangeToCurrency);
  }
  return [...set];
}

function formatStatementAmount(amount: number, currency: Currency): string {
  return isWeightCurrency(currency)
    ? `${formatAmount(amount, currency)} غ`
    : formatAmount(amount, currency);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildAccountStatementCsv(
  accountName: string,
  fundId: FundId,
  rows: AccountStatementRow[],
  currency: Currency,
): string {
  const fundName = getFund(fundId).name;
  const lines = [
    `كشف حساب,${accountName}`,
    `الصندوق,${fundName}`,
    `العملة,${getCurrencyLabel(currency)}`,
    '',
    'التاريخ,البيان,مدين,دائن,الرصيد,مطابق,ملاحظة',
  ];

  for (const row of rows.filter(r => r.currency === currency)) {
    lines.push([
      formatDateAr(row.date),
      csvEscape(row.description),
      row.debit != null ? formatStatementAmount(row.debit, currency) : '',
      row.credit != null ? formatStatementAmount(row.credit, currency) : '',
      formatStatementAmount(row.runningBalance, currency),
      row.reconciled ? 'نعم' : 'لا',
      csvEscape(row.note ?? ''),
    ].join(','));
  }

  return `\uFEFF${lines.join('\n')}`;
}

export function downloadAccountStatementCsv(
  accountName: string,
  fundId: FundId,
  rows: AccountStatementRow[],
  currency: Currency,
): void {
  const csv = buildAccountStatementCsv(accountName, fundId, rows, currency);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `كشف-${accountName}-${currency}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildAccountStatementPrintHtml(
  accountName: string,
  fundId: FundId,
  rows: AccountStatementRow[],
  currency: Currency,
  reconciledThroughDate?: string,
): string {
  const fundName = getFund(fundId).name;
  const filtered = rows.filter(r => r.currency === currency);
  const bodyRows = filtered.map(row => `
    <tr class="${row.reconciled ? 'reconciled' : ''}">
      <td>${formatDateAr(row.date)}</td>
      <td>${row.description}${row.note ? `<br><small>${row.note}</small>` : ''}</td>
      <td class="num debit">${row.debit != null ? formatValueWithUnit(row.debit, currency) : '—'}</td>
      <td class="num credit">${row.credit != null ? formatValueWithUnit(row.credit, currency) : '—'}</td>
      <td class="num">${formatValueWithUnit(row.runningBalance, currency)}</td>
      <td>${row.reconciled ? '✓' : ''}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>كشف حساب — ${accountName}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: right; vertical-align: top; }
    th { background: #f3f4f6; }
    .num { font-family: monospace; white-space: nowrap; }
    .debit { color: #b91c1c; }
    .credit { color: #047857; }
    tr.reconciled td { background: #f0fdf4; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>كشف حساب — ${accountName}</h1>
  <div class="meta">
    ${fundName} · ${getCurrencyLabel(currency)}
    ${reconciledThroughDate ? ` · مطابق حتى ${formatDateAr(reconciledThroughDate)}` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>التاريخ</th>
        <th>البيان</th>
        <th>مدين</th>
        <th>دائن</th>
        <th>الرصيد</th>
        <th>مطابق</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

export function printAccountStatement(
  accountName: string,
  fundId: FundId,
  rows: AccountStatementRow[],
  currency: Currency,
  reconciledThroughDate?: string,
): void {
  const html = buildAccountStatementPrintHtml(accountName, fundId, rows, currency, reconciledThroughDate);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
