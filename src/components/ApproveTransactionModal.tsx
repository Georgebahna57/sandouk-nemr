import { CheckCircle, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getApprovalStatusText } from '../lib/whatsapp';
import { describeTransaction, formatValueWithUnit, groupTransactionsForDisplay } from '../lib/utils';
import type { Transaction } from '../types';

interface Props {
  leadId: string;
  allTransactions: Transaction[];
  approverName?: string;
  onClose: () => void;
  onApprove: (approvalDetails: string) => void;
}

export function ApproveTransactionModal({
  leadId,
  allTransactions,
  approverName,
  onClose,
  onApprove,
}: Props) {
  const [details, setDetails] = useState('');

  const fundTxs = useMemo(() => {
    const lead = allTransactions.find(t => t.id === leadId);
    if (!lead) return [];
    if (lead.batchId) {
      return allTransactions.filter(t => t.batchId === lead.batchId && t.ledger === 'fund');
    }
    return lead.ledger === 'fund' ? [lead] : [];
  }, [allTransactions, leadId]);

  const lead = fundTxs[0];
  const display = useMemo(
    () => (lead ? groupTransactionsForDisplay(fundTxs)[0] : null),
    [fundTxs, lead],
  );

  if (!lead || !display) return null;

  const txs = display.kind === 'batch' ? display.transactions : [display.transaction];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onApprove(details.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 shadow-xl space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle size={20} />
            <div>
              <h3 className="font-semibold text-white">اعتماد → الصندوق</h3>
              <p className="text-xs text-slate-400">{getApprovalStatusText(lead.kind)} على واتساب بعد الحفظ</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="rounded-xl bg-slate-800/80 p-3 text-sm space-y-1">
          {txs.map(tx => (
            <p key={tx.id} className="text-slate-200">
              {tx.kind === 'exchange' && tx.exchangeToCurrency && tx.exchangeToAmount
                ? describeTransaction(tx)
                : `${describeTransaction(tx)} — ${formatValueWithUnit(tx.amount, tx.currency)}`}
            </p>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">
            تفاصيل الاعتماد {approverName ? `(منفّذ: ${approverName})` : ''}
          </label>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="اختياري — ملاحظة عن الاعتماد"
            rows={3}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-500"
        >
          اعتماد وإرسال واتساب
        </button>
      </form>
    </div>
  );
}
