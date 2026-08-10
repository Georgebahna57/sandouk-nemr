import { CheckCircle, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { describeTransaction, formatValueWithUnit, groupTransactionsForDisplay } from '../lib/utils';
import type { Transaction } from '../types';

interface Props {
  pendingTransactions: Transaction[];
  operationCount: number;
  approverName?: string;
  busy?: boolean;
  onClose: () => void;
  onApprove: (approvalDetails: string) => void | Promise<void>;
}

export function ApproveAllPendingModal({
  pendingTransactions,
  operationCount,
  approverName,
  busy = false,
  onClose,
  onApprove,
}: Props) {
  const [details, setDetails] = useState('');

  const displayItems = useMemo(
    () => groupTransactionsForDisplay(pendingTransactions),
    [pendingTransactions],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await onApprove(details.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle size={20} />
            <div>
              <h3 className="font-semibold text-white">اعتماد جميع المعلّق</h3>
              <p className="text-xs text-slate-400">
                {operationCount} {operationCount === 1 ? 'عملية' : 'عمليات'} — تُسجَّل بتاريخ اليوم
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-slate-400 hover:text-white disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="rounded-xl bg-slate-800/80 p-3 text-sm space-y-1.5 max-h-48 overflow-y-auto">
          {displayItems.map(item => {
            const txs = item.kind === 'batch' ? item.transactions : [item.transaction];
            const lead = txs[0];
            return (
              <p key={lead.id} className="text-slate-200 border-b border-slate-700/50 pb-1.5 last:border-0 last:pb-0">
                {txs.length > 1
                  ? `${describeTransaction(lead)} — ${txs.length} بنود`
                  : lead.kind === 'exchange' && lead.exchangeToCurrency && lead.exchangeToAmount
                    ? describeTransaction(lead)
                    : `${describeTransaction(lead)} — ${formatValueWithUnit(lead.amount, lead.currency)}`}
              </p>
            );
          })}
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">
            تفاصيل الاعتماد {approverName ? `(منفّذ: ${approverName})` : ''}
          </label>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="اختياري — ملاحظة مشتركة لكل العمليات"
            rows={2}
            disabled={busy}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm disabled:opacity-60"
          />
        </div>

        <p className="text-[10px] text-slate-500">
          واتساب متاح للاعتماد الفردي — الاعتماد الجماعي بدون رسائل.
        </p>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          اعتماد {operationCount} {operationCount === 1 ? 'عملية' : 'عمليات'}
        </button>
      </form>
    </div>
  );
}
