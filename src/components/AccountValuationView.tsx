import { useMemo } from 'react';
import { isWeightCurrency } from '../config';
import { formatAmount, formatValueWithUnit } from '../lib/utils';
import {
  buildValuationLines,
  convertUsdToGoldGrams,
  formatRateLabel,
  sumBalancesInUsd,
  type AccountValuationMode,
  type ValuationRates,
} from '../lib/valuationRates';
import type { CustomerBalances } from '../types';

export const VALUATION_MODES: { id: AccountValuationMode; label: string }[] = [
  { id: 'breakdown', label: 'تفصيلي' },
  { id: 'usd', label: 'بالدولار' },
  { id: 'gold', label: 'بالذهب' },
];

interface Props {
  balances: CustomerBalances;
  rates: ValuationRates;
  mode: AccountValuationMode;
  compact?: boolean;
}

export function AccountValuationView({ balances, rates, mode, compact = false }: Props) {
  const lines = useMemo(() => buildValuationLines(balances, rates), [balances, rates]);
  const totalUsd = useMemo(() => sumBalancesInUsd(balances, rates), [balances, rates]);
  const totalGold = useMemo(() => convertUsdToGoldGrams(totalUsd, rates), [totalUsd, rates]);

  if (lines.length === 0) return null;

  if (mode === 'breakdown') {
    if (compact) {
      return (
        <div className="flex flex-wrap gap-2">
          {lines.map(line => (
            <span key={line.currency} className="rounded-lg bg-slate-900 px-2 py-1 text-xs">
              <span className="text-slate-400">
                {isWeightCurrency(line.currency) ? `${line.label} ` : line.currency}{' '}
              </span>
              <span className={line.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {isWeightCurrency(line.currency)
                  ? `${formatAmount(line.balance, line.currency)} غ`
                  : formatAmount(line.balance, line.currency)}
              </span>
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {lines.map(line => {
          const b = balances[line.currency];
          return (
            <div key={line.currency} className="rounded-xl bg-slate-900/60 p-3 text-xs">
              <p className="font-medium text-slate-300">
                {line.label}{isWeightCurrency(line.currency) ? ' (وزن بالغرام)' : ''}
              </p>
              <div className="mt-1 grid grid-cols-3 gap-2 text-slate-400">
                <span>وارد: <span className="text-emerald-400">{formatValueWithUnit(b.receipts, line.currency)}</span></span>
                <span>صادر: <span className="text-rose-400">{formatValueWithUnit(b.payments, line.currency)}</span></span>
                <span>رصيد: <span className={b.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatValueWithUnit(b.balance, line.currency)}</span></span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (mode === 'usd') {
    return (
      <div className={`rounded-xl border border-sky-500/30 bg-sky-500/5 ${compact ? 'px-3 py-2' : 'p-4'}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-400">إجمالي بالدولار</p>
          <p className={`font-bold tabular-nums ${compact ? 'text-base' : 'text-2xl'} ${totalUsd >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
            {formatAmount(totalUsd, 'USD')} $
          </p>
        </div>
        {!compact && (
          <div className="mt-3 space-y-1.5 border-t border-slate-700/60 pt-3">
            {lines.map(line => (
              <div key={line.currency} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-400">
                  {formatValueWithUnit(line.balance, line.currency)}
                  <span className="mx-1 text-slate-600">·</span>
                  <span className="text-slate-500">{line.rateLabel}</span>
                </span>
                <span className={`font-semibold tabular-nums ${line.usdValue >= 0 ? 'text-sky-300' : 'text-rose-400'}`}>
                  {formatAmount(line.usdValue, 'USD')} $
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-amber-500/30 bg-amber-500/5 ${compact ? 'px-3 py-2' : 'p-4'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">إجمالي بالذهب</p>
        <p className={`font-bold tabular-nums ${compact ? 'text-base' : 'text-2xl'} ${totalGold >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
          {formatAmount(totalGold, 'GOLD')} غ
        </p>
      </div>
      {!compact && (
        <>
          <p className="mt-1 text-[10px] text-slate-500">
            ≈ {formatAmount(totalUsd, 'USD')} $ حسب أسعار التقييم
          </p>
          <div className="mt-3 space-y-1.5 border-t border-slate-700/60 pt-3">
            {lines.map(line => (
              <div key={line.currency} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-400">{formatValueWithUnit(line.balance, line.currency)}</span>
                <span className="font-semibold tabular-nums text-amber-300/90">
                  {formatAmount(convertUsdToGoldGrams(line.usdValue, rates), 'GOLD')} غ
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface ToolbarProps {
  mode: AccountValuationMode;
  onModeChange: (mode: AccountValuationMode) => void;
  rates: ValuationRates;
  isAdmin?: boolean;
}

export function AccountValuationToolbar({ mode, onModeChange, rates, isAdmin = false }: ToolbarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-amber-500/40 bg-slate-900/50 p-0.5">
          {VALUATION_MODES.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => onModeChange(m.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                mode === m.id ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        أسعار موحّدة لكل الحسابات — {formatRateLabel('GOLD', rates)} · {formatRateLabel('EUR', rates)}
        {isAdmin
          ? ' — لتعديلها: إدارة ← أسعار التقييم'
          : ' — الأسعار تُحدَّث من المسؤول'}
      </p>
    </div>
  );
}
