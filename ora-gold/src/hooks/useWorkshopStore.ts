import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CurrencySide,
  DisbursementPrintTemplate,
  EntryKind,
  InvoiceInput,
  LedgerEntry,
  ManualDisbursementOrder,
  TreasuryItem,
  WorkshopState,
} from '../types';
import type { ManualDisbursementInput } from '../components/ManualDisbursementForm';
import type { LedgerVoucherInput } from '../lib/ledgerVoucher';
import { voucherToLedgerPostings } from '../lib/ledgerVoucher';
import { getAccountDef, getBalanceMode } from '../lib/accountsConfig';
import { addEntry, deleteEntry, getAccountBalances, updateEntry } from '../lib/ledger';
import { buildDashboardSummary } from '../lib/excelExport';
import { exportStateJson, getDefaultState, loadState, saveState } from '../lib/storage';
import { importExcelFile } from '../lib/excelImport';
import { exportWorkbook } from '../lib/excelExport';
import { calculateInvoice } from '../lib/invoiceCalc';
import { applyInvoicePostings, createInvoiceRecord, removeInvoiceFromState } from '../lib/invoicePost';

export function useWorkshopStore() {
  const [state, setState] = useState<WorkshopState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const dashboard = useMemo(() => buildDashboardSummary(state), [state]);

  const updatePeriod = useCallback((label: string) => {
    setState((s) => ({ ...s, periodLabel: label }));
  }, []);

  const addLedgerEntry = useCallback(
    (accountId: string, side: CurrencySide, entry: Omit<LedgerEntry, 'id' | 'balance'>) => {
      const def = getAccountDef(accountId);
      const mode = def ? getBalanceMode(def, side) : 'credit-minus-debit';
      setState((s) => ({
        ...s,
        accounts: {
          ...s.accounts,
          [accountId]: addEntry(s.accounts[accountId], side, entry, mode),
        },
      }));
    },
    [],
  );

  const addLedgerVoucher = useCallback(
    (accountId: string, entryKind: EntryKind, voucher: LedgerVoucherInput) => {
      const postings = voucherToLedgerPostings(accountId, entryKind, voucher);
      if (!postings.length) return;
      setState((s) => {
        const accounts = { ...s.accounts };
        for (const posting of postings) {
          const def = getAccountDef(posting.accountId);
          const mode = def ? getBalanceMode(def, posting.side) : 'credit-minus-debit';
          accounts[posting.accountId] = addEntry(accounts[posting.accountId], posting.side, posting.entry, mode);
        }
        return { ...s, accounts };
      });
    },
    [],
  );

  const editLedgerEntry = useCallback(
    (accountId: string, side: CurrencySide, entryId: string, patch: Partial<Omit<LedgerEntry, 'id' | 'balance'>>) => {
      const def = getAccountDef(accountId);
      const mode = def ? getBalanceMode(def, side) : 'credit-minus-debit';
      setState((s) => ({
        ...s,
        accounts: {
          ...s.accounts,
          [accountId]: updateEntry(s.accounts[accountId], side, entryId, patch, mode),
        },
      }));
    },
    [],
  );

  const removeLedgerEntry = useCallback((accountId: string, side: CurrencySide, entryId: string) => {
    const def = getAccountDef(accountId);
    const mode = def ? getBalanceMode(def, side) : 'credit-minus-debit';
    setState((s) => ({
      ...s,
      accounts: {
        ...s.accounts,
        [accountId]: deleteEntry(s.accounts[accountId], side, entryId, mode),
      },
    }));
  }, []);

  const updateTreasury = useCallback((treasury: TreasuryItem[]) => {
    setState((s) => ({ ...s, treasury }));
  }, []);

  const importFile = useCallback(async (file: File) => {
    const imported = await importExcelFile(file);
    setState(imported);
    return imported;
  }, []);

  const exportExcel = useCallback(() => exportWorkbook(state), [state]);
  const backupJson = useCallback(() => exportStateJson(state), [state]);

  const getBalances = useCallback(
    (accountId: string) => getAccountBalances(state.accounts[accountId]),
    [state],
  );

  const restoreExcelDefaults = useCallback(() => {
    if (!confirm('استعادة بيانات Excel الافتراضية (new.xlsx)؟ سيتم مسح التعديلات المحلية.')) return;
    localStorage.removeItem('workshop-budget-v2');
    setState(getDefaultState());
  }, []);

  const updateProfitRate = useCallback((rate: number) => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings!, profitRate: rate },
    }));
  }, []);

  const postInvoice = useCallback((input: InvoiceInput) => {
    const profitRate = state.settings?.profitRate ?? 0.002;
    const calc = calculateInvoice(input, profitRate);
    const { state: nextState, refs } = applyInvoicePostings(state, calc.description, input.date, calc.postings);
    const invoice = createInvoiceRecord({
      number: input.number,
      date: input.date,
      customer: input.customer,
      type: input.type,
      description: calc.description,
      postings: calc.postings,
      entryRefs: refs,
      workedWeight: input.workedWeight,
      receivedUsd: input.receivedUsd,
      usdAmount: input.receivedUsd ?? input.usdAmount,
      wageUsd: calc.summary.wageUsd,
      wagePerGramUsd: input.wagePerGramUsd,
      rawGoldGiven: input.rawGoldGiven,
      stoneDiscountGrams: input.stoneDiscountGrams,
      profitRate,
    });
    setState({
      ...nextState,
      invoices: [...(nextState.invoices ?? []), invoice],
    });
    return invoice;
  }, [state]);

  const addManualDisbursementOrder = useCallback((input: ManualDisbursementInput) => {
    const order: ManualDisbursementOrder = {
      id: `disp_manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: input.date,
      amountUsd: input.amountUsd,
      beneficiary: input.beneficiary,
      description: input.description,
      category: input.category,
      sourceLabel: input.sourceLabel,
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      manualDisbursementOrders: [...(s.manualDisbursementOrders ?? []), order],
    }));
  }, []);

  const deleteManualDisbursementOrder = useCallback((id: string) => {
    if (!id.startsWith('disp_manual_')) return;
    setState((s) => ({
      ...s,
      manualDisbursementOrders: (s.manualDisbursementOrders ?? []).filter((o) => o.id !== id),
    }));
  }, []);

  const updateManualDisbursementOrder = useCallback((id: string, input: ManualDisbursementInput) => {
    setState((s) => ({
      ...s,
      manualDisbursementOrders: (s.manualDisbursementOrders ?? []).map((o) =>
        o.id !== id
          ? o
          : {
              ...o,
              date: input.date,
              amountUsd: input.amountUsd,
              beneficiary: input.beneficiary,
              description: input.description,
              category: input.category,
              sourceLabel: input.sourceLabel,
            },
      ),
    }));
  }, []);

  const saveDisbursementTemplates = useCallback((overrides: DisbursementPrintTemplate[], defaultTemplateId: string) => {
    setState((s) => ({
      ...s,
      settings: {
        profitRate: s.settings?.profitRate ?? 0.002,
        ...s.settings,
        disbursementTemplateOverrides: overrides.map((t) => ({
          id: t.id,
          nameAr: t.nameAr,
          html: t.html,
        })),
        defaultDisbursementTemplateId: defaultTemplateId,
      },
    }));
  }, []);

  const deleteInvoice = useCallback((invoiceId: string) => {
    setState((prev) => {
      const invoice = (prev.invoices ?? []).find((i) => i.id === invoiceId);
      if (!invoice) return prev;
      return removeInvoiceFromState(prev, invoice);
    });
  }, []);

  const updateInvoice = useCallback((invoiceId: string, input: InvoiceInput) => {
    setState((prev) => {
      const invoice = (prev.invoices ?? []).find((i) => i.id === invoiceId);
      if (!invoice) return prev;
      let next = removeInvoiceFromState(prev, invoice);
      const profitRate = next.settings?.profitRate ?? 0.002;
      const calc = calculateInvoice(input, profitRate);
      const { state: posted, refs } = applyInvoicePostings(next, calc.description, input.date, calc.postings);
      const record = createInvoiceRecord({
        number: input.number,
        date: input.date,
        customer: input.customer,
        type: input.type,
        description: calc.description,
        postings: calc.postings,
        entryRefs: refs,
        workedWeight: input.workedWeight,
        receivedUsd: input.receivedUsd,
        usdAmount: input.receivedUsd ?? input.usdAmount,
        wageUsd: calc.summary.wageUsd,
        wagePerGramUsd: input.wagePerGramUsd,
        rawGoldGiven: input.rawGoldGiven,
        stoneDiscountGrams: input.stoneDiscountGrams,
        profitRate,
      });
      return {
        ...posted,
        invoices: [...(posted.invoices ?? []).filter((i) => i.id !== invoiceId), { ...record, id: invoice.id, createdAt: invoice.createdAt }],
      };
    });
  }, []);

  const invoices = useMemo(() => state.invoices ?? [], [state.invoices]);
  const profitRate = state.settings?.profitRate ?? 0.002;

  return {
    state,
    dashboard,
    invoices,
    profitRate,
    updatePeriod,
    addLedgerEntry,
    addLedgerVoucher,
    editLedgerEntry,
    removeLedgerEntry,
    updateTreasury,
    importFile,
    exportExcel,
    backupJson,
    getBalances,
    restoreExcelDefaults,
    updateProfitRate,
    postInvoice,
    deleteInvoice,
    addManualDisbursementOrder,
    deleteManualDisbursementOrder,
    updateManualDisbursementOrder,
    updateInvoice,
    saveDisbursementTemplates,
  };
}
