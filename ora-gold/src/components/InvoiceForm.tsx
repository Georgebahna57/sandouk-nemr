import { useMemo, useState } from 'react';
import { Calculator, Plus, Save, Trash2 } from 'lucide-react';
import {
  calculateInvoice,
  INVOICE_TYPE_LABELS,
  MATERIAL_LABELS,
  previewWagesProfit,
  suggestNextInvoiceNumber,
} from '../lib/invoiceCalc';
import { formatNumber, todayIso } from '../lib/format';
import type { InvoiceInput, InvoiceLineInput, InvoiceType, MaterialType, LineDirection } from '../types';
import { InvoicePreview } from './InvoicePreview';
import { InvoiceOperationFlow } from './InvoiceOperationFlow';

const MATERIAL_OPTIONS: MaterialType[] = [
  'usd',
  'gold995',
  'scrap18_cast',
  'scrap18_pull',
  'scrap21_cast',
  'scrap21_pull',
  'k18',
  'k21',
  'raw_gold',
];

interface Props {
  profitRate: number;
  existingNumbers: string[];
  onSubmit: (input: InvoiceInput) => void;
  onProfitRateChange: (rate: number) => void;
}

export function InvoiceForm({ profitRate, existingNumbers, onSubmit, onProfitRateChange }: Props) {
  const [type, setType] = useState<InvoiceType>('sale18');
  const [number, setNumber] = useState(() => suggestNextInvoiceNumber(existingNumbers));
  const [date, setDate] = useState(todayIso());
  const [customer, setCustomer] = useState('');
  const [workedWeight, setWorkedWeight] = useState('');
  const [usdAmount, setUsdAmount] = useState('');
  const [wageUsd, setWageUsd] = useState('');
  const [rawGoldGiven, setRawGoldGiven] = useState('');
  const [extraLines, setExtraLines] = useState<InvoiceLineInput[]>([]);
  const [saved, setSaved] = useState(false);

  const input: InvoiceInput = useMemo(() => ({
    number,
    date,
    customer,
    type,
    workedWeight: workedWeight ? parseFloat(workedWeight) : undefined,
    karat: type === 'sale21' ? 21 : 18,
    usdAmount: usdAmount ? parseFloat(usdAmount) : undefined,
    wageUsd: wageUsd ? parseFloat(wageUsd) : undefined,
    rawGoldGiven: rawGoldGiven ? parseFloat(rawGoldGiven) : undefined,
    lines: extraLines.filter((l) => l.amount > 0),
  }), [number, date, customer, type, workedWeight, usdAmount, wageUsd, rawGoldGiven, extraLines]);

  const calc = useMemo(() => calculateInvoice(input, profitRate), [input, profitRate]);

  const karat = type === 'sale21' ? 21 : 18;
  const autoPreview = useMemo(() => {
    const w = parseFloat(workedWeight);
    if (!w || type === 'purchase') return null;
    return previewWagesProfit(w, karat, profitRate);
  }, [workedWeight, karat, profitRate, type]);

  const addLine = () => {
    setExtraLines((lines) => [...lines, { material: 'scrap18_cast', direction: 'receive', amount: 0 }]);
  };

  const updateLine = (idx: number, patch: Partial<InvoiceLineInput>) => {
    setExtraLines((lines) => lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setExtraLines((lines) => lines.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!number.trim() || !customer.trim()) return;
    if (type !== 'purchase' && !workedWeight) return;
    onSubmit(input);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setNumber(suggestNextInvoiceNumber([...existingNumbers, number]));
    setCustomer('');
    setWorkedWeight('');
    setUsdAmount('');
    setWageUsd('');
    setRawGoldGiven('');
    setExtraLines([]);
  };

  const showWageUsd = type === 'sale18' || type === 'sale21';
  const showRawGold = type === 'workshop';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-bold text-amber-400">فاتورة جديدة</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-400">نوع العملية</label>
            <select className="input-field" value={type} onChange={(e) => setType(e.target.value as InvoiceType)}>
              {(Object.keys(INVOICE_TYPE_LABELS) as InvoiceType[]).map((t) => (
                <option key={t} value={t}>{INVOICE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">رقم الفاتورة</label>
            <input className="input-field" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="002820" required />
          </div>
          <div>
            <label className="text-xs text-slate-400">التاريخ</label>
            <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-slate-400">اسم الزبون</label>
            <input className="input-field" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="جرادي محل" required />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-400">
              وزن المشغول ({type === 'sale21' ? 'عيار 21' : 'عيار 18'}) — غرام
            </label>
            <input
              type="number"
              step="any"
              className="input-field num"
              value={workedWeight}
              onChange={(e) => setWorkedWeight(e.target.value)}
              placeholder="42.75"
              required={type !== 'purchase'}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">قبض دولار $</label>
            <input type="number" step="any" className="input-field num" value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)} placeholder="1187" />
          </div>
          {showWageUsd && (
            <div>
              <label className="text-xs text-slate-400">أجور دولار $ (اختياري)</label>
              <input type="number" step="any" className="input-field num" value={wageUsd} onChange={(e) => setWageUsd(e.target.value)} placeholder="684" />
            </div>
          )}
          {showRawGold && (
            <div>
              <label className="text-xs text-slate-400">دهب خام مُسلَّم (995) — غرام</label>
              <input type="number" step="any" className="input-field num" value={rawGoldGiven} onChange={(e) => setRawGoldGiven(e.target.value)} placeholder="155.5" />
            </div>
          )}
        </div>

        {autoPreview && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 grid sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">أجور (ذهب)</p>
              <p className="num font-bold text-emerald-400">{formatNumber(autoPreview.wagesGold, 2)} غ</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">ربح إنتاج (تلقائي)</p>
              <p className="num font-bold text-amber-400">{formatNumber(autoPreview.profitGold, 4)} غ</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">مكافئ 995</p>
              <p className="num font-bold">{formatNumber(autoPreview.fineGold995, 2)} غ</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">متاجرة (995)</p>
              <p className="num font-bold">{formatNumber(autoPreview.tradingGold995, 2)} غ</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-sm">
          <label className="text-xs text-slate-400">نسبة الربح:</label>
          <input
            type="number"
            step="0.0001"
            className="input-field num w-24"
            value={profitRate}
            onChange={(e) => onProfitRateChange(parseFloat(e.target.value) || 0.002)}
          />
          <span className="text-slate-500">({(profitRate * 100).toFixed(2)}% من وزن الأجور)</span>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">سطور إضافية (كسر / رملة / …)</h3>
          <button type="button" className="btn-secondary text-xs flex items-center gap-1" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" /> إضافة سطر
          </button>
        </div>

        {extraLines.length === 0 && (
          <p className="text-xs text-slate-500">مثال: استلام كسر 18 صب، استلام رملة 995، إلخ.</p>
        )}

        {extraLines.map((line, idx) => (
          <div key={idx} className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
            <div>
              <label className="text-xs text-slate-400">المادة</label>
              <select
                className="input-field"
                value={line.material}
                onChange={(e) => updateLine(idx, { material: e.target.value as MaterialType })}
              >
                {MATERIAL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{MATERIAL_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">الاتجاه</label>
              <select
                className="input-field"
                value={line.direction}
                onChange={(e) => updateLine(idx, { direction: e.target.value as LineDirection })}
              >
                <option value="receive">قبضنا ←</option>
                <option value="give">سلّمنا →</option>
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
              />
            </div>
            <button type="button" className="text-red-400 p-2" onClick={() => removeLine(idx)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <InvoiceOperationFlow type={type} />

      <InvoicePreview postings={calc.postings} description={calc.description} />

      <button type="submit" className="btn-primary flex items-center gap-2" disabled={!calc.postings.length}>
        <Save className="h-4 w-4" />
        {saved ? 'تم الحفظ ✓' : 'حفظ الفاتورة'}
      </button>
    </form>
  );
}
