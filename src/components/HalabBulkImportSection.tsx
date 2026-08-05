import { FileInput, Loader2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  HALAB_IMPORT_EXAMPLE,
  halabDraftsToTransactions,
  parseHalabImportJson,
  parseHalabImportText,
} from '../lib/halabBulkImport';
import { formatValueWithUnit } from '../lib/utils';
import type { Transaction } from '../types';

interface Props {
  onImport: (tx: Transaction[]) => void | Promise<void>;
}

export function HalabBulkImportSection({ onImport }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!text.trim()) return null;
    try {
      const drafts = text.trim().startsWith('[') || text.trim().startsWith('{')
        ? parseHalabImportJson(text)
        : parseHalabImportText(text);
      return halabDraftsToTransactions(drafts);
    } catch {
      return null;
    }
  }, [text]);

  const previewError = useMemo(() => {
    if (!text.trim()) return null;
    try {
      if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
        parseHalabImportJson(text);
      } else {
        parseHalabImportText(text);
      }
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'خطأ في الصيغة';
    }
  }, [text]);

  async function submit() {
    setError(null);
    setSuccess(null);
    if (!text.trim()) {
      setError('الصق العمليات أولاً');
      return;
    }
    setBusy(true);
    try {
      const drafts = text.trim().startsWith('[') || text.trim().startsWith('{')
        ? parseHalabImportJson(text)
        : parseHalabImportText(text);
      const txs = halabDraftsToTransactions(drafts);
      await onImport(txs);
      setSuccess(`تم استيراد ${txs.length} عملية إلى حلب - الفيلات`);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الاستيراد');
    } finally {
      setBusy(false);
    }
  }

  function loadExample() {
    setText(HALAB_IMPORT_EXAMPLE);
    setError(null);
    setSuccess(null);
  }

  return (
    <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Upload size={18} className="text-rose-400" />
        <div>
          <p className="font-medium text-slate-200">استيراد عمليات حلب — جماعي</p>
          <p className="text-xs text-slate-500">
            الصق قائمة العمليات بدل إدخالها واحدة واحدة — تُحسب على منطق لنا/لهم الجديد
          </p>
        </div>
      </div>

      <p className="mb-2 text-[10px] text-slate-500">
        كل سطر: <span dir="ltr" className="font-mono">YYYY-MM-DD | دفع/استلام | مبلغ | عملة | طرف | حالة</span>
        {' '}— الحالة اختياري (انتظار / مرحّل)
      </p>

      <textarea
        value={text}
        onChange={e => {
          setText(e.target.value);
          setError(null);
          setSuccess(null);
        }}
        rows={8}
        placeholder={HALAB_IMPORT_EXAMPLE}
        className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-xs leading-relaxed text-slate-200"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={loadExample}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          مثال
        </button>
      </div>

      {preview && !previewError && (
        <div className="mt-3 max-h-36 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/50 p-2 text-xs text-slate-400 space-y-1">
          <p className="font-medium text-slate-300">معاينة — {preview.length} عملية:</p>
          {preview.slice(0, 20).map(tx => (
            <p key={tx.id}>
              {tx.date} · {tx.kind === 'payment' ? 'دفع' : 'استلام'}{' '}
              {formatValueWithUnit(tx.amount, tx.currency)}
              {tx.counterparty ? ` · ${tx.counterparty}` : ''}
              {tx.status === 'pending' ? ' · انتظار' : ''}
            </p>
          ))}
          {preview.length > 20 && (
            <p className="text-slate-500">… و{preview.length - 20} عملية أخرى</p>
          )}
        </div>
      )}

      {(error || previewError || success) && (
        <p className={`mt-3 whitespace-pre-wrap text-xs ${success ? 'text-emerald-400' : 'text-rose-400'}`}>
          {success ?? error ?? previewError}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !preview?.length}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <FileInput size={16} />}
        استيراد إلى حلب - الفيلات
      </button>
    </div>
  );
}
