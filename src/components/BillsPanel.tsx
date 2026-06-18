import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Bill, FundId } from '../types';

interface Props {
  fundId: FundId;
  bills: Bill[];
  onAdd?: (bill: Bill) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
}

export function BillsPanel({ fundId, bills, onAdd, onDelete, readOnly = false }: Props) {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [description, setDescription] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !onAdd) return;
    onAdd({
      id: crypto.randomUUID(),
      fundId,
      invoiceNo: invoiceNo.trim(),
      description: description.trim(),
      paidAt: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    });
    setInvoiceNo('');
    setDescription('');
  }

  return (
    <div className="space-y-4">
      {!readOnly && onAdd && (
      <form onSubmit={submit} className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 space-y-3">
        <h3 className="font-semibold text-amber-400">فاتورة جديدة</h3>
        <input type="text" placeholder="رقم الفاتورة (اختياري)" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" />
        <input type="text" placeholder="الوصف" value={description} onChange={e => setDescription(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" required />
        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 font-semibold text-slate-900">
          <Plus size={16} /> إضافة
        </button>
      </form>
      )}

      {bills.length === 0 ? (
        <p className="text-center text-sm text-slate-500">لا توجد فواتير</p>
      ) : (
        <div className="space-y-2">
          {bills.map(bill => (
            <div key={bill.id} className="flex items-start justify-between gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
              <div>
                {bill.invoiceNo && <p className="text-xs text-amber-400">#{bill.invoiceNo}</p>}
                <p className="text-sm">{bill.description}</p>
                {bill.paidAt && <p className="mt-1 text-xs text-slate-500">{bill.paidAt}</p>}
              </div>
              {onDelete && (
              <button type="button" onClick={() => onDelete(bill.id)} className="text-slate-500 hover:text-rose-400">
                <Trash2 size={14} />
              </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
