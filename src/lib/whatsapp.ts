import { CURRENCIES, getCurrencyLabel, getFund, isWeightCurrency } from '../config';
import type { CustomerBalances, FundBalances, FundId, Transaction } from '../types';
import { describeTransaction, formatAmount, formatDateAr, formatFee, formatIntermediary, formatValueWithUnit, todayIso } from './utils';
import { formatTransactionFees } from './fees';

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

  const via = formatIntermediary(lead.intermediary);
  if (via) lines.push(`بيد: ${via}`);
  const fee = formatTransactionFees(lead) ?? formatFee(lead.fee);
  if (fee) lines.push(`أجور/عمولة: ${fee}`);
  if (lead.note) lines.push(`ملاحظة: ${lead.note}`);
  if (actorName) lines.push(`أضافها: ${actorName}`);

  return lines.join('\n');
}

function balanceStatusLabel(balance: number): string {
  if (balance > 0) return 'زايد';
  if (balance < 0) return 'ناقص';
  return 'متعادل';
}

/** رسالة رصيد الصندوق — نهاية اليوم */
export function buildFundBalanceWhatsAppMessage(
  fundId: FundId,
  balances: FundBalances,
  dateIso?: string,
): string {
  const fund = getFund(fundId);
  const lines: string[] = [
    `📊 رصيد ${fund.name}`,
    `التاريخ: ${formatDateAr(dateIso ?? todayIso())}`,
    '',
  ];

  let hasBalance = false;
  for (const c of CURRENCIES) {
    const b = balances[c.id];
    if (b.balance === 0) continue;
    hasBalance = true;
    const amount = formatAmount(Math.abs(b.balance), c.id);
    const status = balanceStatusLabel(b.balance);
    if (isWeightCurrency(c.id)) {
      lines.push(`• ${c.label}: ${b.balance < 0 ? '-' : ''}${amount} غ (${status})`);
    } else {
      lines.push(`• ${c.label}: ${b.balance < 0 ? '-' : ''}${amount} ${c.symbol} (${status})`);
    }
  }

  if (!hasBalance) lines.push('لا يوجد رصيد');
  return lines.join('\n');
}

/** رسالة مطابقة حساب زبون */
export function buildAccountBalanceWhatsAppMessage(
  fundId: FundId,
  accountName: string,
  balances: CustomerBalances,
  dateIso?: string,
): string {
  const fund = getFund(fundId);
  const lines: string[] = [
    `📋 مطابقة حساب — ${accountName}`,
    `الصندوق: ${fund.name}`,
    `التاريخ: ${formatDateAr(dateIso ?? todayIso())}`,
    '',
  ];

  let hasActivity = false;
  for (const c of CURRENCIES) {
    const b = balances[c.id];
    if (b.receipts === 0 && b.payments === 0) continue;
    hasActivity = true;
    lines.push(`• ${getCurrencyLabel(c.id)}:`);
    lines.push(`  وارد: ${formatValueWithUnit(b.receipts, c.id)}`);
    lines.push(`  صادر: ${formatValueWithUnit(b.payments, c.id)}`);
    lines.push(`  رصيد: ${formatValueWithUnit(b.balance, c.id)}`);
  }

  if (!hasActivity) lines.push('لا يوجد حركة على الحساب');
  return lines.join('\n');
}

/** رسالة مشاركة رصيد حساب (نص) */
export function buildAccountShareWhatsAppMessage(
  fundId: FundId,
  accountName: string,
  balances: CustomerBalances,
  dateIso?: string,
): string {
  const fund = getFund(fundId);
  const lines: string[] = [
    `📤 رصيد حساب — ${accountName}`,
    `الصندوق: ${fund.name}`,
    `التاريخ: ${formatDateAr(dateIso ?? todayIso())}`,
    '',
  ];

  let hasBalance = false;
  for (const c of CURRENCIES) {
    const b = balances[c.id];
    if (b.balance === 0 && b.receipts === 0 && b.payments === 0) continue;
    hasBalance = true;
    lines.push(`• ${getCurrencyLabel(c.id)}: ${formatValueWithUnit(b.balance, c.id)}`);
  }

  if (!hasBalance) lines.push('لا يوجد رصيد');
  return lines.join('\n');
}

/** وجهات الإرسال: رقم الزبون أولاً، وإلا كروبات الصندوق، وإلا واتساب بدون رقم */
export function resolveShareDestinations(
  preferredPhone?: string,
  fallbackDestinations?: string[],
): string[] {
  if (preferredPhone?.trim()) return [preferredPhone.trim()];
  const list = (fallbackDestinations ?? []).map(s => s.trim()).filter(Boolean);
  return list.length ? list : [''];
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
  if (!dest.trim()) return 'اختر جهة على واتساب';
  if (isWhatsAppGroupLink(dest)) return `كروب ${index + 1}`;
  const phone = normalizeWhatsAppPhone(dest);
  if (phone) return `رقم ${phone}`;
  return `وجهة ${index + 1}`;
}
