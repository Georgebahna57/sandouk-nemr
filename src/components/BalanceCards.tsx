import { memo } from 'react';
import { CURRENCIES, isHalabFleilatFund, isWeightCurrency } from '../config';
import { halabBalanceIsSurplus, halabBalanceSideLabel } from '../lib/halabBalance';
import { isBalanceDisplayCurrency } from '../lib/syrianCurrency';
import { formatAmount } from '../lib/utils';
import type { FundBalances, FundId } from '../types';

interface Props {
  balances: FundBalances;
  fundId?: FundId;
  /** عند التوفّر: يعرض الرصيد المتوقّع بعد اعتماد المعلّق */
  projectedBalances?: FundBalances;
}

export const BalanceCards = memo(function BalanceCards({ balances, fundId, projectedBalances }: Props) {
  const showProjected = projectedBalances != null;
  const halab = fundId && isHalabFleilatFund(fundId) ? fundId : undefined;

  const active = CURRENCIES.filter(c => {
    if (!isBalanceDisplayCurrency(c.id)) return false;
    const current = balances[c.id].balance;
    const projected = projectedBalances?.[c.id].balance ?? current;
    if (showProjected) return current !== 0 || projected !== 0;
    return current !== 0;
  });

  if (active.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-500">
        لا يوجد رصيد
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showProjected && (
        <p className="text-[11px] text-sky-300/90">
          الرصيد المتوقّع — شامل عمليات قيد الانتظار
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {active.map(c => {
          const currentBalance = balances[c.id].balance;
          const displayBalance = showProjected ? projectedBalances![c.id].balance : currentBalance;
          const delta = showProjected ? displayBalance - currentBalance : 0;
          const isSurplus = halab
            ? halabBalanceIsSurplus(halab, c.id, displayBalance)
            : displayBalance > 0;
          const side = halab ? halabBalanceSideLabel(c.id, displayBalance) : undefined;
          const isWeight = isWeightCurrency(c.id);
          return (
            <div
              key={c.id}
              className={`rounded-2xl border p-3 ${
                isSurplus
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-rose-500/30 bg-rose-500/10'
              }`}
            >
              <p className="text-xs text-slate-400">
                {c.label}
                {side && <span className="text-slate-500"> · {side}</span>}
                {isWeight && <span className="text-slate-500"> · وزن</span>}
              </p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${isSurplus ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isWeight
                  ? <>{formatAmount(Math.abs(displayBalance), c.id)} <span className="text-sm">غ</span></>
                  : <>{formatAmount(Math.abs(displayBalance), c.id)} <span className="text-sm">{c.symbol}</span></>
                }
              </p>
              {showProjected && delta !== 0 && (
                <p className="mt-1 text-[10px] tabular-nums text-slate-500">
                  حالياً {formatAmount(Math.abs(currentBalance), c.id)} {isWeight ? 'غ' : c.symbol}
                  <span className={`mr-1 ${delta > 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                    {' '}({delta > 0 ? '+' : ''}{formatAmount(delta, c.id)})
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
