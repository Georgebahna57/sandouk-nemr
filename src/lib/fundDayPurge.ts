import { getFundAccountName } from '../config';
import type { FundId, Transaction } from '../types';
import { getDeletionGroupIds } from './utils';

export interface FundDayPurgePreview {
  fundLedgerCount: number;
  totalRemovalCount: number;
  linkedAccountCount: number;
  date: string;
  fundId: FundId;
}

export interface FundDayJournalOnlyPurgePreview {
  fundLedgerCount: number;
  preservedAccountCount: number;
  date: string;
  fundId: FundId;
}

/** حركات دفتر اليومية فقط — نفس معايير buildDailyJournalReport بدون حذف الحسابات المربوطة */
function isFundJournalEntry(tx: Transaction, fundId: FundId): boolean {
  const party = getFundAccountName(fundId);
  return tx.fundId === fundId
    && tx.status === 'posted'
    && (tx.ledger ?? 'fund') === 'fund'
    && tx.party === party
    && !tx.feeSourceId;
}

/** حركات صندوق بتاريخ محدد + كل المربوطة بها (حساب، أجور…) */
export function previewFundDayPurge(
  transactions: Transaction[],
  fundId: FundId,
  date: string,
): FundDayPurgePreview {
  const removeIds = new Set<string>();
  let fundLedgerCount = 0;

  for (const tx of transactions) {
    if (tx.fundId !== fundId || tx.date !== date) continue;
    if ((tx.ledger ?? 'fund') !== 'fund') continue;
    fundLedgerCount++;
    for (const id of getDeletionGroupIds(transactions, tx.id)) {
      removeIds.add(id);
    }
  }

  let linkedAccountCount = 0;
  for (const id of removeIds) {
    const tx = transactions.find(t => t.id === id);
    if (tx?.ledger === 'account') linkedAccountCount++;
  }

  return {
    fundLedgerCount,
    totalRemovalCount: removeIds.size,
    linkedAccountCount,
    date,
    fundId,
  };
}

export function collectFundDayPurgeIds(
  transactions: Transaction[],
  fundId: FundId,
  date: string,
): string[] {
  const removeIds = new Set<string>();
  for (const tx of transactions) {
    if (tx.fundId !== fundId || tx.date !== date) continue;
    if ((tx.ledger ?? 'fund') !== 'fund') continue;
    for (const id of getDeletionGroupIds(transactions, tx.id)) {
      removeIds.add(id);
    }
  }
  return [...removeIds];
}

export function previewFundDayJournalOnlyPurge(
  transactions: Transaction[],
  fundId: FundId,
  date: string,
): FundDayJournalOnlyPurgePreview {
  const fundRows = transactions.filter(tx => tx.date === date && isFundJournalEntry(tx, fundId));
  const fundLinkIds = new Set(fundRows.map(tx => tx.linkId).filter(Boolean) as string[]);
  let preservedAccountCount = 0;
  for (const tx of transactions) {
    if (tx.ledger !== 'account' || !tx.linkId || !fundLinkIds.has(tx.linkId)) continue;
    preservedAccountCount++;
  }
  return {
    fundLedgerCount: fundRows.length,
    preservedAccountCount,
    date,
    fundId,
  };
}

/** حذف دفتر اليومية فقط — لا يمس حركات الحساب المربوطة */
export function collectFundDayJournalOnlyIds(
  transactions: Transaction[],
  fundId: FundId,
  date: string,
): string[] {
  return transactions
    .filter(tx => tx.date === date && isFundJournalEntry(tx, fundId))
    .map(tx => tx.id);
}
