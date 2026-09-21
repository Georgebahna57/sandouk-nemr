import { useMemo, useState } from 'react';
import { Printer, X } from 'lucide-react';
import {
  buildInvoicePrintHtml,
  buildInvoicePrintSections,
  defaultSectionsForType,
  openPrintWindow,
  type InvoicePrintData,
  type InvoicePrintSectionId,
  type PrintMode,
  SECTION_TITLES,
} from '../lib/invoicePrint';

interface Props {
  data: InvoicePrintData;
  onClose: () => void;
}

const MODE_LABELS: Record<PrintMode, string> = {
  full: 'فاتورة كاملة',
  selected: 'أقسام محددة فقط',
  eachSection: 'كل قسم في صفحة منفصلة',
};

export function InvoicePrintDialog({ data, onClose }: Props) {
  const allSectionIds = useMemo(() => defaultSectionsForType(data.type), [data.type]);
  const sections = useMemo(() => buildInvoicePrintSections(data), [data]);

  const [mode, setMode] = useState<PrintMode>('full');
  const [selected, setSelected] = useState<Set<InvoicePrintSectionId>>(() => new Set(allSectionIds));

  const toggle = (id: InvoicePrintSectionId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrint = () => {
    const ids = mode === 'full' ? new Set(allSectionIds) : selected;
    const html = buildInvoicePrintHtml(data, ids, mode);
    openPrintWindow(html, `فاتورة ${data.number}`);
  };

  const selectableSections = sections.filter((s) => s.id !== 'header' && (s.id === 'totals' || s.postings.length > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
      <div className="card w-full max-w-lg max-h-[90dvh] overflow-y-auto p-4 space-y-4 shadow-xl border-amber-500/30">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-amber-400 flex items-center gap-2">
              <Printer className="h-5 w-5" /> طباعة الفاتورة
            </h3>
            <p className="text-xs text-slate-400 mt-1">{data.description}</p>
          </div>
          <button type="button" className="text-slate-400 hover:text-white p-1" onClick={onClose} aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <p className="text-xs text-slate-400 mb-2">نمط الطباعة</p>
          <div className="flex flex-col gap-2">
            {(Object.keys(MODE_LABELS) as PrintMode[]).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="print-mode" checked={mode === m} onChange={() => setMode(m)} />
                {MODE_LABELS[m]}
              </label>
            ))}
          </div>
        </div>

        {mode !== 'full' && (
          <div>
            <p className="text-xs text-slate-400 mb-2">الأقسام</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-slate-700/60 p-2">
              {selectableSections.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    disabled={s.id !== 'totals' && !s.postings.length}
                  />
                  <span className={!s.postings.length && s.id !== 'totals' ? 'text-slate-500' : ''}>
                    {SECTION_TITLES[s.id]}
                    {s.postings.length ? ` (${s.postings.length})` : ''}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
          <button type="button" className="btn-primary flex items-center gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> طباعة
          </button>
        </div>
      </div>
    </div>
  );
}
