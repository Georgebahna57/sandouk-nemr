import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { previewAccountReset } from '../lib/accountReset';
import type { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  onReset: () => Promise<void>;
}

export function AccountResetSection({ transactions, onReset }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const preview = useMemo(() => previewAccountReset(transactions), [transactions]);

  async function handleReset() {
    setBusy(true);
    setError(null);
    try {
      await onReset();
      setConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تصفير الحسابات');
    } finally {
      setBusy(false);
    }
  }

  if (!preview.transactionCount) {
    return (
      <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <p className="font-medium text-slate-300">تصفير أرصدة الحسابات</p>
        <p className="mt-1 text-xs text-slate-500">لا توجد حركات حساب — الأرصدة صفر بالفعل</p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
      <div className="mb-3 flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-400" />
        <div>
          <p className="font-medium text-slate-200">تصفير أرصدة الحسابات</p>
          <p className="mt-1 text-xs text-slate-500">
            يحذف كل حركات الحسابات (مراكز + زبائن) ويُبقي حركات الصناديق كما هي — لتعبئة الأرصدة من جديد
          </p>
        </div>
      </div>

      <div className="mb-3 rounded-xl bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
        <p>{preview.transactionCount.toLocaleString('ar-LB')} حركة حساب</p>
        <p className="mt-1">{preview.accountNames.length.toLocaleString('ar-LB')} حساب</p>
      </div>

      {error && (
        <p className="mb-3 text-xs text-rose-400">{error}</p>
      )}

      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/10"
        >
          <Trash2 size={14} />
          تصفير كل أرصدة الحسابات
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-rose-300">
            ⚠️ هذا الإجراء لا يُرجَع — ستُحذف كل حركات الحسابات. حركات الصناديق تبقى.
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
              onClick={handleReset}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              تأكيد التصفير
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
