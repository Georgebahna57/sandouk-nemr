import { Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { CENTERS_FUND_ID, canRegisterCustomerName } from '../config';
import type { AccountBranchId, Customer, Fund, FundId } from '../types';
import { createCustomer } from '../lib/utils';

interface Props {
  customer?: Customer;
  defaultName: string;
  fundId: FundId;
  accountBranch: AccountBranchId;
  customersLedgerFundId: FundId;
  fundOptions?: Fund[];
  onClose: () => void;
  onAddCustomer?: (customer: Customer) => void | Promise<void>;
  onUpdateCustomer?: (customer: Customer, previousName: string) => void | Promise<void>;
  nameTaken?: (name: string, fundId: FundId) => boolean;
}

export function TrialBalanceAccountModal({
  customer,
  defaultName,
  accountBranch,
  customersLedgerFundId,
  onClose,
  onAddCustomer,
  onUpdateCustomer,
  nameTaken,
}: Props) {
  const isRegister = !customer;
  const [name, setName] = useState(customer?.name ?? defaultName);
  const [accountNumber, setAccountNumber] = useState(customer?.accountNumber ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const targetFundId =
    customer?.fundId ?? (accountBranch === 'centers' ? CENTERS_FUND_ID : customersLedgerFundId);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!canRegisterCustomerName(trimmed, isRegister ? targetFundId : customer!.fundId)) {
      setError('هالاسم محجوز لحساب الصندوق');
      return;
    }
    const checkFund = isRegister ? targetFundId : customer!.fundId;
    if (trimmed !== (customer?.name ?? defaultName) && nameTaken?.(trimmed, checkFund)) {
      setError('في حساب بنفس الاسم');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (customer && onUpdateCustomer) {
        await onUpdateCustomer({
          ...customer,
          name: trimmed,
          accountNumber: accountNumber.trim() || undefined,
          phone: phone.trim() || undefined,
          sharedFundIds: undefined,
        }, customer.name);
      } else if (onAddCustomer) {
        const newCustomer = createCustomer({
          fundId: targetFundId,
          name: trimmed,
          accountNumber: accountNumber.trim() || undefined,
          phone: phone.trim() || undefined,
          accountBranch,
        });
        await onAddCustomer(newCustomer);
        if (trimmed !== defaultName.trim() && onUpdateCustomer) {
          await onUpdateCustomer(newCustomer, defaultName.trim());
        }
      }
      onClose();
    } catch {
      setError('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-4 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400">
            <Pencil size={16} />
            <h3 className="font-semibold">
              {isRegister ? 'تسجيل حساب' : 'تعديل الحساب'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {isRegister && (
          <p className="text-xs text-slate-500">
            يُسجّل الحساب ضمن {accountBranch === 'centers' ? 'المراكز' : 'الزبائن'}
          </p>
        )}

        <input
          type="text"
          placeholder="اسم الحساب"
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm"
          required
        />
        <input
          type="text"
          placeholder="رقم الحساب (مثل 4011-1114)"
          value={accountNumber}
          onChange={e => setAccountNumber(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm"
          dir="ltr"
        />
        <input
          type="text"
          placeholder="واتساب (اختياري)"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm"
          dir="ltr"
        />
        {!isRegister && (
          <p className="text-[10px] text-slate-500">
            لنقل بين المراكز والزبائن استخدم زر «نقل»
          </p>
        )}
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-60"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
      </form>
    </div>
  );
}
