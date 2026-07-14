import { Download, MessageCircle, Share2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  captureElementAsPng,
  downloadBlob,
  shareImageBlob,
  type BalanceSharePayload,
} from '../lib/balanceShare';
import { openWhatsAppApp } from '../lib/whatsapp';
import { BalanceShareCard } from './BalanceShareCard';

interface Props {
  payload: BalanceSharePayload;
  destinations?: string[];
  onClose: () => void;
}

export function BalanceShareImageModal({ payload, destinations = [], onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  const filename = payload.kind === 'fund'
    ? `رصيد-عمليات-${payload.fundId}-${payload.date ?? 'today'}.png`
    : `حساب-${payload.accountName}-${payload.date ?? 'today'}.png`;

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    async function render() {
      setLoading(true);
      setError(null);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const el = cardRef.current;
      if (!el) {
        if (active) setError('تعذّر تجهيز الصورة');
        return;
      }
      try {
        const png = await captureElementAsPng(el);
        if (!active) return;
        objectUrl = URL.createObjectURL(png);
        setBlob(png);
        setImageUrl(objectUrl);
      } catch {
        if (active) setError('تعذّر إنشاء صورة الرصيد');
      } finally {
        if (active) setLoading(false);
      }
    }

    render();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [payload]);

  async function handleShare() {
    if (!blob) return;
    try {
      const ok = await shareImageBlob(blob, filename);
      if (ok) {
        setShared(true);
        return;
      }
      downloadBlob(blob, filename);
      setShared(true);
    } catch {
      downloadBlob(blob, filename);
    }
  }

  function openWhatsAppDestination(dest: string) {
    if (!blob) return;
    downloadBlob(blob, filename);
    openWhatsAppApp(dest, '');
  }

  const targets = destinations.map(s => s.trim()).filter(Boolean);
  const title = payload.kind === 'fund' ? 'مشاركة رصيد الصندوق' : 'مشاركة رصيد الحساب';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Share2 className="text-emerald-400" size={22} />
            <div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-xs text-slate-400">
                {payload.kind === 'fund' ? 'الرصيد وعمليات اليوم والمعلّقة كصورة واحدة' : 'رصيد الحساب كصورة'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="mb-3 flex justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-2">
          {loading && <p className="py-16 text-sm text-slate-500">جاري تجهيز الصورة...</p>}
          {error && <p className="py-16 text-sm text-rose-400">{error}</p>}
          {imageUrl && !loading && (
            <img src={imageUrl} alt="رصيد" className="max-h-[55vh] w-full object-contain" />
          )}
        </div>

        <div className="pointer-events-none fixed -left-[10000px] top-0 z-[-1]" aria-hidden>
          <BalanceShareCard ref={cardRef} payload={payload} />
        </div>

        {blob && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleShare}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <Share2 size={16} />
              {shared ? 'تم — اختر واتساب من القائمة' : 'مشاركة الصورة'}
            </button>

            <button
              type="button"
              onClick={() => blob && downloadBlob(blob, filename)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 py-2.5 text-sm text-slate-200 hover:border-emerald-500/50"
            >
              <Download size={14} />
              حفظ الصورة
            </button>

            {targets.length > 0 && (
              <div className="space-y-2 border-t border-slate-700 pt-2">
                <p className="text-xs text-slate-500">أو افتح واتساب ثم أرفق الصورة المحفوظة:</p>
                {targets.map((dest, index) => (
                  <button
                    key={`${dest}-${index}`}
                    type="button"
                    onClick={() => openWhatsAppDestination(dest)}
                    className="flex w-full items-center justify-between rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-emerald-300 hover:bg-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <MessageCircle size={14} />
                      واتساب {index + 1}
                    </span>
                    <span className="text-xs text-slate-500">حفظ + فتح ←</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
