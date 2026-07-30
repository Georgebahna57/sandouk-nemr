import { Download, HardDriveUpload, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  backupSummary,
  buildAppBackup,
  downloadAppBackup,
  parseAppBackup,
  type AppBackup,
} from '../lib/backup';
import type { AppState } from '../types';
import type { ValuationRates } from '../lib/valuationRates';

interface Props {
  appState: AppState;
  valuationRates: ValuationRates;
  onRestore: (backup: AppBackup, mode: 'merge' | 'replace') => Promise<void>;
}

export function BackupSection({ appState, valuationRates, onRestore }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<AppBackup | null>(null);
  const [replaceConfirm, setReplaceConfirm] = useState('');

  function exportBackup() {
    setError(null);
    setSuccess(null);
    downloadAppBackup(buildAppBackup(appState, valuationRates));
    setSuccess('تم تنزيل النسخة الاحتياطية');
  }

  async function handleFile(file: File) {
    setError(null);
    setSuccess(null);
    setPendingBackup(null);
    try {
      const text = await file.text();
      const backup = parseAppBackup(text);
      setPendingBackup(backup);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل قراءة الملف');
    }
  }

  async function restore(mode: 'merge' | 'replace') {
    if (!pendingBackup) return;
    if (mode === 'replace' && replaceConfirm.trim() !== 'استبدال') {
      setError('اكتب «استبدال» للتأكيد');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await onRestore(pendingBackup, mode);
      setSuccess(mode === 'merge' ? 'تم دمج النسخة الاحتياطية' : 'تم استبدال البيانات');
      setPendingBackup(null);
      setReplaceConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الاسترجاع');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <HardDriveUpload size={18} className="text-sky-400" />
        <div>
          <p className="font-medium text-slate-200">نسخ احتياطي واسترجاع</p>
          <p className="text-xs text-slate-500">
            حركات · حسابات · فواتير · أسعار التقييم — JSON
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportBackup}
          className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          <Download size={14} />
          تنزيل نسخة احتياطية
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          <Upload size={14} />
          اختيار ملف للاسترجاع
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      <p className="mt-2 text-[10px] text-slate-500">
        الحالية: {appState.transactions.length} حركة · {appState.customers.length} حساب · {appState.bills.length} فاتورة
      </p>

      {(error || success) && (
        <p className={`mt-3 text-xs ${error ? 'text-rose-400' : 'text-emerald-400'}`}>
          {error ?? success}
        </p>
      )}

      {pendingBackup && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
          <p className="text-sm text-amber-200">
            ملف: {backupSummary(pendingBackup)}
          </p>
          <p className="text-[10px] text-slate-500">
            تاريخ التصدير: {new Date(pendingBackup.exportedAt).toLocaleString('ar-LB')}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => restore('merge')}
              className="rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {busy ? <Loader2 className="mx-auto animate-spin" size={16} /> : 'دمج (إضافة/تحديث)'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => restore('replace')}
              className="rounded-xl border border-rose-500/50 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-500/10 disabled:opacity-60"
            >
              استبدال كامل
            </button>
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-rose-400">
              للاستبدال اكتب «استبدال» (يحذف كل البيانات الحالية!)
            </label>
            <input
              type="text"
              value={replaceConfirm}
              onChange={e => setReplaceConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs"
              placeholder="استبدال"
            />
          </div>
        </div>
      )}
    </div>
  );
}
