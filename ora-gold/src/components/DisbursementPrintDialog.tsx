import { useEffect, useMemo, useState } from 'react';
import { Printer, RotateCcw, Save, X } from 'lucide-react';
import { DEFAULT_DISBURSEMENT_TEMPLATES, renderDisbursementTemplate } from '../lib/disbursementTemplates';
import { openPrintWindow } from '../lib/invoicePrint';
import type { DisbursementOrder } from '../lib/disbursementOrders';
import type { DisbursementPrintTemplate } from '../types';

interface Props {
  order: DisbursementOrder;
  periodLabel: string;
  templates: DisbursementPrintTemplate[];
  defaultTemplateId: string;
  onClose: () => void;
  onSaveTemplates: (overrides: DisbursementPrintTemplate[], defaultId: string) => void;
}

export function DisbursementPrintDialog({
  order,
  periodLabel,
  templates,
  defaultTemplateId,
  onClose,
  onSaveTemplates,
}: Props) {
  const [templateId, setTemplateId] = useState(defaultTemplateId);
  const [editHtml, setEditHtml] = useState('');
  const [dirty, setDirty] = useState(false);

  const selected = useMemo(
    () => templates.find((t) => t.id === templateId) ?? templates[0],
    [templates, templateId],
  );

  useEffect(() => {
    setEditHtml(selected?.html ?? '');
    setDirty(false);
  }, [selected?.id, selected?.html]);

  const previewHtml = useMemo(
    () => renderDisbursementTemplate(editHtml, order, periodLabel),
    [editHtml, order, periodLabel],
  );

  const handlePrint = () => {
    openPrintWindow(previewHtml, `أمر صرف ${order.beneficiary}`);
  };

  const handleSaveTemplate = () => {
    if (!selected) return;
    const overrides = templates.map((t) =>
      t.id === selected.id ? { ...t, html: editHtml } : t,
    );
    onSaveTemplates(overrides, templateId);
    setDirty(false);
  };

  const handleRestoreBuiltin = () => {
    const builtin = DEFAULT_DISBURSEMENT_TEMPLATES.find((t) => t.id === templateId);
    if (builtin) {
      setEditHtml(builtin.html);
      setDirty(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
      <div className="card w-full max-w-3xl max-h-[92dvh] overflow-hidden flex flex-col shadow-xl border-amber-500/30">
        <div className="flex items-start justify-between gap-2 p-4 border-b border-slate-700/60">
          <div>
            <h3 className="font-bold text-amber-400 flex items-center gap-2">
              <Printer className="h-5 w-5" /> طباعة أمر صرف
            </h3>
            <p className="text-xs text-slate-400 mt-1">{order.beneficiary} — {order.description}</p>
          </div>
          <button type="button" className="text-slate-400 hover:text-white p-1" onClick={onClose} aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">قالب الطباعة</label>
              <select
                className="input-field"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.nameAr}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <button type="button" className="btn-secondary text-xs flex items-center gap-1" onClick={handleRestoreBuiltin}>
                <RotateCcw className="h-3.5 w-3.5" /> استعادة القالب الأصلي
              </button>
              <button
                type="button"
                className="btn-secondary text-xs flex items-center gap-1"
                disabled={!dirty}
                onClick={handleSaveTemplate}
              >
                <Save className="h-3.5 w-3.5" /> حفظ التعديلات على القالب
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">
              تعديل HTML — المتغيرات:{' '}
              <span className="font-mono text-amber-200/80">
                {'{{brand}} {{title}} {{date}} {{beneficiary}} {{amount}} {{description}} {{category}} {{source}} {{period}} {{ref}}'}
              </span>
            </label>
            <textarea
              className="input-field font-mono text-xs min-h-[160px] mt-1"
              value={editHtml}
              onChange={(e) => {
                setEditHtml(e.target.value);
                setDirty(true);
              }}
              spellCheck={false}
            />
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-1">معاينة</p>
            <iframe
              title="معاينة أمر الصرف"
              className="w-full h-56 rounded-lg border border-slate-700 bg-white"
              srcDoc={previewHtml}
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-700/60 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
          <button type="button" className="btn-primary flex items-center gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> طباعة
          </button>
        </div>
      </div>
    </div>
  );
}
