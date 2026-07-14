import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CURRENCIES } from '../config';
import {
  DEFAULT_VALUATION_RATES,
  rateInputLabel,
  rateInputValue,
  readRateInput,
  type ValuationRates,
} from '../lib/valuationRates';

interface Props {
  rates: ValuationRates;
  onChange?: (rates: ValuationRates) => void;
  onSave?: (rates: ValuationRates) => void | Promise<void>;
  saving?: boolean;
  compact?: boolean;
}

export function ValuationRatesEditor({ rates, onChange, onSave, saving = false, compact = false }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(CURRENCIES.filter(c => c.id !== 'USD').map(c => [c.id, rateInputValue(c.id, rates)])),
  );

  useEffect(() => {
    setDraft(Object.fromEntries(
      CURRENCIES.filter(c => c.id !== 'USD').map(c => [c.id, rateInputValue(c.id, rates)]),
    ));
  }, [rates]);

  function applyDraft(): ValuationRates {
    const next: ValuationRates = { USD: 1 };
    for (const c of CURRENCIES) {
      if (c.id === 'USD') continue;
      const parsed = readRateInput(c.id, draft[c.id] ?? '');
      if (parsed) next[c.id] = parsed;
      else if (rates[c.id]) next[c.id] = rates[c.id];
      else if (DEFAULT_VALUATION_RATES[c.id]) next[c.id] = DEFAULT_VALUATION_RATES[c.id];
    }
    return next;
  }

  function handleApply() {
    onChange?.(applyDraft());
  }

  async function handleSave() {
    const next = applyDraft();
    onChange?.(next);
    await onSave?.(next);
  }

  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-900/60 ${compact ? 'p-3 space-y-2' : 'p-4 space-y-3'}`}>
      <div>
        <p className={`font-medium text-slate-200 ${compact ? 'text-xs' : 'text-sm'}`}>أسعار التقييم (بالدولار)</p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          تُحفظ مرة واحدة وتُطبَّق على كل الحسابات في كل الصناديق
        </p>
      </div>
      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {CURRENCIES.filter(c => c.id !== 'USD').map(c => (
          <label key={c.id} className="rounded-lg border border-slate-700 bg-slate-950/50 px-2.5 py-2">
            <span className="block text-[10px] text-slate-400">{rateInputLabel(c.id)}</span>
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={draft[c.id] ?? ''}
              onChange={e => setDraft(prev => ({ ...prev, [c.id]: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs tabular-nums"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {!onSave && (
          <button
            type="button"
            onClick={handleApply}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-amber-500/50"
          >
            تطبيق
          </button>
        )}
        {onSave && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
          >
            <Save size={12} />
            حفظ الأسعار — لكل الحسابات
          </button>
        )}
      </div>
    </div>
  );
}
