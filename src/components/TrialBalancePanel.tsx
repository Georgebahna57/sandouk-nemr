import { Download, FileText, Pencil, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CURRENCIES, getCurrencyLabel, isWeightCurrency } from '../config';
import { accountExistsInFund } from '../lib/utils';
import {
  buildTrialBalanceLines,
  downloadTrialBalanceExcel,
  type TrialBalanceRow,
} from '../lib/trialBalance';
import type { Currency, Customer, CustomerSummary, Fund, FundId, Transaction } from '../types';
import { AccountStatementModal } from './AccountStatementModal';
import { AccountWhatsAppQuickActions } from './AccountWhatsAppQuickActions';
import { TrialBalanceAccountModal } from './TrialBalanceAccountModal';

type ViewCurrency = Currency | 'all';

interface Props {
  summaries: CustomerSummary[];
  customers: Customer[];
  transactions?: Transaction[];
  defaultFundId: FundId;
  fundOptions?: Fund[];
  canEditFund?: (fundId: FundId) => boolean;
  onUpdateCustomer?: (customer: Customer, previousName: string) => void | Promise<void>;
  onShareAccount?: (summary: CustomerSummary) => void;
  readOnly?: boolean;
}

function formatCell(value: number, currency: Currency): string {
  if (value === 0) return '-';
  const abs = Math.abs(value);
  const formatted = isWeightCurrency(currency)
    ? `${abs.toLocaleString('en-US', { maximumFractionDigits: 3 })} غ`
    : abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value < 0) return `(${formatted})`;
  return formatted;
}

export function TrialBalancePanel({
  summaries,
  customers,
  transactions = [],
  defaultFundId,
  fundOptions = [],
  canEditFund,
  onUpdateCustomer,
  onShareAccount,
  readOnly = false,
}: Props) {
  const [viewCurrency, setViewCurrency] = useState<ViewCurrency>('all');
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(true);
  const [editingRow, setEditingRow] = useState<TrialBalanceRow | null>(null);
  const [statementRow, setStatementRow] = useState<TrialBalanceRow | null>(null);

  const showAllCurrencies = viewCurrency === 'all';

  const lines = useMemo(
    () => buildTrialBalanceLines(
      summaries,
      customers,
      defaultFundId,
      transactions,
      {
        currency: showAllCurrencies ? undefined : viewCurrency,
        hideZero: hideZero && !search.trim(),
      },
    ),
    [summaries, customers, defaultFundId, transactions, showAllCurrencies, viewCurrency, hideZero, search],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter(row => {
      const hay = `${row.summary.name} ${row.accountNumber ?? ''} ${row.summary.accountNumber ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [lines, search]);

  const totals = useMemo(() => {
    if (showAllCurrencies) return null;
    return {
      debit: filtered.reduce((s, r) => s + r.debit, 0),
      credit: filtered.reduce((s, r) => s + r.credit, 0),
      balance: filtered.reduce((s, r) => s + r.balance, 0),
    };
  }, [filtered, showAllCurrencies]);

  const exportLabel = showAllCurrencies
    ? 'ميزان مراجعة — كل العملات'
    : `${viewCurrency} - ${getCurrencyLabel(viewCurrency)}`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3">
        <p className="text-sm font-medium text-sky-300">ميزان مراجعة بالعملات</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          ابحث عن حساب لعرض كل العملات، أو اختر عملة محددة من الأزرار
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-800/50 p-1">
        <button
          type="button"
          onClick={() => setViewCurrency('all')}
          className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition ${
            viewCurrency === 'all'
              ? 'bg-slate-700 text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          كل العملات
        </button>
        {CURRENCIES.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setViewCurrency(c.id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition ${
              viewCurrency === c.id
                ? 'bg-slate-700 text-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {c.id}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            placeholder="بحث عن حساب..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 py-2 pr-9 pl-3 text-sm"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={hideZero}
            onChange={e => setHideZero(e.target.checked)}
          />
          إخفاء الأصفار
        </label>
        <button
          type="button"
          onClick={() => downloadTrialBalanceExcel(filtered, exportLabel)}
          className="flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400"
        >
          <Download size={14} />
          Excel
        </button>
      </div>

      {search.trim() && showAllCurrencies && (
        <p className="text-xs text-sky-400/90">
          عرض كل العملات لـ {filtered.length} سطر — اختر عملة من الأعلى لتحديد عملة واحدة
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-700">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80 text-xs text-slate-400">
              <th className="px-3 py-2.5 text-right font-medium">رقم</th>
              <th className="px-3 py-2.5 text-right font-medium">اسم الحساب</th>
              {showAllCurrencies && (
                <th className="px-3 py-2.5 text-right font-medium">عملة</th>
              )}
              <th className="px-3 py-2.5 text-right font-medium">واتساب</th>
              <th className="px-3 py-2.5 text-right font-medium">مدين (عليه)</th>
              <th className="px-3 py-2.5 text-right font-medium">دائن (له)</th>
              <th className="px-3 py-2.5 text-right font-medium">رصيد نهائي</th>
              {!readOnly && <th className="px-3 py-2.5 text-center font-medium">إجراء</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={showAllCurrencies ? (readOnly ? 7 : 8) : (readOnly ? 6 : 7)}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  {search.trim() ? 'ما لقينا حساب بهالاسم' : 'لا يوجد حسابات'}
                </td>
              </tr>
            ) : (
              filtered.map(row => {
                const rowReadOnly = readOnly || (canEditFund && !canEditFund(row.fundId));
                const rowKey = `${row.fundId}:${row.summary.name}:${row.currency}`;
                return (
                  <tr
                    key={rowKey}
                    className="border-b border-slate-700/60 hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2 text-xs text-slate-500 tabular-nums" dir="ltr">
                      {row.accountNumber ?? row.summary.accountNumber ?? '—'}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-100 max-w-[180px] truncate">
                      {row.summary.name}
                    </td>
                    {showAllCurrencies && (
                      <td className="px-3 py-2 text-xs font-medium text-sky-300">
                        {row.currency}
                      </td>
                    )}
                    <td className="px-3 py-2 text-xs text-slate-400" dir="ltr">
                      {row.phone ?? '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-right text-rose-300/90">
                      {formatCell(row.debit, row.currency)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-right text-emerald-300/90">
                      {formatCell(row.credit, row.currency)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-right font-medium text-slate-100">
                      {formatCell(row.balance, row.currency)}
                    </td>
                    {!readOnly && (
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setStatementRow(row)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-sky-400"
                            title="عرض العمليات"
                          >
                            <FileText size={14} />
                          </button>
                          {!rowReadOnly && row.customer && onUpdateCustomer && (
                            <button
                              type="button"
                              onClick={() => setEditingRow(row)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-amber-400"
                              title="تعديل الاسم / واتساب"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {row.phone && (
                            <AccountWhatsAppQuickActions
                              phone={row.phone}
                              fundId={row.fundId}
                              summary={row.summary}
                              onShareImage={onShareAccount
                                ? () => onShareAccount(row.summary)
                                : undefined}
                              compact
                            />
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
          {totals && filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-600 bg-slate-800/60 text-xs font-semibold">
                <td className="px-3 py-2.5 text-slate-300" colSpan={3}>المجموع</td>
                <td className="px-3 py-2.5 tabular-nums text-right text-rose-300">
                  {formatCell(totals.debit, viewCurrency as Currency)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-right text-emerald-300">
                  {formatCell(totals.credit, viewCurrency as Currency)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-right text-slate-200">
                  {formatCell(totals.balance, viewCurrency as Currency)}
                </td>
                {!readOnly && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {editingRow?.customer && (
        <TrialBalanceAccountModal
          customer={editingRow.customer}
          defaultName={editingRow.summary.name}
          fundId={editingRow.fundId}
          fundOptions={fundOptions}
          onClose={() => setEditingRow(null)}
          onUpdateCustomer={onUpdateCustomer}
          nameTaken={name => accountExistsInFund(
            customers,
            editingRow.fundId,
            name,
            editingRow.customer?.id,
          )}
        />
      )}

      {statementRow && (
        <AccountStatementModal
          accountName={statementRow.summary.name}
          fundId={statementRow.fundId}
          transactions={transactions}
          reconciledThroughDate={statementRow.customer?.reconciliation?.throughDate
            ?? statementRow.summary.reconciliation?.throughDate}
          onClose={() => setStatementRow(null)}
        />
      )}
    </div>
  );
}
