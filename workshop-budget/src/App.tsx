import { useState } from 'react';
import { Gem } from 'lucide-react';
import { useWorkshopStore } from './hooks/useWorkshopStore';
import { getAccountDef } from './lib/accountsConfig';
import { Dashboard } from './components/Dashboard';
import { AccountNav } from './components/AccountNav';
import { AccountLedger } from './components/AccountLedger';
import { TreasuryPanel } from './components/TreasuryPanel';
import { ImportExportBar } from './components/ImportExportBar';

type View = 'dashboard' | 'treasury' | 'account';

export default function App() {
  const store = useWorkshopStore();
  const [view, setView] = useState<View>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const selectedDef = selectedAccountId ? getAccountDef(selectedAccountId) : null;
  const selectedData = selectedAccountId ? store.state.accounts[selectedAccountId] : null;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Gem className="h-8 w-8 text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-amber-400">ميزانية الورشة</h1>
            <p className="text-xs text-slate-400">معمل الذهب — مصاريف · أجور · أرباح · مدفوعات</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <ImportExportBar
          periodLabel={store.state.periodLabel}
          onPeriodChange={store.updatePeriod}
          onImport={store.importFile}
          onExport={store.exportExcel}
          onBackup={store.backupJson}
          onRestoreDefaults={store.restoreExcelDefaults}
        />

        <div className="grid lg:grid-cols-[220px_1fr] gap-4">
          <AccountNav
            selectedId={selectedAccountId}
            onSelect={setSelectedAccountId}
            view={view}
            onViewChange={setView}
          />

          <div>
            {view === 'dashboard' && (
              <Dashboard
                summary={store.dashboard}
                onSelectAccount={(id) => {
                  setSelectedAccountId(id);
                  setView('account');
                }}
              />
            )}

            {view === 'treasury' && (
              <TreasuryPanel items={store.state.treasury} onChange={store.updateTreasury} />
            )}

            {view === 'account' && selectedDef && selectedData && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-amber-400">{selectedDef.nameAr}</h2>
                <AccountLedger
                  accountName={selectedDef.nameAr}
                  entryKind={selectedDef.entryKind}
                  data={selectedData}
                  onAdd={(side, entry) => store.addLedgerEntry(selectedAccountId!, side, entry)}
                  onDelete={(side, id) => store.removeLedgerEntry(selectedAccountId!, side, id)}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
