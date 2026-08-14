import { memo, useMemo } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { formatNsypConversionHint, isNsyp } from '../lib/syrianCurrency';
import { CURRENCIES, getValueInputLabel, isWeightCurrency } from '../config';
import {
  calcExchangeAmount,
  calcExchangePaidAmount,
  displayRateToInternalRate,
  exchangeRateLabel,
  formatExchangeRateDisplay,
  formatValueWithUnit,
  internalRateToDisplayRate,
} from '../lib/utils';
import type { Currency } from '../types';

export type ExchangeAmountEntry = 'paid' | 'received';

export interface ExchangeFieldValues {
  paidCurrency: Currency;
  paidAmount: string;
  receivedCurrency: Currency;
  receivedAmount: string;
  rate: string;
  /** أي مبلغ بتدخّله يدوياً؛ الثاني يُحسب من الريت */
  amountEntry: ExchangeAmountEntry;
}

export function defaultExchangeFieldValues(
  paid: Currency = 'USD',
  received: Currency = 'EUR',
): ExchangeFieldValues {
  return {
    paidCurrency: paid,
    paidAmount: '',
    receivedCurrency: received,
    receivedAmount: '',
    rate: '',
    amountEntry: 'paid',
  };
}

export function exchangeFieldValuesFromTransaction(tx: {
  currency: Currency;
  amount: number;
  exchangeToCurrency?: Currency;
  exchangeToAmount?: number;
  exchangeRate?: number;
}): ExchangeFieldValues {
  const receivedCurrency = tx.exchangeToCurrency ?? 'LBP';
  const receivedAmount = tx.exchangeToAmount ?? 0;
  const paidAmount = tx.amount;
  const internalRate = tx.exchangeRate ?? 0;
  const displayRate = internalRateToDisplayRate(tx.currency, receivedCurrency, internalRate);
  const calcReceived = calcExchangeAmount(paidAmount, internalRate);
  const amountEntry: ExchangeAmountEntry = internalRate > 0 && receivedAmount > 0
    && Math.abs(calcReceived - receivedAmount) > 0.01
    ? 'received'
    : 'paid';

  return {
    paidCurrency: tx.currency,
    paidAmount: paidAmount ? String(paidAmount) : '',
    receivedCurrency,
    receivedAmount: receivedAmount ? String(receivedAmount) : '',
    rate: displayRate ? String(displayRate) : '',
    amountEntry,
  };
}

function assetOptionLabel(c: (typeof CURRENCIES)[number]) {
  return c.kind === 'weight' ? `${c.label} (غرام)` : `${c.label} (${c.symbol})`;
}

export function parseExchangeFieldValues(values: ExchangeFieldValues): {
  paidAmount: number;
  receivedAmount: number;
  rate: number;
  displayRate: number;
  valid: boolean;
} {
  const parsedDisplayRate = Number(values.rate.replace(/,/g, '')) || 0;
  const internalRate = displayRateToInternalRate(values.paidCurrency, values.receivedCurrency, parsedDisplayRate);
  const paidInput = Number(values.paidAmount.replace(/,/g, '')) || 0;
  const receivedInput = Number(values.receivedAmount.replace(/,/g, '')) || 0;

  let paidAmount: number;
  let receivedAmount: number;
  let rate = internalRate;

  if (values.amountEntry === 'received') {
    receivedAmount = receivedInput;
    paidAmount = calcExchangePaidAmount(receivedAmount, internalRate);
  } else {
    paidAmount = paidInput;
    receivedAmount = calcExchangeAmount(paidAmount, internalRate);
  }

  if (values.amountEntry === 'received' && receivedAmount > 0 && paidAmount > 0 && !parsedDisplayRate) {
    rate = Math.round((receivedAmount / paidAmount) * 1_000_000) / 1_000_000;
  }

  const displayRate = parsedDisplayRate || internalRateToDisplayRate(values.paidCurrency, values.receivedCurrency, rate);

  const valid = values.paidCurrency !== values.receivedCurrency
    && displayRate > 0
    && (values.amountEntry === 'received' ? receivedInput > 0 : paidInput > 0)
    && paidAmount > 0
    && receivedAmount > 0;

  return { paidAmount, receivedAmount, rate, displayRate, valid };
}

interface Props {
  values: ExchangeFieldValues;
  onChange: (next: ExchangeFieldValues) => void;
  compact?: boolean;
}

export const ExchangeFields = memo(function ExchangeFields({ values, onChange, compact = false }: Props) {
  const parsed = useMemo(() => parseExchangeFieldValues(values), [values]);
  const paidStep = isWeightCurrency(values.paidCurrency) ? '0.01' : '1';
  const receivedStep = isWeightCurrency(values.receivedCurrency) ? '0.01' : '1';
  const paidValueLabel = getValueInputLabel(values.paidCurrency);
  const receivedValueLabel = getValueInputLabel(values.receivedCurrency);
  const entryPaid = values.amountEntry === 'paid';

  function patch(partial: Partial<ExchangeFieldValues>) {
    onChange({ ...values, ...partial });
  }

  function swapCurrencies() {
    onChange({
      ...values,
      paidCurrency: values.receivedCurrency,
      receivedCurrency: values.paidCurrency,
      paidAmount: values.receivedAmount || values.paidAmount,
      receivedAmount: values.paidAmount || values.receivedAmount,
      rate: '',
    });
  }

  const inputClass = compact
    ? 'w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs'
    : 'w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm';
  const labelClass = compact ? 'mb-1 block text-[10px] text-slate-400' : 'mb-1 block text-xs text-slate-400';
  const toggleBtn = (active: boolean) => compact
    ? `rounded-lg py-1.5 text-[10px] font-medium ${active ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}`
    : `rounded-xl py-2 text-xs font-medium ${active ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}`;

  const nsypHints: string[] = [];
  if (isNsyp(values.paidCurrency) && parsed.paidAmount > 0) {
    nsypHints.push(`دفع: ${formatNsypConversionHint(parsed.paidAmount)}`);
  }
  if (isNsyp(values.receivedCurrency) && parsed.receivedAmount > 0) {
    nsypHints.push(`استلام: ${formatNsypConversionHint(parsed.receivedAmount)}`);
  }

  return (
    <div className={`rounded-xl border border-violet-500/30 bg-violet-500/10 space-y-3 ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`font-medium text-violet-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          استلام يزيد الرصيد · دفع ينقصه
        </p>
        <button
          type="button"
          onClick={swapCurrencies}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-violet-500/40 px-2 py-1 text-[10px] text-violet-300 hover:bg-violet-500/20"
          title="عكس الاستلام والدفع"
        >
          <ArrowLeftRight size={12} />
          عكس
        </button>
      </div>

      <div className="space-y-1.5">
        <p className={labelClass}>أدخل المبلغ:</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => patch({ amountEntry: 'paid' })}
            className={toggleBtn(entryPaid)}
          >
            مبلغ الدفع
          </button>
          <button
            type="button"
            onClick={() => patch({ amountEntry: 'received' })}
            className={toggleBtn(!entryPaid)}
          >
            مبلغ الاستلام
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>استلمت في (يزيد)</label>
          <select
            value={values.receivedCurrency}
            onChange={e => {
              const next = e.target.value as Currency;
              const partial: Partial<ExchangeFieldValues> = { receivedCurrency: next };
              if (next === values.paidCurrency) {
                const alt = CURRENCIES.find(c => c.id !== next);
                if (alt) partial.paidCurrency = alt.id;
              }
              patch(partial);
            }}
            className={inputClass}
          >
            {CURRENCIES.map(c => (
              <option key={c.id} value={c.id}>{assetOptionLabel(c)}</option>
            ))}
          </select>
        </div>
        <div>
          {!entryPaid ? (
            <>
              <label className={labelClass}>{receivedValueLabel}</label>
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
              <label className={labelClass}>مبلغ الاستلام (محسوب)</label>
              <div className={`${inputClass} text-emerald-400/90 tabular-nums`}>
                {parsed.receivedAmount > 0
                  ? formatValueWithUnit(parsed.receivedAmount, values.receivedCurrency)
                  : '—'}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>دفعت من (ينقص)</label>
          <select
            value={values.paidCurrency}
            onChange={e => patch({ paidCurrency: e.target.value as Currency })}
            className={inputClass}
          >
            {CURRENCIES.filter(c => c.id !== values.receivedCurrency).map(c => (
              <option key={c.id} value={c.id}>{assetOptionLabel(c)}</option>
            ))}
          </select>
        </div>
        <div>
          {entryPaid ? (
            <>
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
            </>
          ) : (
            <>
              <label className={labelClass}>مبلغ الدفع (محسوب)</label>
              <div className={`${inputClass} text-rose-400/90 tabular-nums`}>
                {parsed.paidAmount > 0
                  ? formatValueWithUnit(parsed.paidAmount, values.paidCurrency)
                  : '—'}
              </div>
            </>
          )}
        </div>
      </div>

      <div>
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
      </div>

      {nsypHints.length > 0 && (
        <p className="text-[10px] text-amber-400/90 tabular-nums">{nsypHints.join(' · ')}</p>
      )}

      {parsed.valid && (
        <div className={`rounded-xl bg-slate-900/80 px-3 py-2.5 ${compact ? 'text-xs' : 'text-sm'}`}>
          <span className="font-bold text-emerald-400">+{formatValueWithUnit(parsed.receivedAmount, values.receivedCurrency)}</span>
          <span className="mx-2 text-slate-500">·</span>
          <span className="text-rose-400">-{formatValueWithUnit(parsed.paidAmount, values.paidCurrency)}</span>
          {parsed.rate > 0 && (
            <p className="mt-1 text-[10px] text-slate-500">
              ريت: {formatExchangeRateDisplay(values.paidCurrency, values.receivedCurrency, parsed.rate)}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
