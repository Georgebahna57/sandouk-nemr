import { useRef, useState } from 'react';
import { Download, Upload, Save, FileSpreadsheet, RotateCcw, ChevronDown, AlertTriangle, KeyRound } from 'lucide-react';
import { accountsWithSheetAlias, dashboardLinks } from '../lib/accountAudit';
import { MANUAL_OPERATION_HINTS, WORKSHOP_LIFECYCLE } from '../lib/operationFlows';
import { useEditProtection } from './EditProtectionProvider';

interface Props {
  periodLabel: string;
  onPeriodChange: (v: string) => void;
  onImport: (file: File) => Promise<unknown>;
  onExport: () => void;
  onBackup: () => void;
  onRestoreDefaults: () => void;
}

export function ImportExportBar({ periodLabel, onPeriodChange, onImport, onExport, onBackup, onRestoreDefaults }: Props) {
  const { guard, hasPin, clearEditPin, lockNow, isUnlocked, setEditPin } = useEditProtection();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [showDataOps, setShowDataOps] = useState(false);
  const [newPin, setNewPin] = useState('');
  const sheetAliases = accountsWithSheetAlias();
  const dashLinks = dashboardLinks();

  const runImport = async (file: File) => {
    setImporting(true);
    setMsg('');
    try {
      await onImport(file);
      setMsg('تم الاستيراد بنجاح');
    } catch (err) {
      setMsg(`خطأ: ${err instanceof Error ? err.message : 'فشل الاستيراد'}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    guard(() => {
      if (!confirm(`استيراد «${file.name}»؟\n\nسيتم استبدال كل البيانات الحالية بمحتوى الملف.`)) {
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
      void runImport(file);
    }, 'استيراد Excel');
  };

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-amber-500" />
          <span className="font-semibold text-amber-400">الفترة:</span>
          <input
            className="input-field w-28"
            value={periodLabel}
            onChange={(e) => onPeriodChange(e.target.value)}
            placeholder="05-2026"
          />
        </div>

        <button type="button" className="btn-primary flex items-center gap-2" onClick={onExport}>
          <Download className="h-4 w-4" />
          تصدير Excel
        </button>

        <button type="button" className="btn-secondary flex items-center gap-2" onClick={onBackup}>
          <Save className="h-4 w-4" />
          نسخة احتياطية
        </button>

        {msg && <span className="text-sm text-emerald-400">{msg}</span>}

        <button
          type="button"
          className="btn-secondary flex items-center gap-1 text-xs ms-auto"
          onClick={() => setShowMap((v) => !v)}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition ${showMap ? 'rotate-180' : ''}`} />
          دليل أوراق Excel
        </button>

        {showMap && (
          <div className="w-full border-t border-slate-700/60 pt-3 space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-2">ربط الملخص الرئيسي (مثل Excel):</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                {dashLinks.map((a) => (
                  <div key={a.id} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                    <span className="text-amber-400">{a.label}</span>
                    <span className="text-slate-500 mx-1">←</span>
                    <span className="text-slate-200">{a.sourceSheet}</span>
                    <span className="text-slate-500"> ({a.side === 'usd' ? 'دولار' : 'ذهب'})</span>
                  </div>
                ))}
              </div>
            </div>
            {sheetAliases.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">أوراق Excel بأسماء مختلفة:</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                  {sheetAliases.map((a) => (
                    <div key={a.id} className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2">
                      <span className="text-amber-400">{a.nameAr}</span>
                      <span className="text-slate-500 mx-1">→</span>
                      <span className="text-slate-200 font-mono">{a.sheetName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 mb-2">مراحل دورة الورشة (ملف Excel):</p>
              <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1">
                {WORKSHOP_LIFECYCLE.map((s) => (
                  <li key={s.id}>
                    <span className="text-amber-400/90">{s.titleAr}</span>
                    <span className="text-slate-500"> — {s.detailAr}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-2">عمليات يدوية شائعة (سند من الحساب + مقابل):</p>
              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                {MANUAL_OPERATION_HINTS.map((h) => (
                  <div key={h.titleAr} className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2">
                    <p className="text-amber-400/90 font-medium">{h.titleAr}</p>
                    <p className="text-slate-400 mt-1">{h.sheets.join(' · ')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card border border-amber-500/25 overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right hover:bg-amber-500/5 transition"
          onClick={() => setShowDataOps((v) => !v)}
        >
          <ChevronDown className={`h-4 w-4 text-amber-400 shrink-0 transition ${showDataOps ? 'rotate-180' : ''}`} />
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="text-sm font-medium text-amber-300">استيراد / استعادة البيانات</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
        </button>

        {showDataOps && (
          <div className="border-t border-amber-500/20 bg-amber-500/5 px-4 py-4 space-y-3">
            <p className="text-xs text-amber-200/80">
              هذه العمليات تستبدل البيانات الحالية. افتح هذا القسم فقط عند الحاجة لتجنب الضغط بالخطأ.
            </p>

            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-secondary flex items-center gap-2 border-amber-500/30"
                onClick={() => fileRef.current?.click()}
                disabled={importing}
              >
                <Upload className="h-4 w-4" />
                {importing ? 'جاري الاستيراد...' : 'استيراد Excel'}
              </button>

              <button
                type="button"
                className="btn-secondary flex items-center gap-2 border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                onClick={() => guard(() => onRestoreDefaults(), 'استعادة البيانات الافتراضية')}
              >
                <RotateCcw className="h-4 w-4" />
                استعادة Excel الأصلي
              </button>
            </div>

            <div className="border-t border-amber-500/15 pt-3 space-y-2">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5" /> رمز حماية التعديل والحذف (محلي على هذا الجهاز)
              </p>
              {hasPin ? (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-emerald-400/90">{isUnlocked ? 'الجلسة مفتوحة للتعديل' : 'مقفول — سيُطلب الرمز عند التعديل'}</span>
                  <button type="button" className="btn-secondary text-xs" onClick={() => lockNow()}>قفل الآن</button>
                  <button
                    type="button"
                    className="btn-secondary text-xs text-rose-300"
                    onClick={() => {
                      if (confirm('إزالة رمز الحماية؟ سيتم قفل التعديل حتى إنشاء رمز جديد.')) clearEditPin();
                    }}
                  >
                    إزالة الرمز
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="password"
                    className="input-field w-36 text-sm num"
                    placeholder="رمز جديد (4+)"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => {
                      if (newPin.trim().length < 4) return;
                      setEditPin(newPin.trim());
                      setNewPin('');
                    }}
                    disabled={newPin.trim().length < 4}
                  >
                    إنشاء الرمز
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
