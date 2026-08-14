import { memo } from 'react';
import { CURRENCIES, getCurrencySymbol } from '../config';
import {
  buildParsedFee,
  calcFeeAmount,
  feeModeLabel,
  feeSideLabel,
  type ParsedFee,
} from '../lib/fees';
import { formatAmount } from '../lib/utils';
import type { Currency, FeeMode, FeeSide } from '../types';

export interface FeeEditorValue {
  enabled: boolean;
  mode: FeeMode;
  rate: string;
  side: FeeSide;
  currency: Currency;
}

export const defaultFeeEditorValue = (): FeeEditorValue => ({
  enabled: false,
  mode: 'fixed',
  rate: '',
  side: 'ours',
  currency: 'USD',
});

interface Props {
  value: FeeEditorValue;
  onChange: (value: FeeEditorValue) => void;
  baseAmount: number;
  availableCurrencies?: Currency[];
  compact?: boolean;
  title?: string;
  hintOurs?: string;
  hintCustomer?: string;
}

export function feeEditorFromParsed(fee: ParsedFee | undefined): FeeEditorValue {
  if (!fee || (fee.amount <= 0 && !fee.display)) return defaultFeeEditorValue();
  return {
    enabled: true,
    mode: fee.mode,
    rate: String(fee.rate),
    side: fee.side,
    currency: fee.currency,
  };
}

export function buildFeeFromEditor(value: FeeEditorValue, baseAmount: number): ParsedFee | undefined {
  if (!value.enabled) return undefined;
  const rate = Number(value.rate.replace(/,/g, '')) || 0;
  if (!rate) return undefined;
  const effectiveBase = value.mode === 'fixed' ? 0 : baseAmount;
  return buildParsedFee(value.mode, rate, value.side, value.currency, effectiveBase);
}

export const FeeEditor = memo(function FeeEditor({
  value,
  onChange,
  baseAmount,
  availableCurrencies,
  compact,
  title = 'أجور / عمولة',
  hintOurs = 'تُخصم من مبلغ حساب الزبون وتُسجَّل على حساب الأجور',
  hintCustomer = 'تُضاف على مبلغ حساب الزبون فقط — ما بتروح لحساب الأجور',
}: Props) {
  const rate = Number(value.rate.replace(/,/g, '')) || 0;
  const previewBase = value.mode === 'fixed' ? 0 : baseAmount;
  const previewAmount = value.enabled && rate
    ? calcFeeAmount(value.mode, rate, previewBase)
    : 0;
  const currencies = availableCurrencies?.length
    ? CURRENCIES.filter(c => availableCurrencies.includes(c.id))
    : CURRENCIES;

  const pad = compact ? 'p-2.5 space-y-2' : 'p-3 space-y-3';
  const textSize = compact ? 'text-xs' : 'text-sm';
  const labelSize = compact ? 'text-[10px]' : 'text-xs';

  return (
    <div className={`rounded-xl border border-amber-500/30 bg-amber-500/5 ${pad}`}>
      <label className={`flex items-center gap-2 font-medium text-amber-300/90 ${textSize}`}>
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={e => onChange({ ...value, enabled: e.target.checked })}
          className="rounded"
        />
        {title}
      </label>

      {value.enabled && (
        <>
          <div>
            <p className={`mb-1 ${labelSize} text-slate-400`}>طريقة الحساب</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['fixed', 'percent', 'per_mille'] as FeeMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ ...value, mode })}
                  className={`rounded-lg py-2 ${textSize} font-medium ${
                    value.mode === mode ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {feeModeLabel(mode)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`mb-1 block ${labelSize} text-slate-400`}>
                {value.mode === 'fixed' ? 'المبلغ' : value.mode === 'percent' ? 'النسبة %' : 'بالألف ‰'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={value.rate}
                onChange={e => onChange({ ...value, rate: e.target.value })}
                className={`w-full rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-2 ${textSize}`}
              />
            </div>
            <div>
              <label className={`mb-1 block ${labelSize} text-slate-400`}>العملة</label>
              <select
                value={value.currency}
                onChange={e => onChange({ ...value, currency: e.target.value as Currency })}
                className={`w-full rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-2 ${textSize}`}
              >
                {currencies.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className={`mb-1 ${labelSize} text-slate-400`}>الوجهة</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(['ours', 'customer'] as FeeSide[]).map(side => (
                <button
                  key={side}
                  type="button"
                  onClick={() => onChange({ ...value, side })}
                  className={`rounded-lg py-2 ${textSize} font-medium ${
                    value.side === side
                      ? side === 'ours' ? 'bg-emerald-600 text-white' : 'bg-sky-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {feeSideLabel(side)}
                </button>
              ))}
            </div>
            <p className={`mt-1.5 ${labelSize} text-slate-500`}>
              {value.side === 'ours' ? hintOurs : hintCustomer}
            </p>
          </div>

          {previewAmount > 0 ? (
            <div className={`rounded-lg bg-slate-900/80 px-2.5 py-2 ${textSize}`}>
              <span className="text-slate-400">الناتج: </span>
              <span className="font-semibold text-amber-300">
                {formatAmount(previewAmount, value.currency)} {getCurrencySymbol(value.currency)}
              </span>
              <span className="text-slate-500"> — {feeSideLabel(value.side)}</span>
            </div>
          ) : value.mode !== 'fixed' && rate > 0 && baseAmount <= 0 ? (
            <p className={`${labelSize} text-rose-400/90`}>
              ما في مبلغ بعملة {getCurrencySymbol(value.currency)} لحساب النسبة
            </p>
          ) : null}
        </>
      )}
    </div>
  );
});
