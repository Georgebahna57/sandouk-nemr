import { ArrowRightLeft, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { CURRENCIES, getFund, getValueInputLabel, isWeightCurrency } from '../config';
import { createLinkedFundTransfer, todayIso } from '../lib/utils';
import type { Currency, Fund, FundId, Transaction } from '../types';

interface Props {
  fromFundId: FundId;
  fundOptions: Fund[];
  onAdd: (tx: Transaction | Transaction[]) => void | Promise<void>;
}

export function FundTransferForm({ fromFundId, fundOptions, onAdd }: Props) {
  const targets = fundOptions.filter(f => f.id !== fromFundId);
  const [open, setOpen] = useState(false);
  const [targetFundId, setTargetFundId] = useState<FundId>(targets[0]?.id ?? fromFundId);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  if (!targets.length) return null;

  function reset() {
    setTargetFundId(targets[0]?.id ?? fromFundId);
    setCurrency('USD');
    setAmount('');
    setNote('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount.replace(/,/g, '')) || 0;
    if (!parsed || !targetFundId || targetFundId === fromFundId) return;

    await onAdd(createLinkedFundTransfer(
      {
        fundId: fromFundId,
        date: todayIso(),
        status: 'posted',
        note: note.trim() || undefined,
      },
      fromFundId,
      targetFundId,
      currency,
      parsed,
    ));
    reset();
    setOpen(false);
  }

  const step = isWeightCurrency(currency) ? '0.01' : '1';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-600/40 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/20"
      >
        <ArrowRightLeft size={14} />
        تحويل إلى صندوق آخر
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-sky-600/40 bg-sky-500/10 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-sky-300">تحويل من {getFund(fromFundId).shortName}</p>
        <button type="button" onClick={() => { reset(); setOpen(false); }} className="text-slate-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-slate-400">إلى صندوق</label>
        <select
          value={targetFundId}
          onChange={e => setTargetFundId(e.target.value as FundId)}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm"
        >
          {targets.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] text-slate-400">العملة</label>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value as Currency)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs"
          >
            {CURRENCIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-slate-400">{getValueInputLabel(currency)}</label>
          <input
            type="number"
            min="0"
            step={step}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs"
            required
          />
        </div>
      </div>

      <input
        type="text"
        placeholder="ملاحظة (اختياري)"
        value={note}
        onChange={e => setNote(e.target.value)}
        className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm"
      />

      <p className="text-[10px] text-slate-500">
        يُسجَّل صادر من {getFund(fromFundId).shortName} ووارد على {getFund(targetFundId).shortName} — مربوطين
      </p>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-500"
      >
        <Plus size={14} />
        حفظ التحويل
      </button>
    </form>
  );
}
