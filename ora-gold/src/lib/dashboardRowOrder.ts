import type { DashboardRow } from '../types';

/** ترتيب صفوف الذهب/الكسر في لوحة الملخص — مطابق لترتيب Excel المطلوب */
const GOLD_CLUSTER_ORDER = ['cast18', 'scrap18', 'scrap21', 'scrap22', 'sand'] as const;

const GOLD_CLUSTER_SET = new Set<string>(GOLD_CLUSTER_ORDER);

/** يجمع صفوف الكسر/الرملة ويعيدها بالترتيب: صب 18 → كسر 18 → 21 → 22 → رملة */
export function reorderDashboardAssetRows(rows: DashboardRow[]): DashboardRow[] {
  const pending = new Map<string, DashboardRow>();
  const out: DashboardRow[] = [];
  let clusterFlushed = false;

  const flushCluster = () => {
    if (clusterFlushed || pending.size === 0) return;
    for (const id of GOLD_CLUSTER_ORDER) {
      const row = pending.get(id);
      if (row) out.push(row);
    }
    pending.clear();
    clusterFlushed = true;
  };

  for (const row of rows) {
    const id = row.navigateAccountId || row.accountId;
    if (GOLD_CLUSTER_SET.has(id)) {
      pending.set(id, row);
      continue;
    }
    flushCluster();
    out.push(row);
  }

  flushCluster();
  return out;
}
