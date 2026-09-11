import type { Bill, Customer, Transaction } from '../types';
import {
  patchTransactions,
  removeBill,
  removeCustomer,
  removeTransactions,
  upsertBill,
  upsertCustomer,
  upsertTransactions,
} from './db';
import { safeSetItem } from './safeLocalStorage';

const OUTBOX_KEY = 'sandouk-halab-outbox-v1';

export type QueueStep =
  | { type: 'upsertTransactions'; txs: Transaction[] }
  | { type: 'removeTransactions'; ids: string[] }
  | { type: 'upsertBill'; bill: Bill }
  | { type: 'removeBill'; id: string }
  | { type: 'upsertCustomer'; customer: Customer }
  | { type: 'removeCustomer'; id: string }
  | { type: 'patchTransactions'; ids: string[]; patch: Partial<Transaction> }
  | { type: 'compound'; steps: QueueStep[] };

export type QueuedMutation = QueueStep & { id: string };

function readQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedMutation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedMutation[]): void {
  safeSetItem(OUTBOX_KEY, JSON.stringify(queue));
}

export function getQueueLength(): number {
  return readQueue().length;
}

export function enqueue(mutation: QueuedMutation): void {
  const queue = readQueue();
  queue.push(mutation);
  writeQueue(queue);
}

export function peekQueue(): QueuedMutation[] {
  return readQueue();
}

/** معرّفات الحركات المعلّقة في الطابور — لعدم مسحها عند سحب السحابة */
export function collectQueuedTransactionIds(): Set<string> {
  const ids = new Set<string>();
  function walk(step: QueueStep) {
    switch (step.type) {
      case 'upsertTransactions':
        for (const tx of step.txs) ids.add(tx.id);
        return;
      case 'removeTransactions':
        return;
      case 'compound':
        for (const child of step.steps) walk(child);
        return;
      default:
        return;
    }
  }
  for (const item of readQueue()) {
    const { id: _id, ...step } = item;
    walk(step as QueueStep);
  }
  return ids;
}

export function clearQueue(): void {
  localStorage.removeItem(OUTBOX_KEY);
}

function isStepRedundant(
  step: QueueStep,
  cloudTxIds: Set<string>,
  cloudBillIds: Set<string>,
  cloudCustomerIds: Set<string>,
): boolean {
  switch (step.type) {
    case 'upsertTransactions':
      return step.txs.length > 0 && step.txs.every(tx => cloudTxIds.has(tx.id));
    case 'removeTransactions':
      return step.ids.length > 0 && step.ids.every(id => !cloudTxIds.has(id));
    case 'upsertBill':
      return cloudBillIds.has(step.bill.id);
    case 'removeBill':
      return !cloudBillIds.has(step.id);
    case 'upsertCustomer':
      return cloudCustomerIds.has(step.customer.id);
    case 'removeCustomer':
      return !cloudCustomerIds.has(step.id);
    case 'patchTransactions':
      return false;
    case 'compound': {
      const kept = step.steps.filter(
        child => !isStepRedundant(child, cloudTxIds, cloudBillIds, cloudCustomerIds),
      );
      return kept.length === 0;
    }
    default:
      return false;
  }
}

function pruneStep(
  step: QueueStep,
  cloudTxIds: Set<string>,
  cloudBillIds: Set<string>,
  cloudCustomerIds: Set<string>,
): QueueStep | null {
  if (isStepRedundant(step, cloudTxIds, cloudBillIds, cloudCustomerIds)) return null;
  if (step.type !== 'compound') return step;
  const steps = step.steps
    .map(child => pruneStep(child, cloudTxIds, cloudBillIds, cloudCustomerIds))
    .filter((child): child is QueueStep => child !== null);
  return steps.length ? { type: 'compound', steps } : null;
}

/** إزالة عناصر الطابور المُطبَّقة مسبقاً في السحابة — يمنع إعادة رفعها عند كل تحديث */
export function pruneRedundantQueueItems(cloud: {
  transactions: Transaction[];
  bills: Bill[];
  customers: Customer[];
}): number {
  const cloudTxIds = new Set(cloud.transactions.map(t => t.id));
  const cloudBillIds = new Set(cloud.bills.map(b => b.id));
  const cloudCustomerIds = new Set(cloud.customers.map(c => c.id));
  const queue = readQueue();
  const before = queue.length;
  const next: QueuedMutation[] = [];
  for (const item of queue) {
    const { id, ...step } = item;
    const pruned = pruneStep(step as QueueStep, cloudTxIds, cloudBillIds, cloudCustomerIds);
    if (pruned) next.push({ id, ...pruned } as QueuedMutation);
  }
  if (next.length !== before) writeQueue(next);
  return before - next.length;
}

export function makeQueueItem(steps: QueueStep | QueueStep[]): QueuedMutation {
  const id = crypto.randomUUID();
  const list = Array.isArray(steps) ? steps : [steps];
  if (list.length === 1) return { id, ...list[0] };
  return { id, type: 'compound', steps: list };
}

export function isRetryableError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (/jwt|token|expired|permission|policy|42501|pgrst|violat|invalid|schema|column|صلاحية|غير مُعد/i.test(lower)) {
    return false;
  }
  if (/fetch|network|timeout|aborted|connection|offline|enotfound|econn|load failed|failed to fetch/i.test(lower)) {
    return true;
  }
  if (err instanceof TypeError && /fetch|network|load/i.test(lower)) return true;
  return false;
}

export async function executeQueueStep(step: QueueStep): Promise<void> {
  switch (step.type) {
    case 'upsertTransactions':
      if (step.txs.length) await upsertTransactions(step.txs);
      return;
    case 'removeTransactions':
      if (step.ids.length) await removeTransactions(step.ids);
      return;
    case 'upsertBill':
      await upsertBill(step.bill);
      return;
    case 'removeBill':
      await removeBill(step.id);
      return;
    case 'upsertCustomer':
      await upsertCustomer(step.customer);
      return;
    case 'removeCustomer':
      await removeCustomer(step.id);
      return;
    case 'patchTransactions':
      await patchTransactions(step.ids, step.patch);
      return;
    case 'compound':
      for (const child of step.steps) await executeQueueStep(child);
      return;
    default:
      return;
  }
}

export async function executeQueuedMutation(mutation: QueuedMutation): Promise<void> {
  const { id: _id, ...step } = mutation;
  await executeQueueStep(step as QueueStep);
}

export async function flushOfflineQueue(
  onRemaining?: (count: number) => void,
): Promise<{ flushed: number; stopped: boolean }> {
  let flushed = 0;

  while (true) {
    const queue = readQueue();
    if (!queue.length) {
      onRemaining?.(0);
      return { flushed, stopped: false };
    }

    const head = queue[0];
    try {
      await executeQueuedMutation(head);
      writeQueue(queue.slice(1));
      flushed++;
      onRemaining?.(queue.length - 1);
    } catch (err) {
      if (isRetryableError(err)) {
        onRemaining?.(queue.length);
        return { flushed, stopped: true };
      }
      throw err;
    }
  }
}
