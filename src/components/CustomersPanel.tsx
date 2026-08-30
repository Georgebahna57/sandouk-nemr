import { CheckCircle2, ChevronDown, ChevronUp, FileText, MessageCircle, Pencil, Plus, Search, Share2, Trash2, User, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CENTERS_FUND_ID, CURRENCIES, getFund, canRegisterCustomerName, isHalabLinkedAccountName } from '../config';
import { isMoneyOutReconciliationAccount } from '../lib/halabMirror';
import { isMergedAccountSummary } from '../lib/accountMerge';
import { accountExistsInFund, accountNeedsReconciliation, createCustomer, enrichAccountTransactionsForDisplay, filterAccountViewTransactions, filterMergedAccountTransactions, findCustomerForAccount, formatDateAr } from '../lib/utils';
import { isFeeAccountName } from '../lib/fees';
import type { Customer, CustomerSummary, Fund, FundId, Transaction } from '../types';
import { AccountStatementModal } from './AccountStatementModal';
import { AccountWhatsAppQuickActions } from './AccountWhatsAppQuickActions';
import { AccountTransactionForm } from './AccountTransactionForm';
import { AccountTransferForm } from './AccountTransferForm';
import { EditCustomerModal } from './EditCustomerModal';
import { MoveAccountModal } from './MoveAccountModal';
import { ReconciliationBar } from './ReconciliationBar';
import { formatSharedFundLabels, SharedFundIdsField } from './SharedFundIdsField';
import { AccountValuationToolbar, AccountValuationView } from './AccountValuationView';
import type { AccountValuationMode, ValuationRates } from '../lib/valuationRates';
import { TransactionList } from './TransactionList';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface Props {
  summaries: CustomerSummary[];
  customers: Customer[];
  transactions: Transaction[];
  fundId: FundId;
  fundOptions?: Fund[];
  transferFundOptions?: Fund[];
  onAddCustomer?: (customer: Customer) => void;
  onUpdateCustomer?: (customer: Customer, previousName: string) => void | Promise<void>;
  onMoveAccount?: (
    accountName: string,
    toFundId: FundId,
    opts?: { fromFundId?: FundId; customerId?: string; accountNumber?: string },
  ) => void | Promise<void>;
  onDeleteCustomer?: (id: string) => void;
  onAddTransaction?: (tx: Transaction | Transaction[]) => void;
  onDeleteTransaction?: (id: string) => void;
  onEditTransaction?: (id: string) => void;
  onShareAccount?: (summary: CustomerSummary) => void;
  onMoneyOutReconciliation?: (summary: CustomerSummary) => void;
  valuationRates: ValuationRates;
  isAdmin?: boolean;
  actorName?: string;
  readOnly?: boolean;
  /** داخل قسم الحسابات — يخفي التعريف المكرر */
  embedded?: boolean;
  reconciliationFocus?: boolean;
  /** حسابات زبائن مجمّعة من كل الصناديق */
  multiFundCustomers?: boolean;
  canEditFund?: (fundId: FundId) => boolean;
}

export function CustomersPanel({
  summaries,
  customers,
  transactions,
  fundId,
  fundOptions,
  transferFundOptions,
  onAddCustomer,
  onUpdateCustomer,
  onMoveAccount,
  onDeleteCustomer,
  onAddTransaction,
  onDeleteTransaction,
  onEditTransaction,
  onShareAccount,
  onMoneyOutReconciliation,
  valuationRates,
  isAdmin = false,
  actorName,
  readOnly = false,
  embedded = false,
  reconciliationFocus = false,
  multiFundCustomers = false,
  canEditFund,
}: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [movingSummary, setMovingSummary] = useState<CustomerSummary | null>(null);
  const [statementAccount, setStatementAccount] = useState<CustomerSummary | null>(null);
  const [name, setName] = useState('');
  const [createFundId, setCreateFundId] = useState<FundId>(CENTERS_FUND_ID);
  const [accountNumber, setAccountNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [sharedFundIds, setSharedFundIds] = useState<FundId[]>([]);
  const [nameError, setNameError] = useState('');
  const [valuationMode, setValuationMode] = useState<AccountValuationMode>('breakdown');
  const [pendingDelete, setPendingDelete] = useState<{
    customerId: string;
    name: string;
    txCount: number;
  } | null>(null);

  const funds = fundOptions ?? [];

  const editableFunds = useMemo(
    () => (canEditFund ? funds.filter(f => canEditFund(f.id)) : funds),
    [funds, canEditFund],
  );

  function resolveFund(summary: CustomerSummary): FundId {
    return summary.fundId ?? fundId;
  }

  function resolveFundIds(summary: CustomerSummary): FundId[] {
    if (summary.fundIds?.length) return summary.fundIds;
    const fid = resolveFund(summary);
    return fid ? [fid] : [];
  }

  function accountTransactionsForSummary(summary: CustomerSummary): Transaction[] {
    if (multiFundCustomers && isMergedAccountSummary(summary)) {
      return enrichAccountTransactionsForDisplay(
        filterMergedAccountTransactions(transactions, summary),
        transactions,
      );
    }
    const summaryFund = resolveFund(summary);
    return enrichAccountTransactionsForDisplay(
      filterAccountViewTransactions(transactions, summaryFund, summary.name),
      transactions,
    );
  }

  function summaryKey(summary: CustomerSummary): string {
    return `${resolveFund(summary)}:${summary.name}`;
  }

  function isSummaryReadOnly(summary: CustomerSummary): boolean {
    if (readOnly && !multiFundCustomers) return true;
    if (multiFundCustomers && canEditFund) return !canEditFund(resolveFund(summary));
    return readOnly;
  }

  const fund = getFund(fundId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(s => s.name.toLowerCase().includes(q));
  }, [summaries, search]);

  const transferAccountNames = useMemo(
    () => summaries
      .map(s => s.name)
      .filter(name => !isFeeAccountName(name) && !isHalabLinkedAccountName(name)),
    [summaries],
  );

  function submitCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !onAddCustomer) return;
    const targetFundId = createFundId;
    if (!canRegisterCustomerName(name.trim(), targetFundId)) {
      setNameError('هالاسم محجوز لحساب الصندوق');
      return;
    }
    if (isFeeAccountName(name.trim())) {
      setNameError('هالاسم محجوز لحساب الأجور');
      return;
    }
    setNameError('');
    onAddCustomer(createCustomer({
      fundId: targetFundId,
      name: name.trim(),
      accountNumber: accountNumber.trim() || undefined,
      phone: phone.trim() || undefined,
      sharedFundIds: sharedFundIds.length ? sharedFundIds : undefined,
    }));
    setName('');
    setAccountNumber('');
    setPhone('');
    setSharedFundIds([]);
  }

  function resolveCustomer(summary: CustomerSummary): Customer | undefined {
    const fundIds = resolveFundIds(summary);
    const names = [...new Set([summary.name, ...(summary.aliases ?? [])])];
    for (const fid of fundIds) {
      for (const name of names) {
        const found = findCustomerForAccount(customers, name, fid);
        if (found) return found;
      }
    }
    return summary.customerId ? customers.find(c => c.id === summary.customerId) : undefined;
  }

  return (
    <div className="space-y-4">
      {!embedded && (
        <p className="text-xs text-slate-500">
          حسابات {fund.name} — يمكن مشاركة حساب مع صناديق محددة تختارها
        </p>
      )}

      {!readOnly && onAddCustomer && !reconciliationFocus && (multiFundCustomers ? editableFunds.length > 0 : true) && (
      <form onSubmit={submitCustomer} className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 space-y-3">
        <h3 className="font-semibold text-amber-400">حساب جديد</h3>
        <input type="text" placeholder="اسم الحساب" value={name} onChange={e => { setName(e.target.value); setNameError(''); }}
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" required />
        {nameError && <p className="text-xs text-rose-400">{nameError}</p>}
        <input type="text" placeholder="رقم الحساب (اختياري)" value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" dir="ltr" />
        <input type="text" placeholder="واتساب (اختياري)" value={phone} onChange={e => setPhone(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" />
        {transferFundOptions && transferFundOptions.length > 1 && (
          <div>
            <label className="mb-1 block text-[10px] text-slate-500">القسم (اختياري — مراكز افتراضي)</label>
            <select
              value={createFundId}
              onChange={e => setCreateFundId(e.target.value as FundId)}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm"
            >
              {transferFundOptions.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}
        <SharedFundIdsField
          homeFundId={createFundId}
          value={sharedFundIds}
          onChange={setSharedFundIds}
          fundOptions={funds}
        />
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

      {!readOnly && onAddTransaction && !reconciliationFocus && !multiFundCustomers && (
        <AccountTransferForm
          accountNames={transferAccountNames}
          fundId={fundId}
          onAdd={onAddTransaction}
        />
      )}

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
        <div>
          <p className="text-sm font-medium text-amber-300">عرض رصيد الحساب</p>
          <p className="text-[10px] text-slate-500">حوّل كل العملات والذهب لرصيد واحد بالدولار أو بالذهب</p>
        </div>
        <AccountValuationToolbar
          mode={valuationMode}
          onModeChange={setValuationMode}
          rates={valuationRates}
          isAdmin={isAdmin}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-500">لا يوجد حسابات</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(summary => {
            const summaryFund = resolveFund(summary);
            const isOpen = expanded === summaryKey(summary);
            const accountTx = accountTransactionsForSummary(summary);
            const summaryReadOnly = isSummaryReadOnly(summary);
            const summaryFundLabel = isMergedAccountSummary(summary)
              ? 'مجمّع'
              : getFund(summaryFund).shortName;
            const activeCurrencies = CURRENCIES.filter(c => {
              const b = summary.balances[c.id];
              return b && (b.receipts !== 0 || b.payments !== 0 || b.balance !== 0);
            });
            const customerPhone = resolveCustomer(summary)?.phone?.trim();
            const needsRecon = accountNeedsReconciliation(
              transactions,
              summaryFund,
              summary,
            );

            return (
              <div
                key={summaryKey(summary)}
                className={`rounded-2xl border overflow-hidden ${
                  needsRecon
                    ? 'border-amber-500/60 bg-amber-500/10'
                    : 'border-slate-700 bg-slate-800/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : summaryKey(summary))}
                  className="flex w-full items-center justify-between gap-2 p-3 text-right hover:bg-slate-700/30"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <User size={16} className={`shrink-0 ${needsRecon ? 'text-amber-300' : 'text-amber-400'}`} />
                    <span className="truncate font-medium">{summary.name}</span>
                    {needsRecon && (
                      <span
                        className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-amber-500/25 px-1.5 py-0.5 text-[10px] text-amber-200"
                        title="حركة بعد آخر مطابقة"
                      >
                        <AlertTriangle size={10} />
                        مطابقة
                      </span>
                    )}
                    {multiFundCustomers && (
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] ${
                        isMergedAccountSummary(summary)
                          ? 'bg-violet-500/15 text-violet-300'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {summaryFundLabel}
                      </span>
                    )}
                    {summary.sharedFundIds && summary.sharedFundIds.length > 0 && (
                      <span className="shrink-0 rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300" title={formatSharedFundLabels(summary.sharedFundIds, funds)}>
                        مشترك
                      </span>
                    )}
                    {summary.reconciliation?.throughDate && (
                      <span className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300" title={`مطابق حتى ${formatDateAr(summary.reconciliation.throughDate)}`}>
                        <CheckCircle2 size={10} />
                        مطابق
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {activeCurrencies.length > 0 && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setStatementAccount(summary); }}
                        className="flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-medium text-sky-400 hover:bg-sky-500/20"
                        title="كشف حساب"
                      >
                        <FileText size={12} />
                        كشف
                      </button>
                    )}
                    {onMoneyOutReconciliation && isMoneyOutReconciliationAccount(summaryFund, summary.name) && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onMoneyOutReconciliation(summary); }}
                        className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-300 hover:bg-violet-500/20"
                        title="رسالة مطابقة موني آوت"
                      >
                        <MessageCircle size={12} />
                        موني آوت
                      </button>
                    )}
                    {onShareAccount && activeCurrencies.length > 0 && !customerPhone && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onShareAccount(summary); }}
                        className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20"
                        title="مشاركة الرصيد للمطابقة"
                      >
                        <Share2 size={12} />
                        مشاركة
                      </button>
                    )}
                    {customerPhone && (
                      <AccountWhatsAppQuickActions
                        phone={customerPhone}
                        fundId={summaryFund}
                        summary={summary}
                        onShareImage={onShareAccount && activeCurrencies.length > 0
                          ? () => onShareAccount(summary)
                          : undefined}
                        compact
                      />
                    )}
                    {summary.customerId && onDeleteCustomer && isAdmin && !summaryReadOnly && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setPendingDelete({
                            customerId: summary.customerId!,
                            name: summary.name,
                            txCount: accountTx.length,
                          });
                        }}
                        className="rounded-lg p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {!summaryReadOnly && onMoveAccount && transferFundOptions && transferFundOptions.length > 1 && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setMovingSummary(summary);
                        }}
                        className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-400 hover:bg-cyan-500/20"
                        title="نقل بين المراكز والزبائن"
                      >
                        <ArrowRightLeft size={12} />
                        نقل
                      </button>
                    )}
                    {!summaryReadOnly && onUpdateCustomer && resolveCustomer(summary) && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          const customer = resolveCustomer(summary);
                          if (customer) setEditingCustomer(customer);
                        }}
                        className="rounded-lg p-1 text-slate-500 hover:text-amber-400"
                        title="تعديل الحساب"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {activeCurrencies.length > 0 && (
                  <div className="border-t border-slate-700 px-3 py-2">
                    <AccountValuationView
                      balances={summary.balances}
                      rates={valuationRates}
                      mode={valuationMode}
                      compact={!isOpen}
                    />
                  </div>
                )}

                {isOpen && (
                  <div className="border-t border-slate-700 p-3 space-y-3">
                    {customerPhone && (
                      <AccountWhatsAppQuickActions
                        phone={customerPhone}
                        fundId={summaryFund}
                        summary={summary}
                        onShareImage={onShareAccount && activeCurrencies.length > 0
                          ? () => onShareAccount(summary)
                          : undefined}
                      />
                    )}
                    {resolveCustomer(summary) && onUpdateCustomer && (
                      <ReconciliationBar
                        customer={resolveCustomer(summary)!}
                        actorName={actorName}
                        readOnly={summaryReadOnly}
                        onSave={async (customer) => {
                          await onUpdateCustomer(customer, customer.name);
                        }}
                      />
                    )}
                    {!summaryReadOnly && onAddTransaction && (
                      <AccountTransactionForm
                        accountName={summary.name}
                        fundId={summaryFund}
                        fundOptions={funds}
                        otherAccountNames={filtered
                          .map(s => s.name)
                          .filter(name => name !== summary.name && !isFeeAccountName(name))}
                        onAdd={onAddTransaction}
                      />
                    )}
                    <div>
                      <p className="mb-2 text-xs text-slate-500">حركات الحساب</p>
                      <TransactionList
                        transactions={accountTx}
                        onDelete={onDeleteTransaction}
                        onEdit={onEditTransaction}
                        reconciledThroughDate={summary.reconciliation?.throughDate}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingCustomer && onUpdateCustomer && (
        <EditCustomerModal
          customer={editingCustomer}
          fundOptions={fundOptions}
          onClose={() => setEditingCustomer(null)}
          onSave={async (updated, previousName) => {
            await onUpdateCustomer(updated, previousName);
            const prevKey = `${editingCustomer.fundId}:${previousName}`;
            if (expanded === prevKey) setExpanded(`${updated.fundId}:${updated.name}`);
          }}
          nameTaken={(name, targetFundId) => accountExistsInFund(
            customers,
            targetFundId,
            name,
            editingCustomer.id,
          )}
        />
      )}

      {movingSummary && onMoveAccount && transferFundOptions && (
        <MoveAccountModal
          summary={movingSummary}
          customer={resolveCustomer(movingSummary)}
          transactions={transactions}
          transferFundOptions={transferFundOptions}
          onClose={() => setMovingSummary(null)}
          onMove={onMoveAccount}
          nameTaken={(name, targetFundId) => accountExistsInFund(
            customers,
            targetFundId,
            name,
            resolveCustomer(movingSummary)?.id,
          )}
        />
      )}

      {statementAccount && (
        <AccountStatementModal
          accountName={statementAccount.name}
          fundId={statementAccount.fundId ?? fundId}
          transactions={transactions}
          reconciledThroughDate={statementAccount.reconciliation?.throughDate}
          onClose={() => setStatementAccount(null)}
        />
      )}

      {pendingDelete && onDeleteCustomer && (
        <ConfirmDeleteModal
          title="حذف الحساب؟"
          message={`متأكد من حذف «${pendingDelete.name}»؟`}
          warning={pendingDelete.txCount > 0
            ? `⚠️ يوجد ${pendingDelete.txCount} حركة على هذا الحساب — الحذف يزيل التسجيل فقط (الحركات تبقى).`
            : 'لا يوجد حركات على هذا الحساب.'}
          confirmLabel="حذف الحساب"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            onDeleteCustomer(pendingDelete.customerId);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
