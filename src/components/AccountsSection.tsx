import { Building2, CheckCircle2, FolderOpen, List, Table2, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { CENTERS_FUND_ID } from '../config';
import {
  buildAccountsSectionSummaries,
  getCustomersLedgerFundId,
} from '../lib/accountBranch';
import {
  assignSummaryToSection,
  enrichSummariesWithSections,
  fetchAccountSections,
  migrateLegacyAccountGroups,
  saveAccountSections,
  type AccountSectionsState,
} from '../lib/accountSections';
import { AccountSectionsPanel } from './AccountSectionsPanel';
import { AccountsGrandTotalCard } from './AccountsGrandTotalCard';
import { loadUiPrefs, saveNavPrefs } from '../lib/uiPrefs';
import {
  accountNeedsReconciliation,
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

type AccountsTab = 'list' | 'reconciliations' | 'trial_balance' | 'sections';

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
    toBranch: AccountBranchId,
    customersLedgerFundId: FundId,
    opts?: { customerId?: string; accountNumber?: string },
  ) => void | Promise<void>;
  onDeleteCustomer?: (id: string) => void;
  onAddTransaction?: (tx: Transaction | Transaction[]) => void;
  onDeleteTransaction?: (id: string) => void;
  onEditTransaction?: (id: string) => void;
  canEditTransaction?: (tx: Transaction) => boolean;
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
  { id: 'sections', label: 'الأقسام', icon: FolderOpen },
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
  canEditTransaction,
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
  const [navBranch, setNavBranch] = useState<AccountBranchId>(
    savedNav.accountsBranch ?? defaultBranch,
  );
  const [tab, setTab] = useState<AccountsTab>(() => {
    const saved = savedNav.accountsTab;
    if (saved === 'reconciliations' || saved === 'trial_balance' || saved === 'list' || saved === 'sections') {
      return saved;
    }
    return 'list';
  });
  const [navTab, setNavTab] = useState<AccountsTab>(tab);
  const [sectionsState, setSectionsState] = useState<AccountSectionsState>({ sections: [], assignments: {} });
  const [, startNavTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetchAccountSections().then(raw => {
      if (cancelled) return;
      setSectionsState(raw);
    });
    return () => { cancelled = true; };
  }, []);

  const persistSections = useCallback(async (next: AccountSectionsState) => {
    setSectionsState(next);
    await saveAccountSections(next);
  }, []);

  const selectBranch = useCallback((id: AccountBranchId) => {
    setNavBranch(id);
    startNavTransition(() => setBranch(id));
  }, []);

  const selectTab = useCallback((id: AccountsTab) => {
    setNavTab(id);
    startNavTransition(() => setTab(id));
  }, []);

  useEffect(() => {
    saveNavPrefs({ accountsBranch: branch, accountsTab: tab });
  }, [branch, tab]);

  const customersLedgerFundId = useMemo(() => getCustomersLedgerFundId(boxFunds), [boxFunds]);

  useEffect(() => {
    if (branch === 'centers' && !canAccessCenters && boxFunds.length > 0) {
      selectBranch('customers');
    }
    if (branch === 'customers' && boxFunds.length === 0 && canAccessCenters) {
      selectBranch('centers');
    }
  }, [branch, canAccessCenters, boxFunds.length, selectBranch]);

  const customerSummaries = useMemo(
    () => (boxFunds.length > 0
      ? buildAccountsSectionSummaries(transactions, customers, 'customers', boxFunds)
      : []),
    [transactions, customers, boxFunds],
  );

  const centersSummaries = useMemo(
    () => (canAccessCenters
      ? buildAccountsSectionSummaries(transactions, customers, 'centers', boxFunds)
      : []),
    [transactions, customers, boxFunds, canAccessCenters],
  );

  const allSummaries = useMemo(
    () => [...customerSummaries, ...centersSummaries],
    [customerSummaries, centersSummaries],
  );

  const panelFundId = branch === 'centers' ? CENTERS_FUND_ID : customersLedgerFundId;
  const rawSummaries = branch === 'centers' ? centersSummaries : customerSummaries;

  useEffect(() => {
    const migrated = migrateLegacyAccountGroups(sectionsState, customers, branch);
    if (migrated !== sectionsState) {
      void persistSections(migrated);
    }
  }, [sectionsState, customers, branch, persistSections]);

  const summaries = useMemo(
    () => enrichSummariesWithSections(rawSummaries, sectionsState, branch, panelFundId, customers),
    [rawSummaries, sectionsState, customers, branch, panelFundId],
  );

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

  const assignAccountSection = useCallback(async (summary: CustomerSummary, sectionId: string | null) => {
    const next = assignSummaryToSection(sectionsState, summary, panelFundId, sectionId);
    await persistSections(next);
  }, [sectionsState, panelFundId, persistSections]);

  const handleMoveAccount = onMoveAccount
    ? (accountName: string, toBranch: AccountBranchId, opts?: {
      customerId?: string;
      accountNumber?: string;
    }) => onMoveAccount(accountName, toBranch, customersLedgerFundId, opts)
    : undefined;

  if (visibleBranches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
        ما عندك صلاحية على حسابات الزبائن أو المراكز
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AccountsGrandTotalCard summaries={allSummaries} />

      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-800/50 p-1">
        {visibleBranches.map(b => {
          const Icon = b.icon;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => selectBranch(b.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                navBranch === b.id ? 'bg-slate-700 text-amber-400' : 'text-slate-400 hover:text-slate-200'
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
                ? 'حسابات المراكز من كل الصناديق — ميزان مراجعة ومطابقات'
                : 'حسابات الزبائن من كل الصناديق — ميزان مراجعة ومطابقات'}
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
              onClick={() => selectTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-2.5 text-xs font-medium transition sm:text-sm ${
                navTab === t.id ? 'bg-slate-700 text-amber-400' : 'text-slate-400 hover:text-slate-200'
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

      {tab === 'sections' ? (
        <AccountSectionsPanel
          branch={branch}
          summaries={summaries}
          sectionsState={sectionsState}
          panelFundId={panelFundId}
          readOnly={branch === 'centers' ? !canEdit(CENTERS_FUND_ID) : false}
          onChangeSections={persistSections}
          onAssignAccount={assignAccountSection}
        />
      ) : tab === 'trial_balance' ? (
        <TrialBalancePanel
          summaries={summaries}
          customers={customers}
          transactions={transactions}
          defaultFundId={panelFundId}
          fundOptions={boxFunds}
          accountBranch={branch}
          customersLedgerFundId={customersLedgerFundId}
          canEditFund={canEdit}
          onUpdateCustomer={onUpdateCustomer}
          onMoveAccount={handleMoveAccount}
          onShareAccount={onShareAccount
            ? s => onShareAccount(summaryFundId(s, panelFundId), s)
            : undefined}
          readOnly={branch === 'centers' ? !canEdit(CENTERS_FUND_ID) : false}
        />
      ) : tab !== 'list' && tab === 'reconciliations' && displayedSummaries.length === 0 ? (
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
          accountBranch={branch}
          customersLedgerFundId={customersLedgerFundId}
          sectionsState={sectionsState}
          onAssignAccountSection={assignAccountSection}
          multiFundCustomers={true}
          canEditFund={canEdit}
          onAddCustomer={onAddCustomer}
          onUpdateCustomer={onUpdateCustomer}
          onMoveAccount={handleMoveAccount}
          onDeleteCustomer={onDeleteCustomer}
          onAddTransaction={onAddTransaction}
          onDeleteTransaction={onDeleteTransaction}
          onEditTransaction={onEditTransaction}
          canEditTransaction={canEditTransaction}
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
