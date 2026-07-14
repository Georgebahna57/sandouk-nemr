import { CURRENCIES, isWeightCurrency } from '../config';
import { ALL_FEE_ACCOUNTS } from '../lib/fees';
import { formatAmount } from '../lib/utils';
import type { CustomerSummary } from '../types';

interface Props {
  summaries: CustomerSummary[];
}

export function FeeAccountCards({ summaries }: Props) {
  const cards = ALL_FEE_ACCOUNTS.map(name => {
    const summary = summaries.find(s => s.name === name);
    return { name, summary };
  }).filter(({ summary }) => summary?.hasActivity);

  if (cards.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-emerald-400/90">حسابات الأجور</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {cards.map(({ name, summary }) => {
          if (!summary) return null;
          const active = CURRENCIES.filter(c => summary.balances[c.id].balance !== 0);
          return (
            <div
              key={name}
              className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5"
            >
              <p className="text-xs font-medium text-emerald-300">{name}</p>
              {active.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">لا يوجد رصيد</p>
              ) : (
                <div className="mt-1 space-y-0.5">
                  {active.map(c => {
                    const b = summary.balances[c.id].balance;
                    const isWeight = isWeightCurrency(c.id);
                    return (
                      <p key={c.id} className="text-sm font-bold tabular-nums text-emerald-400">
                        {isWeight
                          ? <>{formatAmount(Math.abs(b), c.id)} <span className="text-xs">غ</span></>
                          : <>{formatAmount(Math.abs(b), c.id)} <span className="text-xs">{c.symbol}</span></>
                        }
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
