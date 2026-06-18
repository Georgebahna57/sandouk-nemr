import { useCallback, useEffect, useState } from 'react';
import type { AppState, Bill, Customer, Transaction } from '../types';
import { loadState, saveState } from '../lib/utils';

export function useAppStore() {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const addTransaction = useCallback((tx: Transaction) => {
    setState(prev => ({ ...prev, transactions: [tx, ...prev.transactions] }));
  }, []);

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(tx => (tx.id === id ? { ...tx, ...patch } : tx)),
    }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.filter(tx => tx.id !== id),
    }));
  }, []);

  const addBill = useCallback((bill: Bill) => {
    setState(prev => ({ ...prev, bills: [bill, ...prev.bills] }));
  }, []);

  const deleteBill = useCallback((id: string) => {
    setState(prev => ({ ...prev, bills: prev.bills.filter(b => b.id !== id) }));
  }, []);

  const addCustomer = useCallback((customer: Customer) => {
    setState(prev => ({ ...prev, customers: [customer, ...prev.customers] }));
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    setState(prev => ({ ...prev, customers: prev.customers.filter(c => c.id !== id) }));
  }, []);

  return {
    state,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addBill,
    deleteBill,
    addCustomer,
    deleteCustomer,
  };
}
