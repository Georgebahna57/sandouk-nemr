import { isHalabFleilatFund, isHalabLinkedAccountName } from '../config';
import type { Currency, FundId, Transaction } from '../types';
import type { OpeningBalanceSide } from './openingBalance';

/** العملات السورية: موجب = لنا · الدولار على حلب: موجب = لهم */
export function isHalabInvertedBalanceCurrency(currency: Currency): boolean {
  return currency === 'SYP' || currency === 'NSYP';
}

export function usesHalabReconciliationBalance(fundId: FundId): boolean {
  return isHalabFleilatFund(fundId);
}

/** على حلب: الرصيد = دفع − استلام (للعمليات كلها) */
export function computeHalabAwareBalance(
  receipts: number,
  payments: number,
  fundId: FundId,
  _currency?: Currency,
): number {
  if (usesHalabReconciliationBalance(fundId)) {
    return payments - receipts;
  }
  return receipts - payments;
}

/** هدف الرصيد الافتتاحي على حلب */
export function halabOpeningTargetBalance(
  amount: number,
  side: OpeningBalanceSide,
  currency: Currency,
): number {
  if (currency === 'USD') {
    return side === 'theirs' ? amount : -amount;
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
    return delta > 0 ? 'payment' : 'receipt';
  }
  const wantIncrease = delta > 0;
  if (isHalabInvertedBalanceCurrency(currency)) {
    return wantIncrease ? 'payment' : 'receipt';
  }
  return wantIncrease ? 'receipt' : 'payment';
}

/** لنا / لهم للعرض — الدولار على حلب معكوس عن السوري */
export function halabBalanceSideLabel(currency: Currency, balance: number): 'لنا' | 'لهم' | 'متعادل' {
  if (balance === 0) return 'متعادل';
  if (currency === 'USD') {
    return balance > 0 ? 'لهم' : 'لنا';
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

/** تأثير حركة واحدة على الرصيد الجاري (كشف حساب) */
export function halabStatementBalanceDelta(
  fundId: FundId,
  currency: Currency,
  kind: 'receipt' | 'payment',
  amount: number,
): number {
  if (usesHalabReconciliationBalance(fundId)) {
    return kind === 'payment' ? amount : -amount;
  }
  if (isHalabInvertedBalanceCurrency(currency)) {
    return kind === 'payment' ? amount : -amount;
  }
  return kind === 'receipt' ? amount : -amount;
}

export function halabExchangePaidDelta(fundId: FundId, currency: Currency, amount: number): number {
  if (usesHalabReconciliationBalance(fundId)) {
    return amount;
  }
  if (isHalabInvertedBalanceCurrency(currency)) {
    return amount;
  }
  return -amount;
}

export function halabExchangeReceivedDelta(fundId: FundId, currency: Currency, amount: number): number {
  if (usesHalabReconciliationBalance(fundId)) {
    return -amount;
  }
  if (isHalabInvertedBalanceCurrency(currency)) {
    return -amount;
  }
  return amount;
}

export function usesHalabStatementBalance(fundId: FundId, accountName: string): boolean {
  return usesHalabReconciliationBalance(fundId) && isHalabLinkedAccountName(accountName);
}

const OPENING_BALANCE_NOTE = 'رصيد افتتاحي';

/** الرصيد الافتتاحي كان يُسجَّل «استلام» — نحوّله «دفع» (سوري لنا + دولار لهم) */
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
    const shouldBePayment =
      isHalabInvertedBalanceCurrency(tx.currency) || tx.currency === 'USD';
    if (!shouldBePayment) return tx;
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
  const balance = payments - receipts;
  return { payments, receipts, balance, operationDelta: payments - receipts };
}
