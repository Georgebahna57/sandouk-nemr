import type { Currency, FundBalances, FundId, Transaction } from '../types';
import { computeBalances, formatValueWithUnit } from './utils';

export interface FundBalanceImpact {
  fundId: FundId;
  before: FundBalances;
  after: FundBalances;
  currencies: Currency[];
}

function mergeTransactionUpdates(
  allTransactions: Transaction[],
  updated: Transaction[],
): Transaction[] {
  const byId = new Map(updated.map(tx => [tx.id, tx]));
  return allTransactions.map(tx => byId.get(tx.id) ?? tx);
}

/** معاينة تأثير تعديل حركات على رصيد الصندوق */
export function previewFundBalanceAfterEdit(
  allTransactions: Transaction[],
  fundId: FundId,
  updated: Transaction[],
): FundBalanceImpact | null {
  const affectsFund = updated.some(
    tx => tx.fundId === fundId && (tx.ledger ?? 'fund') === 'fund' && tx.status === 'posted',
  );
  if (!affectsFund) return null;

  const before = computeBalances(allTransactions, fundId);
  const after = computeBalances(mergeTransactionUpdates(allTransactions, updated), fundId);
  const currencies = [...new Set(
    updated
      .filter(tx => tx.fundId === fundId && (tx.ledger ?? 'fund') === 'fund')
      .flatMap(tx => [tx.currency, tx.exchangeToCurrency].filter(Boolean) as Currency[]),
  )];

  return { fundId, before, after, currencies };
}

export function formatFundBalanceImpactLine(
  currency: Currency,
  before: number,
  after: number,
): string {
  if (Math.abs(before - after) < 1e-9) {
    return `${formatValueWithUnit(before, currency)} (بدون تغيير)`;
  }
  return `${formatValueWithUnit(before, currency)} → ${formatValueWithUnit(after, currency)}`;
}

export function formatNemrAuditBalanceDetails(
  beforeUsd: number,
  beforeEur: number,
  afterUsd: number,
  afterEur: number,
): string {
  return `رصيد نمر: USD ${beforeUsd.toLocaleString('en-US')}→${afterUsd.toLocaleString('en-US')}, EUR ${beforeEur.toLocaleString('en-US')}→${afterEur.toLocaleString('en-US')}`;
}
