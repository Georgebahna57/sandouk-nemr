import { getCurrencyLabel, getFund, isWeightCurrency } from '../config';
import {
  halabExchangePaidDelta,
  halabExchangeReceivedDelta,
  halabStatementBalanceDelta,
  usesHalabStatementBalance,
} from './halabBalance';
import type { Currency, FundId, Transaction } from '../types';
import { isTransactionReconciled } from './customerMeta';
import { describeTransaction, filterAccountViewTransactions, formatAmount, formatDateAr, formatValueWithUnit, groupTransactionsForDisplay } from './utils';

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

export type StatementKindFilter = 'all' | 'receipt' | 'payment' | 'exchange';

export interface AccountStatementOptions {
  dateFrom?: string;
  dateTo?: string;
  currency?: Currency;
  reconciledThroughDate?: string;
  kindFilter?: StatementKindFilter;
}

export interface AccountStatementBuildResult {
  rows: AccountStatementRow[];
  openingBalance: number;
  closingBalance: number;
  openingByCurrency: Partial<Record<Currency, number>>;
  closingByCurrency: Partial<Record<Currency, number>>;
}

function accountTransactionsForStatement(
  transactions: Transaction[],
  fundId: FundId,
  accountName: string,
): Transaction[] {
  return filterAccountViewTransactions(transactions, fundId, accountName).filter(
    tx => tx.status === 'posted' && !tx.feeSourceId,
  );
}

function sortStatementTxs(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return a.createdAt.localeCompare(b.createdAt);
  });
}


function matchesKindFilter(tx: Transaction, filter: StatementKindFilter): boolean {
  if (filter === 'all') return true;
  return tx.kind === filter;
}

export function buildAccountStatementRows(
  transactions: Transaction[],
  fundId: FundId,
  accountName: string,
  opts: AccountStatementOptions = {},
): AccountStatementBuildResult {
  const kindFilter = opts.kindFilter ?? 'all';
  const allTxs = accountTransactionsForStatement(transactions, fundId, accountName).filter(
    tx => matchesKindFilter(tx, kindFilter),
  );
  const sortedAll = sortStatementTxs(allTxs);

  const runningByCurrency: Partial<Record<Currency, number>> = {};
  let txs = sortedAll;
  const dateFrom = opts.dateFrom;
  if (dateFrom) {
    for (const tx of sortedAll) {
      if (tx.date >= dateFrom) break;
      applyStatementTxToRunning(runningByCurrency, tx, opts.currency, fundId, accountName);
    }
    txs = sortedAll.filter(tx => tx.date >= dateFrom);
  }
  if (opts.dateTo) txs = txs.filter(tx => tx.date <= opts.dateTo!);

  const openingByCurrency: Partial<Record<Currency, number>> = { ...runningByCurrency };
  const openingBalance = opts.currency ? (openingByCurrency[opts.currency] ?? 0) : 0;

  const rows: AccountStatementRow[] = [];

  if (dateFrom) {
    if (opts.currency) {
      rows.push({
        id: 'opening-balance',
        date: dateFrom ?? (txs[0]?.date ?? ''),
        description: 'رصيد افتتاحي',
        currency: opts.currency,
        runningBalance: openingBalance,
        reconciled: true,
      });
    } else {
      for (const [cur, bal] of Object.entries(openingByCurrency)) {
        if (bal === 0) continue;
        const currency = cur as Currency;
        rows.push({
          id: `opening-balance-${currency}`,
          date: dateFrom,
          description: `رصيد افتتاحي — ${getCurrencyLabel(currency)}`,
          currency,
          runningBalance: bal,
          reconciled: true,
        });
      }
    }
  }

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
        const halabStmt = usesHalabStatementBalance(fundId, accountName);
        if (!opts.currency || tx.currency === opts.currency) {
          const delta = halabStmt
            ? halabExchangePaidDelta(fundId, tx.currency, tx.amount)
            : -tx.amount;
          runningByCurrency[tx.currency] = (runningByCurrency[tx.currency] ?? 0) + delta;
          rows.push({
            id: `${tx.id}-from`,
            date: tx.date,
            description,
            currency: tx.currency,
            debit: delta > 0 ? delta : undefined,
            credit: delta < 0 ? Math.abs(delta) : undefined,
            runningBalance: runningByCurrency[tx.currency] ?? 0,
            reconciled: isTransactionReconciled(tx.date, opts.reconciledThroughDate),
            note: tx.note,
          });
        }
        if (!opts.currency || tx.exchangeToCurrency === opts.currency) {
          const delta = halabStmt
            ? halabExchangeReceivedDelta(fundId, tx.exchangeToCurrency, tx.exchangeToAmount)
            : tx.exchangeToAmount;
          runningByCurrency[tx.exchangeToCurrency] = (runningByCurrency[tx.exchangeToCurrency] ?? 0) + delta;
          rows.push({
            id: `${tx.id}-to`,
            date: tx.date,
            description: `↳ ${getCurrencyLabel(tx.exchangeToCurrency)}`,
            currency: tx.exchangeToCurrency,
            debit: delta > 0 ? delta : undefined,
            credit: delta < 0 ? Math.abs(delta) : undefined,
            runningBalance: runningByCurrency[tx.exchangeToCurrency] ?? 0,
            reconciled: isTransactionReconciled(tx.date, opts.reconciledThroughDate),
            note: tx.note,
          });
        }
        continue;
      }

      const halabStmt = usesHalabStatementBalance(fundId, accountName);
      const delta = halabStmt
        ? halabStatementBalanceDelta(fundId, tx.currency, tx.kind as 'receipt' | 'payment', tx.amount)
        : (tx.kind === 'receipt' ? tx.amount : -tx.amount);
      runningByCurrency[tx.currency] = (runningByCurrency[tx.currency] ?? 0) + delta;

      rows.push({
        id: tx.id,
        date: tx.date,
        description,
        currency: tx.currency,
        debit: delta > 0 ? delta : undefined,
        credit: delta < 0 ? Math.abs(delta) : undefined,
        runningBalance: runningByCurrency[tx.currency] ?? 0,
        reconciled: isTransactionReconciled(tx.date, opts.reconciledThroughDate),
        note: tx.note,
      });
    }
  }

  const closingByCurrency: Partial<Record<Currency, number>> = { ...runningByCurrency };
  const closingBalance = opts.currency
    ? (closingByCurrency[opts.currency] ?? openingBalance)
    : 0;

  return { rows, openingBalance, closingBalance, openingByCurrency, closingByCurrency };
}

function applyStatementTxToRunning(
  runningByCurrency: Partial<Record<Currency, number>>,
  tx: Transaction,
  currencyFilter?: Currency,
  fundId?: FundId,
  accountName?: string,
): void {
  const halabStmt = fundId && accountName && usesHalabStatementBalance(fundId, accountName);
  if (tx.kind === 'exchange' && tx.exchangeToCurrency && tx.exchangeToAmount) {
    if (!currencyFilter || tx.currency === currencyFilter) {
      const delta = halabStmt
        ? halabExchangePaidDelta(fundId!, tx.currency, tx.amount)
        : -tx.amount;
      runningByCurrency[tx.currency] = (runningByCurrency[tx.currency] ?? 0) + delta;
    }
    if (!currencyFilter || tx.exchangeToCurrency === currencyFilter) {
      const delta = halabStmt
        ? halabExchangeReceivedDelta(fundId!, tx.exchangeToCurrency, tx.exchangeToAmount)
        : tx.exchangeToAmount;
      runningByCurrency[tx.exchangeToCurrency] = (runningByCurrency[tx.exchangeToCurrency] ?? 0) + delta;
    }
    return;
  }
  if (currencyFilter && tx.currency !== currencyFilter) return;
  const delta = halabStmt
    ? halabStatementBalanceDelta(fundId!, tx.currency, tx.kind as 'receipt' | 'payment', tx.amount)
    : (tx.kind === 'receipt' ? tx.amount : -tx.amount);
  runningByCurrency[tx.currency] = (runningByCurrency[tx.currency] ?? 0) + delta;
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
  build: AccountStatementBuildResult,
  currency: Currency,
  dateFrom?: string,
  dateTo?: string,
  allCurrencies = false,
): string {
  const fundName = getFund(fundId).name;
  const rows = allCurrencies ? build.rows : build.rows.filter(r => r.currency === currency);
  const lines = [
    `كشف حساب,${accountName}`,
    `الصندوق,${fundName}`,
    `العملة,${allCurrencies ? 'جميع العملات' : getCurrencyLabel(currency)}`,
    ...(dateFrom ? [`من,${formatDateAr(dateFrom)}`] : []),
    ...(dateTo ? [`إلى,${formatDateAr(dateTo)}`] : []),
    '',
    allCurrencies
      ? 'العملة,رصيد افتتاحي,رصيد إغلاق'
      : `رصيد افتتاحي,${formatStatementAmount(build.openingBalance, currency)}`,
  ];

  if (allCurrencies) {
    const currencies = [...new Set(rows.map(r => r.currency))];
    for (const c of currencies) {
      const open = build.openingByCurrency[c] ?? 0;
      const close = build.closingByCurrency[c] ?? 0;
      lines.push([
        getCurrencyLabel(c),
        formatStatementAmount(open, c),
        formatStatementAmount(close, c),
      ].join(','));
    }
    lines.push('');
    lines.push('التاريخ,العملة,البيان,مدين (عليه),دائن (له),الرصيد,مطابق,ملاحظة');
  } else {
    lines.push(`رصيد إغلاق,${formatStatementAmount(build.closingBalance, currency)}`);
    lines.push('');
    lines.push('التاريخ,البيان,مدين (عليه),دائن (له),الرصيد,مطابق,ملاحظة');
  }

  for (const row of rows) {
    const rowCurrency = row.currency;
    const base = [
      isOpeningRowId(row.id) ? '—' : formatDateAr(row.date),
      ...(allCurrencies ? [getCurrencyLabel(rowCurrency)] : []),
      csvEscape(row.description),
      row.debit != null ? formatStatementAmount(row.debit, rowCurrency) : '',
      row.credit != null ? formatStatementAmount(row.credit, rowCurrency) : '',
      formatStatementAmount(row.runningBalance, rowCurrency),
      row.reconciled ? 'نعم' : 'لا',
      csvEscape(row.note ?? ''),
    ];
    lines.push(base.join(','));
  }

  return `\uFEFF${lines.join('\n')}`;
}

function isOpeningRowId(id: string): boolean {
  return id === 'opening-balance' || id.startsWith('opening-balance-');
}

export function downloadAccountStatementCsv(
  accountName: string,
  fundId: FundId,
  build: AccountStatementBuildResult,
  currency: Currency,
  dateFrom?: string,
  dateTo?: string,
): void {
  const csv = buildAccountStatementCsv(accountName, fundId, build, currency, dateFrom, dateTo);
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
  build: AccountStatementBuildResult,
  currency?: Currency,
  reconciledThroughDate?: string,
  dateFrom?: string,
  dateTo?: string,
): string {
  const fundName = getFund(fundId).name;
  const allCurrencies = !currency;
  const filtered = allCurrencies ? build.rows : build.rows.filter(r => r.currency === currency);
  const period = [
    dateFrom ? `من ${formatDateAr(dateFrom)}` : '',
    dateTo ? `إلى ${formatDateAr(dateTo)}` : '',
  ].filter(Boolean).join(' · ');

  const bodyRows = filtered.map(row => `
    <tr class="${row.reconciled ? 'reconciled' : ''} ${isOpeningRowId(row.id) ? 'opening' : ''}">
      <td>${isOpeningRowId(row.id) ? '—' : formatDateAr(row.date)}</td>
      ${allCurrencies ? `<td>${getCurrencyLabel(row.currency)}</td>` : ''}
      <td>${row.description}${row.note ? `<br><small>${row.note}</small>` : ''}</td>
      <td class="num debit">${row.debit != null ? formatValueWithUnit(row.debit, row.currency) : '—'}</td>
      <td class="num credit">${row.credit != null ? formatValueWithUnit(row.credit, row.currency) : '—'}</td>
      <td class="num">${formatValueWithUnit(row.runningBalance, row.currency)}</td>
      <td>${row.reconciled ? '✓' : ''}</td>
    </tr>
  `).join('');

  const summaryHtml = allCurrencies
    ? [...new Set(filtered.map(r => r.currency))].map(c => {
      const open = build.openingByCurrency[c] ?? 0;
      const close = build.closingByCurrency[c] ?? 0;
      return `<div>${getCurrencyLabel(c)}: افتتاح <span>${formatValueWithUnit(open, c)}</span> · إغلاق <span>${formatValueWithUnit(close, c)}</span></div>`;
    }).join('')
    : `<div>رصيد افتتاحي: <span>${formatValueWithUnit(build.openingBalance, currency!)}</span></div>
       <div>رصيد إغلاق: <span>${formatValueWithUnit(build.closingBalance, currency!)}</span></div>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>كشف حساب — ${accountName}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
    .summary { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; font-size: 13px; }
    .summary span { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: right; vertical-align: top; }
    th { background: #f3f4f6; }
    .num { font-family: monospace; white-space: nowrap; }
    .debit { color: #b91c1c; }
    .credit { color: #047857; }
    tr.reconciled td { background: #f0fdf4; }
    tr.opening td { background: #eff6ff; font-weight: 600; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>كشف حساب — ${accountName}</h1>
  <div class="meta">
    ${fundName} · ${allCurrencies ? 'جميع العملات' : getCurrencyLabel(currency!)}
    ${period ? ` · ${period}` : ''}
    ${reconciledThroughDate ? ` · مطابق حتى ${formatDateAr(reconciledThroughDate)}` : ''}
  </div>
  <div class="summary">${summaryHtml}</div>
  <table>
    <thead>
      <tr>
        <th>التاريخ</th>
        ${allCurrencies ? '<th>العملة</th>' : ''}
        <th>البيان</th>
        <th>مدين (عليه)</th>
        <th>دائن (له)</th>
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
  build: AccountStatementBuildResult,
  currency?: Currency,
  reconciledThroughDate?: string,
  dateFrom?: string,
  dateTo?: string,
): void {
  const html = buildAccountStatementPrintHtml(
    accountName,
    fundId,
    build,
    currency,
    reconciledThroughDate,
    dateFrom,
    dateTo,
  );
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
