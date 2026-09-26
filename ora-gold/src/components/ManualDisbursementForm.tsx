import { useState } from 'react';
import { Plus, Printer } from 'lucide-react';
import { todayIso } from '../lib/format';
import type { DisbursementCategory, ManualDisbursementOrder } from '../types';
import { handleFormEnterKeyDown, preventFormSubmit } from '../lib/formEnterNav';

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
  onPrintDraft?: (input: ManualDisbursementInput) => void;
  initial?: ManualDisbursementInput & { id?: string };
  onCancelEdit?: () => void;
  submitLabel?: string;
}

export function ManualDisbursementForm({ onAdd, onPrintDraft, initial, onCancelEdit, submitLabel }: Props) {
  const [open, setOpen] = useState(Boolean(initial));
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [beneficiary, setBeneficiary] = useState(initial?.beneficiary ?? '');
  const [amount, setAmount] = useState(initial?.amountUsd?.toString() ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<DisbursementCategory | 'other'>(initial?.category ?? 'expense');
  const [sourceLabel, setSourceLabel] = useState(initial?.sourceLabel ?? '');

  const reset = () => {
    setDate(todayIso());
    setBeneficiary('');
    setAmount('');
    setDescription('');
    setCategory('expense');
    setSourceLabel('');
  };

  const buildInput = (): ManualDisbursementInput | null => {
    const amountUsd = parseFloat(amount);
    if (!beneficiary.trim() || !amountUsd || amountUsd <= 0) return null;
    return {
      date,
      amountUsd,
      beneficiary: beneficiary.trim(),
      description: description.trim() || `أمر صرف — ${beneficiary.trim()}`,
      category,
      sourceLabel: sourceLabel.trim() || undefined,
    };
  };

  const submit = () => {
    const input = buildInput();
    if (!input) return;
    onAdd(input);
    reset();
    setOpen(false);
    onCancelEdit?.();
  };

  const printDraft = () => {
    const input = buildInput();
    if (!input || !onPrintDraft) return;
    onPrintDraft(input);
  };

  if (!open) {
    return (
      <button type="button" className="btn-primary flex items-center gap-2 text-sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> إضافة أمر صرف
      </button>
    );
  }

  return (
    <form onSubmit={preventFormSubmit} onKeyDown={handleFormEnterKeyDown} className="card p-4 space-y-3 border border-amber-500/25">
      <h3 className="font-semibold text-amber-400 text-sm">
        {initial ? 'تعديل أمر صرف يدوي' : 'أمر صرف جديد (يدوي)'}
      </h3>
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
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => {
            setOpen(false);
            reset();
            onCancelEdit?.();
          }}
        >
          إلغاء
        </button>
        {onPrintDraft && (
          <button type="button" className="btn-secondary text-sm flex items-center gap-1" onClick={printDraft}>
            <Printer className="h-3.5 w-3.5" /> طباعة (قبل الحفظ)
          </button>
        )}
        <button type="button" className="btn-primary text-sm" onClick={submit}>{submitLabel ?? 'حفظ الأمر'}</button>
      </div>
    </form>
  );
}
