import type { Currency, Transaction } from '../types';
import {
  buildOpeningBalanceTransactions,
  type OpeningBalanceLine,
} from './openingBalance';
import { computeBalances, getDeletionGroupIds } from './utils';

/** رصيد إغلاق صندوق نمر — 11 سبتمبر 2026 (مشاركة الرصيد) */
export const NEMR_REFERENCE_BALANCES: Record<'USD' | 'EUR', number> = {
  USD: 2_617_045,
  EUR: 473_305,
};

export const NEMR_REFERENCE_LABEL = 'إغلاق 11 سبتمبر 2026';

export const NEMR_REFERENCE_CLOSE_DATE = '2026-09-11';

export const NEMR_RESTORE_NOTE = 'استعادة رصيد — إغلاق 11 سبتمبر 2026';

/** ملاحظات حركات استعادة سابقة — تُحذف قبل إنشاء تصحيح جديد */
export const NEMR_RESTORE_NOTE_MARKERS = [
  NEMR_RESTORE_NOTE,
  'استعادة رصيد — إغلاق 9 سبتمبر 2026',
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

/** حركات صندوق بعد تاريخ المرجع */
export function nemrPostCloseFundLedgerTransactions(transactions: Transaction[]): Transaction[] {
  return transactionsWithoutNemrRestore(transactions).filter(
    tx => tx.fundId === 'nemr'
      && tx.date > NEMR_REFERENCE_CLOSE_DATE
      && (tx.ledger ?? 'fund') === 'fund',
  );
}

/** حذف حركات صندوق بعد المرجع + المربوطة بها */
export function collectNemrPostCloseFundPurgeIds(transactions: Transaction[]): string[] {
  const removeIds = new Set<string>();
  for (const tx of nemrPostCloseFundLedgerTransactions(transactions)) {
    for (const id of getDeletionGroupIds(transactions, tx.id)) {
      removeIds.add(id);
    }
  }
  return [...removeIds];
}

export interface NemrBalanceRestorePlan {
  removeIds: string[];
  add: Transaction[];
  closingUsd: number;
  closingEur: number;
  restoreRemoveCount: number;
  postClosePurgeCount: number;
}

export interface NemrBalanceRestorePreview {
  /** الرصيد الكلي الحالي */
  totalUsd: number;
  totalEur: number;
  targetUsd: number;
  targetEur: number;
  deltaUsd: number;
  deltaEur: number;
  postCloseFundLedgerCount: number;
  postClosePurgeCount: number;
  restoreCount: number;
  needsRestore: boolean;
}

export function previewNemrBalanceRestore(transactions: Transaction[]): NemrBalanceRestorePreview {
  const totalBalances = computeBalances(transactions, 'nemr');
  const totalUsd = totalBalances.USD.balance;
  const totalEur = totalBalances.EUR.balance;
  const deltaUsd = NEMR_REFERENCE_BALANCES.USD - totalUsd;
  const deltaEur = NEMR_REFERENCE_BALANCES.EUR - totalEur;
  const restoreCount = transactions.filter(isNemrRestoreTransaction).length;
  const postCloseFundLedgerCount = nemrPostCloseFundLedgerTransactions(transactions).length;
  const postClosePurgeCount = collectNemrPostCloseFundPurgeIds(transactions).length;
  const totalOk =
    Math.abs(deltaUsd) < 1e-9 && Math.abs(deltaEur) < 1e-9;
  const restoreOk = restoreCount === 1;
  return {
    totalUsd,
    totalEur,
    targetUsd: NEMR_REFERENCE_BALANCES.USD,
    targetEur: NEMR_REFERENCE_BALANCES.EUR,
    deltaUsd,
    deltaEur,
    postCloseFundLedgerCount,
    postClosePurgeCount,
    restoreCount,
    needsRestore: !totalOk || !restoreOk || postCloseFundLedgerCount > 0,
  };
}

/** خطة استعادة: حذف حركات الصندوق بعد المرجع + تصحيحات قديمة ثم ضبط الرصيد الكلي */
export function buildNemrBalanceRestorePlan(
  transactions: Transaction[],
  date: string = NEMR_REFERENCE_CLOSE_DATE,
): NemrBalanceRestorePlan {
  const restoreRemoveIds = transactions.filter(isNemrRestoreTransaction).map(tx => tx.id);
  const postCloseRemoveIds = collectNemrPostCloseFundPurgeIds(transactions);
  const removeIds = [...new Set([...restoreRemoveIds, ...postCloseRemoveIds])];
  const remaining = transactions.filter(tx => !removeIds.includes(tx.id));
  const rawClosingBalances = computeBalances(nemrRawThroughCloseTransactions(remaining), 'nemr');
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
    restoreRemoveCount: restoreRemoveIds.length,
    postClosePurgeCount: postCloseRemoveIds.length,
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

function nemrTotalMatchesReference(transactions: Transaction[]): boolean {
  const total = computeBalances(transactions, 'nemr');
  return (
    Math.abs(total.USD.balance - NEMR_REFERENCE_BALANCES.USD) < 1e-9
    && Math.abs(total.EUR.balance - NEMR_REFERENCE_BALANCES.EUR) < 1e-9
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

  const totalOk = nemrTotalMatchesReference(transactions);

  if (totalOk && restoreTxs.length <= 1 && nemrPostCloseFundLedgerTransactions(transactions).length === 0) {
    return { transactions, removeIds: [], upsert: [] };
  }

  if (totalOk && restoreTxs.length > 1) {
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
