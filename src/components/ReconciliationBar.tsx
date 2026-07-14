import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { formatDateAr, todayIso } from '../lib/utils';
import type { Customer } from '../types';

interface Props {
  customer: Customer;
  actorName?: string;
  onSave: (customer: Customer) => void | Promise<void>;
  readOnly?: boolean;
}

export function ReconciliationBar({ customer, actorName, onSave, readOnly }: Props) {
  const [throughDate, setThroughDate] = useState(customer.reconciliation?.throughDate ?? todayIso());
  const [saving, setSaving] = useState(false);
  const reconciled = customer.reconciliation?.throughDate;

  async function markThrough(date: string) {
    setSaving(true);
    try {
      await Promise.resolve(onSave({
        ...customer,
        reconciliation: {
          throughDate: date,
          markedAt: new Date().toISOString(),
          markedByName: actorName,
        },
      }));
    } finally {
      setSaving(false);
    }
  }

  async function clearMark() {
    setSaving(true);
    try {
      await Promise.resolve(onSave({
        ...customer,
        reconciliation: undefined,
      }));
    } finally {
      setSaving(false);
    }
  }

  if (readOnly) {
    if (!reconciled) return null;
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
        <CheckCircle2 size={14} />
        مطابق حتى {formatDateAr(reconciled)}
        {customer.reconciliation?.markedByName && (
          <span className="text-emerald-400/70">— {customer.reconciliation.markedByName}</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-600/80 bg-slate-900/50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-300">مطابقة الحساب</p>
        {reconciled && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <CheckCircle2 size={12} />
            مطابق حتى {formatDateAr(reconciled)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={throughDate}
          onChange={e => setThroughDate(e.target.value)}
          className="flex-1 min-w-[140px] rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs"
        />
        <button
          type="button"
          disabled={saving || !throughDate}
          onClick={() => markThrough(throughDate)}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          تمت المطابقة حتى
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => markThrough(todayIso())}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
        >
          حتى اليوم
        </button>
        {reconciled && (
          <button
            type="button"
            disabled={saving}
            onClick={clearMark}
            className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-400 hover:text-rose-400 disabled:opacity-50"
          >
            إلغاء المطابقة
          </button>
        )}
      </div>
      <p className="text-[10px] text-slate-500">
        الحركات بتاريخ {reconciled ? `≤ ${formatDateAr(reconciled)}` : '—'} تُعلَّم كمطابقة في القائمة والكشف
      </p>
    </div>
  );
}
