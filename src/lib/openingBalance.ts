import { getFund, getFundAccountName, isHalabFleilatFund } from '../config';
import { openingBalanceKindForDelta } from './halabBalance';
import type { Currency, FundBalances, FundId, Transaction } from '../types';
import { computeAccountBalances, computeBalances, createTransaction } from './utils';

export type OpeningBalanceSide = 'ours' | 'theirs';

export interface OpeningBalanceLine {
  currency: Currency;
  amount: number;
  side: OpeningBalanceSide;
}

export function sideToTargetBalance(amount: number, side: OpeningBalanceSide): number {
  return side === 'ours' ? amount : -amount;
}

export function targetBalanceToSide(balance: number): OpeningBalanceSide {
  return balance >= 0 ? 'ours' : 'theirs';
}

/** الرصيد الحالي الذي تُقاس عليه حركة الافتتاح */
export function computeOpeningBalanceCurrent(
  transactions: Transaction[],
  fundId: FundId,
): FundBalances {
  if (isHalabFleilatFund(fundId)) {
    const account = getFundAccountName(fundId);
    return computeAccountBalances(transactions, fundId, account) as FundBalances;
  }
  return computeBalances(transactions, fundId);
}

export function openingBalanceTargetLabel(fundId: FundId): string {
  if (isHalabFleilatFund(fundId)) {
    return `حساب ${getFundAccountName(fundId)} (${getFund(fundId).name})`;
  }
  return getFund(fundId).name;
}

/** حركات لضبط الرصيد إلى الأهداف (فرق عن الرصيد الحالي) */
export function buildOpeningBalanceTransactions(
  fundId: FundId,
  date: string,
  lines: OpeningBalanceLine[],
  currentBalances: FundBalances,
  note = 'رصيد افتتاحي — قبل البرنامج',
): Transaction[] {
  const party = getFundAccountName(fundId);
  const deltas: { currency: Currency; amount: number; kind: 'receipt' | 'payment' }[] = [];

  for (const line of lines) {
    if (!line.amount || line.amount <= 0) continue;
    const target = sideToTargetBalance(line.amount, line.side);
    const current = currentBalances[line.currency]?.balance ?? 0;
    const delta = target - current;
    if (Math.abs(delta) < 1e-9) continue;
    deltas.push({
      currency: line.currency,
      amount: Math.abs(delta),
      kind: openingBalanceKindForDelta(fundId, line.currency, delta),
    });
  }

  if (!deltas.length) return [];

  const batchId = deltas.length > 1 ? crypto.randomUUID() : undefined;
  return deltas.map(item =>
    createTransaction({
      fundId,
      ledger: 'fund',
      date,
      currency: item.currency,
      kind: item.kind,
      amount: item.amount,
      party,
      note,
      status: 'posted',
      batchId,
    }),
  );
}
