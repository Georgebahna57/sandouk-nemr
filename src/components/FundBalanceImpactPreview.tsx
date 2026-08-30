import { getFund } from '../config';
import {
  formatFundBalanceImpactLine,
  type FundBalanceImpact,
} from '../lib/fundBalancePreview';
import { formatNemrRestoreDelta, NEMR_REFERENCE_BALANCES } from '../lib/nemrBalanceRestore';

interface Props {
  impact: FundBalanceImpact | null;
}

export function FundBalanceImpactPreview({ impact }: Props) {
  if (!impact) return null;

  const fund = getFund(impact.fundId);
  const changed = impact.currencies.filter(
    c => Math.abs(impact.before[c].balance - impact.after[c].balance) > 1e-9,
  );
  const displayCurrencies = changed.length > 0 ? changed : impact.currencies;

  const nemrAfterRef = impact.fundId === 'nemr' ? {
    deltaUsd: NEMR_REFERENCE_BALANCES.USD - impact.after.USD.balance,
    deltaEur: NEMR_REFERENCE_BALANCES.EUR - impact.after.EUR.balance,
  } : null;

  return (
    <div
      className="rounded-xl border px-3 py-2.5 text-xs space-y-1.5"
      style={{ borderColor: `${fund.accent}44`, background: `${fund.accent}0d` }}
    >
      <p className="font-medium" style={{ color: fund.accent }}>
        تأثير التعديل على رصيد {fund.shortName}
      </p>
      {displayCurrencies.length > 0 ? displayCurrencies.map(currency => (
        <p key={currency} className="text-slate-300 tabular-nums">
          {formatFundBalanceImpactLine(
            currency,
            impact.before[currency].balance,
            impact.after[currency].balance,
          )}
        </p>
      )) : (
        <p className="text-slate-500">لا تغيير متوقّع على رصيد الصندوق</p>
      )}
      {nemrAfterRef && (
        <div className="mt-1 border-t border-slate-700/60 pt-1.5 text-slate-500">
          <p>مقارنة بالمرجع (قبل آخر تعديل):</p>
          <p>دولار: {formatNemrRestoreDelta('USD', nemrAfterRef.deltaUsd)}</p>
          <p>يورو: {formatNemrRestoreDelta('EUR', nemrAfterRef.deltaEur)}</p>
        </div>
      )}
    </div>
  );
}
