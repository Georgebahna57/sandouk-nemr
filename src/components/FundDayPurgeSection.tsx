import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BOX_FUNDS } from '../config';
import { previewFundDayPurge } from '../lib/fundDayPurge';
import { todayIso } from '../lib/utils';
import type { FundId, Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  onPurge: (fundId: FundId, date: string) => Promise<number>;
}

export function FundDayPurgeSection({ transactions, onPurge }: Props) {
  const [fundId, setFundId] = useState<FundId>('nemr');
  const [date, setDate] = useState(todayIso());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const preview = useMemo(
    () => previewFundDayPurge(transactions, fundId, date),
    [transactions, fundId, date],
  );

  async function handlePurge() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const removed = await onPurge(fundId, date);
      setConfirm(false);
      setSuccess(removed > 0
        ? `تم حذف ${removed.toLocaleString('ar-LB')} حركة (صندوق + المربوطة)`
        : 'لا توجد حركات صندوق في هذا اليوم');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحذف');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4">
      <div className="mb-3 flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-orange-400" />
        <div>
          <p className="font-medium text-slate-200">حذف حركات صندوق ليوم محدد</p>
          <p className="mt-1 text-xs text-slate-500">
            يحذف حركات الصندوق في اليوم المختار والحركات المربوطة بها — حركات الحساب بدون ترحيل (حساب فقط) لا تُمس
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={fundId}
          onChange={e => setFundId(e.target.value as FundId)}
          className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
        >
          {BOX_FUNDS.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
        />
      </div>

      <div className="mb-3 rounded-xl bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
        <p>{preview.fundLedgerCount.toLocaleString('ar-LB')} حركة صندوق</p>
        <p className="mt-1">
          إجمالي الحذف: {preview.totalRemovalCount.toLocaleString('ar-LB')} حركة
          {preview.linkedAccountCount > 0 && (
            <span> (يشمل {preview.linkedAccountCount.toLocaleString('ar-LB')} حركة حساب مربوطة)</span>
          )}
        </p>
      </div>

      {error && <p className="mb-3 text-xs text-rose-400">{error}</p>}
      {success && <p className="mb-3 text-xs text-emerald-400">{success}</p>}

      {!preview.fundLedgerCount ? (
        <p className="text-xs text-slate-500">لا توجد حركات صندوق في هذا اليوم</p>
      ) : !confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-500/40 py-2 text-sm font-medium text-orange-300 hover:bg-orange-500/10"
        >
          <Trash2 size={14} />
          حذف حركات {BOX_FUNDS.find(f => f.id === fundId)?.shortName ?? fundId} — {date}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-orange-300">
            ⚠️ سيتم حذف {preview.totalRemovalCount} حركة — لا يمكن التراجع
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePurge()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            تأكيد الحذف
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="w-full rounded-xl border border-slate-600 py-2 text-xs text-slate-400"
          >
            إلغاء
          </button>
        </div>
      )}
    </div>
  );
}
