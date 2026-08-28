import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { FUNDS, canRegisterCustomerName } from '../config';
import type { Customer, Fund, FundId } from '../types';
import { ModalShell } from './ModalShell';
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
  fundOptions = FUNDS,
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
    <ModalShell
      title="تعديل الحساب"
      titleIcon={<Pencil size={16} />}
      onClose={onClose}
      onSubmit={submit}
      saveLabel="حفظ"
      saveDisabled={saving}
    >
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
    </ModalShell>
  );
}
