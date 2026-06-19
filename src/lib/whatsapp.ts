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

export function getApprovalStatusText(kind: Transaction['kind']): string {
  if (kind === 'exchange') return 'تم التبديل';
  if (kind === 'payment') return 'تم الدفع';
  return 'تم الاستلام';
}

/** سطر رسالة واتساب عند الاعتماد */
export function getApprovalWhatsAppLine(kind: Transaction['kind']): string {
  if (kind === 'exchange') return 'تم التبديل 👍👍';
  if (kind === 'payment') return 'تم الدفع 👍';
  return 'تم الاستلام 👍';
}

export function buildApprovalWhatsAppMessage(
  lead: Transaction,
  _transactions: Transaction[],
  _approvalDetails?: string,
): string {
  return getApprovalWhatsAppLine(lead.kind);
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

/** يبني رابط whatsapp:// لفتح البرنامج مباشرة (بدون متصفح) */
export function buildWhatsAppAppUrl(destination: string, message: string): string {
  const text = encodeURIComponent(message);
  if (!isWhatsAppGroupLink(destination)) {
    const phone = normalizeWhatsAppPhone(destination);
    if (phone) return `whatsapp://send?phone=${phone}&text=${text}`;
  }
  return `whatsapp://send?text=${text}`;
}

/** يفتح تطبيق واتساب على الجهاز */
export function openWhatsAppApp(destination: string, message: string): void {
  const url = buildWhatsAppAppUrl(destination, message);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function getDestinationLabel(dest: string, index: number): string {
  if (isWhatsAppGroupLink(dest)) return `كروب ${index + 1}`;
  const phone = normalizeWhatsAppPhone(dest);
  if (phone) return `رقم ${phone}`;
  return `وجهة ${index + 1}`;
}
