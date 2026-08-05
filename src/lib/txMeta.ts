import type { TransactionLedger } from '../types';
import type { HalabRemittanceMeta } from './halabRemittance';
import { decodeHalabRemittanceMeta, encodeHalabRemittanceMeta } from './halabRemittance';
import type { HalabRemittanceFields } from '../types';

const META_PREFIX = '[[SNDK]]';

interface TxMeta {
  l?: TransactionLedger;
  c?: string;
  b?: string;
  li?: string;
  uid?: string;
  em?: string;
  nm?: string;
  pwm?: string;
  ad?: string;
  abn?: string;
  abe?: string;
  aat?: string;
  od?: string;
  fsi?: string;
  xf?: string;
  hr?: HalabRemittanceMeta;
}

export function encodeNoteMeta(
  userNote: string | undefined,
  meta: {
    ledger?: TransactionLedger;
    counterparty?: string;
    batchId?: string;
    linkId?: string;
    createdByUserId?: string;
    createdByEmail?: string;
    createdByName?: string;
    pendingWhatsAppMessage?: string;
    approvalDetails?: string;
    approvedByName?: string;
    approvedByEmail?: string;
    approvedAt?: string;
    orderedDate?: string;
    feeSourceId?: string;
    extraFee?: string;
    halabRemittance?: HalabRemittanceFields;
  },
): string | undefined {
  const payload: TxMeta = {};
  if (meta.ledger && meta.ledger !== 'fund') payload.l = meta.ledger;
  if (meta.counterparty) payload.c = meta.counterparty;
  if (meta.batchId) payload.b = meta.batchId;
  if (meta.linkId) payload.li = meta.linkId;
  if (meta.createdByUserId) payload.uid = meta.createdByUserId;
  if (meta.createdByEmail) payload.em = meta.createdByEmail;
  if (meta.createdByName) payload.nm = meta.createdByName;
  if (meta.pendingWhatsAppMessage) payload.pwm = meta.pendingWhatsAppMessage;
  if (meta.approvalDetails) payload.ad = meta.approvalDetails;
  if (meta.approvedByName) payload.abn = meta.approvedByName;
  if (meta.approvedByEmail) payload.abe = meta.approvedByEmail;
  if (meta.approvedAt) payload.aat = meta.approvedAt;
  if (meta.orderedDate) payload.od = meta.orderedDate;
  if (meta.feeSourceId) payload.fsi = meta.feeSourceId;
  if (meta.extraFee) payload.xf = meta.extraFee;
  const hr = encodeHalabRemittanceMeta(meta.halabRemittance);
  if (hr) payload.hr = hr;

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
  linkId?: string;
  createdByUserId?: string;
  createdByEmail?: string;
  createdByName?: string;
  pendingWhatsAppMessage?: string;
  approvalDetails?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  approvedAt?: string;
  orderedDate?: string;
  feeSourceId?: string;
  extraFee?: string;
  halabRemittance?: HalabRemittanceFields;
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
      linkId: meta.li,
      createdByUserId: meta.uid,
      createdByEmail: meta.em,
      createdByName: meta.nm,
      pendingWhatsAppMessage: meta.pwm,
      approvalDetails: meta.ad,
      approvedByName: meta.abn,
      approvedByEmail: meta.abe,
      approvedAt: meta.aat,
      orderedDate: meta.od,
      feeSourceId: meta.fsi,
      extraFee: meta.xf,
      halabRemittance: decodeHalabRemittanceMeta(meta.hr),
    };
  } catch {
    return { userNote: note.trim() || undefined };
  }
}
