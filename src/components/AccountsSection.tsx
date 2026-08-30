import { Building2, CheckCircle2, List, Table2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CENTERS_FUND_ID, getFund } from '../config';
import { loadUiPrefs, saveNavPrefs } from '../lib/uiPrefs';
import {
  accountNeedsReconciliation,
  buildAccountSummaries,
  buildCustomerAccountsAcrossFunds,
} from '../lib/utils';
import type {
  AccountBranchId,
  Customer,
  CustomerSummary,
  Fund,
  FundId,
  Transaction,
} from '../types';
import type { ValuationRates } from '../lib/valuationRates';
import { CustomersPanel } from './CustomersPanel';
import { TrialBalancePanel } from './TrialBalancePanel';

type AccountsTab = 'list' | 'reconciliations' | 'trial_balance';

interface Props {
  transactions: Transaction[];
  customers: Customer[];
  boxFunds: Fund[];
  canAccessCenters: boolean;
  canEdit: (fundId: FundId) => boolean;
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
  onShareAccount?: (fundId: FundId, summary: CustomerSummary) => void;
  onMoneyOutReconciliation?: (fundId: FundId, summary: CustomerSummary) => void;
  valuationRates: ValuationRates;
  isAdmin?: boolean;
  actorName?: string;
}

const BRANCHES: { id: AccountBranchId; label: string; icon: typeof Users }[] = [
  { id: 'customers', label: 'زبائن', icon: Users },
  { id: 'centers', label: 'مراكز', icon: Building2 },
];

const TABS: { id: AccountsTab; label: string; icon: typeof List }[] = [
  { id: 'list', label: 'قائمة الحسابات', icon: List },
  { id: 'trial_balance', label: 'ميزان مراجعة', icon: Table2 },
  { id: 'reconciliations', label: 'المطابقات', icon: CheckCircle2 },
];

function summaryFundId(summary: CustomerSummary, fallback: FundId): FundId {
  return summary.fundId ?? fallback;
}

export function AccountsSection({
  transactions,
  customers,
  boxFunds,
  canAccessCenters,
  canEdit,
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
}: Props) {
  const savedNav = loadUiPrefs().nav;
  const defaultBranch: AccountBranchId = boxFunds.length > 0 ? 'customers' : 'centers';
  const [branch, setBranch] = useState<AccountBranchId>(
    savedNav.accountsBranch ?? defaultBranch,
  );
  const [tab, setTab] = useState<AccountsTab>(() => {
    const saved = savedNav.accountsTab;
    if (saved === 'reconciliations' || saved === 'trial_balance' || saved === 'list') {
      return saved;
    }
    return 'list';
  });

  useEffect(() => {
    saveNavPrefs({ accountsBranch: branch, accountsTab: tab });
  }, [branch, tab]);

  const boxFundIds = useMemo(() => boxFunds.map(f => f.id), [boxFunds]);

  const transferFundOptions = useMemo(() => {
    const list = [...boxFunds];
    if (canAccessCenters) {
      const centers = getFund(CENTERS_FUND_ID);
      if (!list.some(f => f.id === centers.id)) list.unshift(centers);
    }
    return list;
  }, [boxFunds, canAccessCenters]);

  useEffect(() => {
    if (branch === 'centers' && !canAccessCenters && boxFunds.length > 0) {
      setBranch('customers');
    }
    if (branch === 'customers' && boxFunds.length === 0 && canAccessCenters) {
      setBranch('centers');
    }
  }, [branch, canAccessCenters, boxFunds.length]);

  const summaries = useMemo(() => {
    if (branch === 'centers') {
      return buildAccountSummaries(transactions, customers, CENTERS_FUND_ID);
    }
    return buildCustomerAccountsAcrossFunds(transactions, customers, boxFundIds);
  }, [branch, transactions, customers, boxFundIds]);

  const needsReconciliation = useMemo(
    () => summaries.filter(s => {
      const fid = summaryFundId(s, CENTERS_FUND_ID);
      return accountNeedsReconciliation(transactions, fid, s);
    }),
    [summaries, transactions],
  );

  const displayedSummaries = tab === 'reconciliations' ? needsReconciliation : summaries;

  const branchTitle = branch === 'centers' ? 'حسابات المراكز' : 'حسابات الزبائن';

  const visibleBranches = BRANCHES.filter(b => (
    b.id === 'centers' ? canAccessCenters : boxFunds.length > 0
  ));

  const panelFundId = branch === 'centers' ? CENTERS_FUND_ID : boxFundIds[0] ?? 'nemr';

  if (visibleBranches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
        ما عندك صلاحية على حسابات الزبائن أو المراكز
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-800/50 p-1">
        {visibleBranches.map(b => {
          const Icon = b.icon;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBranch(b.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                branch === b.id ? 'bg-slate-700 text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={16} />
              {b.label}
            </button>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-3">
        <div className="flex items-center gap-2">
          {branch === 'centers' ? (
            <Building2 size={18} className="text-cyan-400 shrink-0" />
          ) : (
            <Users size={18} className="text-amber-400 shrink-0" />
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100">{branchTitle}</h2>
            <p className="text-[11px] text-slate-500">
              {branch === 'centers'
                ? 'حسابات المراكز — ميزان مراجعة ومطابقات'
                : 'حسابات الزبائن — ميزان مراجعة ومطابقات'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-lg bg-slate-900/80 px-2.5 py-1 text-slate-400">
            {summaries.length} حساب
          </span>
          {needsReconciliation.length > 0 && (
            <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-amber-300">
              {needsReconciliation.length} بحاجة مطابقة
            </span>
          )}
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-800/50 p-1">
        {TABS.map(t => {
          const Icon = t.icon;
          const badge = t.id === 'reconciliations' && needsReconciliation.length > 0
            ? needsReconciliation.length
            : null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-2.5 text-xs font-medium transition sm:text-sm ${
                tab === t.id ? 'bg-slate-700 text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={15} />
              {t.label}
              {badge !== null && (
                <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-slate-900">{badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === 'reconciliations' && (
        <p className="text-xs text-slate-500">
          حسابات بها حركات بعد آخر مطابقة أو لم تُطابق بعد. افتح الحساب لتسجيل المطابقة.
        </p>
      )}

      {tab === 'trial_balance' ? (
        <TrialBalancePanel
          summaries={summaries}
          customers={customers}
          transactions={transactions}
          defaultFundId={panelFundId}
          fundOptions={boxFunds}
          transferFundOptions={transferFundOptions}
          canEditFund={canEdit}
          onUpdateCustomer={onUpdateCustomer}
          onMoveAccount={onMoveAccount}
          onShareAccount={onShareAccount
            ? s => onShareAccount(summaryFundId(s, panelFundId), s)
            : undefined}
          readOnly={branch === 'centers' ? !canEdit(CENTERS_FUND_ID) : false}
        />
      ) : tab === 'reconciliations' && displayedSummaries.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-6 text-center">
          <CheckCircle2 size={28} className="mx-auto text-emerald-400" />
          <p className="mt-2 text-sm font-medium text-emerald-300">كل الحسابات مطابقة</p>
          <p className="mt-1 text-xs text-emerald-400/70">لا توجد حسابات بحاجة مطابقة هنا</p>
        </div>
      ) : (
        <CustomersPanel
          summaries={displayedSummaries}
          customers={customers}
          transactions={transactions}
          fundId={panelFundId}
          fundOptions={boxFunds}
          transferFundOptions={transferFundOptions}
          multiFundCustomers={branch === 'customers'}
          canEditFund={canEdit}
          onAddCustomer={onAddCustomer}
          onUpdateCustomer={onUpdateCustomer}
          onMoveAccount={onMoveAccount}
          onDeleteCustomer={onDeleteCustomer}
          onAddTransaction={onAddTransaction}
          onDeleteTransaction={isAdmin ? onDeleteTransaction : undefined}
          onEditTransaction={isAdmin ? onEditTransaction : undefined}
          onShareAccount={onShareAccount
            ? s => onShareAccount(summaryFundId(s, panelFundId), s)
            : undefined}
          onMoneyOutReconciliation={onMoneyOutReconciliation
            ? s => onMoneyOutReconciliation(summaryFundId(s, panelFundId), s)
            : undefined}
          valuationRates={valuationRates}
          isAdmin={isAdmin}
          actorName={actorName}
          readOnly={branch === 'centers' ? !canEdit(CENTERS_FUND_ID) : false}
          embedded
          reconciliationFocus={tab === 'reconciliations'}
        />
      )}
    </div>
  );
}
