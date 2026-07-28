import { ArrowLeftRight } from 'lucide-react';
import { CURRENCIES, getValueInputLabel, isWeightCurrency } from '../config';
import { calcExchangeAmount, exchangeRateLabel, formatValueWithUnit } from '../lib/utils';
import type { Currency } from '../types';

export interface ExchangeFieldValues {
  paidCurrency: Currency;
  paidAmount: string;
  receivedCurrency: Currency;
  rate: string;
  manualReceived: boolean;
  receivedAmount: string;
}

export function defaultExchangeFieldValues(
  paid: Currency = 'USD',
  received: Currency = 'LBP',
): ExchangeFieldValues {
  return {
    paidCurrency: paid,
    paidAmount: '',
    receivedCurrency: received,
    rate: '',
    manualReceived: false,
    receivedAmount: '',
  };
}

function assetOptionLabel(c: (typeof CURRENCIES)[number]) {
  return c.kind === 'weight' ? `${c.label} (غرام)` : `${c.label} (${c.symbol})`;
}

export function parseExchangeFieldValues(values: ExchangeFieldValues): {
  paidAmount: number;
  receivedAmount: number;
  rate: number;
  valid: boolean;
} {
  const paidAmount = Number(values.paidAmount.replace(/,/g, '')) || 0;
  const parsedRate = Number(values.rate.replace(/,/g, '')) || 0;
  const manualReceived = Number(values.receivedAmount.replace(/,/g, '')) || 0;
  const receivedAmount = values.manualReceived
    ? manualReceived
    : calcExchangeAmount(paidAmount, parsedRate);
  const rate = values.manualReceived && paidAmount > 0
    ? Math.round((receivedAmount / paidAmount) * 1_000_000) / 1_000_000
    : parsedRate;
  const valid = paidAmount > 0
    && values.paidCurrency !== values.receivedCurrency
    && (values.manualReceived ? receivedAmount > 0 : rate > 0);
  return { paidAmount, receivedAmount, rate, valid };
}

interface Props {
  values: ExchangeFieldValues;
  onChange: (next: ExchangeFieldValues) => void;
  compact?: boolean;
}

export function ExchangeFields({ values, onChange, compact = false }: Props) {
  const parsed = parseExchangeFieldValues(values);
  const paidStep = isWeightCurrency(values.paidCurrency) ? '0.01' : '1';
  const receivedStep = isWeightCurrency(values.receivedCurrency) ? '0.01' : '1';
  const paidValueLabel = getValueInputLabel(values.paidCurrency);
  const receivedValueLabel = getValueInputLabel(values.receivedCurrency);

  function patch(partial: Partial<ExchangeFieldValues>) {
    onChange({ ...values, ...partial });
  }

  function swapCurrencies() {
    onChange({
      ...values,
      paidCurrency: values.receivedCurrency,
      receivedCurrency: values.paidCurrency,
      paidAmount: values.manualReceived ? values.receivedAmount : values.paidAmount,
      receivedAmount: values.manualReceived ? values.paidAmount : values.receivedAmount,
      rate: '',
    });
  }

  const inputClass = compact
    ? 'w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs'
    : 'w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm';
  const labelClass = compact ? 'mb-1 block text-[10px] text-slate-400' : 'mb-1 block text-xs text-slate-400';

  return (
    <div className={`rounded-xl border border-violet-500/30 bg-violet-500/10 space-y-3 ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`font-medium text-violet-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          حدّد العملة اللي دفعت منها واللي استلمت فيها
        </p>
        <button
          type="button"
          onClick={swapCurrencies}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-violet-500/40 px-2 py-1 text-[10px] text-violet-300 hover:bg-violet-500/20"
          title="عكس الدفع والاستلام"
        >
          <ArrowLeftRight size={12} />
          عكس
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>دفعت من</label>
          <select
            value={values.paidCurrency}
            onChange={e => patch({ paidCurrency: e.target.value as Currency })}
            className={inputClass}
          >
            {CURRENCIES.map(c => (
              <option key={c.id} value={c.id}>{assetOptionLabel(c)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{paidValueLabel}</label>
          <input
            type="number"
            min="0"
            step={paidStep}
            placeholder="0"
            value={values.paidAmount}
            onChange={e => patch({ paidAmount: e.target.value })}
            className={inputClass}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>استلمت في</label>
          <select
            value={values.receivedCurrency}
            onChange={e => patch({ receivedCurrency: e.target.value as Currency })}
            className={inputClass}
          >
            {CURRENCIES.filter(c => c.id !== values.paidCurrency).map(c => (
              <option key={c.id} value={c.id}>{assetOptionLabel(c)}</option>
            ))}
          </select>
        </div>
        <div>
          {values.manualReceived ? (
            <>
              <label className={labelClass}>{receivedValueLabel} (يدوي)</label>
              <input
                type="number"
                min="0"
                step={receivedStep}
                placeholder="0"
                value={values.receivedAmount}
                onChange={e => patch({ receivedAmount: e.target.value })}
                className={inputClass}
                required
              />
            </>
          ) : (
            <>
              <label className={labelClass}>{exchangeRateLabel(values.paidCurrency, values.receivedCurrency)}</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="الريت"
                value={values.rate}
                onChange={e => patch({ rate: e.target.value })}
                className={inputClass}
                required
              />
            </>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-violet-200/90">
        <input
          type="checkbox"
          checked={values.manualReceived}
          onChange={e => patch({ manualReceived: e.target.checked })}
          className="rounded"
        />
        المبلغ المستلم يدوي (إذا الريت أو الحساب غلط)
      </label>

      {parsed.valid && (
        <div className={`rounded-xl bg-slate-900/80 px-3 py-2.5 ${compact ? 'text-xs' : 'text-sm'}`}>
          <span className="text-rose-400">-{formatValueWithUnit(parsed.paidAmount, values.paidCurrency)}</span>
          <span className="mx-2 text-slate-500">→</span>
          <span className="font-bold text-emerald-400">+{formatValueWithUnit(parsed.receivedAmount, values.receivedCurrency)}</span>
          {!values.manualReceived && parsed.rate > 0 && (
            <p className="mt-1 text-[10px] text-slate-500">ريت: {parsed.rate}</p>
          )}
        </div>
      )}
    </div>
  );
}
