import { isHalabFleilatFund, isHalabLinkedAccountName } from '../config';
import type { Currency, FundId, Transaction } from '../types';
import type { OpeningBalanceSide } from './openingBalance';

/** سوري/NSYP على حلب: دفع − استلام · دولار: استلام − دفع */
export function isHalabInvertedBalanceCurrency(currency: Currency): boolean {
  return currency === 'SYP' || currency === 'NSYP';
}

export function usesHalabReconciliationBalance(fundId: FundId): boolean {
  return isHalabFleilatFund(fundId);
}

export function computeHalabAwareBalance(
  receipts: number,
  payments: number,
  fundId: FundId,
  currency: Currency,
): number {
  if (!usesHalabReconciliationBalance(fundId)) {
    return receipts - payments;
  }
  if (currency === 'USD') {
    return receipts - payments;
  }
  if (isHalabInvertedBalanceCurrency(currency)) {
    return payments - receipts;
  }
  return receipts - payments;
}

/** هدف الرصيد الافتتاحي (موقّع) */
export function halabOpeningTargetBalance(
  amount: number,
  side: OpeningBalanceSide,
  currency: Currency,
): number {
  if (currency === 'USD') {
    return side === 'theirs' ? -amount : amount;
  }
  if (isHalabInvertedBalanceCurrency(currency)) {
    return side === 'ours' ? amount : -amount;
  }
  return side === 'ours' ? amount : -amount;
}

export function openingBalanceKindForDelta(
  fundId: FundId,
  currency: Currency,
  delta: number,
): 'receipt' | 'payment' {
  if (usesHalabReconciliationBalance(fundId)) {
    if (currency === 'USD') {
      return delta > 0 ? 'receipt' : 'payment';
    }
    if (isHalabInvertedBalanceCurrency(currency)) {
      return delta > 0 ? 'payment' : 'receipt';
    }
  }
  return delta > 0 ? 'receipt' : 'payment';
}

export function halabBalanceSideLabel(currency: Currency, balance: number): 'لنا' | 'لهم' | 'متعادل' {
  if (balance === 0) return 'متعادل';
  if (currency === 'USD') {
    return balance < 0 ? 'لهم' : 'لنا';
  }
  if (isHalabInvertedBalanceCurrency(currency)) {
    return balance > 0 ? 'لنا' : 'لهم';
  }
  return balance > 0 ? 'لنا' : 'لهم';
}

export function halabBalanceIsSurplus(fundId: FundId, currency: Currency, balance: number): boolean {
  if (!usesHalabReconciliationBalance(fundId)) return balance > 0;
  return halabBalanceSideLabel(currency, balance) === 'لنا';
}

export function halabStatementBalanceDelta(
  fundId: FundId,
  currency: Currency,
  kind: 'receipt' | 'payment',
  amount: number,
): number {
  if (usesHalabReconciliationBalance(fundId)) {
    if (currency === 'USD') {
      return kind === 'receipt' ? amount : -amount;
    }
    if (isHalabInvertedBalanceCurrency(currency)) {
      return kind === 'payment' ? amount : -amount;
    }
  }
  return kind === 'receipt' ? amount : -amount;
}

export function halabExchangePaidDelta(fundId: FundId, currency: Currency, amount: number): number {
  if (usesHalabReconciliationBalance(fundId)) {
    if (currency === 'USD') return -amount;
    if (isHalabInvertedBalanceCurrency(currency)) return amount;
  }
  return -amount;
}

export function halabExchangeReceivedDelta(fundId: FundId, currency: Currency, amount: number): number {
  if (usesHalabReconciliationBalance(fundId)) {
    if (currency === 'USD') return amount;
    if (isHalabInvertedBalanceCurrency(currency)) return -amount;
  }
  return amount;
}

export function usesHalabStatementBalance(fundId: FundId, accountName: string): boolean {
  return usesHalabReconciliationBalance(fundId) && isHalabLinkedAccountName(accountName);
}

const OPENING_BALANCE_NOTE = 'رصيد افتتاحي';

/** سوري: افتتاح «استلام» → «دفع» · دولار: «استلام» → «دفع» للرصيد الافتتاحي لهم */
export function repairHalabOpeningBalanceKinds(transactions: Transaction[]): {
  transactions: Transaction[];
  changed: Transaction[];
} {
  const changed: Transaction[] = [];
  const next = transactions.map(tx => {
    if (tx.fundId !== 'halabFleilat') return tx;
    if ((tx.ledger ?? 'fund') !== 'fund') return tx;
    if (!tx.note?.includes(OPENING_BALANCE_NOTE)) return tx;
    if (tx.kind !== 'receipt') return tx;
    const fixed: Transaction = { ...tx, kind: 'payment' };
    changed.push(fixed);
    return fixed;
  });
  return { transactions: next, changed };
}

export function getHalabCurrencyTotals(
  transactions: Transaction[],
  currency: Currency,
): { payments: number; receipts: number; balance: number; operationDelta: number } {
  let payments = 0;
  let receipts = 0;
  for (const tx of transactions) {
    if (tx.fundId !== 'halabFleilat') continue;
    if ((tx.ledger ?? 'fund') !== 'fund') continue;
    if (tx.status !== 'posted') continue;
    if (tx.currency !== currency && !(tx.kind === 'exchange' && tx.exchangeToCurrency === currency)) continue;
    if (tx.kind === 'exchange' && tx.exchangeToCurrency === currency && tx.exchangeToAmount) {
      receipts += tx.exchangeToAmount;
      continue;
    }
    if (tx.currency !== currency) continue;
    if (tx.kind === 'payment') payments += tx.amount;
    if (tx.kind === 'receipt') receipts += tx.amount;
  }
  const balance = computeHalabAwareBalance(receipts, payments, 'halabFleilat', currency);
  const operationDelta = currency === 'USD' ? receipts - payments : payments - receipts;
  return { payments, receipts, balance, operationDelta };
}

export type HalabUsdBreakdown = {
  openingPayments: number;
  openingReceipts: number;
  openingBalance: number;
  opsPayments: number;
  opsReceipts: number;
  opsDelta: number;
  totalBalance: number;
  openingTxCount: number;
};

export function getHalabUsdBalanceBreakdown(transactions: Transaction[]): HalabUsdBreakdown {
  let openingPayments = 0;
  let openingReceipts = 0;
  let opsPayments = 0;
  let opsReceipts = 0;
  let openingTxCount = 0;

  for (const tx of transactions) {
    if (tx.fundId !== 'halabFleilat') continue;
    if ((tx.ledger ?? 'fund') !== 'fund') continue;
    if (tx.status !== 'posted') continue;
    if (tx.currency !== 'USD') continue;
    if (tx.kind !== 'payment' && tx.kind !== 'receipt') continue;
    const isOpening = Boolean(tx.note?.includes(OPENING_BALANCE_NOTE));
    if (isOpening) openingTxCount += 1;
    if (tx.kind === 'payment') {
      if (isOpening) openingPayments += tx.amount;
      else opsPayments += tx.amount;
    } else {
      if (isOpening) openingReceipts += tx.amount;
      else opsReceipts += tx.amount;
    }
  }

  const openingBalance = openingReceipts - openingPayments;
  const opsDelta = opsReceipts - opsPayments;
  const totalBalance = computeHalabAwareBalance(
    openingReceipts + opsReceipts,
    openingPayments + opsPayments,
    'halabFleilat',
    'USD',
  );

  return {
    openingPayments,
    openingReceipts,
    openingBalance,
    opsPayments,
    opsReceipts,
    opsDelta,
    totalBalance,
    openingTxCount,
  };
}

/** كل إصلاحات حلب — تُشغَّل عند كل تحميل */
export function runAllHalabRepairs(transactions: Transaction[]): {
  transactions: Transaction[];
  changed: Transaction[];
} {
  const changedById = new Map<string, Transaction>();

  function merge(result: { transactions: Transaction[]; changed: Transaction[] }) {
    for (const tx of result.changed) changedById.set(tx.id, tx);
    return result.transactions;
  }

  let txs = transactions;
  txs = merge(repairHalabOpeningBalanceKinds(txs));

  const changed = [...changedById.values()];
  const byId = new Map(txs.map(tx => [tx.id, tx]));
  for (const tx of changed) byId.set(tx.id, tx);

  return { transactions: [...byId.values()], changed };
}
