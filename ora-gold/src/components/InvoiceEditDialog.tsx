import { useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import { INVOICE_TYPE_LABELS, resolveMetalWeight, resolveWageUsd } from '../lib/invoiceCalc';
import { formatNumber } from '../lib/format';
import type { InvoiceInput, WorkshopInvoice } from '../types';

interface Props {
  invoice: WorkshopInvoice;
  onClose: () => void;
  onSave: (input: InvoiceInput) => void;
}

function initialWagePerGram(invoice: WorkshopInvoice): string {
  if (invoice.wagePerGramUsd != null) return String(invoice.wagePerGramUsd);
  const metal = resolveMetalWeight({
    workedWeight: invoice.workedWeight,
    stoneDiscountGrams: invoice.stoneDiscountGrams,
  });
  if (metal > 0 && invoice.wageUsd) {
    return String(Math.round((invoice.wageUsd / metal) * 100) / 100);
  }
  return '';
}

export function InvoiceEditDialog({ invoice, onClose, onSave }: Props) {
  const [date, setDate] = useState(invoice.date);
  const [customer, setCustomer] = useState(invoice.customer);
  const [workedWeight, setWorkedWeight] = useState(invoice.workedWeight?.toString() ?? '');
  const [receivedUsd, setReceivedUsd] = useState((invoice.receivedUsd ?? invoice.usdAmount)?.toString() ?? '');
  const [wagePerGramUsd, setWagePerGramUsd] = useState(() => initialWagePerGram(invoice));
  const [stoneDiscountGrams, setStoneDiscountGrams] = useState(invoice.stoneDiscountGrams?.toString() ?? '');
  const [rawGoldGiven, setRawGoldGiven] = useState(invoice.rawGoldGiven?.toString() ?? '');

  const previewWageUsd = useMemo(() => {
    const w = workedWeight ? parseFloat(workedWeight) : undefined;
    const perGram = wagePerGramUsd.trim() ? parseFloat(wagePerGramUsd) : undefined;
    const stone = stoneDiscountGrams.trim() ? parseFloat(stoneDiscountGrams) || 0 : undefined;
    return resolveWageUsd({
      workedWeight: w,
      stoneDiscountGrams: stone,
      wagePerGramUsd: perGram,
      wageUsd: invoice.wageUsd,
    });
  }, [workedWeight, wagePerGramUsd, stoneDiscountGrams, invoice.wageUsd]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const perGram = wagePerGramUsd.trim() ? parseFloat(wagePerGramUsd) : undefined;
    onSave({
      number: invoice.number,
      date,
      customer,
      type: invoice.type,
      workedWeight: workedWeight ? parseFloat(workedWeight) : undefined,
      receivedUsd: receivedUsd ? parseFloat(receivedUsd) : undefined,
      wagePerGramUsd: perGram,
      stoneDiscountGrams: stoneDiscountGrams ? parseFloat(stoneDiscountGrams) : undefined,
      rawGoldGiven: rawGoldGiven ? parseFloat(rawGoldGiven) : undefined,
      karat: invoice.type === 'sale21' || invoice.type === 'workshop' ? 21 : 18,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={submit} className="card w-full max-w-md p-4 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-amber-400 text-sm">
            تعديل فاتورة {invoice.number} — {INVOICE_TYPE_LABELS[invoice.type]}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-slate-500">يُعاد ترحيل الحركات المحاسبية بعد الحفظ.</p>
        <div>
          <label className="text-xs text-slate-400">التاريخ</label>
          <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs text-slate-400">الزبون</label>
          <input className="input-field" value={customer} onChange={(e) => setCustomer(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-400">وزن المشغول</label>
          <input type="number" step="any" className="input-field num" value={workedWeight} onChange={(e) => setWorkedWeight(e.target.value)} />
        </div>
        {(invoice.type === 'sale18' || invoice.type === 'sale21') && (
          <>
            <div>
              <label className="text-xs text-slate-400">المقبوض $</label>
              <input type="number" step="any" className="input-field num" value={receivedUsd} onChange={(e) => setReceivedUsd(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-400">أجور الغرام $</label>
              <input type="number" step="any" className="input-field num" value={wagePerGramUsd} onChange={(e) => setWagePerGramUsd(e.target.value)} />
              {previewWageUsd > 0 && (
                <p className="mt-1 text-[11px] text-slate-500 num">إجمالي الأجور: {formatNumber(previewWageUsd, 2)} $</p>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-400">حجر مخصوم (غرام)</label>
              <input type="number" step="any" className="input-field num" value={stoneDiscountGrams} onChange={(e) => setStoneDiscountGrams(e.target.value)} />
            </div>
          </>
        )}
        {invoice.type === 'workshop' && (
          <div>
            <label className="text-xs text-slate-400">ذهب خام مُسلّم</label>
            <input type="number" step="any" className="input-field num" value={rawGoldGiven} onChange={(e) => setRawGoldGiven(e.target.value)} />
          </div>
        )}
        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
          <Save className="h-4 w-4" /> حفظ وإعادة الترحيل
        </button>
      </form>
    </div>
  );
}
