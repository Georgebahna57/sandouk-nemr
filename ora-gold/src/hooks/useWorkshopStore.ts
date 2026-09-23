import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CurrencySide, EntryKind, InvoiceInput, LedgerEntry, TreasuryItem, WorkshopState } from '../types';
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
    localStorage.removeItem('workshop-budget-v1');
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
      usdAmount: input.usdAmount,
      wageUsd: input.wageUsd,
      rawGoldGiven: input.rawGoldGiven,
      profitRate,
    });
    setState({
      ...nextState,
      invoices: [...(nextState.invoices ?? []), invoice],
    });
    return invoice;
  }, [state]);

  const deleteInvoice = useCallback((invoiceId: string) => {
    const invoice = (state.invoices ?? []).find((i) => i.id === invoiceId);
    if (!invoice) return;
    if (!confirm(`حذف الفاتورة ${invoice.description}؟ سيتم عكس كل الحركات المرتبطة.`)) return;
    setState(removeInvoiceFromState(state, invoice));
  }, [state]);

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
  };
}
