import type { AppState, Transaction } from '../types';

export type DataFingerprint = {
  transactions: number;
  customers: number;
  bills: number;
  latestTxAt: string | null;
  latestEditAt: string | null;
};

export function fingerprintKey(fp: DataFingerprint): string {
  return [
    fp.transactions,
    fp.customers,
    fp.bills,
    fp.latestTxAt ?? '',
    fp.latestEditAt ?? '',
  ].join('|');
}

export function findNewTransactionsFromOthers(
  previous: Transaction[],
  next: Transaction[],
  currentUserId?: string,
): Transaction[] {
  const prevIds = new Set(previous.map(t => t.id));
  return next.filter(t => {
    if (prevIds.has(t.id)) return false;
    if (!currentUserId) return true;
    return t.createdByUserId !== currentUserId;
  });
}

export function describeRemoteChange(txs: Transaction[]): string {
  if (txs.length === 0) return 'تحديث من جهاز آخر';
  const name = txs[0].createdByName?.trim();
  if (txs.length === 1) {
    return name ? `حركة جديدة من ${name}` : 'حركة جديدة من جهاز آخر';
  }
  return name
    ? `${txs.length} حركات جديدة — آخرها من ${name}`
    : `${txs.length} حركات جديدة من أجهزة أخرى`;
}

/** دمج السحابة مع الحركات المحلية التي لم تُرفع بعد (في الطابور) */
export function mergeCloudState(
  local: AppState,
  cloud: AppState,
  preserveTxIds?: Set<string>,
): AppState {
  let transactions = cloud.transactions;
  if (preserveTxIds?.size) {
    const cloudIds = new Set(cloud.transactions.map(t => t.id));
    const pendingLocal = local.transactions.filter(
      t => preserveTxIds.has(t.id) && !cloudIds.has(t.id),
    );
    if (pendingLocal.length) {
      const byId = new Map<string, Transaction>();
      for (const tx of cloud.transactions) byId.set(tx.id, tx);
      for (const tx of pendingLocal) byId.set(tx.id, tx);
      transactions = [...byId.values()];
    }
  }
  return {
    transactions,
    customers: cloud.customers,
    bills: cloud.bills,
  };
}
