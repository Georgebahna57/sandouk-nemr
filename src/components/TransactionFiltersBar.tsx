import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';
import { CURRENCIES } from '../config';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { Currency, TransactionFilters } from '../types';

interface Props {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
}

export function hasActiveTransactionFilters(filters: TransactionFilters): boolean {
  return !!(filters.dateFrom || filters.dateTo || filters.query || filters.currency);
}

export function TransactionFiltersBar({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [queryDraft, setQueryDraft] = useState(filters.query ?? '');
  const debouncedQuery = useDebouncedValue(queryDraft, 200);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const hasActive = hasActiveTransactionFilters(filters);

  useEffect(() => {
    setQueryDraft(filters.query ?? '');
  }, [filters.query]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    const nextQuery = trimmed || undefined;
    if (nextQuery === (filtersRef.current.query ?? undefined)) return;
    onChange({ ...filtersRef.current, query: nextQuery });
  }, [debouncedQuery, onChange]);

  function clear() {
    setQueryDraft('');
    onChange({});
    setOpen(false);
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Filter size={14} className="text-amber-400" />
          فلترة وبحث
          {hasActive && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              مفعّل
            </span>
          )}
        </span>
        <ChevronDown size={16} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-slate-700 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">راجع أيام سابقة أو ابحث عن عملية</p>
            {hasActive && (
              <button type="button" onClick={clear} className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-400">
                <X size={12} /> مسح والعودة لعمليات اليوم
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
                value={queryDraft}
                onChange={e => setQueryDraft(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
