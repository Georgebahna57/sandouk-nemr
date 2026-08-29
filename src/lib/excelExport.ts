import { getFund } from '../config';
import type { FundId, Transaction } from '../types';
import { describeTransaction, formatDateAr } from './utils';

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadBlob(filename: string, content: string, mime = 'application/vnd.ms-excel;charset=utf-8') {
  const blob = new Blob([`\uFEFF${content}`], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAccountStatementExcel(
  accountName: string,
  _fundId: FundId,
  csvContent: string,
  currency: string,
): void {
  downloadBlob(`كشف-${accountName}-${currency}.xls`, csvContent);
}

export function buildDailyOperationsRows(
  transactions: Transaction[],
  fundId: FundId,
  dateIso: string,
): string[] {
  const fundName = getFund(fundId).name;
  const lines = [
    `عمليات اليوم — ${fundName}`,
    `التاريخ,${formatDateAr(dateIso)}`,
    '',
    'التاريخ,النوع,البيان,المبلغ,الحالة,ملاحظة',
  ];

  const txs = transactions
    .filter(t => t.fundId === fundId && t.date === dateIso && (t.ledger ?? 'fund') === 'fund')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const tx of txs) {
    lines.push([
      formatDateAr(tx.date),
      tx.kind,
      csvEscape(describeTransaction(tx)),
      csvEscape(tx.amount != null ? String(tx.amount) : ''),
      tx.status,
      csvEscape(tx.note ?? ''),
    ].join(','));
  }

  return lines;
}

export function downloadDailyOperationsExcel(
  transactions: Transaction[],
  fundId: FundId,
  dateIso: string,
): void {
  const lines = buildDailyOperationsRows(transactions, fundId, dateIso);
  downloadBlob(`عمليات-${fundId}-${dateIso}.xls`, lines.join('\n'));
}
