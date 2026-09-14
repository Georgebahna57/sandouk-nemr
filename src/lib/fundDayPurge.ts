import type { FundId, Transaction } from '../types';
import { getDeletionGroupIds } from './utils';

export interface FundDayPurgePreview {
  fundLedgerCount: number;
  totalRemovalCount: number;
  linkedAccountCount: number;
  date: string;
  fundId: FundId;
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
