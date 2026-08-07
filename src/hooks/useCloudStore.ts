import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, Bill, Customer, Transaction, TransactionComment } from '../types';
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
import { saveValuationRates } from '../lib/appSettings';
import type { AppBackup } from '../lib/backup';
import { repairNsypToSypTransactions, normalizeSyrianTransaction } from '../lib/syrianCurrency';
import {
  appendEditHistory,
  applyCustomerRename,
  backfillLinkedAccountFields,
  getDeletionGroupIds,
  getOperationGroupIds,
  loadState,
  parseMentions,
  repairHalabFundTransactions,
} from '../lib/utils';
import {
  collectFeeSyncLeadIds,
  getFeeSyncLeadIds,
  syncAutoFeesForOperations,
} from '../lib/feePosting';
import {
  maybeAutoSnapshot,
  mirrorAppState,
  recoverFromLocalMirror,
  saveManualSnapshot,
  savePreDestructiveSnapshot,
} from '../lib/localMirror';
import { runAllHalabRepairs } from '../lib/halabBalance';

const MIGRATED_KEY = 'sandouk-cloud-migrated';

type FeeSyncResult = {
  transactions: Transaction[];
  upsert: Transaction[];
  removeIds: string[];
};

function mergeFeeSync(transactions: Transaction[], leadIds: string[]): FeeSyncResult {
  const { transactions: synced, changed, removedIds } = syncAutoFeesForOperations(transactions, leadIds);
  return { transactions: synced, upsert: changed, removeIds: removedIds };
}

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

function mergeUniqueTransactions(existing: Transaction[], incoming: Transaction[]): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const tx of existing) byId.set(tx.id, tx);
  for (const tx of incoming) byId.set(tx.id, tx);
  return [...byId.values()];
}

export function useCloudStore(enabled: boolean, actor?: StoreActor) {
  const [state, setState] = useState<AppState>({ transactions: [], bills: [], customers: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

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

        if (!cancelled) {
          const { transactions: nsypFixed, changed: repairedNsyp } = repairNsypToSypTransactions(cloud.transactions);
          const { transactions: repaired, changed: repairedHalab } = repairHalabFundTransactions(nsypFixed);
          const { transactions: afterOpening, changed: repairedOpening } = runAllHalabRepairs(repaired);
          const { transactions: withBackfill, changed } = backfillLinkedAccountFields(afterOpening);
          const leadIds = getFeeSyncLeadIds(withBackfill);
          const feeSync = mergeFeeSync(withBackfill, leadIds);
          const nextState = { ...cloud, transactions: feeSync.transactions };

          if (repairedNsyp.length || repairedHalab.length || repairedOpening.length || changed.length || feeSync.upsert.length || feeSync.removeIds.length) {
            if (feeSync.removeIds.length) {
              await removeTransactions(feeSync.removeIds);
            }
            const toUpsert = [...repairedNsyp, ...repairedHalab, ...repairedOpening, ...changed, ...feeSync.upsert];
            if (toUpsert.length) await upsertTransactions(toUpsert);
          }

          setState(nextState);
          mirrorAppState(nextState);
        }
      } catch (err) {
        if (!cancelled) {
          const recovered = recoverFromLocalMirror();
          if (recovered) {
            setState(recovered.state);
            setError(`تعذّر الاتصال — عُرضت نسخة محلية (${new Date(recovered.savedAt).toLocaleString('ar-LB')})`);
          } else {
            setError(err instanceof Error ? err.message : 'فشل تحميل البيانات');
            setState(loadState());
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || loading) return;
    const timer = window.setTimeout(() => {
      mirrorAppState(state);
      maybeAutoSnapshot(state);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [enabled, loading, state]);

  useEffect(() => {
    if (!enabled || loading) return;
    function onHide() {
      if (document.visibilityState === 'hidden') mirrorAppState(stateRef.current);
    }
    function onUnload() {
      mirrorAppState(stateRef.current);
    }
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [enabled, loading]);

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
    const txs = toArray(tx).map(t => stampActor(normalizeSyrianTransaction(t) as Transaction, actor));
    let previous: Transaction[] = [];
    let syncResult: FeeSyncResult = { transactions: [], upsert: [], removeIds: [] };
    setState(prev => {
      previous = prev.transactions;
      const merged = mergeUniqueTransactions(txs, prev.transactions);
      const leadIds = collectFeeSyncLeadIds(merged, txs.map(t => t.id));
      syncResult = mergeFeeSync(merged, leadIds);
      return { ...prev, transactions: syncResult.transactions };
    });
    try {
      await runSync(async () => {
        if (syncResult.removeIds.length) await removeTransactions(syncResult.removeIds);
        const upsertIds = new Set(txs.map(t => t.id));
        const feeUpsert = syncResult.upsert.filter(t => !upsertIds.has(t.id));
        await upsertTransactions([...txs, ...feeUpsert]);
      });
    } catch {
      setState(prev => ({ ...prev, transactions: previous }));
      throw new Error('فشل الحفظ');
    }
  }, [actor, runSync]);

  const updateTransaction = useCallback(async (id: string, patch: Partial<Transaction>) => {
    let ids: string[] = [id];
    let upsertTxs: Transaction[] = [];
    let syncResult: FeeSyncResult = { transactions: [], upsert: [], removeIds: [] };
    setState(prev => {
      ids = getOperationGroupIds(prev.transactions, id);
      const patched = prev.transactions.map(tx => {
        if (!ids.includes(tx.id)) return tx;
        return normalizeSyrianTransaction({ ...tx, ...patch }) as Transaction;
      });
      upsertTxs = patched.filter(tx => ids.includes(tx.id));
      const leadIds = collectFeeSyncLeadIds(patched, ids);
      syncResult = mergeFeeSync(patched, leadIds);
      return { ...prev, transactions: syncResult.transactions };
    });
    await runSync(async () => {
      if (syncResult.removeIds.length) await removeTransactions(syncResult.removeIds);
      if (upsertTxs.length) await upsertTransactions(upsertTxs);
      if (syncResult.upsert.length) await upsertTransactions(syncResult.upsert);
    });
  }, [runSync]);

  const deleteTransaction = useCallback(async (id: string) => {
    savePreDestructiveSnapshot(stateRef.current, 'pre-delete');
    let removeIds: string[] = [id];
    setState(prev => {
      removeIds = getDeletionGroupIds(prev.transactions, id);
      return { ...prev, transactions: prev.transactions.filter(tx => !removeIds.includes(tx.id)) };
    });
    await runSync(() => removeTransactions(removeIds));
  }, [runSync]);

  const editTransactions = useCallback(async (updated: Transaction[], summary: string) => {
    const stamped = updated.map(tx => appendEditHistory(normalizeSyrianTransaction(tx) as Transaction, summary, actor));
    let syncResult: FeeSyncResult = { transactions: [], upsert: [], removeIds: [] };
    setState(prev => {
      const merged = prev.transactions.map(tx => {
        const u = stamped.find(s => s.id === tx.id);
        return u ?? tx;
      });
      const leadIds = collectFeeSyncLeadIds(merged, stamped.map(t => t.id));
      syncResult = mergeFeeSync(merged, leadIds);
      return { ...prev, transactions: syncResult.transactions };
    });
    await runSync(async () => {
      if (syncResult.removeIds.length) await removeTransactions(syncResult.removeIds);
      const upsertIds = new Set(stamped.map(t => t.id));
      const feeUpsert = syncResult.upsert.filter(t => !upsertIds.has(t.id));
      await upsertTransactions([...stamped, ...feeUpsert]);
    });
  }, [actor, runSync]);

  const addBill = useCallback(async (bill: Bill) => {
    setState(prev => ({ ...prev, bills: [bill, ...prev.bills] }));
    await runSync(() => upsertBill(bill));
  }, [runSync]);

  const deleteBill = useCallback(async (id: string) => {
    savePreDestructiveSnapshot(stateRef.current, 'pre-delete');
    setState(prev => ({ ...prev, bills: prev.bills.filter(b => b.id !== id) }));
    await runSync(() => removeBill(id));
  }, [runSync]);

  const addCustomer = useCallback(async (customer: Customer) => {
    setState(prev => ({ ...prev, customers: [customer, ...prev.customers] }));
    await runSync(() => upsertCustomer(customer));
  }, [runSync]);

  const updateCustomer = useCallback(async (updated: Customer, previousName: string) => {
    const nameChanged = updated.name.trim() !== previousName.trim();
    let changedTxs: Transaction[] = [];

    setState(prev => {
      let transactions = prev.transactions;
      if (nameChanged) {
        const result = applyCustomerRename(
          prev.transactions,
          previousName.trim(),
          updated.name.trim(),
          updated.fundId,
          updated.sharedFundIds,
        );
        transactions = result.transactions;
        changedTxs = result.changed;
      }
      return {
        ...prev,
        customers: prev.customers.map(c => (c.id === updated.id ? updated : c)),
        transactions,
      };
    });

    await runSync(async () => {
      await upsertCustomer(updated);
      if (changedTxs.length) await upsertTransactions(changedTxs);
    });
  }, [runSync]);

  const deleteCustomer = useCallback(async (id: string) => {
    savePreDestructiveSnapshot(stateRef.current, 'pre-delete');
    setState(prev => ({ ...prev, customers: prev.customers.filter(c => c.id !== id) }));
    await runSync(() => removeCustomer(id));
  }, [runSync]);

  const addComment = useCallback(async (id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const comment: TransactionComment = {
      id: crypto.randomUUID(),
      text: trimmed,
      at: new Date().toISOString(),
      byUserId: actor?.userId,
      byName: actor?.displayName,
      byEmail: actor?.email,
      mentions: parseMentions(trimmed),
    };
    let ids: string[] = [id];
    let comments: TransactionComment[] = [];
    setState(prev => {
      ids = getOperationGroupIds(prev.transactions, id);
      const lead = prev.transactions.find(t => t.id === id)
        ?? prev.transactions.find(t => ids.includes(t.id));
      comments = [...(lead?.comments ?? []), comment];
      return {
        ...prev,
        transactions: prev.transactions.map(tx => (
          ids.includes(tx.id) ? { ...tx, comments } : tx
        )),
      };
    });
    await runSync(() => patchTransactions(ids, { comments }));
  }, [actor, runSync]);

  const claimTransaction = useCallback(async (id: string) => {
    if (!actor) return;
    const patch = {
      claimedByUserId: actor.userId,
      claimedByName: actor.displayName,
      claimedAt: new Date().toISOString(),
    };
    let ids: string[] = [id];
    setState(prev => {
      ids = getOperationGroupIds(prev.transactions, id);
      return {
        ...prev,
        transactions: prev.transactions.map(tx => (
          ids.includes(tx.id) ? { ...tx, ...patch } : tx
        )),
      };
    });
    await runSync(() => patchTransactions(ids, patch));
  }, [actor, runSync]);

  const releaseClaim = useCallback(async (id: string) => {
    const patch = {
      claimedByUserId: undefined,
      claimedByName: undefined,
      claimedAt: undefined,
    };
    let ids: string[] = [id];
    setState(prev => {
      ids = getOperationGroupIds(prev.transactions, id);
      return {
        ...prev,
        transactions: prev.transactions.map(tx => (
          ids.includes(tx.id) ? { ...tx, ...patch } : tx
        )),
      };
    });
    await runSync(() => patchTransactions(ids, patch));
  }, [runSync]);

  const restoreBackup = useCallback(async (backup: AppBackup, mode: 'merge' | 'replace') => {
    setSyncing(true);
    setError(null);
    try {
      if (mode === 'replace') {
        savePreDestructiveSnapshot(stateRef.current, 'pre-replace');
      } else {
        saveManualSnapshot(stateRef.current);
      }
      if (mode === 'replace') {
        let txIds: string[] = [];
        let billIds: string[] = [];
        let customerIds: string[] = [];
        setState(prev => {
          txIds = prev.transactions.map(t => t.id);
          billIds = prev.bills.map(b => b.id);
          customerIds = prev.customers.map(c => c.id);
          return prev;
        });
        if (txIds.length) await removeTransactions(txIds);
        await Promise.all(billIds.map(id => removeBill(id)));
        await Promise.all(customerIds.map(id => removeCustomer(id)));
      }

      await importAppState({
        transactions: backup.transactions,
        bills: backup.bills,
        customers: backup.customers,
      });

      if (backup.valuationRates) {
        await saveValuationRates(backup.valuationRates);
      }

      const cloud = await fetchAppState();
      setState(cloud);
      mirrorAppState(cloud);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل استرجاع النسخة');
      throw err;
    } finally {
      setSyncing(false);
    }
  }, []);

  const repairHalabData = useCallback(async () => {
    await runSync(async () => {
      const cloud = await fetchAppState();
      const { changed: repairedNsyp, transactions: afterNsyp } = repairNsypToSypTransactions(cloud.transactions);
      const { changed: repairedHalab, transactions: afterParty } = repairHalabFundTransactions(afterNsyp);
      const { changed: repairedOpening, transactions: afterOpening } = runAllHalabRepairs(afterParty);
      const { transactions: withBackfill, changed } = backfillLinkedAccountFields(afterOpening);
      const leadIds = getFeeSyncLeadIds(withBackfill);
      const feeSync = mergeFeeSync(withBackfill, leadIds);
      if (feeSync.removeIds.length) await removeTransactions(feeSync.removeIds);
      const toUpsert = [...repairedNsyp, ...repairedHalab, ...repairedOpening, ...changed, ...feeSync.upsert];
      if (toUpsert.length) await upsertTransactions(toUpsert);
      const refreshed = await fetchAppState();
      setState(refreshed);
      mirrorAppState(refreshed);
    });
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
    updateCustomer,
    deleteCustomer,
    addComment,
    claimTransaction,
    releaseClaim,
    restoreBackup,
    repairHalabData,
  };
}
