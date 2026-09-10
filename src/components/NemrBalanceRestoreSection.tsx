import { Loader2, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  buildNemrBalanceRestorePlan,
  formatNemrRestoreDelta,
  NEMR_REFERENCE_BALANCES,
  NEMR_REFERENCE_LABEL,
  nemrRestorePlanNeeded,
  previewNemrBalanceRestore,
  type NemrBalanceRestorePlan,
} from '../lib/nemrBalanceRestore';
import { formatValueWithUnit } from '../lib/utils';
import type { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  onRestore: (plan: NemrBalanceRestorePlan) => void | Promise<void>;
  /** عرض مضغوط داخل نافذة التفاصيل */
  compact?: boolean;
}

export function NemrBalanceRestoreSection({
  transactions,
  onRestore,
  compact = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const preview = useMemo(
    () => previewNemrBalanceRestore(transactions),
    [transactions],
  );

  const plan = useMemo(
    () => buildNemrBalanceRestorePlan(transactions),
    [transactions],
  );

  async function submit() {
    setError(null);
    setSuccess(null);
    if (!nemrRestorePlanNeeded(plan)) {
      setError('الرصيد الحالي يطابق المرجع — لا حاجة لحركة');
      return;
    }
    setBusy(true);
    try {
      await onRestore(plan);
      const parts: string[] = [];
      if (plan.removeIds.length) parts.push(`حذف ${plan.removeIds.length} تصحيح قديم`);
      if (plan.add.length) parts.push(`إضافة ${plan.add.length} حركة`);
      setSuccess(parts.length ? `تم: ${parts.join(' · ')}` : 'تم ضبط الرصيد');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الاستعادة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-2xl border border-amber-500/40 bg-amber-500/5 ${compact ? 'p-3' : 'mb-4 p-4'}`}>
      <div className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <RotateCcw size={compact ? 16 : 18} className="text-amber-400 shrink-0" />
        <div>
          <p className={`font-medium text-slate-200 ${compact ? 'text-sm' : ''}`}>
            استعادة رصيد صندوق نمر
          </p>
          <p className="text-xs text-slate-500">
            يصحّح رصيد {NEMR_REFERENCE_LABEL} فقط — عمليات ما بعده (مثل اليوم) لا تُمس
          </p>
          <p className="text-xs text-slate-500">
            المرجع: {NEMR_REFERENCE_BALANCES.USD.toLocaleString('en-US')} $ و{' '}
            {NEMR_REFERENCE_BALANCES.EUR.toLocaleString('en-US')} €
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/50">
        <table className="w-full min-w-[280px] text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="py-2 pr-3 text-right font-medium">عملة</th>
              <th className="py-2 px-2 text-right font-medium">الافتتاح</th>
              <th className="py-2 px-2 text-right font-medium">المرجع</th>
              <th className="py-2 pl-3 text-right font-medium">الفرق</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            <tr className="border-t border-slate-800">
              <td className="py-2 pr-3">دولار</td>
              <td className="py-2 px-2 tabular-nums">{formatValueWithUnit(preview.closingUsd, 'USD')}</td>
              <td className="py-2 px-2 tabular-nums text-amber-300">{formatValueWithUnit(preview.targetUsd, 'USD')}</td>
              <td className="py-2 pl-3 tabular-nums">{formatNemrRestoreDelta('USD', preview.deltaUsd)}</td>
            </tr>
            <tr className="border-t border-slate-800">
              <td className="py-2 pr-3">يورو</td>
              <td className="py-2 px-2 tabular-nums">{formatValueWithUnit(preview.closingEur, 'EUR')}</td>
              <td className="py-2 px-2 tabular-nums text-amber-300">{formatValueWithUnit(preview.targetEur, 'EUR')}</td>
              <td className="py-2 pl-3 tabular-nums">{formatNemrRestoreDelta('EUR', preview.deltaEur)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 rounded-xl border border-slate-700/80 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
        <p className="font-medium text-slate-300">الرصيد الكلي الحالي (بعد عمليات اليوم)</p>
        <p className="mt-1 tabular-nums">
          {formatValueWithUnit(preview.totalUsd, 'USD')} · {formatValueWithUnit(preview.totalEur, 'EUR')}
        </p>
      </div>

      {!compact && nemrRestorePlanNeeded(plan) && (
        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-400 space-y-1">
          <p className="font-medium text-slate-300">سيُنفَّذ:</p>
          {plan.removeIds.length > 0 && (
            <p>حذف {plan.removeIds.length} حركة استعادة قديمة (تصحيح مكرّر)</p>
          )}
          {plan.add.map(tx => (
            <p key={tx.id}>
              {tx.kind === 'receipt' ? 'وارد' : 'صادر'}{' '}
              {formatValueWithUnit(tx.amount, tx.currency)}
            </p>
          ))}
          {plan.removeIds.length > 0 && plan.add.length === 0 && (
            <p className="text-emerald-400/90">الرصيد الأساسي مطابق — يكفي حذف التصحيحات القديمة</p>
          )}
        </div>
      )}

      {(error || success) && (
        <p className={`mt-3 text-xs ${error ? 'text-rose-400' : 'text-emerald-400'}`}>
          {error ?? success}
        </p>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !preview.needsRestore}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 font-medium text-white hover:bg-amber-500 disabled:opacity-50 ${compact ? 'py-2 text-xs' : 'py-2.5 text-sm'}`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
        {preview.needsRestore ? 'استعادة الرصيد الآن' : 'الرصيد مطابق — لا حاجة لإجراء'}
      </button>
    </div>
  );
}
