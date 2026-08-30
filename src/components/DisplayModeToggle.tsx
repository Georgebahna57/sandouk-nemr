import { Bell, Monitor, Moon, Smartphone, Sun } from 'lucide-react';
import type { DisplayMode, LayoutMode } from '../lib/uiPrefs';

interface Props {
  mode: DisplayMode;
  layoutMode: LayoutMode;
  pendingNotify: boolean;
  onModeChange: (mode: DisplayMode) => void;
  onLayoutModeChange: (mode: LayoutMode) => void;
  onPendingNotifyChange: (enabled: boolean) => void;
}

const LAYOUT_OPTIONS: { id: LayoutMode; label: string; icon: typeof Smartphone; title: string }[] = [
  { id: 'auto', label: 'تلقائي', icon: Smartphone, title: 'يتكيّف مع حجم الشاشة' },
  { id: 'mobile', label: 'موبايل', icon: Smartphone, title: 'أزرار أكبر وتخطيط مضغوط للهاتف' },
  { id: 'comfortable', label: 'واسع', icon: Monitor, title: 'عرض سطح المكتب حتى على الهاتف' },
];

export function DisplayModeToggle({
  mode,
  layoutMode,
  pendingNotify,
  onModeChange,
  onLayoutModeChange,
  onPendingNotifyChange,
}: Props) {
  return (
    <div className="flex flex-col items-end gap-2 sm:items-center">
      <div className="flex flex-wrap items-center justify-end gap-2">
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
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span className="text-[10px] text-slate-500 hidden sm:inline">العرض:</span>
        <div className="flex rounded-xl border border-slate-700 p-0.5">
          {LAYOUT_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onLayoutModeChange(opt.id)}
                title={opt.title}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] transition ${
                  layoutMode === opt.id
                    ? 'bg-sky-600 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={13} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
