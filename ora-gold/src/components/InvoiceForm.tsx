import { useMemo, useState } from 'react';
import { Calculator, Plus, Printer, Save, Trash2 } from 'lucide-react';
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
import { InvoicePrintDialog } from './InvoicePrintDialog';
import type { InvoicePrintData } from '../lib/invoicePrint';

/** يقبل 0 ولا يعامل الحقل الفارغ كـ undefined عند الحاجة */
function parseMoneyField(value: string, allowEmpty: boolean): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return allowEmpty ? undefined : 0;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

const MATERIAL_OPTIONS_CASH: MaterialType[] = ['usd', 'k18', 'k21'];

const MATERIAL_OPTIONS_FULL: MaterialType[] = [
  ...MATERIAL_OPTIONS_CASH,
  'gold995',
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
  const [receivedUsd, setReceivedUsd] = useState('');
  const [usdAmount, setUsdAmount] = useState('');
  const [wageUsd, setWageUsd] = useState('');
  const [rawGoldGiven, setRawGoldGiven] = useState('');
  const [stoneDiscountGrams, setStoneDiscountGrams] = useState('');
  const [extraLines, setExtraLines] = useState<InvoiceLineInput[]>([]);
  const [saved, setSaved] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  const input: InvoiceInput = useMemo(() => ({
    number,
    date,
    customer,
    type,
    workedWeight: workedWeight ? parseFloat(workedWeight) : undefined,
    karat: type === 'sale21' ? 21 : 18,
    receivedUsd:
      type === 'sale18' || type === 'sale21'
        ? parseMoneyField(receivedUsd, true)
        : undefined,
    usdAmount:
      type === 'workshop' || type === 'purchase'
        ? parseMoneyField(usdAmount, true)
        : undefined,
    wageUsd:
      type === 'sale18' || type === 'sale21'
        ? parseMoneyField(wageUsd, true)
        : wageUsd
          ? parseFloat(wageUsd)
          : undefined,
    rawGoldGiven: rawGoldGiven ? parseFloat(rawGoldGiven) : undefined,
    stoneDiscountGrams:
      type !== 'purchase' && stoneDiscountGrams.trim()
        ? parseFloat(stoneDiscountGrams) || 0
        : undefined,
    lines: extraLines.filter((l) => l.amount > 0),
  }), [number, date, customer, type, workedWeight, receivedUsd, usdAmount, wageUsd, rawGoldGiven, stoneDiscountGrams, extraLines]);

  const calc = useMemo(() => calculateInvoice(input, profitRate), [input, profitRate]);

  const karat = type === 'sale21' ? 21 : 18;
  const autoPreview = useMemo(() => {
    const w = parseFloat(workedWeight);
    if (!w || type === 'purchase') return null;
    const received = parseFloat(receivedUsd) || 0;
    const wage = parseFloat(wageUsd) || 0;
    const stone = parseFloat(stoneDiscountGrams) || 0;
    return previewWagesProfit(w, karat, profitRate, received, wage, stone);
  }, [workedWeight, karat, profitRate, type, receivedUsd, wageUsd, stoneDiscountGrams]);

  const addLine = () => {
    setExtraLines((lines) => [...lines, { material: 'k18', direction: 'receive', amount: 0 }]);
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
    setReceivedUsd('');
    setUsdAmount('');
    setWageUsd('');
    setRawGoldGiven('');
    setStoneDiscountGrams('');
    setExtraLines([]);
  };

  const showCashUsd = type === 'sale18' || type === 'sale21';
  const showOtherUsd = type === 'workshop' || type === 'purchase';
  const showRawGold = type === 'workshop';
  const showExtraLines = type === 'workshop' || type === 'purchase';
  const materialOptions = showCashUsd ? MATERIAL_OPTIONS_CASH : MATERIAL_OPTIONS_FULL;

  const printData: InvoicePrintData | null = useMemo(() => {
    if (!calc.postings.length || !number.trim()) return null;
    return {
      number,
      date,
      customer,
      type,
      description: calc.description,
      postings: calc.postings,
      workedWeight: input.workedWeight,
      receivedUsd: input.receivedUsd,
      usdAmount: input.receivedUsd ?? input.usdAmount,
      wageUsd: input.wageUsd,
      stoneDiscountGrams: input.stoneDiscountGrams,
      profitRate,
    };
  }, [calc, number, date, customer, type, input, profitRate]);

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
          {type !== 'purchase' && (
            <div>
              <label className="text-xs text-slate-400">حجر مخصوم (غرام)</label>
              <input
                type="number"
                step="any"
                min="0"
                className="input-field num"
                value={stoneDiscountGrams}
                onChange={(e) => setStoneDiscountGrams(e.target.value)}
                placeholder="0"
              />
            </div>
          )}
          {showCashUsd && (
            <>
              <div>
                <label className="text-xs text-slate-400">مقبوض $ (إجمالي)</label>
                <input
                  type="number"
                  step="any"
                  className="input-field num"
                  value={receivedUsd}
                  onChange={(e) => setReceivedUsd(e.target.value)}
                  placeholder="13550"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">أجور $</label>
                <input
                  type="number"
                  step="any"
                  className="input-field num"
                  value={wageUsd}
                  onChange={(e) => setWageUsd(e.target.value)}
                  placeholder="684"
                />
              </div>
            </>
          )}
          {showOtherUsd && (
            <div>
              <label className="text-xs text-slate-400">
                {type === 'purchase' ? 'مبلغ الشراء $' : 'قبض زبون $'}
              </label>
              <input
                type="number"
                step="any"
                className="input-field num"
                value={usdAmount}
                onChange={(e) => setUsdAmount(e.target.value)}
                placeholder={type === 'purchase' ? '5000' : '520'}
              />
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
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 grid sm:grid-cols-2 lg:grid-cols-6 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">وزن إجمالي</p>
              <p className="num font-bold text-slate-200">{formatNumber(autoPreview.grossWeight, 2)} غ</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">حجر مخصوم</p>
              <p className="num font-bold text-slate-300">
                {autoPreview.stoneDiscountGrams > 0 ? `${formatNumber(autoPreview.stoneDiscountGrams, 2)} غ` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">وزن الأجور (صافي)</p>
              <p className="num font-bold text-emerald-400">{formatNumber(autoPreview.wagesGold, 2)} غ</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">ربح Pro (2غ/كغ)</p>
              <p className="num font-bold text-amber-400">{formatNumber(autoPreview.profitGold, 4)} غ</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">مكافئ 995 (رملة)</p>
              <p className="num font-bold">{formatNumber(autoPreview.fineGold995, 2)} غ</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">صافي $ (مقبوض − أجور)</p>
              <p className="num font-bold">{formatNumber(autoPreview.profitUsd, 2)}</p>
            </div>
            {(type === 'sale18' || type === 'sale21') && (
              <div>
                <p className="text-xs text-slate-400">مسار القبض</p>
                <p className="font-bold text-slate-200">
                  {autoPreview.settlementPath === 'trading' ? 'متاجرة + دولار' : 'رملة + دولار'}
                </p>
              </div>
            )}
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
          <span className="text-slate-500">(2 غرام لكل كيلو = {profitRate} × الوزن بالغرام)</span>
        </div>
      </div>

      {showExtraLines && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">سطور إضافية (كسر / …)</h3>
            <button type="button" className="btn-secondary text-xs flex items-center gap-1" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" /> إضافة سطر
            </button>
          </div>

          {extraLines.length === 0 && (
            <p className="text-xs text-slate-500">مثال: K18، دولار، مواد إضافية، إلخ.</p>
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
                  {materialOptions.map((m) => (
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
      )}

      <InvoiceOperationFlow type={type} />

      <InvoicePreview postings={calc.postings} description={calc.description} />

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={!calc.postings.length}>
          <Save className="h-4 w-4" />
          {saved ? 'تم الحفظ ✓' : 'حفظ الفاتورة'}
        </button>
        <button
          type="button"
          className="btn-secondary flex items-center gap-2"
          disabled={!printData}
          onClick={() => setPrintOpen(true)}
        >
          <Printer className="h-4 w-4" /> طباعة
        </button>
      </div>

      {printOpen && printData && (
        <InvoicePrintDialog data={printData} onClose={() => setPrintOpen(false)} />
      )}
    </form>
  );
}
