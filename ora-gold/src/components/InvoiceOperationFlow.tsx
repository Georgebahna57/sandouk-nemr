import { ArrowRight, Layers } from 'lucide-react';
import { getInvoiceOperationFlow, WORKSHOP_LIFECYCLE } from '../lib/operationFlows';
import type { InvoiceType } from '../types';

interface Props {
  type: InvoiceType;
}

export function InvoiceOperationFlow({ type }: Props) {
  const flow = getInvoiceOperationFlow(type);
  const stageLabels = new Map(WORKSHOP_LIFECYCLE.map((s) => [s.id, s.titleAr]));

  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-800/30 p-4 space-y-3 text-sm">
      <div className="flex items-center gap-2 text-amber-400 font-semibold">
        <Layers className="h-4 w-4" />
        دورة العملية في Excel — {flow.labelAr}
      </div>

      <div className="flex flex-wrap items-center gap-1 text-xs text-slate-300">
        {flow.stages.map((id, i) => (
          <span key={id} className="flex items-center gap-1">
            {i > 0 && <ArrowRight className="h-3 w-3 text-slate-500" />}
            <span className="rounded bg-slate-700/60 px-2 py-0.5">{stageLabels.get(id) ?? id}</span>
          </span>
        ))}
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-1">أوراق التسجيل (قيود تلقائية عند الحفظ):</p>
        <ul className="list-disc list-inside text-slate-200 text-xs space-y-0.5">
          {flow.sheets.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">{flow.notesAr}</p>
    </div>
  );
}
