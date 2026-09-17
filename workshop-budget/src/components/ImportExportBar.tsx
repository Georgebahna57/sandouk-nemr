import { useRef, useState } from 'react';
import { Download, Upload, Save, FileSpreadsheet, RotateCcw } from 'lucide-react';

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
    </div>
  );
}
