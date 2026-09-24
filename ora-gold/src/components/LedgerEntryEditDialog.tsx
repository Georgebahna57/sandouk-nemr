import { useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import { formValuesToLedger, getColumnHeaders, getDisplayValues } from '../lib/ledgerDisplay';
import type { CurrencySide, EntryKind, LedgerEntry } from '../types';

interface Props {
  entry: LedgerEntry;
  entryKind: EntryKind;
  side: CurrencySide;
  onClose: () => void;
  onSave: (patch: Partial<Omit<LedgerEntry, 'id' | 'balance'>>) => void;
}

export function LedgerEntryEditDialog({ entry, entryKind, side, onClose, onSave }: Props) {
  const initial = useMemo(() => getDisplayValues(entry, entryKind, side), [entry, entryKind, side]);
  const [date, setDate] = useState(entry.date);
  const [description, setDescription] = useState(entry.description);
  const [col1, setCol1] = useState(initial.col1?.toString() ?? '');
  const [col2, setCol2] = useState(initial.col2?.toString() ?? '');
  const [c1, c2] = getColumnHeaders(entryKind, side);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { debit, credit } = formValuesToLedger(
      entryKind,
      col1 ? parseFloat(col1) : undefined,
      col2 ? parseFloat(col2) : undefined,
      side,
    );
    onSave({ date, description, debit, credit });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={submit} className="card w-full max-w-md p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-amber-400 text-sm">تعديل حركة</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div>
          <label className="text-xs text-slate-400">التاريخ</label>
          <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-400">{c1}</label>
            <input type="number" step="any" className="input-field num" value={col1} onChange={(e) => setCol1(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-400">{c2}</label>
            <input type="number" step="any" className="input-field num" value={col2} onChange={(e) => setCol2(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400">البيان</label>
          <input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
          <Save className="h-4 w-4" /> حفظ التعديل
        </button>
      </form>
    </div>
  );
}
