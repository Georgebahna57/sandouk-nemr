import { Loader2, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  buildNemrBalanceRestoreTransactions,
  formatNemrRestoreDelta,
  previewNemrBalanceRestore,
} from '../lib/nemrBalanceRestore';
import { formatValueWithUnit, todayIso } from '../lib/utils';
import type { AppState, Transaction } from '../types';

interface Props {
  appState: AppState;
  onRestore: (tx: Transaction[]) => void | Promise<void>;
}

export function NemrBalanceRestoreSection({ appState, onRestore }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const preview = useMemo(
    () => previewNemrBalanceRestore(appState.transactions),
    [appState.transactions],
  );

  const restoreTxs = useMemo(
    () => buildNemrBalanceRestoreTransactions(appState.transactions, todayIso()),
    [appState.transactions],
  );

  async function submit() {
    setError(null);
    setSuccess(null);
    if (!restoreTxs.length) {
      setError('الرصيد الحالي يطابق المرجع — لا حاجة لحركة');
      return;
    }
    setBusy(true);
    try {
      await onRestore(restoreTxs);
      setSuccess(`تم تسجيل ${restoreTxs.length} حركة استعادة لصندوق نمر`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الاستعادة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <RotateCcw size={18} className="text-amber-400" />
        <div>
          <p className="font-medium text-slate-200">استعادة رصيد صندوق نمر</p>
          <p className="text-xs text-slate-500">
            الرصيد المرجعي قبل آخر تعديل — يُسجَّل فرق التصحيح فقط
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/50">
        <table className="w-full min-w-[320px] text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="py-2 pr-3 text-right font-medium">عملة</th>
              <th className="py-2 px-2 text-right font-medium">الحالي</th>
              <th className="py-2 px-2 text-right font-medium">المطلوب</th>
              <th className="py-2 pl-3 text-right font-medium">الفرق</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            <tr className="border-t border-slate-800">
              <td className="py-2 pr-3">دولار</td>
              <td className="py-2 px-2 tabular-nums">{formatValueWithUnit(preview.currentUsd, 'USD')}</td>
              <td className="py-2 px-2 tabular-nums text-amber-300">{formatValueWithUnit(preview.targetUsd, 'USD')}</td>
              <td className="py-2 pl-3 tabular-nums">{formatNemrRestoreDelta('USD', preview.deltaUsd)}</td>
            </tr>
            <tr className="border-t border-slate-800">
              <td className="py-2 pr-3">يورو</td>
              <td className="py-2 px-2 tabular-nums">{formatValueWithUnit(preview.currentEur, 'EUR')}</td>
              <td className="py-2 px-2 tabular-nums text-amber-300">{formatValueWithUnit(preview.targetEur, 'EUR')}</td>
              <td className="py-2 pl-3 tabular-nums">{formatNemrRestoreDelta('EUR', preview.deltaEur)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {restoreTxs.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-400 space-y-1">
          <p className="font-medium text-slate-300">سيُسجَّل:</p>
          {restoreTxs.map(tx => (
            <p key={tx.id}>
              {tx.kind === 'receipt' ? 'وارد' : 'صادر'}{' '}
              {formatValueWithUnit(tx.amount, tx.currency)}
            </p>
          ))}
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
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
        {preview.needsRestore ? 'استعادة الرصيد الآن' : 'الرصيد مطابق — لا حاجة لإجراء'}
      </button>
    </div>
  );
}
