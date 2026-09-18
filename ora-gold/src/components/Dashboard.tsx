import { ArrowLeft, CheckCircle2, AlertTriangle, TrendingDown, TrendingUp, Scale } from 'lucide-react';
import { formatNumber } from '../lib/format';
import type { buildDashboardSummary } from '../lib/excelExport';

type Summary = ReturnType<typeof buildDashboardSummary>;

interface Props {
  summary: Summary;
  onSelectAccount: (id: string) => void;
}

function BalanceBadge({ value, compact = false }: { value: number; compact?: boolean }) {
  if (value === 0) {
    return <span className="num text-slate-500">{compact ? '—' : '0'}</span>;
  }
  const isNeg = value < 0;
  return (
    <span className={`num font-semibold ${isNeg ? 'text-rose-400' : 'text-emerald-400'}`}>
      {formatNumber(value)}
    </span>
  );
}

function AccountTable({
  title,
  subtitle,
  icon,
  accent,
  rows,
  totalGold,
  totalUsd,
  onSelect,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: 'emerald' | 'rose';
  rows: Summary['assets'];
  totalGold: number;
  totalUsd: number;
  onSelect: (id: string) => void;
}) {
  const border = accent === 'emerald' ? 'border-emerald-500/30' : 'border-rose-500/30';
  const headerBg = accent === 'emerald' ? 'from-emerald-950/40 to-slate-900/60' : 'from-rose-950/40 to-slate-900/60';
  const titleColor = accent === 'emerald' ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div className={`dashboard-panel border ${border}`}>
      <div className={`dashboard-panel-header bg-gradient-to-l ${headerBg}`}>
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className={`font-bold ${titleColor}`}>{title}</h3>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="dashboard-table w-full">
          <thead>
            <tr>
              <th className="text-right">الحساب</th>
              <th className="text-center w-28">ذهب 995</th>
              <th className="text-center w-32">دولار $</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.accountId} className="dashboard-row">
                <td>
                  <button
                    type="button"
                    className="account-link"
                    onClick={() => onSelect(row.accountId)}
                  >
                    <ArrowLeft className="account-link-arrow h-3.5 w-3.5 shrink-0" />
                    <span>{row.label}</span>
                  </button>
                </td>
                <td className="text-center"><BalanceBadge value={row.gold} compact /></td>
                <td className="text-center"><BalanceBadge value={row.usd} compact /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="dashboard-total">
              <td className="font-bold text-slate-200">المجموع</td>
              <td className="text-center"><BalanceBadge value={totalGold} /></td>
              <td className="text-center"><BalanceBadge value={totalUsd} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ReconcileCard({
  label,
  value,
  unit,
  balanced,
}: {
  label: string;
  value: number;
  unit: string;
  balanced: boolean;
}) {
  return (
    <div className={`reconcile-card ${balanced ? 'reconcile-ok' : 'reconcile-warn'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400 mb-1">{label}</p>
          <p className="num text-2xl font-bold">{formatNumber(value, unit === 'غ' ? 4 : 2)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{unit}</p>
        </div>
        <div className={`reconcile-icon ${balanced ? 'text-emerald-400' : 'text-amber-400'}`}>
          {balanced ? <CheckCircle2 className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
        </div>
      </div>
      <p className={`mt-3 text-sm font-medium ${balanced ? 'text-emerald-400' : 'text-amber-400'}`}>
        {balanced ? '✓ متوازن' : '⚠ يحتاج مراجعة'}
      </p>
    </div>
  );
}

export function Dashboard({ summary, onSelectAccount }: Props) {
  const goldBalanced = Math.abs(summary.goldDiff) < 0.01;
  const usdBalanced = Math.abs(summary.usdDiff) < 0.01;

  return (
    <div className="space-y-5">
      {/* بطاقات الملخص العلوية */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="summary-stat">
          <p className="summary-stat-label">إجمالي الأصول — ذهب</p>
          <p className="summary-stat-value num text-emerald-400">{formatNumber(summary.totalAssets.gold, 2)}</p>
          <p className="summary-stat-unit">غرام 995</p>
        </div>
        <div className="summary-stat">
          <p className="summary-stat-label">إجمالي الأصول — دولار</p>
          <p className="summary-stat-value num text-emerald-400">{formatNumber(summary.totalAssets.usd)}</p>
          <p className="summary-stat-unit">USD</p>
        </div>
        <div className="summary-stat">
          <p className="summary-stat-label">إجمالي الالتزامات — ذهب</p>
          <p className="summary-stat-value num text-rose-400">{formatNumber(summary.totalLiab.gold, 2)}</p>
          <p className="summary-stat-unit">غرام 995</p>
        </div>
        <div className="summary-stat">
          <p className="summary-stat-label">إجمالي الالتزامات — دولار</p>
          <p className="summary-stat-value num text-rose-400">{formatNumber(summary.totalLiab.usd)}</p>
          <p className="summary-stat-unit">USD</p>
        </div>
      </div>

      {/* عنوان الصفحة */}
      <div className="flex items-center gap-3 px-1">
        <div className="dashboard-title-icon">
          <Scale className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-amber-400">حسابات الورشة</h2>
          <p className="text-sm text-slate-400">ملخص الأصول والالتزامات — المجموع يجب أن يتوازن</p>
        </div>
      </div>

      {/* جدولان منفصلان: أصول | التزامات */}
      <div className="grid lg:grid-cols-2 gap-5">
        <AccountTable
          title="الأصول"
          subtitle="ما للورشة"
          icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
          accent="emerald"
          rows={summary.assets}
          totalGold={summary.totalAssets.gold}
          totalUsd={summary.totalAssets.usd}
          onSelect={onSelectAccount}
        />
        <AccountTable
          title="الالتزامات"
          subtitle="ما على الورشة"
          icon={<TrendingDown className="h-5 w-5 text-rose-400" />}
          accent="rose"
          rows={summary.liabilities}
          totalGold={summary.totalLiab.gold}
          totalUsd={summary.totalLiab.usd}
          onSelect={onSelectAccount}
        />
      </div>

      {/* فحص التوازن */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Scale className="h-4 w-4 text-amber-400" />
          فحص التوازن
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <ReconcileCard
            label="الفرق — ذهب"
            value={summary.goldDiff}
            unit="غرام 995"
            balanced={goldBalanced}
          />
          <ReconcileCard
            label="الفرق — دولار"
            value={summary.usdDiff}
            unit="USD"
            balanced={usdBalanced}
          />
        </div>
      </div>
    </div>
  );
}
