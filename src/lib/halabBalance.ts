import { isHalabFleilatFund, isHalabLinkedAccountName } from '../config';
import type { Currency, FundId } from '../types';

/** العملات السورية على حلب: دفع يزيد «لنا»، استلام ينقص — عكس الدولار */
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
  if (usesHalabReconciliationBalance(fundId) && isHalabInvertedBalanceCurrency(currency)) {
    return payments - receipts;
  }
  return receipts - payments;
}

/** نوع الحركة لضبط الرصيد الافتتاحي — السوري على حلب معكوس */
export function openingBalanceKindForDelta(
  fundId: FundId,
  currency: Currency,
  delta: number,
): 'receipt' | 'payment' {
  const wantIncrease = delta > 0;
  if (usesHalabReconciliationBalance(fundId) && isHalabInvertedBalanceCurrency(currency)) {
    return wantIncrease ? 'payment' : 'receipt';
  }
  return wantIncrease ? 'receipt' : 'payment';
}

/** تأثير حركة واحدة على الرصيد الجاري (كشف حساب) */
export function halabStatementBalanceDelta(
  fundId: FundId,
  currency: Currency,
  kind: 'receipt' | 'payment',
  amount: number,
): number {
  if (usesHalabReconciliationBalance(fundId) && isHalabInvertedBalanceCurrency(currency)) {
    return kind === 'payment' ? amount : -amount;
  }
  return kind === 'receipt' ? amount : -amount;
}

export function halabExchangePaidDelta(fundId: FundId, currency: Currency, amount: number): number {
  if (usesHalabReconciliationBalance(fundId) && isHalabInvertedBalanceCurrency(currency)) {
    return amount;
  }
  return -amount;
}

export function halabExchangeReceivedDelta(fundId: FundId, currency: Currency, amount: number): number {
  if (usesHalabReconciliationBalance(fundId) && isHalabInvertedBalanceCurrency(currency)) {
    return -amount;
  }
  return amount;
}

export function usesHalabStatementBalance(fundId: FundId, accountName: string): boolean {
  return usesHalabReconciliationBalance(fundId) && isHalabLinkedAccountName(accountName);
}
