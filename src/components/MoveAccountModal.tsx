import { ArrowRightLeft, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getFund } from '../config';
import { inferAccountTransactionFund } from '../lib/utils';
import type { Customer, CustomerSummary, Fund, FundId, Transaction } from '../types';

interface Props {
  summary: CustomerSummary;
  customer?: Customer;
  transactions: Transaction[];
  transferFundOptions: Fund[];
  onClose: () => void;
  onMove: (
    accountName: string,
    toFundId: FundId,
    opts?: { fromFundId?: FundId; customerId?: string; accountNumber?: string },
  ) => void | Promise<void>;
  nameTaken?: (name: string, fundId: FundId) => boolean;
}

export function MoveAccountModal({
  summary,
  customer,
  transactions,
  transferFundOptions,
  onClose,
  onMove,
  nameTaken,
}: Props) {
  const fromFundId = useMemo(
    () => inferAccountTransactionFund(transactions, summary.name, customer?.fundId ?? summary.fundId),
    [transactions, summary.name, customer?.fundId, summary.fundId],
  );
  const [toFundId, setToFundId] = useState<FundId>(() => {
    const other = transferFundOptions.find(f => f.id !== fromFundId);
    return other?.id ?? fromFundId;
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const targetOptions = transferFundOptions.filter(f => f.id !== fromFundId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (toFundId === fromFundId) {
      setError('اختر قسماً مختلفاً عن المصدر');
      return;
    }
    if (nameTaken?.(summary.name, toFundId)) {
      setError('في حساب بنفس الاسم في القسم المحدد');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await Promise.resolve(onMove(summary.name, toFundId, {
        fromFundId,
        customerId: customer?.id,
        accountNumber: summary.accountNumber,
      }));
      onClose();
    } catch {
      setError('فشل النقل — تحقق من الاتصال وحاول مجدداً');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-4 shadow-xl space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400">
            <ArrowRightLeft size={16} />
            <h3 className="font-semibold">نقل الحساب</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-200">
          {summary.name}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2">
            <p className="text-slate-500">من</p>
            <p className="mt-1 font-medium text-slate-200">{getFund(fromFundId).name}</p>
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-slate-500">نقل إلى</label>
            <select
              value={toFundId}
              onChange={e => {
                setToFundId(e.target.value as FundId);
                setError('');
              }}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs"
            >
              {targetOptions.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-[10px] text-amber-400/90">
          تُنقل كل حركات الحساب من {getFund(fromFundId).name} إلى القسم المحدد
        </p>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={saving || targetOptions.length === 0}
          className="w-full rounded-xl bg-cyan-600 py-2.5 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {saving ? 'جاري النقل...' : 'نقل الحساب'}
        </button>
      </form>
    </div>
  );
}
