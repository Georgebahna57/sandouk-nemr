import { Download, Printer, ScrollText, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getFund } from '../config';
import {
  buildDailyJournalReport,
  downloadDailyJournalCsv,
  printDailyJournal,
} from '../lib/dailyJournal';
import { formatDateAr, formatValueWithUnit, todayIso } from '../lib/utils';
import type { FundId, Transaction } from '../types';

interface Props {
  fundId: FundId;
  transactions: Transaction[];
  defaultDate?: string;
  onClose: () => void;
}

export function DailyJournalModal({ fundId, transactions, defaultDate, onClose }: Props) {
  const [date, setDate] = useState(defaultDate ?? todayIso());
  const report = useMemo(
    () => buildDailyJournalReport(transactions, fundId, date),
    [transactions, fundId, date],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-600 bg-slate-900 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700 p-4">
          <div>
            <div className="flex items-center gap-2 text-sky-400">
              <ScrollText size={16} />
              <h3 className="font-semibold">دفتر يومية — {getFund(fundId).name}</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">حركات الصندوق المُعتمدة فقط</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-slate-700 p-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-[10px] text-slate-500">التاريخ</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => downloadDailyJournalCsv(report)}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
          >
            <Download size={14} />
            Excel
          </button>
          <button
            type="button"
            onClick={() => printDailyJournal(report)}
            className="flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
          >
            <Printer size={14} />
            PDF
          </button>
        </div>

        {report.summaries.length > 0 && (
          <div className="border-b border-slate-700 p-4 overflow-x-auto">
            <p className="mb-2 text-xs font-medium text-slate-400">ملخص — {formatDateAr(date)}</p>
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-1 text-right font-medium">عملة</th>
                  <th className="py-1 text-right font-medium">افتتاح</th>
                  <th className="py-1 text-right font-medium">وارد</th>
                  <th className="py-1 text-right font-medium">صادر</th>
                  <th className="py-1 text-right font-medium">إغلاق</th>
                </tr>
              </thead>
              <tbody>
                {report.summaries.map(s => (
                  <tr key={s.currency} className="border-t border-slate-800">
                    <td className="py-1.5 font-medium">{s.currency}</td>
                    <td className="py-1.5 tabular-nums">{formatValueWithUnit(s.openingBalance, s.currency)}</td>
                    <td className="py-1.5 tabular-nums text-emerald-400">+{formatValueWithUnit(s.totalReceipts, s.currency)}</td>
                    <td className="py-1.5 tabular-nums text-rose-400">-{formatValueWithUnit(s.totalPayments, s.currency)}</td>
                    <td className="py-1.5 tabular-nums font-semibold">{formatValueWithUnit(s.closingBalance, s.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="overflow-auto flex-1 p-4">
          {report.rows.length === 0 ? (
            <p className="text-center text-sm text-slate-500">لا حركات على الصندوق في هذا اليوم</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-2 text-right font-medium">البيان</th>
                  <th className="py-2 text-right font-medium">عملة</th>
                  <th className="py-2 text-right font-medium">مدين</th>
                  <th className="py-2 text-right font-medium">دائن</th>
                  <th className="py-2 text-right font-medium">طرف</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map(row => (
                  <tr key={row.id} className="border-b border-slate-800/80">
                    <td className="py-2 pr-2">
                      <span className="text-slate-200">{row.description}</span>
                      {row.note && <p className="text-[10px] text-slate-500">{row.note}</p>}
                    </td>
                    <td className="py-2 text-slate-400">{row.currency}</td>
                    <td className="py-2 text-rose-400 tabular-nums">
                      {row.debit != null ? formatValueWithUnit(row.debit, row.currency) : '—'}
                    </td>
                    <td className="py-2 text-emerald-400 tabular-nums">
                      {row.credit != null ? formatValueWithUnit(row.credit, row.currency) : '—'}
                    </td>
                    <td className="py-2 text-slate-500">{row.counterparty ?? '—'}</td>
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
