import { CURRENCIES, isWeightCurrency } from '../config';
import { sumSummariesByCurrency } from '../lib/accountBranch';
import { formatAmount } from '../lib/utils';
import type { Currency, CustomerSummary } from '../types';

interface Props {
  summaries: CustomerSummary[];
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

function balanceTone(amount: number): 'positive' | 'negative' | 'zero' {
  if (amount > 0) return 'positive';
  if (amount < 0) return 'negative';
  return 'zero';
}

const TONE_STYLES = {
  positive: {
    card: 'border-emerald-500/35 bg-emerald-500/10',
    amount: 'text-emerald-400',
    sign: 'text-emerald-300/80',
  },
  negative: {
    card: 'border-rose-500/35 bg-rose-500/10',
    amount: 'text-rose-400',
    sign: 'text-rose-300/80',
  },
  zero: {
    card: 'border-slate-600/50 bg-slate-800/40',
    amount: 'text-slate-300',
    sign: 'text-slate-500',
  },
} as const;

function TotalTile({
  currency,
  total,
  compact,
}: {
  currency: Currency;
  total: number;
  compact?: boolean;
}) {
  const config = CURRENCIES.find(c => c.id === currency);
  if (!config) return null;

  const tone = balanceTone(total);
  const styles = TONE_STYLES[tone];
  const sign = total > 0 ? '+' : total < 0 ? '−' : '';
  const displayAmount = formatAmount(Math.abs(total), currency);

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${styles.card} ${compact ? 'py-2' : ''}`}>
      <p className={`font-medium text-slate-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {config.label}
      </p>
      <p className={`mt-0.5 tabular-nums font-bold leading-tight ${styles.amount} ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}>
        {sign && <span className={`mr-0.5 text-sm font-semibold ${styles.sign}`}>{sign}</span>}
        {displayAmount}
        <span className={`mr-1 font-semibold ${compact ? 'text-[11px]' : 'text-sm'}`}>
          {isWeightCurrency(currency) ? 'غرام' : config.symbol}
        </span>
      </p>
    </div>
  );
}

export function AccountsGrandTotalCard({
  summaries,
  title = 'المجموع العام',
  subtitle = 'مجموع أرصدة كل الحسابات — زبائن ومراكز معاً',
  compact = false,
}: Props) {
  const totals = sumSummariesByCurrency(summaries);
  const moneyTotals = totals.filter(row => !isWeightCurrency(row.currency));
  const weightTotals = totals.filter(row => isWeightCurrency(row.currency));

  if (totals.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-500">
        لا يوجد رصيد في الحسابات
      </div>
    );
  }

  return (
    <section className={`rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900/40 ${compact ? 'p-3' : 'p-4'}`}>
      <header className={compact ? 'mb-2' : 'mb-3'}>
        <h2 className={`font-semibold text-amber-300 ${compact ? 'text-sm' : 'text-base'}`}>{title}</h2>
        {!compact && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
      </header>

      {moneyTotals.length > 0 && (
        <div className={weightTotals.length > 0 ? 'mb-3' : undefined}>
          {!compact && <p className="mb-2 text-[11px] font-medium text-slate-400">العملات النقدية</p>}
          <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
            {moneyTotals.map(row => (
              <TotalTile key={row.currency} currency={row.currency} total={row.total} compact={compact} />
            ))}
          </div>
        </div>
      )}

      {weightTotals.length > 0 && (
        <div>
          {!compact && <p className="mb-2 text-[11px] font-medium text-slate-400">الذهب والفضة</p>}
          <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
            {weightTotals.map(row => (
              <TotalTile key={row.currency} currency={row.currency} total={row.total} compact={compact} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
