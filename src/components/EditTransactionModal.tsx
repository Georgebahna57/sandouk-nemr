import { Pencil, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getFundAccountName } from '../config';
import { formatDateAr } from '../lib/utils';
import type { Transaction } from '../types';
import { AmountLinesEditor, createDefaultLines, parseAmountLines } from './AmountLinesEditor';
import type { AmountLine } from './AmountLinesEditor';

interface Props {
  leadId: string;
  allTransactions: Transaction[];
  onSave: (updated: Transaction[], summary: string) => void;
  onClose: () => void;
}

function txsToLines(txs: Transaction[]): AmountLine[] {
  return txs.map(tx => ({
    id: tx.id,
    currency: tx.currency,
    amount: String(tx.amount),
  }));
}

export function EditTransactionModal({ leadId, allTransactions, onSave, onClose }: Props) {
  const fundTxs = useMemo(() => {
    const lead = allTransactions.find(t => t.id === leadId);
    if (!lead) return [];
    const sameBatch = lead.batchId
      ? allTransactions.filter(t => t.batchId === lead.batchId && t.ledger === 'fund')
      : [lead];
    return sameBatch.filter(t => t.ledger === 'fund' && t.kind !== 'exchange');
  }, [allTransactions, leadId]);

  const lead = fundTxs[0];
  const [date, setDate] = useState(lead?.date ?? '');
  const [counterparty, setCounterparty] = useState(lead?.counterparty ?? '');
  const [note, setNote] = useState(lead?.note ?? '');
  const [lines, setLines] = useState(() => (fundTxs.length ? txsToLines(fundTxs) : createDefaultLines()));

  if (!lead || lead.kind === 'exchange') return null;

  const linkedAccountTxs = lead.linkId
    ? allTransactions.filter(t => t.linkId === lead.linkId && t.ledger === 'account')
    : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseAmountLines(lines);
    if (!parsed.length) return;

    const summaryParts: string[] = [];
    if (date !== lead.date) summaryParts.push(`تاريخ: ${formatDateAr(lead.date)} → ${formatDateAr(date)}`);
    if ((counterparty || '') !== (lead.counterparty || '')) {
      summaryParts.push(`طرف: ${lead.counterparty || '—'} → ${counterparty || '—'}`);
    }
    if ((note || '') !== (lead.note || '')) summaryParts.push('تعديل ملاحظة');

    const updated: Transaction[] = [];

    for (let i = 0; i < fundTxs.length; i++) {
      const tx = fundTxs[i];
      const item = parsed[i];
      if (!item) continue;
      if (tx.amount !== item.amount || tx.currency !== item.currency) {
        summaryParts.push(`${tx.currency}: ${tx.amount} → ${item.amount}`);
      }
      updated.push({
        ...tx,
        date,
        counterparty: counterparty.trim() || undefined,
        note: note.trim() || undefined,
        currency: item.currency,
        amount: item.amount,
      });
    }

    for (const atx of linkedAccountTxs) {
      const idx = fundTxs.findIndex(f => f.currency === atx.currency);
      const item = idx >= 0 ? parsed[idx] : parsed[0];
      if (!item) continue;
      updated.push({
        ...atx,
        date,
        note: note.trim() || undefined,
        amount: item.amount,
        currency: item.currency,
      });
    }

    onSave(updated, summaryParts.join(' | ') || 'تعديل');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-4 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400">
            <Pencil size={16} />
            <h3 className="font-semibold">تعديل العملية</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-500">{getFundAccountName(lead.fundId)}</p>
        {lead.linkId && (
          <p className="text-xs text-emerald-400/80">مرتبطة بحساب — التعديل ينعكس على الصندوق والحساب</p>
        )}

        <div>
          <label className="mb-1 block text-xs text-slate-400">التاريخ</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm"
            required
          />
        </div>

        <AmountLinesEditor lines={lines} onChange={setLines} />

        <input
          type="text"
          placeholder="الطرف (اختياري)"
          value={counterparty}
          onChange={e => setCounterparty(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm"
        />

        <input
          type="text"
          placeholder="ملاحظة (اختياري)"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm"
        />

        {lead.editHistory && lead.editHistory.length > 0 && (
          <div className="rounded-xl bg-slate-800/80 p-3 text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-400">سجل التعديلات</p>
            {[...lead.editHistory].reverse().slice(0, 5).map((h, i) => (
              <p key={i}>
                {formatDateAr(h.at.slice(0, 10))} — {h.byName ?? h.byEmail ?? '؟'}: {h.summary}
              </p>
            ))}
          </div>
        )}

        <button type="submit" className="w-full rounded-xl bg-amber-500 py-2.5 font-semibold text-slate-900 hover:bg-amber-400">
          حفظ التعديل
        </button>
      </form>
    </div>
  );
}
