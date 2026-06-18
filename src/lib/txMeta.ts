import type { TransactionLedger } from '../types';

const META_PREFIX = '[[SNDK]]';

interface TxMeta {
  l?: TransactionLedger;
  c?: string;
  b?: string;
  uid?: string;
  em?: string;
  nm?: string;
}

export function encodeNoteMeta(
  userNote: string | undefined,
  meta: {
    ledger?: TransactionLedger;
    counterparty?: string;
    batchId?: string;
    createdByUserId?: string;
    createdByEmail?: string;
    createdByName?: string;
  },
): string | undefined {
  const payload: TxMeta = {};
  if (meta.ledger && meta.ledger !== 'fund') payload.l = meta.ledger;
  if (meta.counterparty) payload.c = meta.counterparty;
  if (meta.batchId) payload.b = meta.batchId;
  if (meta.createdByUserId) payload.uid = meta.createdByUserId;
  if (meta.createdByEmail) payload.em = meta.createdByEmail;
  if (meta.createdByName) payload.nm = meta.createdByName;

  const hasMeta = Object.keys(payload).length > 0;
  const trimmed = userNote?.trim();
  if (!hasMeta) return trimmed || undefined;
  const tag = `${META_PREFIX}${JSON.stringify(payload)}`;
  return trimmed ? `${tag}\n${trimmed}` : tag;
}

export function decodeNoteMeta(note?: string): {
  userNote?: string;
  ledger?: TransactionLedger;
  counterparty?: string;
  batchId?: string;
  createdByUserId?: string;
  createdByEmail?: string;
  createdByName?: string;
} {
  if (!note?.startsWith(META_PREFIX)) {
    return { userNote: note?.trim() || undefined };
  }

  const newline = note.indexOf('\n');
  const tagBody = newline === -1 ? note.slice(META_PREFIX.length) : note.slice(META_PREFIX.length, newline);
  const userNote = newline === -1 ? undefined : note.slice(newline + 1).trim() || undefined;

  try {
    const meta = JSON.parse(tagBody) as TxMeta;
    return {
      userNote,
      ledger: meta.l,
      counterparty: meta.c,
      batchId: meta.b,
      createdByUserId: meta.uid,
      createdByEmail: meta.em,
      createdByName: meta.nm,
    };
  } catch {
    return { userNote: note.trim() || undefined };
  }
}
