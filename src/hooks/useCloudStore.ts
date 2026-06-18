import { useCallback, useEffect, useState } from 'react';
import type { AppState, Bill, Customer, Transaction } from '../types';
import {
  fetchAppState,
  importAppState,
  patchTransactions,
  removeBill,
  removeCustomer,
  removeTransactions,
  upsertBill,
  upsertCustomer,
  upsertTransactions,
} from '../lib/db';
import { appendEditHistory, getOperationGroupIds, loadState } from '../lib/utils';

const MIGRATED_KEY = 'sandouk-cloud-migrated';

export interface StoreActor {
  userId: string;
  email: string;
  displayName: string;
}

function toArray(tx: Transaction | Transaction[]): Transaction[] {
  return Array.isArray(tx) ? tx : [tx];
}

function stampActor(tx: Transaction, actor?: StoreActor): Transaction {
  if (!actor) return tx;
  return {
    ...tx,
    createdByUserId: actor.userId,
    createdByEmail: actor.email,
    createdByName: actor.displayName,
  };
}

export function useCloudStore(enabled: boolean, actor?: StoreActor) {
  const [state, setState] = useState<AppState>({ transactions: [], bills: [], customers: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        let cloud = await fetchAppState();
        const local = loadState();
        const hasLocal = local.transactions.length + local.bills.length + local.customers.length > 0;
        const hasCloud = cloud.transactions.length + cloud.bills.length + cloud.customers.length > 0;
        const alreadyMigrated = localStorage.getItem(MIGRATED_KEY) === '1';

        if (hasLocal && !hasCloud && !alreadyMigrated) {
          await importAppState(local);
          localStorage.setItem(MIGRATED_KEY, '1');
          cloud = await fetchAppState();
        }

        if (!cancelled) setState(cloud);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'فشل تحميل البيانات');
          setState(loadState());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [enabled]);

  const runSync = useCallback(async (fn: () => Promise<void>) => {
    setSyncing(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
      throw err;
    } finally {
      setSyncing(false);
    }
  }, []);

  const addTransaction = useCallback(async (tx: Transaction | Transaction[]) => {
    const txs = toArray(tx).map(t => stampActor(t, actor));
    setState(prev => ({ ...prev, transactions: [...txs, ...prev.transactions] }));
    await runSync(() => upsertTransactions(txs));
  }, [actor, runSync]);

  const updateTransaction = useCallback(async (id: string, patch: Partial<Transaction>) => {
    let ids: string[] = [id];
    setState(prev => {
      ids = getOperationGroupIds(prev.transactions, id);
      return {
        ...prev,
        transactions: prev.transactions.map(tx => (ids.includes(tx.id) ? { ...tx, ...patch } : tx)),
      };
    });
    await runSync(() => patchTransactions(ids, patch));
  }, [runSync]);

  const deleteTransaction = useCallback(async (id: string) => {
    let ids: string[] = [id];
    setState(prev => {
      ids = getOperationGroupIds(prev.transactions, id);
      return { ...prev, transactions: prev.transactions.filter(tx => !ids.includes(tx.id)) };
    });
    await runSync(() => removeTransactions(ids));
  }, [runSync]);

  const editTransactions = useCallback(async (updated: Transaction[], summary: string) => {
    const stamped = updated.map(tx => appendEditHistory(tx, summary, actor));
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.map(tx => {
        const u = stamped.find(s => s.id === tx.id);
        return u ?? tx;
      }),
    }));
    await runSync(() => upsertTransactions(stamped));
  }, [actor, runSync]);

  const addBill = useCallback(async (bill: Bill) => {
    setState(prev => ({ ...prev, bills: [bill, ...prev.bills] }));
    await runSync(() => upsertBill(bill));
  }, [runSync]);

  const deleteBill = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, bills: prev.bills.filter(b => b.id !== id) }));
    await runSync(() => removeBill(id));
  }, [runSync]);

  const addCustomer = useCallback(async (customer: Customer) => {
    setState(prev => ({ ...prev, customers: [customer, ...prev.customers] }));
    await runSync(() => upsertCustomer(customer));
  }, [runSync]);

  const deleteCustomer = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, customers: prev.customers.filter(c => c.id !== id) }));
    await runSync(() => removeCustomer(id));
  }, [runSync]);

  return {
    state,
    loading,
    syncing,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    editTransactions,
    addBill,
    deleteBill,
    addCustomer,
    deleteCustomer,
  };
}
