import { useMemo } from 'react';
import { Banknote, Printer } from 'lucide-react';
import {
  buildDisbursementPrintHtml,
  collectDisbursementOrders,
  expenseAccountLabels,
  type DisbursementOrder,
} from '../lib/disbursementOrders';
import { openPrintWindow } from '../lib/invoicePrint';
import { formatDateAr, formatNumber } from '../lib/format';
import type { WorkshopState } from '../types';

interface Props {
  state: WorkshopState;
}

export function DisbursementOrdersPanel({ state }: Props) {
  const orders = useMemo(() => collectDisbursementOrders(state), [state]);
  const purchases = orders.filter((o) => o.category === 'purchase');
  const expenses = orders.filter((o) => o.category === 'expense');

  const printOne = (order: DisbursementOrder) => {
    const html = buildDisbursementPrintHtml(order, state.periodLabel);
    openPrintWindow(html, `أمر صرف ${order.beneficiary}`);
  };

  const printBatch = (list: DisbursementOrder[]) => {
    if (!list.length) return;
    const body = list
      .map((o) => buildDisbursementPrintHtml(o, state.periodLabel).replace(/<\/?html[^>]*>|<\/?head[^>]*>|<\/?body[^>]*>/gi, ''))
      .join('<div style="page-break-after:always"></div>');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/></head><body>${body}</body></html>`;
    openPrintWindow(html, 'أوامر صرف');
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
          <Banknote className="h-5 w-5" /> أوامر الصرف
        </h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          تُجمَع تلقائياً من <strong>فواتير الشراء</strong> ومن قيود <strong>المصاريف</strong> ($ مدفوع) في:
          {expenseAccountLabels().join(' · ')}.
        </p>
      </div>

      <OrderTable
        title={`مشتريات (${purchases.length})`}
        orders={purchases}
        onPrint={printOne}
        onPrintAll={() => printBatch(purchases)}
      />
      <OrderTable
        title={`مصاريف (${expenses.length})`}
        orders={expenses}
        onPrint={printOne}
        onPrintAll={() => printBatch(expenses)}
      />
    </div>
  );
}

function OrderTable({
  title,
  orders,
  onPrint,
  onPrintAll,
}: {
  title: string;
  orders: DisbursementOrder[];
  onPrint: (o: DisbursementOrder) => void;
  onPrintAll: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-700 bg-slate-800/50 px-4 py-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-amber-400">{title}</h3>
        {orders.length > 0 && (
          <button type="button" className="btn-secondary text-xs flex items-center gap-1" onClick={onPrintAll}>
            <Printer className="h-3.5 w-3.5" /> طباعة الكل
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
                  <td>
                    <button
                      type="button"
                      className="text-amber-400 hover:text-amber-300 p-1"
                      title="طباعة أمر صرف"
                      onClick={() => onPrint(o)}
                    >
                      <Printer className="h-4 w-4" />
                    </button>
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
