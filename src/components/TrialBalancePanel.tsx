import { Download, Pencil, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CURRENCIES, canRegisterCustomerName, getCurrencyLabel, isWeightCurrency } from '../config';
import { accountExistsInFund, createCustomer, todayIso } from '../lib/utils';
import {
  buildAccountOpeningTransactions,
  buildTrialBalanceRows,
  downloadTrialBalanceExcel,
  type TrialBalanceRow,
} from '../lib/trialBalance';
import type { Currency, Customer, CustomerSummary, Fund, FundId, Transaction } from '../types';
import { AccountWhatsAppQuickActions } from './AccountWhatsAppQuickActions';
import { TrialBalanceAccountModal } from './TrialBalanceAccountModal';

interface Props {
  summaries: CustomerSummary[];
  customers: Customer[];
  defaultFundId: FundId;
  fundOptions?: Fund[];
  multiFund?: boolean;
  canEditFund?: (fundId: FundId) => boolean;
  onAddCustomer?: (customer: Customer) => void | Promise<void>;
  onUpdateCustomer?: (customer: Customer, previousName: string) => void | Promise<void>;
  onAddTransaction?: (tx: Transaction | Transaction[]) => void | Promise<void>;
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
  defaultFundId,
  fundOptions = [],
  multiFund = false,
  canEditFund,
  onAddCustomer,
  onUpdateCustomer,
  onAddTransaction,
  onShareAccount,
  readOnly = false,
}: Props) {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [editingRow, setEditingRow] = useState<TrialBalanceRow | null>(null);

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newFundId, setNewFundId] = useState<FundId>(defaultFundId);
  const [newDebit, setNewDebit] = useState('');
  const [newCredit, setNewCredit] = useState('');
  const [addError, setAddError] = useState('');

  const editableFunds = useMemo(
    () => (canEditFund ? fundOptions.filter(f => canEditFund(f.id)) : fundOptions),
    [fundOptions, canEditFund],
  );

  const canAdd = !readOnly && onAddCustomer && (
    multiFund ? editableFunds.length > 0 : true
  );

  const rows = useMemo(
    () => buildTrialBalanceRows(summaries, customers, currency, defaultFundId),
    [summaries, customers, currency, defaultFundId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(row => {
      if (hideZero && row.debit === 0 && row.credit === 0 && row.balance === 0) {
        return !!row.customer;
      }
      if (!q) return true;
      return row.summary.name.toLowerCase().includes(q);
    });
  }, [rows, search, hideZero]);

  const totals = useMemo(() => ({
    debit: filtered.reduce((s, r) => s + r.debit, 0),
    credit: filtered.reduce((s, r) => s + r.credit, 0),
    balance: filtered.reduce((s, r) => s + r.balance, 0),
  }), [filtered]);

  async function submitNewAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!onAddCustomer) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    const targetFund = multiFund ? newFundId : defaultFundId;
    if (!canRegisterCustomerName(trimmed, targetFund)) {
      setAddError('هالاسم محجوز لحساب الصندوق');
      return;
    }
    if (accountExistsInFund(customers, targetFund, trimmed)) {
      setAddError('في حساب بنفس الاسم');
      return;
    }
    const debit = parseFloat(newDebit.replace(/,/g, '')) || 0;
    const credit = parseFloat(newCredit.replace(/,/g, '')) || 0;
    if (debit < 0 || credit < 0) {
      setAddError('المبالغ يجب أن تكون موجبة');
      return;
    }
    setAddError('');
    const customer = createCustomer({
      fundId: targetFund,
      name: trimmed,
      phone: newPhone.trim() || undefined,
    });
    await onAddCustomer(customer);
    if ((debit > 0 || credit > 0) && onAddTransaction) {
      const txs = buildAccountOpeningTransactions(
        targetFund,
        trimmed,
        currency,
        debit,
        credit,
        todayIso(),
      );
      if (txs.length) await onAddTransaction(txs);
    }
    setNewName('');
    setNewPhone('');
    setNewDebit('');
    setNewCredit('');
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3">
        <p className="text-sm font-medium text-sky-300">ميزان مراجعة بالعملات</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          مدين = صادر · دائن = وارد · الرصيد النهائي لكل عملة — مثل ملف Excel
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-800/50 p-1">
        {CURRENCIES.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCurrency(c.id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition ${
              currency === c.id
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
          onClick={() => downloadTrialBalanceExcel(currency, filtered)}
          className="flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400"
        >
          <Download size={14} />
          Excel
        </button>
      </div>

      {canAdd && (
        <form
          onSubmit={submitNewAccount}
          className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-amber-400">حساب جديد — {getCurrencyLabel(currency)}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {multiFund && editableFunds.length > 0 && (
              <select
                value={newFundId}
                onChange={e => setNewFundId(e.target.value as FundId)}
                className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm sm:col-span-2"
              >
                {editableFunds.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              placeholder="اسم الحساب"
              value={newName}
              onChange={e => { setNewName(e.target.value); setAddError(''); }}
              className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm"
              required
            />
            <input
              type="text"
              placeholder="واتساب (اختياري)"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm"
              dir="ltr"
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="مدين (صادر)"
              value={newDebit}
              onChange={e => setNewDebit(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm"
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="دائن (وارد)"
              value={newCredit}
              onChange={e => setNewCredit(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm"
            />
          </div>
          {addError && <p className="text-xs text-rose-400">{addError}</p>}
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-900"
          >
            <Plus size={16} />
            إضافة حساب
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-700">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80 text-xs text-slate-400">
              <th className="px-3 py-2.5 text-right font-medium">اسم الحساب</th>
              <th className="px-3 py-2.5 text-right font-medium">واتساب</th>
              <th className="px-3 py-2.5 text-right font-medium">مدين</th>
              <th className="px-3 py-2.5 text-right font-medium">دائن</th>
              <th className="px-3 py-2.5 text-right font-medium">رصيد نهائي</th>
              <th className="px-3 py-2.5 text-center font-medium">حالة</th>
              {!readOnly && <th className="px-3 py-2.5 text-center font-medium">إجراء</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 6 : 7} className="px-3 py-8 text-center text-slate-500">
                  لا يوجد حسابات لهالعملة
                </td>
              </tr>
            ) : (
              filtered.map(row => {
                const rowReadOnly = readOnly || (canEditFund && !canEditFund(row.fundId));
                return (
                  <tr
                    key={`${row.fundId}:${row.summary.name}`}
                    className="border-b border-slate-700/60 hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2 font-medium text-slate-100 max-w-[180px] truncate">
                      {row.summary.name}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400" dir="ltr">
                      {row.phone ?? '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-right text-rose-300/90">
                      {formatCell(row.debit, currency)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-right text-emerald-300/90">
                      {formatCell(row.credit, currency)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-right font-medium text-slate-100">
                      {formatCell(row.balance, currency)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      <span className={`rounded-md px-2 py-0.5 ${
                        row.status === 'زايد'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : row.status === 'ناقص'
                            ? 'bg-rose-500/15 text-rose-300'
                            : 'bg-slate-700 text-slate-400'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    {!readOnly && (
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {!rowReadOnly && (onUpdateCustomer || onAddCustomer) && (
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
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-600 bg-slate-800/60 text-xs font-semibold">
                <td className="px-3 py-2.5 text-slate-300" colSpan={2}>المجموع</td>
                <td className="px-3 py-2.5 tabular-nums text-right text-rose-300">
                  {formatCell(totals.debit, currency)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-right text-emerald-300">
                  {formatCell(totals.credit, currency)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-right text-slate-200">
                  {formatCell(totals.balance, currency)}
                </td>
                <td colSpan={readOnly ? 1 : 2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {editingRow && (
        <TrialBalanceAccountModal
          customer={editingRow.customer}
          defaultName={editingRow.summary.name}
          fundId={editingRow.fundId}
          fundOptions={fundOptions}
          onClose={() => setEditingRow(null)}
          onAddCustomer={onAddCustomer}
          onUpdateCustomer={onUpdateCustomer}
          nameTaken={name => accountExistsInFund(
            customers,
            editingRow.fundId,
            name,
            editingRow.customer?.id,
          )}
        />
      )}
    </div>
  );
}
