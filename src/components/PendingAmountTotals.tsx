import { useMemo } from 'react';
import { getCurrencyLabel } from '../config';
import {
  formatValueWithUnit,
  groupTransactionsForDisplay,
  summarizePendingAmounts,
} from '../lib/utils';
import type { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
}

export function PendingAmountTotals({ transactions }: Props) {
  const rows = useMemo(() => summarizePendingAmounts(transactions), [transactions]);
  const operationCount = useMemo(
    () => groupTransactionsForDisplay(transactions).length,
    [transactions],
  );

  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 space-y-2">
      <p className="text-xs font-medium text-amber-200">
        مجموع قيد الانتظار
        <span className="mr-1.5 font-normal text-amber-200/70">
          · {operationCount} {operationCount === 1 ? 'عملية' : 'عمليات'}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {rows.map(row => (
          <div
            key={row.currency}
            className="rounded-lg border border-amber-500/20 bg-slate-900/50 px-2.5 py-1.5 text-xs"
          >
            <p className="mb-0.5 font-medium text-slate-400">{getCurrencyLabel(row.currency)}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
              {row.receipts > 0 && (
                <span className="text-emerald-400">
                  وارد {formatValueWithUnit(row.receipts, row.currency)}
                </span>
              )}
              {row.payments > 0 && (
                <span className="text-rose-400">
                  صادر {formatValueWithUnit(row.payments, row.currency)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
