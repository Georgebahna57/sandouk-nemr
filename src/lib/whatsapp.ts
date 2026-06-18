import { getFund } from '../config';
import type { FundId, Transaction } from '../types';
import { describeTransaction, formatDateAr } from './utils';

/** يحوّل الرقم لصيغة wa.me (أرقام فقط مع رمز الدولة) */
export function normalizeWhatsAppPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  // رقم محلي لبناني يبدأ بـ 0
  if (digits.startsWith('0') && digits.length >= 8) digits = `961${digits.slice(1)}`;
  return digits.length >= 8 ? digits : null;
}

export function buildPendingWhatsAppMessage(
  fundId: FundId,
  transactions: Transaction[],
  actorName?: string,
): string {
  const fund = getFund(fundId);
  const lead = transactions[0];
  if (!lead) return '';

  const lines: string[] = [
    `⏳ قيد انتظار — ${fund.name}`,
    `التاريخ: ${formatDateAr(lead.date)}`,
  ];

  for (const tx of transactions) {
    lines.push(`• ${describeTransaction(tx)}`);
  }

  if (lead.intermediary) lines.push(`بيد: ${lead.intermediary}`);
  if (lead.note) lines.push(`ملاحظة: ${lead.note}`);
  if (actorName) lines.push(`أضافها: ${actorName}`);

  return lines.join('\n');
}

export function buildPendingWhatsAppUrl(
  phoneRaw: string,
  fundId: FundId,
  transactions: Transaction[],
  actorName?: string,
): string | null {
  const phone = normalizeWhatsAppPhone(phoneRaw);
  if (!phone || !transactions.length) return null;
  const text = buildPendingWhatsAppMessage(fundId, transactions, actorName);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function openPendingWhatsAppNotify(
  phoneRaw: string,
  fundId: FundId,
  transactions: Transaction[],
  actorName?: string,
  prefetchedWindow?: Window | null,
): string | null {
  const url = buildPendingWhatsAppUrl(phoneRaw, fundId, transactions, actorName);
  if (!url) return null;

  if (prefetchedWindow && !prefetchedWindow.closed) {
    prefetchedWindow.location.href = url;
    return url;
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.href = url;
  return url;
}
