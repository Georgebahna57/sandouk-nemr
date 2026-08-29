import { Contrast, Moon } from 'lucide-react';
import type { DisplayMode } from '../lib/uiPrefs';

interface Props {
  mode: DisplayMode;
  pendingNotify: boolean;
  onModeChange: (mode: DisplayMode) => void;
  onPendingNotifyChange: (enabled: boolean) => void;
}

export function DisplayModeToggle({
  mode,
  pendingNotify,
  onModeChange,
  onPendingNotifyChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onModeChange(mode === 'highContrast' ? 'default' : 'highContrast')}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition ${
          mode === 'highContrast'
            ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
            : 'border-slate-700 text-slate-400 hover:text-slate-200'
        }`}
        title="تباين أعلى للتابلت/التلفزيون"
      >
        <Contrast size={14} />
        {mode === 'highContrast' ? 'تباين عالي' : 'تباين عادي'}
      </button>
      <label className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={pendingNotify}
          onChange={e => onPendingNotifyChange(e.target.checked)}
          className="rounded"
        />
        <Moon size={12} />
        تنبيه انتظار
      </label>
    </div>
  );
}
