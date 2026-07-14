import type { AccountReconciliation } from '../types';

const META_PREFIX = '[[SNDK-C]]';

interface CustomerMeta {
  rt?: string;
  ra?: string;
  rb?: string;
}

export function encodeCustomerNote(
  userNote: string | undefined,
  meta: { reconciliation?: AccountReconciliation },
): string | undefined {
  const payload: CustomerMeta = {};
  if (meta.reconciliation?.throughDate) {
    payload.rt = meta.reconciliation.throughDate;
    payload.ra = meta.reconciliation.markedAt;
    if (meta.reconciliation.markedByName) payload.rb = meta.reconciliation.markedByName;
  }

  const hasMeta = Object.keys(payload).length > 0;
  const trimmed = userNote?.trim();
  if (!hasMeta) return trimmed || undefined;
  const tag = `${META_PREFIX}${JSON.stringify(payload)}`;
  return trimmed ? `${tag}\n${trimmed}` : tag;
}

export function decodeCustomerNote(note?: string): {
  userNote?: string;
  reconciliation?: AccountReconciliation;
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
    return { userNote, reconciliation };
  } catch {
    return { userNote: note.trim() || undefined };
  }
}

export function isTransactionReconciled(txDate: string, throughDate?: string): boolean {
  if (!throughDate) return false;
  return txDate <= throughDate;
}
