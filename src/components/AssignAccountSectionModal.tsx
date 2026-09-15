import { FolderInput, X } from 'lucide-react';
import { useState } from 'react';
import type { AccountSection } from '../lib/accountSections';
import { UNASSIGNED_SECTION_LABEL } from '../lib/accountSections';
import type { CustomerSummary } from '../types';

interface Props {
  summary: CustomerSummary;
  sections: AccountSection[];
  currentSectionId?: string;
  onClose: () => void;
  onAssign: (sectionId: string | null) => void | Promise<void>;
}

export function AssignAccountSectionModal({
  summary,
  sections,
  currentSectionId,
  onClose,
  onAssign,
}: Props) {
  const [selected, setSelected] = useState(currentSectionId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await Promise.resolve(onAssign(selected || null));
      onClose();
    } catch {
      setError('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-4 shadow-xl space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400">
            <FolderInput size={16} />
            <h3 className="font-semibold">تعيين قسم</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-slate-300">{summary.name}</p>

        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm"
        >
          <option value="">{UNASSIGNED_SECTION_LABEL}</option>
          {sections.map(section => (
            <option key={section.id} value={section.id}>{section.name}</option>
          ))}
        </select>

        {sections.length === 0 && (
          <p className="text-xs text-amber-300/90">
            لا يوجد أقسام بعد — أنشئ قسماً من تبويب «الأقسام» أولاً
          </p>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-amber-500 py-2.5 font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
        >
          حفظ
        </button>
      </form>
    </div>
  );
}
