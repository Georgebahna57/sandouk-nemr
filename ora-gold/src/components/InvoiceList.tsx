import { useState } from 'react';
import { Printer, Trash2 } from 'lucide-react';
import { INVOICE_TYPE_LABELS } from '../lib/invoiceCalc';
import { formatDateAr, formatNumber } from '../lib/format';
import type { WorkshopInvoice } from '../types';
import { InvoicePrintDialog } from './InvoicePrintDialog';
import type { InvoicePrintData } from '../lib/invoicePrint';

interface Props {
  invoices: WorkshopInvoice[];
  onDelete: (id: string) => void;
}

function toPrintData(inv: WorkshopInvoice): InvoicePrintData {
  return {
    number: inv.number,
    date: inv.date,
    customer: inv.customer,
    type: inv.type,
    description: inv.description,
    postings: inv.postings,
    workedWeight: inv.workedWeight,
    receivedUsd: inv.receivedUsd ?? inv.usdAmount,
    usdAmount: inv.receivedUsd ?? inv.usdAmount,
    wageUsd: inv.wageUsd,
    stoneDiscountGrams: inv.stoneDiscountGrams,
    profitRate: inv.profitRate,
  };
}

export function InvoiceList({ invoices, onDelete }: Props) {
  const [printData, setPrintData] = useState<InvoicePrintData | null>(null);
  const sorted = [...invoices].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  if (!sorted.length) {
    return (
      <div className="card p-6 text-center text-slate-500 text-sm">
        لا توجد فواتير مسجّلة بعد
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-700 bg-slate-800/50 px-4 py-3">
        <h3 className="font-semibold text-amber-400">سجل الفواتير ({sorted.length})</h3>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full table-ledger text-sm">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>البيان</th>
              <th>النوع</th>
              <th>الوزن</th>
              <th>مقبوض $</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((inv) => (
              <tr key={inv.id}>
                <td>{formatDateAr(inv.date)}</td>
                <td className="max-w-[200px] truncate" title={inv.description}>{inv.description}</td>
                <td className="text-xs text-slate-400">{INVOICE_TYPE_LABELS[inv.type]}</td>
                <td className="num">{inv.workedWeight ? formatNumber(inv.workedWeight, 2) : '—'}</td>
                <td className="num">
                  {(inv.receivedUsd ?? inv.usdAmount)
                    ? formatNumber(inv.receivedUsd ?? inv.usdAmount)
                    : '—'}
                </td>
                <td className="flex gap-1 justify-end">
                  <button
                    type="button"
                    className="text-amber-400 hover:text-amber-300 p-1"
                    onClick={() => setPrintData(toPrintData(inv))}
                    title="طباعة الفاتورة"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-300 p-1"
                    onClick={() => onDelete(inv.id)}
                    title="حذف الفاتورة"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {printData && <InvoicePrintDialog data={printData} onClose={() => setPrintData(null)} />}
    </div>
  );
}
