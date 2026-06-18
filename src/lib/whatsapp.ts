import { getFund } from '../config';
import type { FundId, Transaction } from '../types';
import { describeTransaction, formatDateAr } from './utils';

/** يحوّل الرقم لصيغة wa.me (أرقام فقط مع رمز الدولة) */
export function normalizeWhatsAppPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length >= 8) digits = `961${digits.slice(1)}`;
  return digits.length >= 8 ? digits : null;
}

export function isWhatsAppGroupLink(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    return url.hostname === 'chat.whatsapp.com'
      || (url.hostname.endsWith('whatsapp.com') && url.pathname.startsWith('/chat'));
  } catch {
    return false;
  }
}

/** سطر أو فاصلة لكل وجهة (رقم أو رابط كروب) */
export function parseWhatsAppDestinations(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

export function destinationsToText(destinations: string[] | undefined): string {
  return (destinations ?? []).join('\n');
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

function buildDestinationUrl(destination: string, message: string): string {
  if (isWhatsAppGroupLink(destination)) {
    return destination.trim().startsWith('http') ? destination.trim() : `https://${destination.trim()}`;
  }
  const phone = normalizeWhatsAppPhone(destination);
  if (phone) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export { buildDestinationUrl };

export function getDestinationLabel(dest: string, index: number): string {
  if (isWhatsAppGroupLink(dest)) return `كروب ${index + 1}`;
  const phone = normalizeWhatsAppPhone(dest);
  if (phone) return `رقم ${phone}`;
  return `وجهة ${index + 1}`;
}

async function copyMessageForGroup(message: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(message);
  } catch {
    // على بعض الجوالات النسخ يحتاج إجراء يدوي
  }
}

function navigateWindow(win: Window | null | undefined, url: string): void {
  if (win && !win.closed) {
    win.location.href = url;
    return;
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.href = url;
}

/** يفتح كل وجهة (كروب أو رقم) — للكروبات ينسخ الرسالة تلقائياً */
export async function openPendingWhatsAppNotify(
  destinations: string[],
  fundId: FundId,
  transactions: Transaction[],
  actorName?: string,
  prefetchedWindows?: Array<Window | null>,
): Promise<number> {
  const message = buildPendingWhatsAppMessage(fundId, transactions, actorName);
  const targets = destinations.map(d => d.trim()).filter(Boolean);
  if (!message || !targets.length) return 0;

  let opened = 0;
  for (let i = 0; i < targets.length; i++) {
    const dest = targets[i];
    const win = prefetchedWindows?.[i] ?? null;

    if (isWhatsAppGroupLink(dest)) {
      await copyMessageForGroup(message);
    }
    navigateWindow(win ?? window.open('about:blank', '_blank'), buildDestinationUrl(dest, message));
    opened++;
  }

  return opened;
}
