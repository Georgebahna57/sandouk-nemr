import { useState } from 'react';
import { Plus } from 'lucide-react';
import { todayIso } from '../lib/format';
import type { DisbursementCategory, ManualDisbursementOrder } from '../types';

export interface ManualDisbursementInput {
  date: string;
  amountUsd: number;
  beneficiary: string;
  description: string;
  category: DisbursementCategory | 'other';
  sourceLabel?: string;
}

interface Props {
  onAdd: (input: ManualDisbursementInput) => void;
}

export function ManualDisbursementForm({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [beneficiary, setBeneficiary] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DisbursementCategory | 'other'>('expense');
  const [sourceLabel, setSourceLabel] = useState('');

  const reset = () => {
    setDate(todayIso());
    setBeneficiary('');
    setAmount('');
    setDescription('');
    setCategory('expense');
    setSourceLabel('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountUsd = parseFloat(amount);
    if (!beneficiary.trim() || !amountUsd || amountUsd <= 0) return;
    onAdd({
      date,
      amountUsd,
      beneficiary: beneficiary.trim(),
      description: description.trim() || `أمر صرف — ${beneficiary.trim()}`,
      category,
      sourceLabel: sourceLabel.trim() || undefined,
    });
    reset();
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" className="btn-primary flex items-center gap-2 text-sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> إضافة أمر صرف
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card p-4 space-y-3 border border-amber-500/25">
      <h3 className="font-semibold text-amber-400 text-sm">أمر صرف جديد (يدوي)</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-400">التاريخ</label>
          <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs text-slate-400">المستفيد</label>
          <input className="input-field" value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs text-slate-400">المبلغ $</label>
          <input type="number" step="any" className="input-field num" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs text-slate-400">التصنيف</label>
          <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value as ManualDisbursementOrder['category'])}>
            <option value="expense">مصروف</option>
            <option value="purchase">شراء</option>
            <option value="other">أخرى</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400">المصدر (اختياري)</label>
          <input className="input-field" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="صندوق / دفعة بيد…" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="text-xs text-slate-400">البيان</label>
          <input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="تفاصيل الدفع" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-secondary text-sm" onClick={() => { setOpen(false); reset(); }}>إلغاء</button>
        <button type="submit" className="btn-primary text-sm">حفظ الأمر</button>
      </div>
    </form>
  );
}
