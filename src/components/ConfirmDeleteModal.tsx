import { AlertTriangle, X } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteModal({
  title,
  message,
  warning,
  confirmLabel = 'حذف',
  cancelLabel = 'إلغاء',
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-rose-500/40 bg-slate-900 shadow-xl">
        <div className="flex items-start justify-between gap-2 border-b border-slate-700 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={20} className="shrink-0 text-rose-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-slate-100">{title}</h3>
              <p className="mt-1 text-sm text-slate-400">{message}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        {warning && (
          <div className="border-b border-slate-700 px-4 py-3 text-xs text-amber-300 bg-amber-500/10">
            {warning}
          </div>
        )}
        <div className="flex gap-2 p-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-slate-600 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
