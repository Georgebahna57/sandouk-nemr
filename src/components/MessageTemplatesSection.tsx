import { useEffect, useState } from 'react';
import { Loader2, MessageSquare, Save } from 'lucide-react';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  fetchMessageTemplates,
  saveMessageTemplates,
  type MessageTemplateKey,
  type MessageTemplates,
} from '../lib/messageTemplates';

const TEMPLATE_FIELDS: { key: MessageTemplateKey; label: string; hint: string }[] = [
  {
    key: 'reconciliation',
    label: 'مطابقة حساب',
    hint: '{{account}}, {{fund}}, {{date}}, {{lines}}',
  },
  {
    key: 'balance',
    label: 'رصيد صندوق',
    hint: '{{fund}}, {{date}}, {{lines}}',
  },
  {
    key: 'balance_share',
    label: 'مشاركة رصيد حساب',
    hint: '{{account}}, {{fund}}, {{date}}, {{lines}}',
  },
  {
    key: 'pending',
    label: 'قيد انتظار',
    hint: '{{fund}}, {{date}}, {{lines}}, {{actor}}',
  },
];

interface Props {
  onSaved?: () => void;
}

export function MessageTemplatesSection({ onSaved }: Props) {
  const [templates, setTemplates] = useState<MessageTemplates>(DEFAULT_MESSAGE_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchMessageTemplates()
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveMessageTemplates(templates);
      setSuccess('تم حفظ قوالب الرسائل');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mb-4 flex justify-center py-8">
        <Loader2 className="animate-spin text-slate-500" size={24} />
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare size={18} className="text-violet-400" />
        <div>
          <p className="font-medium text-slate-200">قوالب رسائل واتساب</p>
          <p className="text-xs text-slate-500">مطابقة، رصيد، انتظار — قابلة للتعديل</p>
        </div>
      </div>

      {(error || success) && (
        <div className={`mb-3 rounded-xl px-3 py-2 text-xs ${
          error ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          {error ?? success}
        </div>
      )}

      <div className="space-y-3">
        {TEMPLATE_FIELDS.map(field => (
          <div key={field.key}>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              {field.label}
            </label>
            <p className="mb-1 text-[10px] text-slate-500">{field.hint}</p>
            <textarea
              rows={4}
              value={templates[field.key]}
              onChange={e => setTemplates(prev => ({ ...prev, [field.key]: e.target.value }))}
              className="w-full resize-y rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-xs leading-relaxed"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
      >
        <Save size={14} />
        حفظ القوالب
      </button>
    </div>
  );
}
