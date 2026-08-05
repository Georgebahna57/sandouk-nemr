import { getFundAccountName } from '../config';
import type { Currency, FundBalances, FundId, Transaction } from '../types';
import { createTransaction } from './utils';

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

/** حركات لضبط رصيد الصندوق إلى الأهداف (فرق عن الرصيد الحالي) */
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
      kind: delta > 0 ? 'receipt' : 'payment',
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
