import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { createTransactionBatch, inferKind, todayIso } from '../lib/utils';
import type { FundId, Transaction } from '../types';
import { AmountLinesEditor, createDefaultLines, parseAmountLines } from './AmountLinesEditor';

interface Props {
  accountName: string;
  fundId: FundId;
  onAdd: (tx: Transaction | Transaction[]) => void;
}

export function AccountTransactionForm({ accountName, fundId, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [lines, setLines] = useState(createDefaultLines);
  const [note, setNote] = useState('');

  function reset() {
    setDirection('in');
    setLines(createDefaultLines());
    setNote('');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = parseAmountLines(lines);
    if (!items.length) return;

    onAdd(createTransactionBatch({
      fundId,
      ledger: 'account',
      date: todayIso(),
      kind: inferKind(direction, false),
      party: accountName,
      note: note.trim() || undefined,
      status: 'posted',
    }, items));

    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
      >
        <Plus size={14} />
        حركة على الحساب
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-600 bg-slate-900/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-amber-400">حركة حساب — {accountName}</p>
        <button type="button" onClick={() => { reset(); setOpen(false); }} className="text-slate-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setDirection('in')}
          className={`rounded-lg py-2 text-xs font-medium ${direction === 'in' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
          وارد للحساب
        </button>
        <button type="button" onClick={() => setDirection('out')}
          className={`rounded-lg py-2 text-xs font-medium ${direction === 'out' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
          صادر من الحساب
        </button>
      </div>

      <AmountLinesEditor lines={lines} onChange={setLines} />

      <input type="text" placeholder="ملاحظة (اختياري)" value={note} onChange={e => setNote(e.target.value)}
        className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm" />

      <button type="submit" className="w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400">
        حفظ — ما بتأثر على الصندوق
      </button>
    </form>
  );
}
