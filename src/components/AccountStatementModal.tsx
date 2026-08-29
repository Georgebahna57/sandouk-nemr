import { Download, FileText, Printer, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getCurrencyLabel, getFund } from '../config';
import {
  buildAccountStatementRows,
  buildAccountStatementCsv,
  printAccountStatement,
  statementActiveCurrencies,
  type StatementKindFilter,
} from '../lib/accountStatement';
import { downloadAccountStatementExcel } from '../lib/excelExport';
import { formatDateAr, formatValueWithUnit } from '../lib/utils';
import type { Currency, FundId, Transaction } from '../types';

interface Props {
  accountName: string;
  fundId: FundId;
  transactions: Transaction[];
  reconciledThroughDate?: string;
  onClose: () => void;
}

const KIND_FILTERS: { id: StatementKindFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'receipt', label: 'وارد' },
  { id: 'payment', label: 'صادر' },
  { id: 'exchange', label: 'تبديل' },
];

export function AccountStatementModal({
  accountName,
  fundId,
  transactions,
  reconciledThroughDate,
  onClose,
}: Props) {
  const currencies = useMemo(
    () => statementActiveCurrencies(transactions, fundId, accountName),
    [transactions, fundId, accountName],
  );
  const [currency, setCurrency] = useState<Currency>(currencies[0] ?? 'USD');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [kindFilter, setKindFilter] = useState<StatementKindFilter>('all');

  const build = useMemo(
    () => buildAccountStatementRows(transactions, fundId, accountName, {
      currency,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      reconciledThroughDate,
      kindFilter,
    }),
    [transactions, fundId, accountName, currency, dateFrom, dateTo, reconciledThroughDate, kindFilter],
  );

  const filteredRows = build.rows.filter(r => r.currency === currency);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-600 bg-slate-900 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700 p-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400">
              <FileText size={16} />
              <h3 className="font-semibold">كشف حساب — {accountName}</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">{getFund(fundId).name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-slate-700 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[10px] text-slate-500">العملة</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as Currency)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs"
              >
                {currencies.map(c => (
                  <option key={c} value={c}>{getCurrencyLabel(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-500">من تاريخ</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-500">إلى تاريخ</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-500">نوع الحركة</label>
              <select
                value={kindFilter}
                onChange={e => setKindFilter(e.target.value as StatementKindFilter)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs"
              >
                {KIND_FILTERS.map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-3 text-xs">
              <span className="text-slate-500">
                افتتاح: <span className="font-semibold text-slate-200">{formatValueWithUnit(build.openingBalance, currency)}</span>
              </span>
              <span className="text-slate-500">
                إغلاق: <span className="font-semibold text-emerald-400">{formatValueWithUnit(build.closingBalance, currency)}</span>
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const csv = buildAccountStatementCsv(
                    accountName,
                    fundId,
                    build,
                    currency,
                    dateFrom || undefined,
                    dateTo || undefined,
                  );
                  downloadAccountStatementExcel(accountName, fundId, csv, currency);
                }}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-medium text-white hover:bg-emerald-500"
              >
                <Download size={14} />
                Excel
              </button>
              <button
                type="button"
                onClick={() => printAccountStatement(
                  accountName,
                  fundId,
                  build,
                  currency,
                  reconciledThroughDate,
                  dateFrom || undefined,
                  dateTo || undefined,
                )}
                className="flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-2 text-xs text-slate-200 hover:bg-slate-800"
              >
                <Printer size={14} />
                PDF
              </button>
            </div>
          </div>

          {reconciledThroughDate && (
            <p className="text-[10px] text-emerald-400/90">
              مطابق حتى {formatDateAr(reconciledThroughDate)}
            </p>
          )}
        </div>

        <div className="overflow-auto flex-1 p-4">
          {filteredRows.length === 0 ? (
            <p className="text-center text-sm text-slate-500">لا توجد حركات ضمن الفترة المحددة</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-2 text-right font-medium">التاريخ</th>
                  <th className="py-2 text-right font-medium">البيان</th>
                  <th className="py-2 text-right font-medium">مدين</th>
                  <th className="py-2 text-right font-medium">دائن</th>
                  <th className="py-2 text-right font-medium">الرصيد</th>
                  <th className="py-2 text-center font-medium">✓</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-800/80 ${row.reconciled ? 'bg-emerald-500/5' : ''} ${row.id === 'opening-balance' ? 'bg-sky-500/10' : ''}`}
                  >
                    <td className="py-2 text-slate-400 whitespace-nowrap">
                      {row.id === 'opening-balance' ? '—' : formatDateAr(row.date)}
                    </td>
                    <td className="py-2 pr-2">
                      <span className={row.id === 'opening-balance' ? 'font-semibold text-sky-300' : 'text-slate-200'}>
                        {row.description}
                      </span>
                      {row.note && <p className="text-[10px] text-slate-500">{row.note}</p>}
                    </td>
                    <td className="py-2 text-rose-400 tabular-nums whitespace-nowrap">
                      {row.debit != null ? formatValueWithUnit(row.debit, row.currency) : '—'}
                    </td>
                    <td className="py-2 text-emerald-400 tabular-nums whitespace-nowrap">
                      {row.credit != null ? formatValueWithUnit(row.credit, row.currency) : '—'}
                    </td>
                    <td className="py-2 font-semibold tabular-nums whitespace-nowrap">
                      {formatValueWithUnit(row.runningBalance, row.currency)}
                    </td>
                    <td className="py-2 text-center text-emerald-400">
                      {row.reconciled ? '✓' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
