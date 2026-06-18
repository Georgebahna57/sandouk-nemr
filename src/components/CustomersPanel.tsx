import { ChevronDown, ChevronUp, Plus, Search, Trash2, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CURRENCIES, getFund, isFundAccountName, isWeightCurrency } from '../config';
import { createCustomer, formatAmount, formatValueWithUnit } from '../lib/utils';
import type { Customer, CustomerSummary, FundId, Transaction } from '../types';
import { AccountTransactionForm } from './AccountTransactionForm';
import { TransactionList } from './TransactionList';

interface Props {
  summaries: CustomerSummary[];
  transactions: Transaction[];
  fundId: FundId;
  onAddCustomer?: (customer: Customer) => void;
  onDeleteCustomer?: (id: string) => void;
  onAddTransaction?: (tx: Transaction | Transaction[]) => void;
  readOnly?: boolean;
}

export function CustomersPanel({
  summaries,
  transactions,
  fundId,
  onAddCustomer,
  onDeleteCustomer,
  onAddTransaction,
  readOnly = false,
}: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState('');

  const fund = getFund(fundId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(s => s.name.toLowerCase().includes(q));
  }, [summaries, search]);

  function submitCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !onAddCustomer) return;
    if (isFundAccountName(name.trim())) {
      setNameError('هالاسم محجوز لحساب الصندوق');
      return;
    }
    setNameError('');
    onAddCustomer(createCustomer({
      fundId,
      name: name.trim(),
      phone: phone.trim() || undefined,
    }));
    setName('');
    setPhone('');
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        حسابات {fund.name} — كل صندوق عنده حساباتو الخاصة (جرادي بأورا ≠ جرادي بتايغر)
      </p>

      {!readOnly && onAddCustomer && (
      <form onSubmit={submitCustomer} className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 space-y-3">
        <h3 className="font-semibold text-amber-400">حساب جديد</h3>
        <input type="text" placeholder="اسم الحساب" value={name} onChange={e => { setName(e.target.value); setNameError(''); }}
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" required />
        {nameError && <p className="text-xs text-rose-400">{nameError}</p>}
        <input type="text" placeholder="هاتف (اختياري)" value={phone} onChange={e => setPhone(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" />
        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 font-semibold text-slate-900">
          <Plus size={16} /> إضافة حساب
        </button>
      </form>
      )}

      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" placeholder="بحث عن حساب..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-900 py-2.5 pr-9 pl-3 text-sm" />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-500">لا يوجد حسابات</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(summary => {
            const isOpen = expanded === summary.name;
            const accountTx = transactions.filter(
              tx => tx.fundId === fundId
                && (tx.ledger ?? 'fund') === 'account'
                && tx.party === summary.name,
            );
            const activeCurrencies = CURRENCIES.filter(c => {
              const b = summary.balances[c.id];
              return b.receipts !== 0 || b.payments !== 0;
            });

            return (
              <div key={summary.customerId ?? summary.name} className="rounded-2xl border border-slate-700 bg-slate-800/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : summary.name)}
                  className="flex w-full items-center justify-between gap-2 p-3 text-right hover:bg-slate-700/30"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <User size={16} className="shrink-0 text-amber-400" />
                    <span className="truncate font-medium">{summary.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {summary.customerId && onDeleteCustomer && !readOnly && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onDeleteCustomer(summary.customerId!); }}
                        className="rounded-lg p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {activeCurrencies.length > 0 && (
                  <div className="border-t border-slate-700 px-3 py-2 flex flex-wrap gap-2">
                    {activeCurrencies.map(c => {
                      const b = summary.balances[c.id];
                      return (
                        <span key={c.id} className="rounded-lg bg-slate-900 px-2 py-1 text-xs">
                          <span className="text-slate-400">{isWeightCurrency(c.id) ? `${c.label} ` : c.symbol}{' '}</span>
                          <span className={b.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {isWeightCurrency(c.id) ? `${formatAmount(b.balance, c.id)} غ` : formatAmount(b.balance, c.id)}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}

                {isOpen && (
                  <div className="border-t border-slate-700 p-3 space-y-3">
                    {!readOnly && onAddTransaction && (
                      <AccountTransactionForm
                        accountName={summary.name}
                        fundId={fundId}
                        onAdd={onAddTransaction}
                      />
                    )}
                    {activeCurrencies.map(c => {
                      const b = summary.balances[c.id];
                      return (
                        <div key={c.id} className="rounded-xl bg-slate-900/60 p-3 text-xs">
                          <p className="font-medium text-slate-300">
                            {c.label}{isWeightCurrency(c.id) ? ' (وزن بالغرام)' : ` (${c.symbol})`}
                          </p>
                          <div className="mt-1 grid grid-cols-3 gap-2 text-slate-400">
                            <span>وارد: <span className="text-emerald-400">{formatValueWithUnit(b.receipts, c.id)}</span></span>
                            <span>صادر: <span className="text-rose-400">{formatValueWithUnit(b.payments, c.id)}</span></span>
                            <span>رصيد: <span className={b.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatValueWithUnit(b.balance, c.id)}</span></span>
                          </div>
                        </div>
                      );
                    })}
                    <div>
                      <p className="mb-2 text-xs text-slate-500">حركات الحساب</p>
                      <TransactionList transactions={accountTx} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
