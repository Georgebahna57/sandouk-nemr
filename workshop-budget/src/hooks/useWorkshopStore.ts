import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CurrencySide, LedgerEntry, TreasuryItem, WorkshopState } from '../types';
import { getAccountDef, getBalanceMode } from '../lib/accountsConfig';
import { addEntry, deleteEntry, getAccountBalances, updateEntry } from '../lib/ledger';
import { buildDashboardSummary } from '../lib/excelExport';
import { exportStateJson, getDefaultState, loadState, saveState } from '../lib/storage';
import { importExcelFile } from '../lib/excelImport';
import { exportWorkbook } from '../lib/excelExport';

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
    if (!confirm('استعادة بيانات Excel الأصلية (ميزانية-05-2026)؟ سيتم مسح التعديلات المحلية.')) return;
    localStorage.removeItem('workshop-budget-v1');
    setState(getDefaultState());
  }, []);

  return {
    state,
    dashboard,
    updatePeriod,
    addLedgerEntry,
    editLedgerEntry,
    removeLedgerEntry,
    updateTreasury,
    importFile,
    exportExcel,
    backupJson,
    getBalances,
    restoreExcelDefaults,
  };
}
