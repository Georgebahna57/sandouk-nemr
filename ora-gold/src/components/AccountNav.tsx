import { ACCOUNTS, DASHBOARD_ALIASES, getAccountNavLabel } from '../lib/accountsConfig';
import type { LedgerFocus } from './AccountLedger';

interface Props {
  selectedId: string | null;
  ledgerFocus?: LedgerFocus;
  onSelect: (accountId: string, title: string, focus: LedgerFocus) => void;
  view: 'dashboard' | 'treasury' | 'account' | 'invoice' | 'disbursements';
  onViewChange: (v: 'dashboard' | 'treasury' | 'account' | 'invoice' | 'disbursements') => void;
}

export function AccountNav({ selectedId, ledgerFocus, onSelect, view, onViewChange }: Props) {
  const grouped = {
    main: ACCOUNTS.filter((a) => a.showOnDashboard),
    detail: ACCOUNTS.filter((a) => !a.showOnDashboard && a.id !== 'gold'),
  };

  const isBourseActive = selectedId === 'cash' && ledgerFocus === 'usd';

  return (
    <nav className="card p-3 space-y-3 max-h-[calc(100dvh-8rem)] overflow-y-auto">
      <button
        type="button"
        className={`w-full text-right rounded-lg px-3 py-2 text-sm transition ${view === 'dashboard' ? 'bg-amber-600/30 text-amber-300' : 'hover:bg-slate-800'}`}
        onClick={() => { onViewChange('dashboard'); }}
      >
        📊 لوحة الملخص
      </button>
      <button
        type="button"
        className={`w-full text-right rounded-lg px-3 py-2 text-sm transition ${view === 'invoice' ? 'bg-amber-600/30 text-amber-300' : 'hover:bg-slate-800'}`}
        onClick={() => { onViewChange('invoice'); }}
      >
        🧾 فاتورة جديدة
      </button>
      <button
        type="button"
        className={`w-full text-right rounded-lg px-3 py-2 text-sm transition ${view === 'disbursements' ? 'bg-amber-600/30 text-amber-300' : 'hover:bg-slate-800'}`}
        onClick={() => { onViewChange('disbursements'); }}
      >
        💵 أوامر الصرف
      </button>
      <button
        type="button"
        className={`w-full text-right rounded-lg px-3 py-2 text-sm transition ${view === 'treasury' ? 'bg-amber-600/30 text-amber-300' : 'hover:bg-slate-800'}`}
        onClick={() => { onViewChange('treasury'); }}
      >
        🏦 خزنة رئيسية
      </button>

      <div className="text-xs text-slate-500 px-2 pt-2">حسابات الملخص</div>
      {grouped.main.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`w-full text-right rounded-lg px-3 py-1.5 text-sm transition ${
            selectedId === a.id && ledgerFocus !== 'usd' ? 'bg-amber-600/30 text-amber-300' : 'hover:bg-slate-800 text-slate-300'
          }`}
          onClick={() => {
            onSelect(a.id, a.dashboardLabel ?? a.nameAr, 'both');
          }}
        >
          {getAccountNavLabel(a)}
        </button>
      ))}

      {DASHBOARD_ALIASES.filter((a) => a.showOnDashboard === 'assets').map((alias) => (
        <button
          key={alias.id}
          type="button"
          className={`w-full text-right rounded-lg px-3 py-1.5 text-sm transition ${
            isBourseActive && alias.id === 'bourse' ? 'bg-amber-600/30 text-amber-300' : 'hover:bg-slate-800 text-slate-300'
          }`}
          onClick={() => onSelect(alias.sourceAccountId, alias.label, alias.side === 'usd' ? 'usd' : 'both')}
        >
          {alias.label} (CASH)
        </button>
      ))}

      <div className="text-xs text-slate-500 px-2 pt-2">حسابات تفصيلية</div>
      {grouped.detail.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`w-full text-right rounded-lg px-3 py-1.5 text-sm transition ${selectedId === a.id ? 'bg-amber-600/30 text-amber-300' : 'hover:bg-slate-800 text-slate-400'}`}
          onClick={() => onSelect(a.id, getAccountNavLabel(a), 'both')}
        >
          {getAccountNavLabel(a)}
        </button>
      ))}
    </nav>
  );
}
