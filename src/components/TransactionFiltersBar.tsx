import { Filter, X } from 'lucide-react';
import { CURRENCIES } from '../config';
import type { Currency, TransactionFilters } from '../types';

interface Props {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
}

export function TransactionFiltersBar({ filters, onChange }: Props) {
  const hasActive = !!(filters.dateFrom || filters.dateTo || filters.query || filters.currency);

  function clear() {
    onChange({});
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Filter size={14} className="text-amber-400" />
          فلترة وبحث
        </div>
        {hasActive && (
          <button type="button" onClick={clear} className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-400">
            <X size={12} /> مسح
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[10px] text-slate-500">من تاريخ</label>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={e => onChange({ ...filters, dateFrom: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-slate-500">إلى تاريخ</label>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={e => onChange({ ...filters, dateTo: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-slate-500">العملة</label>
          <select
            value={filters.currency ?? ''}
            onChange={e => onChange({ ...filters, currency: (e.target.value || undefined) as Currency | undefined })}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs"
          >
            <option value="">الكل</option>
            {CURRENCIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-slate-500">طرف / حساب</label>
          <input
            type="text"
            placeholder="بحث..."
            value={filters.query ?? ''}
            onChange={e => onChange({ ...filters, query: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
