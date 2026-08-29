import { Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { BOX_FUNDS, canRegisterCustomerName } from '../config';
import type { Customer, Fund, FundId } from '../types';
import { SharedFundIdsField } from './SharedFundIdsField';

interface Props {
  customer: Customer;
  fundOptions?: Fund[];
  onClose: () => void;
  onSave: (updated: Customer, previousName: string) => void | Promise<void>;
  nameTaken?: (name: string) => boolean;
}

export function EditCustomerModal({
  customer,
  fundOptions = BOX_FUNDS,
  onClose,
  onSave,
  nameTaken,
}: Props) {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? '');
  const [sharedFundIds, setSharedFundIds] = useState<FundId[]>(customer.sharedFundIds ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!canRegisterCustomerName(trimmed, customer.fundId)) {
      setError('هالاسم محجوز لحساب الصندوق');
      return;
    }
    if (trimmed !== customer.name && nameTaken?.(trimmed)) {
      setError('في حساب بنفس الاسم');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await Promise.resolve(onSave({
        ...customer,
        name: trimmed,
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
          placeholder="هاتف (اختياري)"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm"
        />

        <SharedFundIdsField
          homeFundId={customer.fundId}
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
