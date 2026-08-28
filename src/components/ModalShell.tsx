import type { FormEventHandler, ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  titleIcon?: ReactNode;
  titleClassName?: string;
  onClose: () => void;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  saveLabel?: string;
  saveDisabled?: boolean;
  children: ReactNode;
}

/** نافذة بملء الشاشة على الموبايل مع شريط علوي: إغلاق + حفظ */
export function ModalShell({
  title,
  titleIcon,
  titleClassName = 'text-amber-400',
  onClose,
  onSubmit,
  saveLabel = 'حفظ',
  saveDisabled = false,
  children,
}: Props) {
  const body = (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-700 bg-slate-900/95 px-3 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
        >
          <X size={14} />
          إغلاق
        </button>
        <div className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 ${titleClassName}`}>
          {titleIcon}
          <h3 className="truncate text-sm font-semibold">{title}</h3>
        </div>
        {onSubmit ? (
          <button
            type="submit"
            disabled={saveDisabled}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
          >
            {saveLabel}
          </button>
        ) : (
          <span className="w-[4.5rem]" aria-hidden />
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">{children}</div>
    </>
  );

  const panelClass =
    'flex h-dvh w-full flex-col bg-slate-900 shadow-xl sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-slate-600';

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 sm:items-start sm:p-4 sm:pt-6">
      {onSubmit ? (
        <form onSubmit={onSubmit} className={panelClass}>
          {body}
        </form>
      ) : (
        <div className={panelClass}>{body}</div>
      )}
    </div>
  );
}
