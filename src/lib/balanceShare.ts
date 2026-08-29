import { CURRENCIES, getFund, isWeightCurrency } from '../config';
import { halabBalanceSideLabel } from './halabBalance';
import { isBalanceDisplayCurrency } from './syrianCurrency';
import type { CustomerBalances, Currency, FundBalances, FundId, Transaction } from '../types';
import {
  buildAccountStatementRows,
  type AccountStatementRow,
} from './accountStatement';
import {
  describeTransaction,
  formatAmount,
  formatDateAr,
  formatValueWithUnit,
  getOrderedDateNote,
  groupTransactionsForDisplay,
  todayIso,
} from './utils';

export type FundBalanceRow = {
  label: string;
  amount: string;
  status: 'زايد' | 'ناقص' | 'متعادل';
  tone: 'positive' | 'negative' | 'neutral';
};

export type AccountBalanceRow = {
  label: string;
  receiptsLabel: string;
  paymentsLabel: string;
  balanceLabel: string;
  receipts: string;
  payments: string;
  balance: string;
  balanceTone: 'positive' | 'negative' | 'neutral';
};

function customerSideLabel(currency: Currency, balance: number): 'لنا' | 'لكم' | 'متعادل' {
  const side = halabBalanceSideLabel(currency, balance);
  if (side === 'متعادل') return 'متعادل';
  return side === 'لهم' ? 'لكم' : 'لنا';
}

export type AccountStatementShareRow = {
  date: string;
  currencyLabel: string;
  description: string;
  note?: string;
  debit?: string;
  credit?: string;
  balance: string;
  reconciled: boolean;
  isOpening: boolean;
};

function balanceStatus(balance: number): { status: FundBalanceRow['status']; tone: FundBalanceRow['tone'] } {
  if (balance > 0) return { status: 'زايد', tone: 'positive' };
  if (balance < 0) return { status: 'ناقص', tone: 'negative' };
  return { status: 'متعادل', tone: 'neutral' };
}

function balanceTone(balance: number): AccountBalanceRow['balanceTone'] {
  if (balance > 0) return 'positive';
  if (balance < 0) return 'negative';
  return 'neutral';
}

export function getFundBalanceShareRows(balances: FundBalances): FundBalanceRow[] {
  const rows: FundBalanceRow[] = [];
  for (const c of CURRENCIES) {
    if (!isBalanceDisplayCurrency(c.id)) continue;
    const b = balances[c.id];
    if (b.balance === 0) continue;
    const amount = formatAmount(Math.abs(b.balance), c.id);
    const { status, tone } = balanceStatus(b.balance);
    const prefix = b.balance < 0 ? '-' : '';
    rows.push({
      label: c.label,
      amount: isWeightCurrency(c.id) ? `${prefix}${amount} غ` : `${prefix}${amount} ${c.symbol}`,
      status,
      tone,
    });
  }
  return rows;
}

export function getAccountBalanceShareRows(balances: CustomerBalances): AccountBalanceRow[] {
  const rows: AccountBalanceRow[] = [];
  for (const c of CURRENCIES) {
    if (!isBalanceDisplayCurrency(c.id)) continue;
    const b = balances[c.id];
    if (b.receipts === 0 && b.payments === 0) continue;
    const balanceSide = customerSideLabel(c.id, b.balance);
    rows.push({
      label: c.label,
      receiptsLabel: 'وارد (لكم)',
      paymentsLabel: 'صادر (لنا)',
      balanceLabel: balanceSide === 'متعادل' ? 'رصيد' : `رصيد (${balanceSide})`,
      receipts: formatValueWithUnit(b.receipts, c.id),
      payments: formatValueWithUnit(b.payments, c.id),
      balance: formatValueWithUnit(b.balance, c.id),
      balanceTone: balanceTone(b.balance),
    });
  }
  return rows;
}

function isOpeningStatementRow(id: string): boolean {
  return id === 'opening-balance' || id.startsWith('opening-balance-');
}

export function getAccountStatementShareRows(
  transactions: Transaction[],
  fundId: FundId,
  accountName: string,
  reconciledThroughDate?: string,
): AccountStatementShareRow[] {
  const build = buildAccountStatementRows(transactions, fundId, accountName, {
    reconciledThroughDate,
  });
  return build.rows.map((row: AccountStatementRow) => ({
    date: isOpeningStatementRow(row.id) ? '—' : formatDateAr(row.date),
    currencyLabel: CURRENCIES.find(c => c.id === row.currency)?.label ?? row.currency,
    description: row.description,
    note: row.note,
    debit: row.debit != null ? formatValueWithUnit(row.debit, row.currency) : undefined,
    credit: row.credit != null ? formatValueWithUnit(row.credit, row.currency) : undefined,
    balance: formatValueWithUnit(row.runningBalance, row.currency),
    reconciled: row.reconciled,
    isOpening: isOpeningStatementRow(row.id),
  }));
}

export type DailyOperationRow = {
  description: string;
  lines: { text: string; tone: 'positive' | 'negative' }[];
};

function fundLedgerTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(tx => (tx.ledger ?? 'fund') === 'fund');
}

export function getDailyOperationRows(transactions: Transaction[]): DailyOperationRow[] {
  return groupTransactionsForDisplay(fundLedgerTransactions(transactions)).map(item => {
    const txs = item.kind === 'batch' ? item.transactions : [item.transaction];
    const lead = txs[0];
    const description = item.kind === 'batch'
      ? `${lead.kind === 'payment' ? 'دفع' : lead.kind === 'exchange' ? 'تبديل' : 'استلام'} — ${txs.length} بنود`
      : describeTransaction(lead);
    const orderedNote = getOrderedDateNote(lead);
    const fullDescription = orderedNote ? `${description} (${orderedNote})` : description;

    const lines: DailyOperationRow['lines'] = [];
    if (lead.kind === 'exchange' && lead.exchangeToCurrency && lead.exchangeToAmount) {
      lines.push({ text: `-${formatValueWithUnit(lead.amount, lead.currency)}`, tone: 'negative' });
      lines.push({ text: `+${formatValueWithUnit(lead.exchangeToAmount, lead.exchangeToCurrency)}`, tone: 'positive' });
    } else {
      for (const tx of txs) {
        lines.push({
          text: `${tx.kind === 'payment' ? '-' : '+'}${formatValueWithUnit(tx.amount, tx.currency)}`,
          tone: tx.kind === 'payment' ? 'negative' : 'positive',
        });
      }
    }
    return { description: fullDescription, lines };
  });
}

export type BalanceSharePayload =
  | {
    kind: 'fund';
    fundId: FundId;
    balances: FundBalances;
    date?: string;
    dailyTransactions?: Transaction[];
    pendingTransactions?: Transaction[];
  }
  | { kind: 'account'; fundId: FundId; accountName: string; balances: CustomerBalances; date?: string; transactions?: Transaction[]; reconciledThroughDate?: string; accountNumber?: string };

export function getBalanceShareMeta(payload: BalanceSharePayload) {
  const fund = getFund(payload.fundId);
  const date = formatDateAr(payload.date ?? todayIso());
  if (payload.kind === 'fund') {
    const operations = getDailyOperationRows(payload.dailyTransactions ?? []);
    const pendingOperations = getDailyOperationRows(payload.pendingTransactions ?? []);
    return {
      title: `رصيد ${fund.name}`,
      subtitle: date,
      rows: getFundBalanceShareRows(payload.balances),
      statementRows: [] as AccountStatementShareRow[],
      emptyText: 'لا يوجد رصيد',
      operations,
      operationsEmptyText: 'لا توجد عمليات اليوم',
      pendingOperations,
      pendingOperationsEmptyText: 'لا توجد عمليات معلّقة',
    };
  }
  return {
    title: `مطابقة حساب — ${payload.accountName}`,
    subtitle: [
      fund.name,
      payload.accountNumber ? `رقم ${payload.accountNumber}` : '',
      date,
      payload.reconciledThroughDate ? `مطابق حتى ${formatDateAr(payload.reconciledThroughDate)}` : '',
    ].filter(Boolean).join(' · '),
    rows: getAccountBalanceShareRows(payload.balances),
    statementRows: payload.transactions
      ? getAccountStatementShareRows(
        payload.transactions,
        payload.fundId,
        payload.accountName,
        payload.reconciledThroughDate,
      )
      : [],
    emptyText: 'لا يوجد حركة على الحساب',
    operations: [] as DailyOperationRow[],
    operationsEmptyText: '',
    pendingOperations: [] as DailyOperationRow[],
    pendingOperationsEmptyText: '',
  };
}

export async function captureElementAsPng(element: HTMLElement): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#0f172a',
    logging: false,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('تعذّر إنشاء الصورة'))), 'image/png', 0.95);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function shareImageBlob(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return true;
  }
  return false;
}
