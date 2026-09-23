import { INVOICE_TYPE_LABELS } from './invoiceCalc';
import { formatDateAr, formatNumber } from './format';
import type { InvoicePosting, InvoiceType } from '../types';

export type InvoicePrintSectionId =
  | 'header'
  | 'trading'
  | 'worked'
  | 'customers'
  | 'profit'
  | 'cash'
  | 'materials'
  | 'totals';

export interface InvoicePrintSection {
  id: InvoicePrintSectionId;
  titleAr: string;
  postings: InvoicePosting[];
}

export interface InvoicePrintData {
  number: string;
  date: string;
  customer: string;
  type: InvoiceType;
  description: string;
  postings: InvoicePosting[];
  workedWeight?: number;
  receivedUsd?: number;
  usdAmount?: number;
  wageUsd?: number;
  stoneDiscountGrams?: number;
  profitRate?: number;
}

function sectionForAccount(accountId: string): InvoicePrintSectionId {
  if (accountId === 'trading') return 'trading';
  if (accountId === 'wages18' || accountId === 'wages21') return 'worked';
  if (accountId === 'customers') return 'customers';
  if (accountId === 'pro') return 'profit';
  if (accountId === 'dollar' || accountId === 'cash') return 'cash';
  return 'materials';
}

const SECTION_TITLES: Record<InvoicePrintSectionId, string> = {
  header: 'بيانات الفاتورة',
  trading: 'قسم المتاجرة (Trading)',
  worked: 'قسم المشغول والأجور',
  customers: 'قسم زبائن الورشة',
  profit: 'قسم ربح الإنتاج (Pro)',
  cash: 'قسم الصندوق / الدولار',
  materials: 'قسم المواد (كسر / K / دهب)',
  totals: 'ملخص المبالغ',
};

/** أقسام افتراضية حسب نوع الفاتورة — مطابقة لمسارات Excel */
export function defaultSectionsForType(type: InvoiceType): InvoicePrintSectionId[] {
  switch (type) {
    case 'sale18':
    case 'sale21':
      return ['header', 'trading', 'worked', 'profit', 'cash', 'materials', 'totals'];
    case 'workshop':
      return ['header', 'customers', 'worked', 'profit', 'materials', 'totals'];
    case 'purchase':
      return ['header', 'trading', 'cash', 'totals'];
    default:
      return ['header', 'totals'];
  }
}

export function buildInvoicePrintSections(data: InvoicePrintData): InvoicePrintSection[] {
  const buckets = new Map<InvoicePrintSectionId, InvoicePosting[]>();
  for (const id of Object.keys(SECTION_TITLES) as InvoicePrintSectionId[]) {
    if (id !== 'header' && id !== 'totals') buckets.set(id, []);
  }
  for (const p of data.postings) {
    const sid = sectionForAccount(p.accountId);
    buckets.get(sid)?.push(p);
  }

  const sections: InvoicePrintSection[] = [
    { id: 'header', titleAr: SECTION_TITLES.header, postings: [] },
  ];
  for (const [id, postings] of buckets) {
    if (postings.length) sections.push({ id, titleAr: SECTION_TITLES[id], postings });
  }
  sections.push({ id: 'totals', titleAr: SECTION_TITLES.totals, postings: [] });
  return sections;
}

function postingRow(p: InvoicePosting): string {
  const unit = p.side === 'gold' ? 'غ (995)' : '$';
  const debit = p.debit ? formatNumber(p.debit, p.side === 'gold' ? 4 : 2) : '—';
  const credit = p.credit ? formatNumber(p.credit, p.side === 'gold' ? 4 : 2) : '—';
  return `<tr>
    <td>${p.accountName}</td>
    <td>${p.side === 'gold' ? 'ذهب' : 'دولار'}</td>
    <td class="num">${debit}</td>
    <td class="num">${credit}</td>
    <td>${p.note ?? ''}</td>
    <td>${unit}</td>
  </tr>`;
}

function sectionBlock(section: InvoicePrintSection): string {
  if (section.id === 'header') return '';
  if (section.id === 'totals') return '';
  if (!section.postings.length) return '';
  return `
    <section class="print-section">
      <h2>${section.titleAr}</h2>
      <table>
        <thead><tr>
          <th>الحساب</th><th>النوع</th><th>مدين</th><th>دائن</th><th>ملاحظة</th><th>وحدة</th>
        </tr></thead>
        <tbody>${section.postings.map(postingRow).join('')}</tbody>
      </table>
    </section>`;
}

function totalsBlock(data: InvoicePrintData): string {
  let goldOut = 0;
  let goldIn = 0;
  let usdOut = 0;
  let usdIn = 0;
  for (const p of data.postings) {
    if (p.side === 'gold') {
      goldOut += p.debit ?? 0;
      goldIn += p.credit ?? 0;
    } else {
      usdOut += p.debit ?? 0;
      usdIn += p.credit ?? 0;
    }
  }
  return `
    <section class="print-section">
      <h2>${SECTION_TITLES.totals}</h2>
      <table class="summary-table">
        <tr><td>وزن المشغول (إجمالي)</td><td class="num">${data.workedWeight ? formatNumber(data.workedWeight, 2) + ' غ' : '—'}</td></tr>
        <tr><td>خصم حجر</td><td class="num">${data.stoneDiscountGrams ? formatNumber(data.stoneDiscountGrams, 2) + ' غ' : '—'}</td></tr>
        <tr><td>مقبوض $</td><td class="num">${(data.receivedUsd ?? data.usdAmount) ? formatNumber(data.receivedUsd ?? data.usdAmount) + ' $' : '—'}</td></tr>
        <tr><td>أجور $</td><td class="num">${data.wageUsd ? formatNumber(data.wageUsd) + ' $' : '—'}</td></tr>
        <tr><td>مجموع مدين ذهب</td><td class="num">${formatNumber(goldOut, 4)} غ</td></tr>
        <tr><td>مجموع دائن ذهب</td><td class="num">${formatNumber(goldIn, 4)} غ</td></tr>
        <tr><td>مجموع مدين دولار</td><td class="num">${formatNumber(usdOut)} $</td></tr>
        <tr><td>مجموع دائن دولار</td><td class="num">${formatNumber(usdIn)} $</td></tr>
      </table>
    </section>`;
}

function headerBlock(data: InvoicePrintData): string {
  return `
    <header class="print-header">
      <div class="brand">Ora Gold — معمل الذهب</div>
      <h1>فاتورة / سند قيود</h1>
      <table class="meta-table">
        <tr><td>رقم الفاتورة</td><td><strong>${data.number}</strong></td></tr>
        <tr><td>التاريخ</td><td>${formatDateAr(data.date)}</td></tr>
        <tr><td>الزبون / الجهة</td><td>${data.customer}</td></tr>
        <tr><td>نوع العملية</td><td>${INVOICE_TYPE_LABELS[data.type]}</td></tr>
        <tr><td>البيان</td><td>${data.description}</td></tr>
      </table>
    </header>`;
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Tahoma, Arial, sans-serif; margin: 24px; color: #111; direction: rtl; }
  .brand { color: #b45309; font-weight: bold; font-size: 14px; }
  h1 { font-size: 20px; margin: 8px 0 16px; }
  h2 { font-size: 15px; color: #92400e; border-bottom: 2px solid #fbbf24; padding-bottom: 4px; margin-top: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; }
  th { background: #fef3c7; }
  .num { direction: ltr; text-align: left; font-variant-numeric: tabular-nums; }
  .meta-table td:first-child { width: 140px; color: #555; }
  .summary-table td:last-child { font-weight: 600; }
  .print-section { page-break-inside: avoid; }
  .page-break { page-break-after: always; }
  @media print {
    body { margin: 12mm; }
  }
`;

export type PrintMode = 'full' | 'selected' | 'eachSection';

export function buildInvoicePrintHtml(
  data: InvoicePrintData,
  selectedSectionIds: Set<InvoicePrintSectionId>,
  mode: PrintMode,
): string {
  const sections = buildInvoicePrintSections(data);
  const parts: string[] = [headerBlock(data)];

  const contentSections = sections.filter((s) => s.id !== 'header' && s.id !== 'totals');

  if (mode === 'eachSection') {
    for (const s of contentSections) {
      if (!selectedSectionIds.has(s.id) || !s.postings.length) continue;
      parts.push(sectionBlock(s));
      parts.push('<div class="page-break"></div>');
    }
    if (selectedSectionIds.has('totals')) parts.push(totalsBlock(data));
  } else {
    for (const s of contentSections) {
      if (mode === 'selected' && !selectedSectionIds.has(s.id)) continue;
      parts.push(sectionBlock(s));
    }
    if (mode === 'full' || selectedSectionIds.has('totals')) parts.push(totalsBlock(data));
  }

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
    <title>فاتورة ${data.number}</title><style>${PRINT_STYLES}</style></head>
    <body>${parts.join('')}</body></html>`;
}

/** طباعة HTML — iframe يتجنب حظر النوافذ المنبثقة و bug `noopener` الذي يُرجع null */
export function openPrintWindow(html: string, title: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', title);
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    openPrintWindowPopupFallback(html, title);
    return;
  }

  const doc = win.document;
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 2000);
  };

  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      openPrintWindowPopupFallback(html, title);
    } finally {
      cleanup();
    }
  };

  if (doc.readyState === 'complete') {
    window.setTimeout(runPrint, 100);
  } else {
    win.addEventListener('load', () => window.setTimeout(runPrint, 100), { once: true });
  }
}

function openPrintWindowPopupFallback(html: string, title: string): void {
  // بدون noopener — وإلا window.open يعيد null في Chrome ولا تُكتب الصفحة
  const w = window.open('', '_blank');
  if (!w) {
    alert('تعذّر الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = title;
  w.addEventListener('load', () => {
    w.focus();
    w.print();
  });
  try {
    w.opener = null;
  } catch {
    /* ignore */
  }
}

export { SECTION_TITLES };
