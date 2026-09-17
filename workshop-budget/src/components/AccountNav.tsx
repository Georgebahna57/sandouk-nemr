import { ACCOUNTS } from '../lib/accountsConfig';

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  view: 'dashboard' | 'treasury' | 'account';
  onViewChange: (v: 'dashboard' | 'treasury' | 'account') => void;
}

export function AccountNav({ selectedId, onSelect, view, onViewChange }: Props) {
  const grouped = {
    main: ACCOUNTS.filter((a) => a.showOnDashboard),
    detail: ACCOUNTS.filter((a) => !a.showOnDashboard),
  };

  return (
    <nav className="card p-3 space-y-3 max-h-[calc(100dvh-8rem)] overflow-y-auto">
      <button
        type="button"
        className={`w-full text-right rounded-lg px-3 py-2 text-sm transition ${view === 'dashboard' ? 'bg-amber-600/30 text-amber-300' : 'hover:bg-slate-800'}`}
        onClick={() => { onViewChange('dashboard'); onSelect(null); }}
      >
        📊 لوحة الملخص
      </button>
      <button
        type="button"
        className={`w-full text-right rounded-lg px-3 py-2 text-sm transition ${view === 'treasury' ? 'bg-amber-600/30 text-amber-300' : 'hover:bg-slate-800'}`}
        onClick={() => { onViewChange('treasury'); onSelect(null); }}
      >
        🏦 خزنة رئيسية
      </button>

      <div className="text-xs text-slate-500 px-2 pt-2">حسابات الملخص</div>
      {grouped.main.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`w-full text-right rounded-lg px-3 py-1.5 text-sm transition ${selectedId === a.id ? 'bg-amber-600/30 text-amber-300' : 'hover:bg-slate-800 text-slate-300'}`}
          onClick={() => { onSelect(a.id); onViewChange('account'); }}
        >
          {a.nameAr}
        </button>
      ))}

      <div className="text-xs text-slate-500 px-2 pt-2">حسابات تفصيلية</div>
      {grouped.detail.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`w-full text-right rounded-lg px-3 py-1.5 text-sm transition ${selectedId === a.id ? 'bg-amber-600/30 text-amber-300' : 'hover:bg-slate-800 text-slate-400'}`}
          onClick={() => { onSelect(a.id); onViewChange('account'); }}
        >
          {a.nameAr}
        </button>
      ))}
    </nav>
  );
}
