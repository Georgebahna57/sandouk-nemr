import { useRef, useState } from 'react';
import { Download, Upload, Save, FileSpreadsheet, RotateCcw, ChevronDown } from 'lucide-react';
import { accountsWithSheetAlias, dashboardLinks } from '../lib/accountAudit';

interface Props {
  periodLabel: string;
  onPeriodChange: (v: string) => void;
  onImport: (file: File) => Promise<unknown>;
  onExport: () => void;
  onBackup: () => void;
  onRestoreDefaults: () => void;
}

export function ImportExportBar({ periodLabel, onPeriodChange, onImport, onExport, onBackup, onRestoreDefaults }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [showMap, setShowMap] = useState(false);
  const sheetAliases = accountsWithSheetAlias();
  const dashLinks = dashboardLinks();

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  return (
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

      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
      <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => fileRef.current?.click()} disabled={importing}>
        <Upload className="h-4 w-4" />
        {importing ? 'جاري الاستيراد...' : 'استيراد Excel'}
      </button>

      <button type="button" className="btn-primary flex items-center gap-2" onClick={onExport}>
        <Download className="h-4 w-4" />
        تصدير Excel
      </button>

      <button type="button" className="btn-secondary flex items-center gap-2" onClick={onBackup}>
        <Save className="h-4 w-4" />
        نسخة احتياطية
      </button>

      <button type="button" className="btn-secondary flex items-center gap-2" onClick={onRestoreDefaults}>
        <RotateCcw className="h-4 w-4" />
        استعادة Excel الأصلي
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
        </div>
      )}
    </div>
  );
}
