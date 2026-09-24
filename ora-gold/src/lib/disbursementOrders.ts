import { getAccountDef } from './accountsConfig';
import { getDisplayValues } from './ledgerDisplay';
import { formatDateAr, formatNumber } from './format';
import type { DisbursementCategory, ManualDisbursementOrder, WorkshopInvoice, WorkshopState } from '../types';
import { mergeTemplateOverrides, renderDisbursementTemplate } from './disbursementTemplates';
import type { DisbursementPrintTemplate } from '../types';

export type { DisbursementCategory };

export interface DisbursementOrder {
  id: string;
  date: string;
  amountUsd: number;
  beneficiary: string;
  description: string;
  category: DisbursementCategory;
  sourceLabel: string;
  accountId?: string;
  entryId?: string;
  manual?: boolean;
}

const EXPENSE_ACCOUNT_IDS = ['operational', 'monthly', 'setup', 'machines'] as const;

function extractBeneficiary(desc: string): string {
  const parts = desc.split('//').map((s) => s.trim());
  if (parts.length > 1) return parts[parts.length - 1];
  const m = desc.match(/(?:بيد|من|لـ|إلى)\s+(.+)$/i);
  return m?.[1]?.trim() || desc.slice(0, 80) || '—';
}

/** أوامر صرف من فواتير الشراء */
function fromPurchaseInvoices(invoices: WorkshopInvoice[]): DisbursementOrder[] {
  return invoices
    .filter((i) => i.type === 'purchase' && (i.usdAmount ?? 0) > 0)
    .map((i) => ({
      id: `disp_inv_${i.id}`,
      date: i.date,
      amountUsd: i.usdAmount!,
      beneficiary: i.customer.trim() || extractBeneficiary(i.description),
      description: i.description,
      category: 'purchase' as const,
      sourceLabel: 'فاتورة شراء — متاجرة',
    }));
}

/** أوامر صرف من قيود المصاريف (مدفوع $) */
function fromExpenseLedgers(state: WorkshopState): DisbursementOrder[] {
  const orders: DisbursementOrder[] = [];
  for (const accountId of EXPENSE_ACCOUNT_IDS) {
    const def = getAccountDef(accountId);
    if (!def) continue;
    const data = state.accounts[accountId];
    if (!data) continue;
    for (const e of data.usd) {
      const { col1 } = getDisplayValues(e, 'expense', 'usd');
      const amount = col1 ?? 0;
      if (amount <= 0) continue;
      orders.push({
        id: `disp_${accountId}_${e.id}`,
        date: e.date,
        amountUsd: amount,
        beneficiary: extractBeneficiary(e.description),
        description: e.description,
        category: 'expense',
        sourceLabel: def.dashboardLabel ?? def.nameAr,
        accountId,
        entryId: e.id,
      });
    }
  }
  return orders;
}

function fromManualOrders(list: ManualDisbursementOrder[]): DisbursementOrder[] {
  return list.map((m) => ({
    id: m.id,
    date: m.date,
    amountUsd: m.amountUsd,
    beneficiary: m.beneficiary,
    description: m.description,
    category: m.category === 'other' ? 'expense' : m.category,
    sourceLabel: m.sourceLabel ?? 'أمر صرف يدوي',
    manual: true,
  }));
}

export function collectDisbursementOrders(state: WorkshopState): DisbursementOrder[] {
  const invoices = state.invoices ?? [];
  const manual = fromManualOrders(state.manualDisbursementOrders ?? []);
  const all = [...fromPurchaseInvoices(invoices), ...fromExpenseLedgers(state), ...manual];
  return all.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

const DISBURSE_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Tahoma, Arial, sans-serif; margin: 24px; color: #111; direction: rtl; }
  .brand { color: #b45309; font-weight: bold; }
  h1 { font-size: 18px; margin: 12px 0; text-align: center; }
  .box { border: 2px solid #333; padding: 16px; margin-top: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 10px 8px; border-bottom: 1px solid #ddd; }
  td:first-child { width: 130px; color: #444; }
  .amount { font-size: 22px; font-weight: bold; color: #b45309; direction: ltr; text-align: left; }
  .sign { margin-top: 48px; display: flex; justify-content: space-between; }
  .sign div { width: 40%; border-top: 1px solid #333; padding-top: 8px; text-align: center; font-size: 12px; }
  @media print { body { margin: 12mm; } }
`;

export function buildDisbursementPrintHtml(
  order: DisbursementOrder,
  periodLabel?: string,
  template?: DisbursementPrintTemplate,
): string {
  if (template?.html) {
    return renderDisbursementTemplate(template.html, order, periodLabel);
  }
  const catLabel = order.category === 'purchase' ? 'شراء / متاجرة' : 'مصروف تشغيلي أو تأسيس';
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
    <title>أمر صرف ${order.id}</title><style>${DISBURSE_STYLES}</style></head>
    <body>
      <div class="brand">Ora Gold${periodLabel ? ` — ${periodLabel}` : ''}</div>
      <h1>أمر صرف نقدي</h1>
      <div class="box">
        <table>
          <tr><td>التاريخ</td><td>${formatDateAr(order.date)}</td></tr>
          <tr><td>التصنيف</td><td>${catLabel}</td></tr>
          <tr><td>المصدر</td><td>${order.sourceLabel}</td></tr>
          <tr><td>المستفيد</td><td><strong>${order.beneficiary}</strong></td></tr>
          <tr><td>البيان</td><td>${order.description}</td></tr>
          <tr><td>المبلغ</td><td class="amount">${formatNumber(order.amountUsd)} USD</td></tr>
        </table>
      </div>
      <div class="sign">
        <div>المحاسب</div>
        <div>المدير / المخوّل</div>
      </div>
    </body></html>`;
}

export function resolveDisbursementTemplates(state: WorkshopState): DisbursementPrintTemplate[] {
  return mergeTemplateOverrides(state.settings?.disbursementTemplateOverrides);
}

export function resolveDefaultDisbursementTemplate(state: WorkshopState): DisbursementPrintTemplate {
  const templates = resolveDisbursementTemplates(state);
  const id = state.settings?.defaultDisbursementTemplateId ?? 'classic';
  return templates.find((t) => t.id === id) ?? templates[0];
}

export function expenseAccountLabels(): string[] {
  return EXPENSE_ACCOUNT_IDS.map((id) => {
    const d = getAccountDef(id);
    return d ? `${d.nameAr} (${d.sheetName})` : id;
  });
}
