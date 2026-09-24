import { useMemo, useState } from 'react';
import { Banknote, Printer, Trash2 } from 'lucide-react';
import {
  buildDisbursementPrintHtml,
  collectDisbursementOrders,
  expenseAccountLabels,
  resolveDefaultDisbursementTemplate,
  resolveDisbursementTemplates,
  type DisbursementOrder,
} from '../lib/disbursementOrders';
import { openPrintWindow } from '../lib/invoicePrint';
import { formatDateAr, formatNumber } from '../lib/format';
import type { DisbursementPrintTemplate, WorkshopState } from '../types';
import { DisbursementPrintDialog } from './DisbursementPrintDialog';
import { ManualDisbursementForm, type ManualDisbursementInput } from './ManualDisbursementForm';

interface Props {
  state: WorkshopState;
  onAddManual: (input: ManualDisbursementInput) => void;
  onDeleteManual: (id: string) => void;
  onSaveTemplates: (overrides: DisbursementPrintTemplate[], defaultTemplateId: string) => void;
}

export function DisbursementOrdersPanel({ state, onAddManual, onDeleteManual, onSaveTemplates }: Props) {
  const orders = useMemo(() => collectDisbursementOrders(state), [state]);
  const purchases = orders.filter((o) => o.category === 'purchase' && !o.manual);
  const expenses = orders.filter((o) => o.category === 'expense' && !o.manual);
  const manual = orders.filter((o) => o.manual);

  const templates = useMemo(() => resolveDisbursementTemplates(state), [state]);
  const defaultTemplateId = state.settings?.defaultDisbursementTemplateId ?? 'classic';

  const [printOrder, setPrintOrder] = useState<DisbursementOrder | null>(null);

  const printBatch = (list: DisbursementOrder[]) => {
    if (!list.length) return;
    const tpl = resolveDefaultDisbursementTemplate(state);
    const body = list
      .map((o) => buildDisbursementPrintHtml(o, state.periodLabel, tpl).replace(/<\/?html[^>]*>|<\/?head[^>]*>|<\/?body[^>]*>/gi, ''))
      .join('<div style="page-break-after:always"></div>');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/></head><body>${body}</body></html>`;
    openPrintWindow(html, 'أوامر صرف');
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
          <Banknote className="h-5 w-5" /> أوامر الصرف
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          تُجمَع تلقائياً من <strong>فواتير الشراء</strong> وقيود <strong>المصاريف</strong> ($)، أو تُضاف يدوياً.
          الطباعة تدعم <strong>قوالب جاهزة</strong> قابلة للتعديل والحفظ.
        </p>
        <ManualDisbursementForm onAdd={onAddManual} />
      </div>

      <OrderTable
        title={`أوامر يدوية (${manual.length})`}
        orders={manual}
        onPrint={(o) => setPrintOrder(o)}
        onPrintAll={() => printBatch(manual)}
        onDelete={onDeleteManual}
      />
      <OrderTable
        title={`مشتريات (${purchases.length})`}
        orders={purchases}
        onPrint={(o) => setPrintOrder(o)}
        onPrintAll={() => printBatch(purchases)}
      />
      <OrderTable
        title={`مصاريف (${expenses.length})`}
        orders={expenses}
        onPrint={(o) => setPrintOrder(o)}
        onPrintAll={() => printBatch(expenses)}
      />

      <p className="text-xs text-slate-500 px-1">
        مصادر المصاريف التلقائية: {expenseAccountLabels().join(' · ')}.
      </p>

      {printOrder && (
        <DisbursementPrintDialog
          order={printOrder}
          periodLabel={state.periodLabel}
          templates={templates}
          defaultTemplateId={defaultTemplateId}
          onClose={() => setPrintOrder(null)}
          onSaveTemplates={onSaveTemplates}
        />
      )}
    </div>
  );
}

function OrderTable({
  title,
  orders,
  onPrint,
  onPrintAll,
  onDelete,
}: {
  title: string;
  orders: DisbursementOrder[];
  onPrint: (o: DisbursementOrder) => void;
  onPrintAll: () => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-700 bg-slate-800/50 px-4 py-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-amber-400">{title}</h3>
        {orders.length > 0 && (
          <button type="button" className="btn-secondary text-xs flex items-center gap-1" onClick={onPrintAll}>
            <Printer className="h-3.5 w-3.5" /> طباعة الكل (القالب الافتراضي)
          </button>
        )}
      </div>
      {orders.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">لا توجد أوامر في هذا القسم</p>
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full table-ledger text-sm">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المستفيد</th>
                <th>المبلغ $</th>
                <th>المصدر</th>
                <th>البيان</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{formatDateAr(o.date)}</td>
                  <td>{o.beneficiary}</td>
                  <td className="num font-medium">{formatNumber(o.amountUsd)}</td>
                  <td className="text-xs text-slate-400">{o.sourceLabel}</td>
                  <td className="max-w-[180px] truncate" title={o.description}>{o.description}</td>
                  <td className="flex gap-1 justify-end">
                    <button
                      type="button"
                      className="text-amber-400 hover:text-amber-300 p-1"
                      title="طباعة مع قوالب"
                      onClick={() => onPrint(o)}
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    {onDelete && o.manual && (
                      <button
                        type="button"
                        className="text-red-400 hover:text-red-300 p-1"
                        title="حذف"
                        onClick={() => onDelete(o.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
