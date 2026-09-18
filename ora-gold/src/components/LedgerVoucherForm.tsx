import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import type { CurrencySide, EntryKind } from '../types';
import { todayIso } from '../lib/format';
import { getColumnHeaders } from '../lib/ledgerDisplay';
import { suggestNextInvoiceNumber } from '../lib/invoiceCalc';
import type { LedgerVoucherInput, VoucherLineDirection, VoucherLineInput } from '../lib/ledgerVoucher';

export type { LedgerVoucherInput } from '../lib/ledgerVoucher';

interface Props {
  entryKind: EntryKind;
  allowUsd?: boolean;
  defaultSide?: CurrencySide;
  existingNumbers?: string[];
  onSubmit: (voucher: LedgerVoucherInput) => void;
}

function emptyLine(side: CurrencySide): VoucherLineInput {
  return { side, direction: 'col1', amount: 0 };
}

export function LedgerVoucherForm({
  entryKind,
  allowUsd = true,
  defaultSide = 'gold',
  existingNumbers = [],
  onSubmit,
}: Props) {
  const fixedSide = allowUsd ? null : 'gold';
  const initialSide = fixedSide ?? defaultSide;

  const [invoiceNumber, setInvoiceNumber] = useState(() => suggestNextInvoiceNumber(existingNumbers));
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<VoucherLineInput[]>([emptyLine(initialSide)]);

  useEffect(() => {
    setLines([emptyLine(fixedSide ?? defaultSide)]);
  }, [defaultSide, fixedSide]);

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine(fixedSide ?? defaultSide)]);
  };

  const updateLine = (idx: number, patch: Partial<VoucherLineInput>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const validLines = useMemo(() => lines.filter((l) => l.amount > 0), [lines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim() || validLines.length === 0) return;
    onSubmit({ invoiceNumber: invoiceNumber.trim(), date, description, lines: validLines });
    setInvoiceNumber(suggestNextInvoiceNumber([...existingNumbers, invoiceNumber.trim()]));
    setDescription('');
    setLines([emptyLine(fixedSide ?? defaultSide)]);
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-4">
      <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
        <FileText className="h-4 w-4" /> إضافة فاتورة / سند
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-slate-400">رقم الفاتورة</label>
          <input
            className="input-field"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="002821"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">التاريخ</label>
          <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="col-span-2 md:col-span-1 lg:col-span-2">
          <label className="text-xs text-slate-400">البيان</label>
          <input
            type="text"
            className="input-field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="وصف الحركة أو اسم الزبون"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">سطور الفاتورة (ذهب / دولار · استلام / تسليم)</p>
          <button type="button" className="btn-secondary text-xs flex items-center gap-1" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" /> إضافة سطر
          </button>
        </div>

        {lines.map((line, idx) => {
          const [col1Label, col2Label] = getColumnHeaders(entryKind, line.side);
          const gridCols = allowUsd
            ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]'
            : 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]';

          return (
            <div key={idx} className={`grid ${gridCols} gap-2 items-end`}>
              {allowUsd && (
                <div>
                  <label className="text-xs text-slate-400">النوع</label>
                  <select
                    className="input-field"
                    value={line.side}
                    onChange={(e) => updateLine(idx, { side: e.target.value as CurrencySide })}
                  >
                    <option value="gold">ذهب 995</option>
                    <option value="usd">دولار $</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-400">الاتجاه</label>
                <select
                  className="input-field"
                  value={line.direction}
                  onChange={(e) => updateLine(idx, { direction: e.target.value as VoucherLineDirection })}
                >
                  <option value="col1">{col1Label}</option>
                  <option value="col2">{col2Label}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">الكمية</label>
                <input
                  type="number"
                  step="any"
                  className="input-field num"
                  value={line.amount || ''}
                  onChange={(e) => updateLine(idx, { amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                className="text-red-400 p-2 disabled:opacity-30"
                onClick={() => removeLine(idx)}
                disabled={lines.length <= 1}
                title="حذف السطر"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <button type="submit" className="btn-primary" disabled={!invoiceNumber.trim() || validLines.length === 0}>
        إضافة الفاتورة ({validLines.length} سطر)
      </button>
    </form>
  );
}
