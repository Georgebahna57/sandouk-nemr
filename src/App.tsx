import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Clock, FileText, Eye, Loader2, LogOut, Settings, Users, Wallet } from 'lucide-react';
import { BalanceCards } from './components/BalanceCards';
import { BillsPanel } from './components/BillsPanel';
import { CustomersPanel } from './components/CustomersPanel';
import { EditTransactionModal } from './components/EditTransactionModal';
import { FundSelector } from './components/FundSelector';
import { TransactionFiltersBar } from './components/TransactionFiltersBar';
import { TransactionForm } from './components/TransactionForm';
import { TransactionList } from './components/TransactionList';
import { AdminPanel } from './components/AdminPanel';
import { ApproveTransactionModal } from './components/ApproveTransactionModal';
import { PendingWhatsAppModal } from './components/PendingWhatsAppModal';
import { getFund } from './config';
import { useCloudStore } from './hooks/useCloudStore';
import { usePermissions } from './hooks/usePermissions';
import {
  applyTransactionFilters,
  buildAccountSummaries,
  computeBalances,
  expandFilteredTransactions,
  filterByFund,
  filterTransactions,
  formatDateAr,
  getOperationGroupIds,
  todayIso,
} from './lib/utils';
import type { FundId, TransactionFilters, ViewId } from './types';
import type { User } from '@supabase/supabase-js';
import { fetchFundWhatsAppPhones, type FundWhatsAppMap } from './lib/fundSettings';
import { buildApprovalWhatsAppMessage } from './lib/whatsapp';

const VIEWS: { id: ViewId; label: string; icon: typeof Wallet }[] = [
  { id: 'ledger', label: 'الصندوق', icon: Wallet },
  { id: 'pending', label: 'قيد الانتظار', icon: Clock },
  { id: 'customers', label: 'الحسابات', icon: Users },
  { id: 'bills', label: 'فواتير', icon: FileText },
];

interface Props {
  user: User;
  onLogout: () => void;
}

export default function App({ user, onLogout }: Props) {
  const [showAdmin, setShowAdmin] = useState(false);
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

  const {
    profile,
    visibleFunds,
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
    deleteTransaction,
    editTransactions,
    addBill,
    deleteBill,
    addCustomer,
    deleteCustomer,
  } = useCloudStore(true, user.email ? {
    userId: user.id,
    email: user.email,
    displayName: profile?.displayName ?? user.email.split('@')[0] ?? 'مستخدم',
  } : undefined);

  useEffect(() => {
    fetchFundWhatsAppPhones().then(setFundWhatsApp);
  }, [showAdmin]);

  const readOnly = !canEdit(fundId);
  const canManageAccounts = isAdmin || canEdit(fundId);
  const fund = getFund(fundId);
  const today = todayIso();

  useEffect(() => {
    if (visibleFunds.length === 0) return;
    if (!visibleFunds.some(f => f.id === fundId)) {
      setFundId(visibleFunds[0].id);
    }
  }, [visibleFunds, fundId]);

  const balances = useMemo(() => computeBalances(state.transactions, fundId), [state.transactions, fundId]);

  const allPosted = useMemo(
    () => filterTransactions(state.transactions, fundId, { status: 'posted' }),
    [state.transactions, fundId],
  );

  const filteredPosted = useMemo(() => {
    const matched = applyTransactionFilters(allPosted, txFilters);
    return expandFilteredTransactions(allPosted, matched);
  }, [allPosted, txFilters]);

  const pending = useMemo(
    () => filterTransactions(state.transactions, fundId, { status: 'pending' }),
    [state.transactions, fundId],
  );

  const fundBills = useMemo(() => filterByFund(state.bills, fundId), [state.bills, fundId]);

  const accountSummaries = useMemo(
    () => buildAccountSummaries(state.transactions, state.customers, fundId),
    [state.transactions, state.customers, fundId],
  );

  const accountNames = useMemo(
    () => accountSummaries.map(s => s.name),
    [accountSummaries],
  );

  async function handleApproveConfirm(approvalDetails: string) {
    if (!approvingTxId) return;
    const lead = state.transactions.find(t => t.id === approvingTxId);
    if (!lead) return;

    const now = new Date().toISOString();
    await updateTransaction(approvingTxId, {
      status: 'posted',
      approvalDetails: approvalDetails || undefined,
      approvedByName: profile?.displayName,
      approvedByEmail: user.email ?? undefined,
      approvedAt: now,
    });

    const destinations = fundWhatsApp[lead.fundId] ?? [];
    if (destinations.length) {
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

  if (showAdmin && isAdmin) {
    return (
      <AdminPanel
        onBack={() => setShowAdmin(false)}
        onWhatsAppSaved={() => fetchFundWhatsAppPhones().then(setFundWhatsApp)}
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

  if (visibleFunds.length === 0) {
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

      <section className="mb-4">
        <FundSelector
          funds={visibleFunds}
          active={fundId}
          fundAccess={fundAccess}
          onChange={setFundId}
        />
      </section>

      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: fund.accent }}>{fund.name}</h2>
            {readOnly && (
              <span className="flex items-center gap-1 rounded-md bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
                <Eye size={10} />
                مراجعة فقط
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">{formatDateAr(today)}</span>
        </div>
        <BalanceCards balances={balances} />
      </section>

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-800/50 p-1">
        {VIEWS.map(v => {
          const Icon = v.icon;
          const badge = v.id === 'pending' && pending.length > 0 ? pending.length : null;
          return (
            <button key={v.id} type="button" onClick={() => setView(v.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-2.5 text-xs font-medium transition sm:text-sm ${view === v.id ? 'bg-slate-700 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}>
              <Icon size={15} />
              {v.label}
              {badge !== null && (
                <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <main>
        {view === 'ledger' && (
          <div className="space-y-4">
            {!readOnly && (
              <TransactionForm
                fundId={fundId}
                onAdd={addTransaction}
                counterpartyNames={accountNames}
                whatsappDestinations={fundWhatsApp[fundId]}
                actorName={profile?.displayName}
                onPendingWhatsApp={payload => setWhatsappPrompt({
                  ...payload,
                  title: 'إرسال على واتساب',
                  subtitle: 'تم حفظ العملية بقيد الانتظار',
                })}
              />
            )}
            <TransactionFiltersBar filters={txFilters} onChange={setTxFilters} />
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-400">
                كل عمليات الصندوق ({filteredPosted.length}{filteredPosted.length !== allPosted.length ? ` من ${allPosted.length}` : ''})
              </h3>
              <TransactionList
                transactions={filteredPosted}
                onDelete={isAdmin ? deleteTransaction : undefined}
                onEdit={isAdmin ? setEditingTxId : undefined}
              />
            </div>
          </div>
        )}

        {editingTxId && (
          <EditTransactionModal
            leadId={editingTxId}
            allTransactions={state.transactions}
            onClose={() => setEditingTxId(null)}
            onSave={(updated, summary) => {
              editTransactions(updated, summary);
              setEditingTxId(null);
            }}
          />
        )}

        {view === 'pending' && (
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
                onPendingWhatsApp={payload => setWhatsappPrompt({
                  ...payload,
                  title: 'إرسال على واتساب',
                  subtitle: 'تم حفظ العملية بقيد الانتظار',
                })}
              />
            )}
            <TransactionList
              transactions={pending}
              showApprove={!readOnly}
              onApprove={readOnly ? undefined : id => setApprovingTxId(id)}
              onDelete={isAdmin ? deleteTransaction : undefined}
            />
          </div>
        )}

        {view === 'customers' && (
          <CustomersPanel
            summaries={accountSummaries}
            transactions={state.transactions}
            fundId={fundId}
            onAddCustomer={canManageAccounts ? addCustomer : undefined}
            onDeleteCustomer={canManageAccounts ? deleteCustomer : undefined}
            onAddTransaction={canManageAccounts ? addTransaction : undefined}
            readOnly={!canManageAccounts}
          />
        )}

        {view === 'bills' && (
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

      {approvingTxId && (
        <ApproveTransactionModal
          leadId={approvingTxId}
          allTransactions={state.transactions}
          approverName={profile?.displayName}
          onClose={() => setApprovingTxId(null)}
          onApprove={handleApproveConfirm}
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
    </div>
  );
}
