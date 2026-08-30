import { Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { BOX_FUNDS, canRegisterCustomerName, getFund } from '../config';
import type { Customer, Fund, FundId } from '../types';
import { createCustomer } from '../lib/utils';
import { SharedFundIdsField } from './SharedFundIdsField';

interface Props {
  customer?: Customer;
  defaultName: string;
  fundId: FundId;
  fundOptions?: Fund[];
  transferFundOptions?: Fund[];
  onClose: () => void;
  onAddCustomer?: (customer: Customer) => void | Promise<void>;
  onUpdateCustomer?: (customer: Customer, previousName: string) => void | Promise<void>;
  nameTaken?: (name: string, fundId: FundId) => boolean;
}

export function TrialBalanceAccountModal({
  customer,
  defaultName,
  fundId,
  fundOptions = BOX_FUNDS,
  transferFundOptions,
  onClose,
  onAddCustomer,
  onUpdateCustomer,
  nameTaken,
}: Props) {
  const isRegister = !customer;
  const [name, setName] = useState(customer?.name ?? defaultName);
  const [accountNumber, setAccountNumber] = useState(customer?.accountNumber ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [targetFundId, setTargetFundId] = useState<FundId>(customer?.fundId ?? fundId);
  const [sharedFundIds, setSharedFundIds] = useState<FundId[]>(customer?.sharedFundIds ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const moveOptions = transferFundOptions ?? fundOptions;
  const fundChanged = customer && targetFundId !== customer.fundId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!canRegisterCustomerName(trimmed, targetFundId)) {
      setError('هالاسم محجوز لحساب الصندوق');
      return;
    }
    if (trimmed !== (customer?.name ?? defaultName) && nameTaken?.(trimmed, targetFundId)) {
      setError('في حساب بنفس الاسم في القسم المحدد');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (customer && onUpdateCustomer) {
        await onUpdateCustomer({
          ...customer,
          fundId: targetFundId,
          name: trimmed,
          accountNumber: accountNumber.trim() || undefined,
          phone: phone.trim() || undefined,
          sharedFundIds: sharedFundIds.length ? sharedFundIds : undefined,
        }, customer.name);
      } else if (onAddCustomer) {
        const newCustomer = createCustomer({
          fundId: targetFundId,
          name: trimmed,
          accountNumber: accountNumber.trim() || undefined,
          phone: phone.trim() || undefined,
          sharedFundIds: sharedFundIds.length ? sharedFundIds : undefined,
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
            سجّل الحساب لتعديل الاسم أو إضافة واتساب
          </p>
        )}

        {moveOptions.length > 1 && (
          <div>
            <label className="mb-1 block text-[10px] text-slate-500">
              {isRegister ? 'الصندوق / المركز' : 'نقل إلى (صندوق / مركز)'}
            </label>
            <select
              value={targetFundId}
              onChange={e => {
                setTargetFundId(e.target.value as FundId);
                setError('');
              }}
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm"
            >
              {moveOptions.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            {fundChanged && (
              <p className="mt-1 text-[10px] text-amber-400/90">
                نقل من {getFund(customer!.fundId).name} إلى {getFund(targetFundId).name} — تُحدَّث كل حركات الحساب
              </p>
            )}
          </div>
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
          <SharedFundIdsField
            homeFundId={targetFundId}
            value={sharedFundIds}
            onChange={setSharedFundIds}
            fundOptions={fundOptions}
          />
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
