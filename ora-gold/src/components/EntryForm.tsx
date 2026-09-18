import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { CurrencySide, EntryKind } from '../types';
import { todayIso } from '../lib/format';
import { formValuesToLedger, getFormLabels } from '../lib/ledgerDisplay';

interface Props {
  entryKind: EntryKind;
  /** false = ذهب فقط (مثل تحت التصنيع) */
  allowUsd?: boolean;
  defaultSide?: CurrencySide;
  onSubmit: (side: CurrencySide, data: { date: string; debit?: number; credit?: number; description: string }) => void;
}

export function EntryForm({ entryKind, allowUsd = true, defaultSide = 'gold', onSubmit }: Props) {
  const [side, setSide] = useState<CurrencySide>(defaultSide);
  useEffect(() => { setSide(defaultSide); }, [defaultSide]);
  const [date, setDate] = useState(todayIso());
  const [col1, setCol1] = useState('');
  const [col2, setCol2] = useState('');
  const [description, setDescription] = useState('');

  const activeSide = allowUsd ? side : 'gold';
  const labels = getFormLabels(entryKind, activeSide);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v1 = col1 ? parseFloat(col1) : undefined;
    const v2 = col2 ? parseFloat(col2) : undefined;
    if (!v1 && !v2) return;
    const { debit, credit } = formValuesToLedger(entryKind, v1, v2, activeSide);
    onSubmit(activeSide, { date, debit, credit, description });
    setCol1('');
    setCol2('');
    setDescription('');
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
        <Plus className="h-4 w-4" /> إضافة حركة
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {allowUsd && (
          <div>
            <label className="text-xs text-slate-400">النوع</label>
            <select
              className="input-field"
              value={side}
              onChange={(e) => setSide(e.target.value as CurrencySide)}
            >
              <option value="gold">ذهب 995</option>
              <option value="usd">دولار $</option>
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-slate-400">التاريخ</label>
          <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs text-slate-400">{labels.col1}</label>
          <input type="number" step="any" className="input-field num" value={col1} onChange={(e) => setCol1(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="text-xs text-slate-400">{labels.col2}</label>
          <input type="number" step="any" className="input-field num" value={col2} onChange={(e) => setCol2(e.target.value)} placeholder="0" />
        </div>
        <div className={allowUsd ? '' : 'lg:col-span-2'}>
          <label className="text-xs text-slate-400">البيان</label>
          <input type="text" className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف الحركة" />
        </div>
      </div>
      <button type="submit" className="btn-primary">إضافة</button>
    </form>
  );
}
