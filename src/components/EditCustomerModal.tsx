import { Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { BOX_FUNDS, canRegisterCustomerName, getFund } from '../config';
import type { Customer, Fund, FundId } from '../types';
import { SharedFundIdsField } from './SharedFundIdsField';

interface Props {
  customer: Customer;
  fundOptions?: Fund[];
  transferFundOptions?: Fund[];
  onClose: () => void;
  onSave: (updated: Customer, previousName: string) => void | Promise<void>;
  nameTaken?: (name: string, fundId: FundId) => boolean;
}

export function EditCustomerModal({
  customer,
  fundOptions = BOX_FUNDS,
  transferFundOptions,
  onClose,
  onSave,
  nameTaken,
}: Props) {
  const [name, setName] = useState(customer.name);
  const [accountNumber, setAccountNumber] = useState(customer.accountNumber ?? '');
  const [phone, setPhone] = useState(customer.phone ?? '');
  const [targetFundId, setTargetFundId] = useState<FundId>(customer.fundId);
  const [sharedFundIds, setSharedFundIds] = useState<FundId[]>(customer.sharedFundIds ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const moveOptions = transferFundOptions ?? fundOptions;
  const fundChanged = targetFundId !== customer.fundId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!canRegisterCustomerName(trimmed, targetFundId)) {
      setError('هالاسم محجوز لحساب الصندوق');
      return;
    }
    if (trimmed !== customer.name && nameTaken?.(trimmed, targetFundId)) {
      setError('في حساب بنفس الاسم في القسم المحدد');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await Promise.resolve(onSave({
        ...customer,
        fundId: targetFundId,
        name: trimmed,
        accountNumber: accountNumber.trim() || undefined,
        phone: phone.trim() || undefined,
        sharedFundIds: sharedFundIds.length ? sharedFundIds : undefined,
      }, customer.name));
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
            <h3 className="font-semibold">تعديل الحساب</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {moveOptions.length > 1 && (
          <div>
            <label className="mb-1 block text-[10px] text-slate-500">نقل إلى (صندوق / مركز)</label>
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
                نقل من {getFund(customer.fundId).name} إلى {getFund(targetFundId).name} — تُحدَّث كل حركات الحساب
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
        {error && <p className="text-xs text-rose-400">{error}</p>}

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
          placeholder="واتساب / رقم (اختياري)"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm"
        />

        <SharedFundIdsField
          homeFundId={targetFundId}
          value={sharedFundIds}
          onChange={setSharedFundIds}
          fundOptions={fundOptions}
        />

        {name.trim() !== customer.name && (
          <p className="text-xs text-amber-400/90">
            تغيير الاسم يحدّث كل حركات الحساب المرتبطة به
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-amber-500 py-2.5 font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
        >
          حفظ التعديل
        </button>
      </form>
    </div>
  );
}
