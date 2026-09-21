import type { InvoiceType } from '../types';

/** مرحلة دورة الورشة — مطابقة لملف Excel */
export interface WorkshopStage {
  id: string;
  titleAr: string;
  detailAr: string;
}

export const WORKSHOP_LIFECYCLE: WorkshopStage[] = [
  { id: 'supply', titleAr: 'توريد وتمويل', detailAr: 'دهب / كسر / Alloy / فضة + سيولة من Ahmad / Mzen / Cash' },
  { id: 'wip', titleAr: 'تحت التصنيع', detailAr: 'خروج من الخام ودخول ورشة — ورقة «تحت التصنيع»' },
  { id: 'production', titleAr: 'مشغول جاهز', detailAr: 'استلام مشغول 18/21 — أعمدة مستلم من تصنيع / تسليم زبائن' },
  { id: 'sale', titleAr: 'بيع أو تسليم زبون', detailAr: 'متاجرة (Trading) أو زبون ورشة (زبائن) — حسب نوع الفاتورة' },
  { id: 'settlement', titleAr: 'تسوية وتحصيل', detailAr: 'دولار (صندوق) + Pro (ربح) + مواد إضافية (K18/K21/دهب) عند الحاجة' },
];

export interface InvoiceFlowInfo {
  type: InvoiceType;
  labelAr: string;
  stages: string[];
  /** أوراق Excel التي يُرحَّل عليها القيد الأساسي */
  sheets: string[];
  notesAr: string;
}

/** مسارات الفاتورة — مطابقة لنمط ميزانية-05-2026 */
export const INVOICE_OPERATION_FLOWS: Record<InvoiceType, InvoiceFlowInfo> = {
  sale18: {
    type: 'sale18',
    labelAr: 'مبيع مشغول 18 (متاجرة)',
    stages: ['production', 'sale', 'settlement'],
    sheets: ['Trading', 'مشغول 18', 'دولار', 'Pro'],
    notesAr:
      'لا يُرحَّل تلقائياً على «زبائن» ولا K18 — أضف سطر K18/كسر من السطور الإضافية إن لزم، كما في Excel.',
  },
  sale21: {
    type: 'sale21',
    labelAr: 'مبيع مشغول 21 (متاجرة)',
    stages: ['production', 'sale', 'settlement'],
    sheets: ['Trading', 'مشغول 21', 'دولار', 'Pro'],
    notesAr: 'نفس مسار 18 على ورقة مشغول 21.',
  },
  workshop: {
    type: 'workshop',
    labelAr: 'زبون ورشة',
    stages: ['production', 'sale', 'settlement'],
    sheets: ['زبائن', 'مشغول 18/21', 'Pro', 'دهب (خام مُعطى)'],
    notesAr: 'بدون Trading — الذمم على ورقة الزبائن؛ دهب خام يُسجَّل على «دهب».',
  },
  purchase: {
    type: 'purchase',
    labelAr: 'شراء ذهب (متاجرة)',
    stages: ['supply', 'settlement'],
    sheets: ['Trading', 'دولار'],
    notesAr: 'شراء في Trading + خروج من الصندوق في «دولار».',
  },
};

export function getInvoiceOperationFlow(type: InvoiceType): InvoiceFlowInfo {
  return INVOICE_OPERATION_FLOWS[type];
}

/** عمليات يدوية شائعة (سند من الحساب) — من جدول الخلاصة */
export const MANUAL_OPERATION_HINTS = [
  {
    titleAr: 'استلام خام / كسر',
    sheets: ['دهب أو كسر صب', 'Ahmad/Mzen/زبائن', 'دولار/Cash'],
  },
  {
    titleAr: 'تسليم للتصنيع',
    sheets: ['مصدر المادة', 'تحت التصنيع'],
  },
  {
    titleAr: 'تحويل كسر صب ↔ سحب',
    sheets: ['كسر 18 صب', 'كسر 18 سحب'],
  },
  {
    titleAr: 'مصروف تشغيلي',
    sheets: ['مصاريف تشغيلية/أخرى', 'دولار أو Cash أو شريك'],
  },
] as const;
