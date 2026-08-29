import { MessageCircle, Share2 } from 'lucide-react';
import {
  buildAccountBalanceWhatsAppMessage,
  buildAccountShareWhatsAppMessage,
  getDestinationLabel,
  normalizeWhatsAppPhone,
  openWhatsAppApp,
} from '../lib/whatsapp';
import type { CustomerSummary, FundId } from '../types';

interface Props {
  phone: string;
  fundId: FundId;
  summary: CustomerSummary;
  onShareImage?: () => void;
  compact?: boolean;
}

export function AccountWhatsAppQuickActions({
  phone,
  fundId,
  summary,
  onShareImage,
  compact = false,
}: Props) {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const phoneOk = normalizeWhatsAppPhone(trimmed);
  const label = phoneOk ? getDestinationLabel(trimmed, 0) : trimmed;

  function sendReconciliation() {
    const message = buildAccountBalanceWhatsAppMessage(
      fundId,
      summary.name,
      summary.balances,
    );
    openWhatsAppApp(trimmed, message);
  }

  function sendShareText() {
    const message = buildAccountShareWhatsAppMessage(
      fundId,
      summary.name,
      summary.balances,
    );
    openWhatsAppApp(trimmed, message);
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); sendReconciliation(); }}
          className="flex items-center gap-0.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/25"
          title={`مطابقة على واتساب — ${label}`}
        >
          <MessageCircle size={12} />
          مطابقة
        </button>
        {onShareImage && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onShareImage(); }}
            className="flex items-center gap-0.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2 py-1 text-[10px] font-medium text-sky-400 hover:bg-sky-500/25"
            title={`مشاركة صورة — ${label}`}
          >
            <Share2 size={12} />
            صورة
          </button>
        )}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); sendShareText(); }}
          className="flex items-center gap-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
          title={`رصيد نصي — ${label}`}
        >
          رصيد
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
      <p className="text-xs font-medium text-emerald-300">
        واتساب سريع — {label}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={sendReconciliation}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
        >
          <MessageCircle size={14} />
          إرسال مطابقة
        </button>
        <button
          type="button"
          onClick={sendShareText}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
        >
          <MessageCircle size={14} />
          إرسال رصيد (نص)
        </button>
        {onShareImage && (
          <button
            type="button"
            onClick={onShareImage}
            className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-300 hover:bg-sky-500/20"
          >
            <Share2 size={14} />
            مشاركة صورة
          </button>
        )}
      </div>
    </div>
  );
}
