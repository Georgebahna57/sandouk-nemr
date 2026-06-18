import { CURRENCIES, isWeightCurrency } from '../config';
import { formatAmount } from '../lib/utils';
import type { FundBalances } from '../types';

interface Props {
  balances: FundBalances;
}

export function BalanceCards({ balances }: Props) {
  const active = CURRENCIES.filter(c => balances[c.id].balance !== 0);

  if (active.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-500">
        لا يوجد رصيد
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {active.map(c => {
        const b = balances[c.id];
        const isSurplus = b.balance > 0;
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
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs text-slate-400">
                {c.label}
                {isWeight && <span className="text-slate-500"> · وزن</span>}
              </p>
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                isSurplus ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {isSurplus ? 'زايد' : 'ناقص'}
              </span>
            </div>
            <p className={`mt-1 text-xl font-bold tabular-nums ${isSurplus ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isWeight
                ? <>{formatAmount(Math.abs(b.balance), c.id)} <span className="text-sm">غ</span></>
                : <>{formatAmount(Math.abs(b.balance), c.id)} <span className="text-sm">{c.symbol}</span></>
              }
            </p>
          </div>
        );
      })}
    </div>
  );
}
