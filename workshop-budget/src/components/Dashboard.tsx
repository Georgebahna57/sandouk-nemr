import { formatNumber } from '../lib/format';
import type { buildDashboardSummary } from '../lib/excelExport';

type Summary = ReturnType<typeof buildDashboardSummary>;

interface Props {
  summary: Summary;
  onSelectAccount: (id: string) => void;
}

function BalanceCell({ value }: { value: number }) {
  const cls = value < 0 ? 'num num-neg' : value > 0 ? 'num num-pos' : 'num';
  return <td className={cls}>{formatNumber(value)}</td>;
}

export function Dashboard({ summary, onSelectAccount }: Props) {
  const maxRows = Math.max(summary.assets.length, summary.liabilities.length);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-700 bg-slate-800/50 px-4 py-3">
        <h2 className="text-lg font-bold text-amber-400">حسابات الورشة — معمل الذهب</h2>
        <p className="text-xs text-slate-400 mt-1">ملخص الأصول والالتزامات — يجب أن يتوازن المجموع</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-ledger">
          <thead>
            <tr>
              <th className="w-[22%]">الحساب (أصول)</th>
              <th>ذهب 995</th>
              <th>دولار</th>
              <th className="w-4" />
              <th className="w-[22%]">الحساب (التزامات)</th>
              <th>ذهب 995</th>
              <th>دولار</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }).map((_, i) => {
              const asset = summary.assets[i];
              const liab = summary.liabilities[i];
              return (
                <tr key={i}>
                  {asset ? (
                    <>
                      <td>
                        <button type="button" className="text-amber-300 hover:underline text-right w-full" onClick={() => onSelectAccount(asset.accountId)}>
                          {asset.label}
                        </button>
                      </td>
                      <BalanceCell value={asset.gold} />
                      <BalanceCell value={asset.usd} />
                    </>
                  ) : (
                    <><td /><td /><td /></>
                  )}
                  <td />
                  {liab ? (
                    <>
                      <td>
                        <button type="button" className="text-amber-300 hover:underline text-right w-full" onClick={() => onSelectAccount(liab.accountId)}>
                          {liab.label}
                        </button>
                      </td>
                      <BalanceCell value={liab.gold} />
                      <BalanceCell value={liab.usd} />
                    </>
                  ) : (
                    <><td /><td /><td /></>
                  )}
                </tr>
              );
            })}
            <tr className="bg-slate-800/60 font-bold">
              <td>المجموع</td>
              <BalanceCell value={summary.totalAssets.gold} />
              <BalanceCell value={summary.totalAssets.usd} />
              <td />
              <td>المجموع</td>
              <BalanceCell value={summary.totalLiab.gold} />
              <BalanceCell value={summary.totalLiab.usd} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-slate-700 p-4 text-sm">
        <div className={`rounded-lg p-3 ${Math.abs(summary.goldDiff) < 0.01 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
          <span className="text-slate-400">الفرق ذهب: </span>
          <span className="num font-bold">{formatNumber(summary.goldDiff, 4)}</span>
          {Math.abs(summary.goldDiff) < 0.01 ? ' ✓ متوازن' : ' ⚠ غير متوازن'}
        </div>
        <div className={`rounded-lg p-3 ${Math.abs(summary.usdDiff) < 0.01 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
          <span className="text-slate-400">الفرق دولار: </span>
          <span className="num font-bold">{formatNumber(summary.usdDiff)}</span>
          {Math.abs(summary.usdDiff) < 0.01 ? ' ✓ متوازن' : ' ⚠ غير متوازن'}
        </div>
      </div>
    </div>
  );
}
