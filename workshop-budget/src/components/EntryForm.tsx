import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { EntryKind } from '../types';
import { todayIso } from '../lib/format';

interface Props {
  entryKind: EntryKind;
  onSubmit: (data: { date: string; debit?: number; credit?: number; description: string }) => void;
}

function labelsForKind(kind: EntryKind, side: 'gold' | 'usd') {
  if (kind === 'profit') return { out: 'خسارة', in: 'ربح' };
  if (kind === 'expense') return { out: 'مدفوع', in: 'مرتجع مصروف' };
  if (kind === 'partner') return { out: 'Debit', in: 'Credit' };
  if (kind === 'inout') return { out: side === 'gold' ? 'خروج' : 'خروج', in: side === 'gold' ? 'دخول' : 'دخول' };
  return { out: 'مدفوع له', in: 'مستلم منه' };
}

export function EntryForm({ entryKind, onSubmit }: Props) {
  const [date, setDate] = useState(todayIso());
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [description, setDescription] = useState('');

  const goldLabels = labelsForKind(entryKind, 'gold');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const d = debit ? parseFloat(debit) : undefined;
    const c = credit ? parseFloat(credit) : undefined;
    if (!d && !c) return;
    onSubmit({ date, debit: d, credit: c, description });
    setDebit('');
    setCredit('');
    setDescription('');
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
        <Plus className="h-4 w-4" /> إضافة حركة
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-slate-400">التاريخ</label>
          <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs text-slate-400">{goldLabels.out}</label>
          <input type="number" step="any" className="input-field num" value={debit} onChange={(e) => setDebit(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="text-xs text-slate-400">{goldLabels.in}</label>
          <input type="number" step="any" className="input-field num" value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="text-xs text-slate-400">البيان</label>
          <input type="text" className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف الحركة" />
        </div>
      </div>
      <button type="submit" className="btn-primary">إضافة</button>
    </form>
  );
}
