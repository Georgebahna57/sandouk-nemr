import type { AccountBranchId, AccountReconciliation } from '../types';

const META_PREFIX = '[[SNDK-C]]';

interface CustomerMeta {
  rt?: string;
  ra?: string;
  rb?: string;
  ac?: string;
  /** c=مراكز · u=زبائن */
  br?: 'c' | 'u';
}

export function isTransactionReconciled(txDate: string, reconciledThroughDate?: string): boolean {
  if (!reconciledThroughDate) return false;
  return txDate <= reconciledThroughDate;
}

export function encodeCustomerNote(
  userNote: string | undefined,
  meta: { reconciliation?: AccountReconciliation; accountNumber?: string; accountBranch?: AccountBranchId },
): string | undefined {
  const payload: CustomerMeta = {};
  if (meta.reconciliation?.throughDate) {
    payload.rt = meta.reconciliation.throughDate;
    payload.ra = meta.reconciliation.markedAt;
    if (meta.reconciliation.markedByName) payload.rb = meta.reconciliation.markedByName;
  }
  if (meta.accountNumber?.trim()) payload.ac = meta.accountNumber.trim();
  if (meta.accountBranch === 'centers') payload.br = 'c';
  if (meta.accountBranch === 'customers') payload.br = 'u';

  const hasMeta = Object.keys(payload).length > 0;
  const trimmed = userNote?.trim();
  if (!hasMeta) return trimmed || undefined;
  const tag = `${META_PREFIX}${JSON.stringify(payload)}`;
  return trimmed ? `${tag}\n${trimmed}` : tag;
}

export function decodeCustomerNote(note?: string): {
  userNote?: string;
  reconciliation?: AccountReconciliation;
  accountNumber?: string;
  accountBranch?: AccountBranchId;
} {
  if (!note?.startsWith(META_PREFIX)) {
    return { userNote: note?.trim() || undefined };
  }

  const newline = note.indexOf('\n');
  const tagBody = newline === -1 ? note.slice(META_PREFIX.length) : note.slice(META_PREFIX.length, newline);
  const userNote = newline === -1 ? undefined : note.slice(newline + 1).trim() || undefined;

  try {
    const meta = JSON.parse(tagBody) as CustomerMeta;
    const reconciliation = meta.rt && meta.ra
      ? {
        throughDate: meta.rt,
        markedAt: meta.ra,
        markedByName: meta.rb,
      }
      : undefined;
    return {
      userNote,
      reconciliation,
      accountNumber: meta.ac?.trim() || undefined,
      accountBranch: meta.br === 'c' ? 'centers' : meta.br === 'u' ? 'customers' : undefined,
    };
  } catch {
    return { userNote: note.trim() || undefined };
  }
}
