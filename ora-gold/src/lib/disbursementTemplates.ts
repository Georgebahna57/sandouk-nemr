import { formatDateAr, formatNumber } from './format';
import type { DisbursementOrder } from './disbursementOrders';
import type { DisbursementPrintTemplate } from '../types';

const BASE_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Tahoma, Arial, sans-serif; margin: 24px; color: #111; direction: rtl; }
  .brand { color: #b45309; font-weight: bold; }
  h1 { font-size: 18px; margin: 12px 0; text-align: center; }
  .box { border: 2px solid #333; padding: 16px; margin-top: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 10px 8px; border-bottom: 1px solid #ddd; }
  td:first-child { width: 130px; color: #444; }
  .amount { font-size: 22px; font-weight: bold; color: #b45309; direction: ltr; text-align: left; }
  .sign { margin-top: 48px; display: flex; justify-content: space-between; gap: 16px; }
  .sign div { flex: 1; border-top: 1px solid #333; padding-top: 8px; text-align: center; font-size: 12px; }
  .meta { font-size: 12px; color: #555; margin-top: 8px; }
  @media print { body { margin: 12mm; } }
`;

export const DEFAULT_DISBURSEMENT_TEMPLATES: DisbursementPrintTemplate[] = [
  {
    id: 'classic',
    nameAr: 'كلاسيكي — إطار وتوقيعات',
    isBuiltin: true,
    html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>{{title}}</title><style>${BASE_STYLES}</style></head><body>
<div class="brand">{{brand}}</div>
<h1>{{title}}</h1>
<div class="box">
<table>
<tr><td>التاريخ</td><td>{{date}}</td></tr>
<tr><td>التصنيف</td><td>{{category}}</td></tr>
<tr><td>المصدر</td><td>{{source}}</td></tr>
<tr><td>المستفيد</td><td><strong>{{beneficiary}}</strong></td></tr>
<tr><td>البيان</td><td>{{description}}</td></tr>
<tr><td>المبلغ</td><td class="amount">{{amount}}</td></tr>
</table>
</div>
<div class="sign"><div>المحاسب</div><div>المدير / المخوّل</div></div>
</body></html>`,
  },
  {
    id: 'compact',
    nameAr: 'مختصر — سطر واحد للمبلغ',
    isBuiltin: true,
    html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>{{title}}</title><style>${BASE_STYLES}
  .head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
  .pill { background:#fef3c7; padding:8px 14px; border-radius:8px; font-weight:bold; }
</style></head><body>
<div class="head">
  <div><div class="brand">{{brand}}</div><div class="meta">{{date}} · {{category}}</div></div>
  <div class="pill amount">{{amount}}</div>
</div>
<h1 style="margin-top:0">{{title}}</h1>
<p><strong>المستفيد:</strong> {{beneficiary}}</p>
<p><strong>البيان:</strong> {{description}}</p>
<p class="meta">المصدر: {{source}}</p>
<div class="sign"><div>توقيع المستلم</div><div>توقيع الصندوق</div></div>
</body></html>`,
  },
  {
    id: 'formal',
    nameAr: 'رسمي — ثلاث توقيعات',
    isBuiltin: true,
    html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>{{title}}</title><style>${BASE_STYLES}
  .header-line { border-bottom: 3px double #333; padding-bottom: 8px; margin-bottom: 16px; }
</style></head><body>
<div class="header-line">
  <div class="brand">{{brand}}</div>
  <h1>{{title}}</h1>
  <p class="meta">الفترة: {{period}} · رقم مرجعي: {{ref}}</p>
</div>
<div class="box">
<table>
<tr><td>التاريخ</td><td>{{date}}</td></tr>
<tr><td>المستفيد</td><td>{{beneficiary}}</td></tr>
<tr><td>التصنيف / المصدر</td><td>{{category}} — {{source}}</td></tr>
<tr><td>البيان التفصيلي</td><td>{{description}}</td></tr>
<tr><td>المبلغ المستحق</td><td class="amount">{{amount}}</td></tr>
</table>
</div>
<div class="sign">
  <div>أمين الصندوق</div>
  <div>المحاسب</div>
  <div>الإدارة</div>
</div>
</body></html>`,
  },
];

export function categoryLabelAr(order: DisbursementOrder): string {
  if (order.category === 'purchase') return 'شراء / متاجرة';
  if (order.category === 'expense') return 'مصروف';
  return 'أخرى';
}

export function templateVariables(order: DisbursementOrder, periodLabel?: string): Record<string, string> {
  return {
    brand: `Ora Gold${periodLabel ? ` — ${periodLabel}` : ''}`,
    title: 'أمر صرف نقدي',
    date: formatDateAr(order.date),
    beneficiary: order.beneficiary,
    amount: `${formatNumber(order.amountUsd)} USD`,
    description: order.description || '—',
    category: categoryLabelAr(order),
    source: order.sourceLabel,
    period: periodLabel ?? '—',
    ref: order.id.replace(/^disp_/, '').slice(0, 24),
  };
}

export function renderDisbursementTemplate(
  templateHtml: string,
  order: DisbursementOrder,
  periodLabel?: string,
): string {
  const vars = templateVariables(order, periodLabel);
  return templateHtml.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export function getDisbursementTemplates(custom?: DisbursementPrintTemplate[]): DisbursementPrintTemplate[] {
  const map = new Map<string, DisbursementPrintTemplate>();
  for (const t of DEFAULT_DISBURSEMENT_TEMPLATES) map.set(t.id, { ...t });
  for (const t of custom ?? []) {
    map.set(t.id, { ...t });
  }
  return [...map.values()];
}

export function mergeTemplateOverrides(
  overrides: DisbursementPrintTemplate[] | undefined,
): DisbursementPrintTemplate[] {
  const byId = new Map(DEFAULT_DISBURSEMENT_TEMPLATES.map((t) => [t.id, { ...t }]));
  for (const o of overrides ?? []) {
    const base = byId.get(o.id);
    byId.set(o.id, {
      id: o.id,
      nameAr: o.nameAr || base?.nameAr || o.id,
      html: o.html || base?.html || '',
      isBuiltin: base?.isBuiltin,
    });
  }
  return [...byId.values()];
}
