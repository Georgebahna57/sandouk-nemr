import { Copy, MessageCircle, X } from 'lucide-react';
import { useState } from 'react';
import {
  buildDestinationUrl,
  getDestinationLabel,
  isWhatsAppGroupLink,
} from '../lib/whatsapp';

interface Props {
  message: string;
  destinations: string[];
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

export function PendingWhatsAppModal({ message, destinations, title, subtitle, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [openedIndex, setOpenedIndex] = useState<number | null>(null);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function openDestination(index: number) {
    const dest = destinations[index];
    if (isWhatsAppGroupLink(dest)) {
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
      } catch {
        /* manual copy from textarea */
      }
    }
    const url = buildDestinationUrl(dest, message);
    window.location.href = url;
    setOpenedIndex(index);
  }

  const hasGroups = destinations.some(isWhatsAppGroupLink);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="text-emerald-400" size={22} />
            <div>
              <h3 className="font-semibold text-white">{title ?? 'إرسال على واتساب'}</h3>
              <p className="text-xs text-slate-400">{subtitle ?? 'تم حفظ العملية بقيد الانتظار'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {hasGroups && (
          <p className="mb-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {subtitle?.includes('رد')
              ? 'افتح الكروب → رد Reply على رسالة الانتظار → الصق الرسالة → إرسال'
              : 'للكروبات: اضغط الزر → الصق الرسالة (Ctrl+V) → إرسال. كرّر لكل كروب.'}
          </p>
        )}

        <textarea
          readOnly
          value={message}
          rows={6}
          className="mb-3 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />

        <button
          type="button"
          onClick={copyMessage}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 py-2 text-sm text-slate-200 hover:border-emerald-500/50"
        >
          <Copy size={14} />
          {copied ? 'تم النسخ' : 'نسخ الرسالة'}
        </button>

        <div className="space-y-2">
          {destinations.map((dest, index) => (
            <button
              key={`${dest}-${index}`}
              type="button"
              onClick={() => openDestination(index)}
              className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition ${
                openedIndex === index
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-600/90 text-white hover:bg-emerald-500'
              }`}
            >
              <span>{getDestinationLabel(dest, index)}</span>
              <span className="text-xs opacity-80">فتح ←</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
