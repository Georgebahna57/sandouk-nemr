import { Bell, Moon, Sun } from 'lucide-react';
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
      <div className="flex rounded-xl border border-slate-700 p-0.5">
        <button
          type="button"
          onClick={() => onModeChange('day')}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition ${
            mode === 'day'
              ? 'bg-amber-500 text-slate-900 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="وضع نهاري"
        >
          <Sun size={14} />
          نهاري
        </button>
        <button
          type="button"
          onClick={() => onModeChange('night')}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition ${
            mode === 'night'
              ? 'bg-slate-700 text-amber-400 font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="وضع ليلي"
        >
          <Moon size={14} />
          ليلي
        </button>
      </div>
      <label className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={pendingNotify}
          onChange={e => onPendingNotifyChange(e.target.checked)}
          className="rounded"
        />
        <Bell size={12} />
        تنبيه انتظار
      </label>
    </div>
  );
}
