import { ArrowRightLeft, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ACCOUNT_BRANCH_LABELS,
  accountExistsInBranch,
  inferAccountBranch,
} from '../lib/accountBranch';
import type { AccountBranchId, Customer, CustomerSummary, Transaction } from '../types';

interface Props {
  summary: CustomerSummary;
  customer?: Customer;
  customers: Customer[];
  transactions: Transaction[];
  onClose: () => void;
  onMove: (
    accountName: string,
    toBranch: AccountBranchId,
    opts?: { customerId?: string; accountNumber?: string },
  ) => void | Promise<void>;
}

export function MoveAccountModal({
  summary,
  customer,
  customers,
  transactions,
  onClose,
  onMove,
}: Props) {
  const fromBranch = useMemo(
    () => inferAccountBranch(transactions, summary.name, customer),
    [transactions, summary.name, customer],
  );
  const [toBranch, setToBranch] = useState<AccountBranchId>(
    fromBranch === 'centers' ? 'customers' : 'centers',
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const targetOptions: AccountBranchId[] = fromBranch === 'centers'
    ? ['customers']
    : ['centers'];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (toBranch === fromBranch) {
      setError('اختر قسماً مختلفاً');
      return;
    }
    if (accountExistsInBranch(customers, toBranch, summary.name, customer?.id)) {
      setError('في حساب بنفس الاسم في هذا القسم');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await Promise.resolve(onMove(summary.name, toBranch, {
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
            <p className="mt-1 font-medium text-slate-200">{ACCOUNT_BRANCH_LABELS[fromBranch]}</p>
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-slate-500">نقل إلى</label>
            <select
              value={toBranch}
              onChange={e => {
                setToBranch(e.target.value as AccountBranchId);
                setError('');
              }}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs"
            >
              {targetOptions.map(b => (
                <option key={b} value={b}>{ACCOUNT_BRANCH_LABELS[b]}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-[10px] text-amber-400/90">
          النقل بين المراكز والزبائن فقط — تُنقل كل حركات الحساب
        </p>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={saving || toBranch === fromBranch}
          className="w-full rounded-xl bg-cyan-600 py-2.5 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {saving ? 'جاري النقل...' : 'نقل الحساب'}
        </button>
      </form>
    </div>
  );
}
