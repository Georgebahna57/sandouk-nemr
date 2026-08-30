import type { Currency, Transaction } from '../types';
import {
  buildOpeningBalanceTransactions,
  computeOpeningBalanceCurrent,
  type OpeningBalanceLine,
} from './openingBalance';
import { computeBalances } from './utils';

/** الرصيد المرجعي لصندوق نمر قبل آخر تعديل */
export const NEMR_REFERENCE_BALANCES: Record<'USD' | 'EUR', number> = {
  USD: 1_888_413,
  EUR: 688_710,
};

const NEMR_RESTORE_NOTE = 'استعادة رصيد — قبل آخر تعديل';

export interface NemrBalanceRestorePreview {
  currentUsd: number;
  currentEur: number;
  targetUsd: number;
  targetEur: number;
  deltaUsd: number;
  deltaEur: number;
  needsRestore: boolean;
}

export function previewNemrBalanceRestore(transactions: Transaction[]): NemrBalanceRestorePreview {
  const balances = computeBalances(transactions, 'nemr');
  const currentUsd = balances.USD.balance;
  const currentEur = balances.EUR.balance;
  const deltaUsd = NEMR_REFERENCE_BALANCES.USD - currentUsd;
  const deltaEur = NEMR_REFERENCE_BALANCES.EUR - currentEur;
  return {
    currentUsd,
    currentEur,
    targetUsd: NEMR_REFERENCE_BALANCES.USD,
    targetEur: NEMR_REFERENCE_BALANCES.EUR,
    deltaUsd,
    deltaEur,
    needsRestore: Math.abs(deltaUsd) > 1e-9 || Math.abs(deltaEur) > 1e-9,
  };
}

export function buildNemrBalanceRestoreTransactions(
  transactions: Transaction[],
  date: string,
): Transaction[] {
  const current = computeOpeningBalanceCurrent(transactions, 'nemr');
  const lines: OpeningBalanceLine[] = [
    { currency: 'USD', amount: NEMR_REFERENCE_BALANCES.USD, side: 'ours' },
    { currency: 'EUR', amount: NEMR_REFERENCE_BALANCES.EUR, side: 'ours' },
  ];
  return buildOpeningBalanceTransactions('nemr', date, lines, current, NEMR_RESTORE_NOTE);
}

export function formatNemrRestoreDelta(_currency: Currency, delta: number): string {
  if (Math.abs(delta) < 1e-9) return 'مطابق';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${Math.abs(delta).toLocaleString('en-US')}`;
}
