import type { Currency, Transaction } from '../types';
import {
  buildOpeningBalanceTransactions,
  computeOpeningBalanceCurrent,
  type OpeningBalanceLine,
} from './openingBalance';
import { computeBalances } from './utils';

/** رصيد إغلاق صندوق نمر — 9 سبتمبر 2026 (مشاركة الرصيد) */
export const NEMR_REFERENCE_BALANCES: Record<'USD' | 'EUR', number> = {
  USD: 640_790,
  EUR: 1_773_520,
};

export const NEMR_REFERENCE_LABEL = 'إغلاق 9 سبتمبر 2026';

export const NEMR_REFERENCE_CLOSE_DATE = '2026-09-09';

const NEMR_RESTORE_NOTE = 'استعادة رصيد — إغلاق 9 سبتمبر 2026';

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
  date: string = NEMR_REFERENCE_CLOSE_DATE,
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

/** آخر حركات صندوق نمر التي لها سجل تعديل */
export function getRecentlyEditedNemrFundTransactions(
  transactions: Transaction[],
  limit = 3,
): Transaction[] {
  return transactions
    .filter(
      tx => tx.fundId === 'nemr'
        && (tx.ledger ?? 'fund') === 'fund'
        && (tx.editHistory?.length ?? 0) > 0,
    )
    .sort((a, b) => {
      const aAt = a.editHistory![a.editHistory!.length - 1]?.at ?? '';
      const bAt = b.editHistory![b.editHistory!.length - 1]?.at ?? '';
      return bAt.localeCompare(aAt);
    })
    .slice(0, limit);
}
