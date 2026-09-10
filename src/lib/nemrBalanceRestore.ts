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

/** كل حركات نمر حتى تاريخ الإغلاق — بما فيها تصحيح الاستعادة */
export function nemrThroughCloseTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(
    tx => tx.fundId === 'nemr' && tx.date <= NEMR_REFERENCE_CLOSE_DATE,
  );
}

/** حركات حتى الإغلاق بدون تصحيحات الاستعادة */
export function nemrRawThroughCloseTransactions(transactions: Transaction[]): Transaction[] {
  return transactionsWithoutNemrRestore(transactions).filter(
    tx => tx.fundId === 'nemr' && tx.date <= NEMR_REFERENCE_CLOSE_DATE,
  );
}

/** حركات بعد تاريخ الإغلاق */
export function nemrPostCloseTransactions(transactions: Transaction[]): Transaction[] {
  return transactionsWithoutNemrRestore(transactions).filter(
    tx => tx.fundId === 'nemr' && tx.date > NEMR_REFERENCE_CLOSE_DATE,
  );
}

export interface NemrBalanceRestorePlan {
  removeIds: string[];
  add: Transaction[];
  closingUsd: number;
  closingEur: number;
}

export interface NemrBalanceRestorePreview {
  /** رصيد الإغلاق (حتى 9 سبتمبر، شامل تصحيح الاستعادة إن وُجد) */
  closingUsd: number;
  closingEur: number;
  /** الرصيد الكلي (إغلاق + عمليات اليوم وما بعد) */
  totalUsd: number;
  totalEur: number;
  targetUsd: number;
  targetEur: number;
  deltaUsd: number;
  deltaEur: number;
  needsRestore: boolean;
}

export function previewNemrBalanceRestore(transactions: Transaction[]): NemrBalanceRestorePreview {
  const closingBalances = computeBalances(nemrThroughCloseTransactions(transactions), 'nemr');
  const totalBalances = computeBalances(transactions, 'nemr');
  const closingUsd = closingBalances.USD.balance;
  const closingEur = closingBalances.EUR.balance;
  const deltaUsd = NEMR_REFERENCE_BALANCES.USD - closingUsd;
  const deltaEur = NEMR_REFERENCE_BALANCES.EUR - closingEur;
  const restoreCount = transactions.filter(isNemrRestoreTransaction).length;
  const closingOk =
    Math.abs(deltaUsd) < 1e-9 && Math.abs(deltaEur) < 1e-9;
  return {
    closingUsd,
    closingEur,
    totalUsd: totalBalances.USD.balance,
    totalEur: totalBalances.EUR.balance,
    targetUsd: NEMR_REFERENCE_BALANCES.USD,
    targetEur: NEMR_REFERENCE_BALANCES.EUR,
    deltaUsd,
    deltaEur,
    needsRestore: !closingOk || restoreCount > 1,
  };
}

/** خطة استعادة: حذف تصحيحات قديمة ثم ضبط إغلاق 9 سبتمبر — لا يمس عمليات ما بعده */
export function buildNemrBalanceRestorePlan(
  transactions: Transaction[],
  date: string = NEMR_REFERENCE_CLOSE_DATE,
): NemrBalanceRestorePlan {
  const removeIds = transactions.filter(isNemrRestoreTransaction).map(tx => tx.id);
  const rawClosingBalances = computeBalances(nemrRawThroughCloseTransactions(transactions), 'nemr');
  const lines: OpeningBalanceLine[] = [
    { currency: 'USD', amount: NEMR_REFERENCE_BALANCES.USD, side: 'ours' },
    { currency: 'EUR', amount: NEMR_REFERENCE_BALANCES.EUR, side: 'ours' },
  ];
  const add = buildOpeningBalanceTransactions(
    'nemr',
    date,
    lines,
    rawClosingBalances,
    NEMR_RESTORE_NOTE,
  );
  return {
    removeIds,
    add,
    closingUsd: rawClosingBalances.USD.balance,
    closingEur: rawClosingBalances.EUR.balance,
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

function nemrClosingMatchesReference(transactions: Transaction[]): boolean {
  const closing = computeBalances(nemrThroughCloseTransactions(transactions), 'nemr');
  return (
    Math.abs(closing.USD.balance - NEMR_REFERENCE_BALANCES.USD) < 1e-9
    && Math.abs(closing.EUR.balance - NEMR_REFERENCE_BALANCES.EUR) < 1e-9
  );
}

/** إصلاح تلقائي: حذف تصحيحات مكررة فقط — لا يعيد إنشاء تصحيح صحيح عند كل تحميل */
export function repairNemrRestoreState(transactions: Transaction[]): {
  transactions: Transaction[];
  removeIds: string[];
  upsert: Transaction[];
} {
  const restoreTxs = transactions.filter(isNemrRestoreTransaction);
  const strayRestoreIds = restoreTxs
    .filter(tx => tx.date > NEMR_REFERENCE_CLOSE_DATE)
    .map(tx => tx.id);
  if (strayRestoreIds.length) {
    return {
      transactions: transactions.filter(tx => !strayRestoreIds.includes(tx.id)),
      removeIds: strayRestoreIds,
      upsert: [],
    };
  }

  const closingOk = nemrClosingMatchesReference(transactions);

  if (closingOk && restoreTxs.length <= 1) {
    return { transactions, removeIds: [], upsert: [] };
  }

  if (closingOk && restoreTxs.length > 1) {
    const removeIds = restoreTxs.slice(1).map(tx => tx.id);
    return {
      transactions: transactions.filter(tx => !removeIds.includes(tx.id)),
      removeIds,
      upsert: [],
    };
  }

  const plan = buildNemrBalanceRestorePlan(transactions);
  if (!nemrRestorePlanNeeded(plan)) {
    return { transactions, removeIds: [], upsert: [] };
  }
  const without = transactions.filter(tx => !plan.removeIds.includes(tx.id));
  return {
    transactions: [...without, ...plan.add],
    removeIds: plan.removeIds,
    upsert: plan.add,
  };
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
