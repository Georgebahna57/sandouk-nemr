import { FUNDS } from '../config';
import { computeBalances, formatValueWithUnit, getFundTransactionStats } from '../lib/utils';
import type { AppState } from '../types';

interface Props {
  appState: AppState;
}

function sideLabel(balance: number): string {
  if (balance > 0) return 'لنا';
  if (balance < 0) return 'لهم';
  return 'متعادل';
}

export function FundDataDiagnostic({ appState }: Props) {
  const rows = FUNDS.map(fund => ({
    fund,
    stats: getFundTransactionStats(appState.transactions, fund.id),
  }));

  const halab = rows.find(r => r.fund.id === 'halabFleilat');
  const halabBalances = halab ? computeBalances(appState.transactions, 'halabFleilat') : null;
  const halabHidden = halab
    ? halab.stats.fundLedger - halab.stats.visibleFundLedger
    : 0;

  return (
    <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
      <p className="mb-2 font-medium text-rose-200">تشخيص البيانات — كل الصناديق</p>
      <p className="mb-3 text-[10px] text-slate-500">
        إذا «المخزّن» أكبر من «الظاهر»، الحركات موجودة لكن كانت مخفية — يُصلَح تلقائياً عند التحميل.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="py-1 pr-2 font-medium">الصندوق</th>
              <th className="py-1 px-1 font-medium">المخزّن</th>
              <th className="py-1 px-1 font-medium">صندوق</th>
              <th className="py-1 px-1 font-medium">حساب</th>
              <th className="py-1 px-1 font-medium">انتظار</th>
              <th className="py-1 px-1 font-medium">ظاهر</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ fund, stats }) => (
              <tr key={fund.id} className="border-t border-slate-800/80 text-slate-300">
                <td className="py-1.5 pr-2 font-medium">{fund.shortName}</td>
                <td className="py-1.5 px-1 tabular-nums">{stats.total}</td>
                <td className="py-1.5 px-1 tabular-nums">{stats.fundLedger}</td>
                <td className="py-1.5 px-1 tabular-nums">{stats.accountLedger}</td>
                <td className="py-1.5 px-1 tabular-nums">{stats.pending}</td>
                <td className="py-1.5 px-1 tabular-nums">{stats.visibleFundLedger}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {halab && halab.stats.total === 0 && (
        <p className="mt-3 text-xs text-rose-300">
          لا توجد أي حركة مخزّنة لـ حلب - الفيلات في قاعدة البيانات. راجع Supabase → Table Editor → transactions
          أو استعد نسخة احتياطية.
        </p>
      )}
      {halabHidden > 0 && (
        <p className="mt-3 text-xs text-amber-300">
          وُجد {halabHidden} حركة صندوق لحلب كانت مخفية — يفترض أن تظهر بعد التحديث.
        </p>
      )}
      {halabBalances && (halabBalances.SYP.balance !== 0 || halabBalances.USD.balance !== 0) && (
        <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-slate-300">
          <p className="mb-1 font-medium text-sky-200">أرصدة حلب (المنطق الجديد)</p>
          {halabBalances.SYP.balance !== 0 && (
            <p>
              سوري: {formatValueWithUnit(Math.abs(halabBalances.SYP.balance), 'SYP')} · {sideLabel(halabBalances.SYP.balance)}
            </p>
          )}
          {halabBalances.USD.balance !== 0 && (
            <p>
              دولار: {formatValueWithUnit(Math.abs(halabBalances.USD.balance), 'USD')} · {sideLabel(halabBalances.USD.balance)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
