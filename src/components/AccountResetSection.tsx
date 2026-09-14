import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { previewAccountReset, type AccountResetResult } from '../lib/accountReset';
import type { Customer, Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  customers: Customer[];
  onReset: () => Promise<AccountResetResult>;
}

export function AccountResetSection({ transactions, customers, onReset }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const preview = useMemo(
    () => previewAccountReset(transactions, customers),
    [transactions, customers],
  );

  const hasWork = preview.transactionCount > 0 || preview.customerCount > 0;

  async function handleReset() {
    setBusy(true);
    setError(null);
    try {
      const result = await onReset();
      setConfirm(false);
      if (!result.removedTransactions && !result.removedCustomers) {
        setSuccess('لا توجد حسابات للحذف');
        return;
      }
      const parts: string[] = [];
      if (result.removedCustomers) {
        parts.push(`${result.removedCustomers.toLocaleString('ar-LB')} حساب`);
      }
      if (result.removedTransactions) {
        parts.push(`${result.removedTransactions.toLocaleString('ar-LB')} حركة`);
      }
      setSuccess(`تم الحذف: ${parts.join(' · ')} — حركات الصناديق لم تُمس`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حذف الحسابات');
    } finally {
      setBusy(false);
    }
  }

  if (!hasWork) {
    return (
      <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <p className="font-medium text-slate-300">حذف جميع الحسابات</p>
        <p className="mt-1 text-xs text-slate-500">لا توجد حسابات مسجّلة — القائمة فارغة</p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
      <div className="mb-3 flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-400" />
        <div>
          <p className="font-medium text-slate-200">حذف جميع الحسابات</p>
          <p className="mt-1 text-xs text-slate-500">
            يحذف كل الحسابات (زبائن + مراكز + داخل كل الصناديق) وكل حركاتها — حركات الصناديق تبقى
          </p>
        </div>
      </div>

      <div className="mb-3 rounded-xl bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
        <p>{preview.customerCount.toLocaleString('ar-LB')} حساب مسجّل</p>
        <p className="mt-1">{preview.transactionCount.toLocaleString('ar-LB')} حركة حساب</p>
      </div>

      {error && (
        <p className="mb-3 text-xs text-rose-400">{error}</p>
      )}
      {success && (
        <p className="mb-3 text-xs text-emerald-400">{success}</p>
      )}

      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/10"
        >
          <Trash2 size={14} />
          حذف جميع الحسابات
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-rose-300">
            ⚠️ لا يُرجَع — سيُحذف {preview.customerCount} حساب و{preview.transactionCount} حركة. صناديق نمر/زلقا/جورج/مراكز تبقى.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              disabled={busy}
              className="flex-1 rounded-xl border border-slate-600 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-60"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              تأكيد الحذف
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
