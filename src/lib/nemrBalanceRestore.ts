import type { Currency, Transaction } from '../types';
import {
  buildOpeningBalanceTransactions,
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

export const NEMR_RESTORE_NOTE = 'استعادة رصيد — إغلاق 9 سبتمبر 2026';

/** ملاحظات حركات استعادة سابقة — تُحذف قبل إنشاء تصحيح جديد */
export const NEMR_RESTORE_NOTE_MARKERS = [
  NEMR_RESTORE_NOTE,
  'استعادة رصيد — قبل آخر تعديل',
];

export function isNemrRestoreTransaction(tx: Transaction): boolean {
  if (tx.fundId !== 'nemr') return false;
  if ((tx.ledger ?? 'fund') !== 'fund') return false;
  const note = tx.note ?? '';
  return NEMR_RESTORE_NOTE_MARKERS.some(marker => note.includes(marker));
}

export function transactionsWithoutNemrRestore(transactions: Transaction[]): Transaction[] {
  return transactions.filter(tx => !isNemrRestoreTransaction(tx));
}

export interface NemrBalanceRestorePlan {
  removeIds: string[];
  add: Transaction[];
  baseUsd: number;
  baseEur: number;
}

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
  const plan = buildNemrBalanceRestorePlan(transactions);
  return {
    currentUsd,
    currentEur,
    targetUsd: NEMR_REFERENCE_BALANCES.USD,
    targetEur: NEMR_REFERENCE_BALANCES.EUR,
    deltaUsd,
    deltaEur,
    needsRestore: nemrRestorePlanNeeded(plan),
  };
}

/** خطة استعادة: حذف تصحيحات قديمة ثم إضافة فرق واحد من الرصيد الأساسي */
export function buildNemrBalanceRestorePlan(
  transactions: Transaction[],
  date: string = NEMR_REFERENCE_CLOSE_DATE,
): NemrBalanceRestorePlan {
  const removeIds = transactions.filter(isNemrRestoreTransaction).map(tx => tx.id);
  const baseTxs = transactionsWithoutNemrRestore(transactions);
  const baseBalances = computeBalances(baseTxs, 'nemr');
  const lines: OpeningBalanceLine[] = [
    { currency: 'USD', amount: NEMR_REFERENCE_BALANCES.USD, side: 'ours' },
    { currency: 'EUR', amount: NEMR_REFERENCE_BALANCES.EUR, side: 'ours' },
  ];
  const add = buildOpeningBalanceTransactions(
    'nemr',
    date,
    lines,
    baseBalances,
    NEMR_RESTORE_NOTE,
  );
  return {
    removeIds,
    add,
    baseUsd: baseBalances.USD.balance,
    baseEur: baseBalances.EUR.balance,
  };
}

export function buildNemrBalanceRestoreTransactions(
  transactions: Transaction[],
  date: string = NEMR_REFERENCE_CLOSE_DATE,
): Transaction[] {
  return buildNemrBalanceRestorePlan(transactions, date).add;
}

export function nemrRestorePlanNeeded(plan: NemrBalanceRestorePlan): boolean {
  return plan.removeIds.length > 0 || plan.add.length > 0;
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
