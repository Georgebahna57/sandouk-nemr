import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, BookOpen, Clock, Eye, FileText, Loader2, LogOut, ScrollText, Search, Settings, Share2, Users, Wallet, X } from 'lucide-react';
import { BalanceCards } from './components/BalanceCards';
import { BillsPanel } from './components/BillsPanel';
import { AccountsSection } from './components/AccountsSection';
import { CustomersPanel } from './components/CustomersPanel';
import { DailyJournalModal } from './components/DailyJournalModal';
import { EditTransactionModal } from './components/EditTransactionModal';
import { FundSelector } from './components/FundSelector';
import { FundTransferForm } from './components/FundTransferForm';
import { TransactionFiltersBar, hasActiveTransactionFilters } from './components/TransactionFiltersBar';
import { TransactionForm } from './components/TransactionForm';
import { TransactionList } from './components/TransactionList';
import { AdminPanel } from './components/AdminPanel';
import { ApproveAllPendingModal } from './components/ApproveAllPendingModal';
import { ApproveTransactionModal } from './components/ApproveTransactionModal';
import { BalanceShareImageModal } from './components/BalanceShareImageModal';
import { PendingAmountTotals } from './components/PendingAmountTotals';
import { PendingWhatsAppModal } from './components/PendingWhatsAppModal';
import { getFund, isBoxFund, isHalabFleilatFund } from './config';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useCloudStore } from './hooks/useCloudStore';
import { usePermissions } from './hooks/usePermissions';
import {
  applyTransactionFilters,
  accountNeedsReconciliation,
  buildAccountSummaries,
  countAccountsNeedingReconciliation,
  computeBalances,
  computeProjectedFundBalances,
  expandFilteredTransactions,
  filterByFund,
  filterTransactions,
  formatDateAr,
  getAvailableAccountNames,
  getOperationGroupIds,
  getPendingFundOperationLeads,
  todayIso,
} from './lib/utils';
import type { AppSectionId, FundId, TransactionFilters, ViewId } from './types';
import type { User } from '@supabase/supabase-js';
import { fetchFundWhatsAppPhones, type FundWhatsAppMap } from './lib/fundSettings';
import { fetchValuationRates, saveValuationRates } from './lib/appSettings';
import type { ValuationRates } from './lib/valuationRates';
import { loadValuationRatesLocal } from './lib/valuationRates';
import { fetchAllProfiles } from './lib/profile';
import type { UserProfile } from './lib/permissions';
import { buildApprovalWhatsAppMessage, resolveShareDestinations } from './lib/whatsapp';
import { buildMoneyOutReconciliationMessage } from './lib/halabMirror';
import { isFeeAccountName } from './lib/fees';
import type { BalanceSharePayload } from './lib/balanceShare';

const FUND_VIEWS: { id: ViewId; label: string; icon: typeof Wallet }[] = [
  { id: 'ledger', label: 'الصندوق', icon: Wallet },
  { id: 'pending', label: 'قيد الانتظار', icon: Clock },
  { id: 'customers', label: 'الحسابات', icon: Users },
  { id: 'bills', label: 'فواتير', icon: FileText },
];

const APP_SECTIONS: { id: AppSectionId; label: string; icon: typeof Wallet }[] = [
  { id: 'funds', label: 'الصناديق', icon: Wallet },
  { id: 'accounts', label: 'حسابات', icon: Users },
];

interface Props {
  user: User;
  onLogout: () => void;
}

export default function App({ user, onLogout }: Props) {
  const [showAdmin, setShowAdmin] = useState(false);
  const [appSection, setAppSection] = useState<AppSectionId>('funds');
  const [fundId, setFundId] = useState<FundId>('nemr');
  const [view, setView] = useState<ViewId>('ledger');
  const [txFilters, setTxFilters] = useState<TransactionFilters>({});
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [fundWhatsApp, setFundWhatsApp] = useState<FundWhatsAppMap>({});
  const [whatsappPrompt, setWhatsappPrompt] = useState<{
    message: string;
    destinations: string[];
    title?: string;
    subtitle?: string;
  } | null>(null);
  const [approvingTxId, setApprovingTxId] = useState<string | null>(null);
  const [approvingAllPending, setApprovingAllPending] = useState(false);
  const [balanceShare, setBalanceShare] = useState<{
    payload: BalanceSharePayload;
    destinations: string[];
  } | null>(null);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [valuationRates, setValuationRates] = useState<ValuationRates>(() => loadValuationRatesLocal());
  const [savingValuationRates, setSavingValuationRates] = useState(false);
  const [dailyJournalOpen, setDailyJournalOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState('');

  const {
    profile,
    visibleBoxFunds,
    canAccessCenters,
    fundAccess,
    canEdit,
    loading: permsLoading,
    error: permsError,
    isAdmin,
  } = usePermissions(user);

  const {
    state,
    loading: dataLoading,
    syncing,
    error: syncError,
    addTransaction,
    updateTransaction,
    approvePendingOperations,
    deleteTransaction,
    editTransactions,
    addBill,
    deleteBill,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addComment,
    claimTransaction,
    releaseClaim,
    restoreBackup,
    repairHalabData,
  } = useCloudStore(true, user.email ? {
    userId: user.id,
    email: user.email,
    displayName: profile?.displayName ?? user.email.split('@')[0] ?? 'مستخدم',
  } : undefined);

  useEffect(() => {
    fetchFundWhatsAppPhones().then(setFundWhatsApp);
    fetchValuationRates().then(setValuationRates);
  }, [showAdmin]);

  useEffect(() => {
    setPendingQuery('');
  }, [fundId]);

  useEffect(() => {
    fetchAllProfiles()
      .then(setTeamMembers)
      .catch(() => setTeamMembers([]));
  }, []);

  const readOnly = !canEdit(fundId);
  const canManageAccounts = isAdmin || canEdit(fundId);
  const fund = getFund(fundId);
  const today = todayIso();
  const actorName = profile?.displayName ?? user.email?.split('@')[0] ?? 'مستخدم';

  useEffect(() => {
    if (visibleBoxFunds.length === 0) return;
    if (!isBoxFund(fundId) || !visibleBoxFunds.some(f => f.id === fundId)) {
      setFundId(visibleBoxFunds[0].id);
    }
  }, [visibleBoxFunds, fundId]);

  const balances = useMemo(() => computeBalances(state.transactions, fundId), [state.transactions, fundId]);

  const debouncedPendingQuery = useDebouncedValue(pendingQuery, 200);

  const allPosted = useMemo(
    () => filterTransactions(state.transactions, fundId, { status: 'posted' }),
    [state.transactions, fundId],
  );

  const filteredPosted = useMemo(() => {
    const reviewing = hasActiveTransactionFilters(txFilters);
    const effectiveFilters = reviewing
      ? txFilters
      : { dateFrom: today, dateTo: today };
    const matched = applyTransactionFilters(allPosted, effectiveFilters);
    return expandFilteredTransactions(allPosted, matched);
  }, [allPosted, txFilters, today]);

  const reviewingPosted = hasActiveTransactionFilters(txFilters);

  const todayFundTx = useMemo(() => {
    const matched = applyTransactionFilters(allPosted, { dateFrom: today, dateTo: today });
    return expandFilteredTransactions(allPosted, matched);
  }, [allPosted, today]);

  const pending = useMemo(
    () => filterTransactions(state.transactions, fundId, { status: 'pending' }),
    [state.transactions, fundId],
  );

  const projectedBalances = useMemo(
    () => (view === 'pending' && pending.length > 0)
      ? computeProjectedFundBalances(state.transactions, fundId)
      : balances,
    [view, pending.length, state.transactions, fundId, balances],
  );

  const filteredPending = useMemo(() => {
    const q = debouncedPendingQuery.trim();
    if (!q) return pending;
    const matched = applyTransactionFilters(pending, { query: q });
    return expandFilteredTransactions(pending, matched);
  }, [pending, debouncedPendingQuery]);

  const fundBills = useMemo(() => filterByFund(state.bills, fundId), [state.bills, fundId]);

  const fundAccountSummaries = useMemo(
    () => buildAccountSummaries(state.transactions, state.customers, fundId),
    [state.transactions, state.customers, fundId],
  );

  const fundAccountsNeedingReconciliation = useMemo(
    () => fundAccountSummaries.filter(s => accountNeedsReconciliation(state.transactions, fundId, s)).length,
    [fundAccountSummaries, state.transactions, fundId],
  );

  const accountsNeedingReconciliation = useMemo(
    () => countAccountsNeedingReconciliation(
      state.transactions,
      state.customers,
      visibleBoxFunds.map(f => f.id),
      canAccessCenters,
    ),
    [state.transactions, state.customers, visibleBoxFunds, canAccessCenters],
  );

  const accountNames = useMemo(
    () => getAvailableAccountNames(state.customers, fundId).filter(n => !isFeeAccountName(n)),
    [state.customers, fundId],
  );

  const pendingOperationLeads = useMemo(
    () => getPendingFundOperationLeads(state.transactions, fundId),
    [state.transactions, fundId],
  );

  const handlePendingWhatsApp = useCallback((payload: { message: string; destinations: string[] }) => {
    setWhatsappPrompt({
      ...payload,
      title: 'إرسال على واتساب',
      subtitle: payload.message.startsWith('⏳')
        ? 'تم حفظ العملية بقيد الانتظار'
        : 'تم حفظ حركة الصندوق — أرسل الرسالة',
    });
  }, []);

  async function handleApproveAllConfirm(approvalDetails: string) {
    if (!pendingOperationLeads.length) return;
    const now = new Date().toISOString();
    await approvePendingOperations(pendingOperationLeads, {
      approvalDetails: approvalDetails || undefined,
      approvedByName: profile?.displayName,
      approvedByEmail: user.email ?? undefined,
      executionDate: todayIso(),
      approvedAt: now,
    });
    setApprovingAllPending(false);
  }

  async function handleApproveConfirm(approvalDetails: string, sendWhatsApp: boolean) {
    if (!approvingTxId) return;
    const lead = state.transactions.find(t => t.id === approvingTxId);
    if (!lead) return;

    const now = new Date().toISOString();
    const executionDate = todayIso();
    const orderedDate = lead.date !== executionDate ? lead.date : undefined;
    await updateTransaction(approvingTxId, {
      status: 'posted',
      date: executionDate,
      orderedDate,
      approvalDetails: approvalDetails || undefined,
      approvedByName: profile?.displayName,
      approvedByEmail: user.email ?? undefined,
      approvedAt: now,
    });

    const destinations = fundWhatsApp[lead.fundId] ?? [];
    if (sendWhatsApp && destinations.length) {
      const ids = getOperationGroupIds(state.transactions, approvingTxId);
      const fundTxs = state.transactions.filter(t => ids.includes(t.id) && (t.ledger ?? 'fund') === 'fund');
      const message = buildApprovalWhatsAppMessage(
        lead,
        fundTxs.length ? fundTxs : [lead],
        approvalDetails,
      );
      setWhatsappPrompt({
        message,
        destinations,
        title: 'رد الاعتماد على واتساب',
        subtitle: 'رد على رسالة الانتظار — الصق بالكروب واضغط إرسال',
      });
    }

    setApprovingTxId(null);
  }

  async function handleSaveValuationRates(rates: ValuationRates) {
    setSavingValuationRates(true);
    try {
      await saveValuationRates(rates);
      setValuationRates(rates);
    } finally {
      setSavingValuationRates(false);
    }
  }

  if (showAdmin && isAdmin) {
    return (
      <AdminPanel
        onBack={() => setShowAdmin(false)}
        onWhatsAppSaved={() => fetchFundWhatsAppPhones().then(setFundWhatsApp)}
        valuationRates={valuationRates}
        onSaveValuationRates={handleSaveValuationRates}
        savingValuationRates={savingValuationRates}
        appState={state}
        onRestoreBackup={async (backup, mode) => {
          await restoreBackup(backup, mode);
          if (backup.valuationRates) setValuationRates(backup.valuationRates);
        }}
        onAddOpeningBalance={addTransaction}
        onRepairHalab={repairHalabData}
      />
    );
  }

  if (permsLoading || dataLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-amber-400" size={32} />
        <p className="text-sm text-slate-400">جاري التحميل...</p>
      </div>
    );
  }

  if (visibleBoxFunds.length === 0 && !canAccessCenters) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 text-center">
        <p className="text-lg font-semibold text-amber-400">صناديق</p>
        <p className="mt-3 text-sm text-slate-400">ما عندك صلاحية على أي صندوق.</p>
        <p className="mt-1 text-xs text-slate-500">تواصل مع المسؤول لتفعيل حسابك.</p>
        <button type="button" onClick={onLogout} className="mt-6 text-sm text-rose-400">خروج</button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl p-3" style={{ background: `${fund.accent}22` }}>
              <BookOpen size={24} style={{ color: fund.accent }} />
            </div>
            <div>
              <h1 className="text-xl font-bold">صناديق</h1>
              <p className="text-xs text-slate-500">{profile?.displayName ?? user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAdmin(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-amber-400"
              >
                <Settings size={14} />
                إدارة
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-rose-400"
            >
              <LogOut size={14} />
              خروج
            </button>
          </div>
        </div>
        {(syncing || syncError || permsError) && (
          <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${
            syncError || permsError ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
          }`}>
            {syncError ?? permsError ?? 'جاري الحفظ على السحابة...'}
          </div>
        )}
      </header>

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-800/50 p-1">
        {APP_SECTIONS.map(s => {
          const Icon = s.icon;
          const badge = s.id === 'accounts' && accountsNeedingReconciliation > 0
            ? accountsNeedingReconciliation
            : s.id === 'funds' && pending.length > 0
              ? pending.length
              : null;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setAppSection(s.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                appSection === s.id ? 'bg-slate-700 text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={16} />
              {s.label}
              {badge !== null && (
                <span className={`rounded-full px-1.5 text-[10px] text-white ${
                  s.id === 'accounts' ? 'bg-amber-500 text-slate-900' : 'bg-rose-500'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <section className="mb-4">
        {appSection === 'funds' && (
        <FundSelector
          funds={visibleBoxFunds}
          active={fundId}
          fundAccess={fundAccess}
          onChange={setFundId}
        />
        )}
      </section>

      {appSection === 'funds' && (
      <>
      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold truncate" style={{ color: fund.accent }}>{fund.name}</h2>
            {readOnly && (
              <span className="flex items-center gap-1 rounded-md bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
                <Eye size={10} />
                مراجعة فقط
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDailyJournalOpen(true)}
              className="flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-medium text-sky-400 hover:bg-sky-500/20"
            >
              <ScrollText size={12} />
              يومية
            </button>
            <button
              type="button"
              onClick={() => setBalanceShare({
                payload: {
                  kind: 'fund',
                  fundId,
                  balances,
                  date: today,
                  dailyTransactions: todayFundTx,
                  pendingTransactions: pending,
                },
                destinations: resolveShareDestinations(undefined, fundWhatsApp[fundId]),
              })}
              className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20"
            >
              <Share2 size={12} />
              مشاركة الرصيد
            </button>
            <span className="text-xs text-slate-500">{formatDateAr(today)}</span>
          </div>
        </div>
        <BalanceCards
          balances={balances}
          fundId={fundId}
          projectedBalances={view === 'pending' && pending.length > 0 ? projectedBalances : undefined}
        />
      </section>

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-800/50 p-1">
        {FUND_VIEWS.map(v => {
          const Icon = v.icon;
          const badge = v.id === 'pending' && pending.length > 0
            ? pending.length
            : v.id === 'customers' && fundAccountsNeedingReconciliation > 0
              ? fundAccountsNeedingReconciliation
              : null;
          return (
            <button key={v.id} type="button" onClick={() => setView(v.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-2.5 text-xs font-medium transition sm:text-sm ${view === v.id ? 'bg-slate-700 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}>
              <Icon size={15} />
              {v.label}
              {badge !== null && (
                <span className={`rounded-full px-1.5 text-[10px] text-white ${
                  v.id === 'customers' ? 'bg-amber-500 text-slate-900' : 'bg-rose-500'
                }`}>{badge}</span>
              )}
            </button>
          );
        })}
      </nav>
      </>
      )}

      <main>
        {appSection === 'funds' && view === 'ledger' && (
          <div className="space-y-4">
            {!readOnly && (
              <>
                <TransactionForm
                  fundId={fundId}
                  onAdd={addTransaction}
                  counterpartyNames={accountNames}
                  whatsappDestinations={fundWhatsApp[fundId]}
                  actorName={profile?.displayName}
                  onPendingWhatsApp={handlePendingWhatsApp}
                />
                <FundTransferForm
                  fromFundId={fundId}
                  fundOptions={visibleBoxFunds.filter(f => canEdit(f.id))}
                  onAdd={addTransaction}
                />
              </>
            )}
            <TransactionFiltersBar filters={txFilters} onChange={setTxFilters} />
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-400">
                {reviewingPosted
                  ? `نتائج البحث (${filteredPosted.length}${filteredPosted.length !== allPosted.length ? ` من ${allPosted.length}` : ''})`
                  : `عمليات اليوم — ${formatDateAr(today)} (${filteredPosted.length})`}
              </h3>
              {!reviewingPosted && filteredPosted.length === 0 && (
                <p className="mb-2 text-xs text-slate-500">ما في عمليات اليوم. افتح «فلترة وبحث» لمراجعة أيام سابقة.</p>
              )}
              <TransactionList
                transactions={filteredPosted}
                compact
                onDelete={isAdmin ? deleteTransaction : undefined}
                onEdit={isAdmin ? setEditingTxId : undefined}
              />
            </div>
          </div>
        )}

        {editingTxId && (
          <EditTransactionModal
            key={editingTxId}
            leadId={editingTxId}
            allTransactions={state.transactions}
            onClose={() => setEditingTxId(null)}
            onSave={(updated, summary) => {
              editTransactions(updated, summary);
              setEditingTxId(null);
            }}
          />
        )}

        {appSection === 'funds' && view === 'pending' && (
          <div className="space-y-4">
            {isAdmin && !(fundWhatsApp[fundId]?.length) && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                ما في كروبات واتساب لـ {fund.name}. اضغط <strong>إدارة</strong> → واتساب قيد الانتظار → حط روابط الكروبات (سطر لكل كروب).
              </div>
            )}
            {!readOnly && (
              <TransactionForm
                fundId={fundId}
                onAdd={addTransaction}
                defaultPending
                counterpartyNames={accountNames}
                whatsappDestinations={fundWhatsApp[fundId]}
                actorName={profile?.displayName}
                onPendingWhatsApp={handlePendingWhatsApp}
              />
            )}
            {pending.length > 0 && (
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  placeholder="مبلغ، اسم، أو الرقم العام..."
                  value={pendingQuery}
                  onChange={e => setPendingQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 py-2 pl-8 pr-9 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none"
                />
                {pendingQuery && (
                  <button
                    type="button"
                    onClick={() => setPendingQuery('')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-300"
                    aria-label="مسح البحث"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
            {isHalabFleilatFund(fundId) && pending.length > 0 && !readOnly && (
              <button
                type="button"
                onClick={() => setApprovingAllPending(true)}
                disabled={syncing}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-60"
              >
                <CheckCircle2 size={16} />
                اعتماد الكل ({pendingOperationLeads.length})
              </button>
            )}
            {filteredPending.length > 0 && (
              <PendingAmountTotals transactions={filteredPending} />
            )}
            <TransactionList
              transactions={filteredPending}
              compact
              showApprove={!readOnly}
              showCoordination
              onApprove={readOnly ? undefined : id => setApprovingTxId(id)}
              onDelete={isAdmin ? deleteTransaction : undefined}
              onEdit={!readOnly ? setEditingTxId : undefined}
              currentUserId={user.id}
              teamMembers={teamMembers.map(m => ({ id: m.id, displayName: m.displayName }))}
              onAddComment={readOnly ? undefined : addComment}
              onClaim={readOnly ? undefined : claimTransaction}
              onReleaseClaim={readOnly ? undefined : releaseClaim}
              readOnly={readOnly}
            />
          </div>
        )}

        {appSection === 'funds' && view === 'customers' && (
          <CustomersPanel
            summaries={fundAccountSummaries}
            customers={state.customers}
            transactions={state.transactions}
            fundId={fundId}
            fundOptions={visibleBoxFunds}
            onAddCustomer={canManageAccounts ? addCustomer : undefined}
            onUpdateCustomer={canManageAccounts ? updateCustomer : undefined}
            onDeleteCustomer={canManageAccounts ? deleteCustomer : undefined}
            onAddTransaction={canManageAccounts ? addTransaction : undefined}
            onDeleteTransaction={isAdmin ? deleteTransaction : undefined}
            onEditTransaction={isAdmin ? setEditingTxId : undefined}
            onShareAccount={summary => {
              const customer = state.customers.find(
                c => c.fundId === fundId && (c.id === summary.customerId || c.name === summary.name),
              );
              setBalanceShare({
                payload: {
                  kind: 'account',
                  fundId,
                  accountName: summary.name,
                  balances: summary.balances,
                  date: today,
                },
                destinations: resolveShareDestinations(customer?.phone, fundWhatsApp[fundId]),
              });
            }}
            onMoneyOutReconciliation={summary => {
              const customer = state.customers.find(
                c => c.fundId === fundId && (c.id === summary.customerId || c.name === summary.name),
              );
              setWhatsappPrompt({
                message: buildMoneyOutReconciliationMessage(summary.balances, today),
                destinations: resolveShareDestinations(customer?.phone, fundWhatsApp[fundId]),
                title: 'مطابقة موني آوت',
                subtitle: 'رصيد حساب حلب — انسخ أو أرسل على واتساب',
              });
            }}
            valuationRates={valuationRates}
            isAdmin={isAdmin}
            actorName={actorName}
            readOnly={!canManageAccounts}
          />
        )}

        {appSection === 'accounts' && (
          <AccountsSection
            transactions={state.transactions}
            customers={state.customers}
            boxFunds={visibleBoxFunds}
            canAccessCenters={canAccessCenters}
            canEdit={canEdit}
            onAddCustomer={addCustomer}
            onUpdateCustomer={updateCustomer}
            onDeleteCustomer={deleteCustomer}
            onAddTransaction={addTransaction}
            onDeleteTransaction={isAdmin ? deleteTransaction : undefined}
            onEditTransaction={isAdmin ? setEditingTxId : undefined}
            onShareAccount={(shareFundId, summary) => {
              const customer = state.customers.find(
                c => c.fundId === shareFundId && (c.id === summary.customerId || c.name === summary.name),
              );
              setBalanceShare({
                payload: {
                  kind: 'account',
                  fundId: shareFundId,
                  accountName: summary.name,
                  balances: summary.balances,
                  date: today,
                },
                destinations: resolveShareDestinations(customer?.phone, fundWhatsApp[shareFundId]),
              });
            }}
            onMoneyOutReconciliation={(shareFundId, summary) => {
              const customer = state.customers.find(
                c => c.fundId === shareFundId && (c.id === summary.customerId || c.name === summary.name),
              );
              setWhatsappPrompt({
                message: buildMoneyOutReconciliationMessage(summary.balances, today),
                destinations: resolveShareDestinations(customer?.phone, fundWhatsApp[shareFundId]),
                title: 'مطابقة موني آوت',
                subtitle: 'رصيد حساب حلب — انسخ أو أرسل على واتساب',
              });
            }}
            valuationRates={valuationRates}
            isAdmin={isAdmin}
            actorName={actorName}
          />
        )}

        {appSection === 'funds' && view === 'bills' && (
          <BillsPanel
            fundId={fundId}
            bills={fundBills}
            onAdd={readOnly ? undefined : addBill}
            onDelete={readOnly ? undefined : deleteBill}
            readOnly={readOnly}
          />
        )}
      </main>

      <footer className="mt-8 text-center text-xs text-slate-600">
        البيانات محفوظة على السحابة — كل صندوق له حسابه الافتراضي
      </footer>

      {approvingAllPending && isHalabFleilatFund(fundId) && (
        <ApproveAllPendingModal
          pendingTransactions={pending}
          operationCount={pendingOperationLeads.length}
          approverName={profile?.displayName}
          busy={syncing}
          onClose={() => setApprovingAllPending(false)}
          onApprove={handleApproveAllConfirm}
        />
      )}

      {approvingTxId && (() => {
        const approvingLead = state.transactions.find(t => t.id === approvingTxId);
        const approvingDestinations = approvingLead
          ? (fundWhatsApp[approvingLead.fundId] ?? [])
          : [];
        return (
          <ApproveTransactionModal
            leadId={approvingTxId}
            allTransactions={state.transactions}
            approverName={profile?.displayName}
            hasWhatsApp={approvingDestinations.length > 0}
            onClose={() => setApprovingTxId(null)}
            onApprove={handleApproveConfirm}
          />
        );
      })()}

      {balanceShare && (
        <BalanceShareImageModal
          payload={balanceShare.payload}
          destinations={balanceShare.destinations}
          onClose={() => setBalanceShare(null)}
        />
      )}

      {whatsappPrompt && (
        <PendingWhatsAppModal
          message={whatsappPrompt.message}
          destinations={whatsappPrompt.destinations}
          title={whatsappPrompt.title}
          subtitle={whatsappPrompt.subtitle}
          onClose={() => setWhatsappPrompt(null)}
        />
      )}

      {dailyJournalOpen && (
        <DailyJournalModal
          fundId={fundId}
          transactions={state.transactions}
          defaultDate={today}
          onClose={() => setDailyJournalOpen(false)}
        />
      )}
    </div>
  );
}
