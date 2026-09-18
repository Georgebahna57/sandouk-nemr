import { useState } from 'react';
import { Gem } from 'lucide-react';
import { useWorkshopStore } from './hooks/useWorkshopStore';
import { DASHBOARD_ALIASES, getAccountDef, getExcelSheetTitle } from './lib/accountsConfig';
import { Dashboard } from './components/Dashboard';
import { AccountNav } from './components/AccountNav';
import { AccountLedger, type LedgerFocus } from './components/AccountLedger';
import { TreasuryPanel } from './components/TreasuryPanel';
import { ImportExportBar } from './components/ImportExportBar';
import { InvoiceForm } from './components/InvoiceForm';
import { InvoiceList } from './components/InvoiceList';
import type { DashboardRow } from './types';

type View = 'dashboard' | 'treasury' | 'account' | 'invoice';

function focusForRow(row: DashboardRow): LedgerFocus {
  if (row.accountId === 'bourse') return 'usd';
  if (row.accountId === 'trading') return 'gold';
  return 'both';
}

export default function App() {
  const store = useWorkshopStore();
  const [view, setView] = useState<View>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [ledgerFocus, setLedgerFocus] = useState<LedgerFocus>('both');
  const [pageTitle, setPageTitle] = useState('');

  const selectedDef = selectedAccountId ? getAccountDef(selectedAccountId) : null;
  const selectedData = selectedAccountId ? store.state.accounts[selectedAccountId] : null;

  const openAccount = (accountId: string, title: string, focus: LedgerFocus = 'both') => {
    setSelectedAccountId(accountId);
    setPageTitle(title);
    setLedgerFocus(focus);
    setView('account');
  };

  const bourseAlias = DASHBOARD_ALIASES.find((a) => a.id === 'bourse');

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Gem className="h-8 w-8 text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-amber-400">Ora Gold</h1>
            <p className="text-xs text-slate-400">ميزانية معمل الذهب — مصاريف · أجور · أرباح · مدفوعات</p>
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
            ledgerFocus={ledgerFocus}
            onSelect={(id, title, focus) => openAccount(id, title, focus)}
            view={view}
            onViewChange={setView}
          />

          <div>
            {view === 'dashboard' && (
              <Dashboard
                summary={store.dashboard}
                onSelectRow={(row) => {
                  openAccount(row.navigateAccountId, row.label, focusForRow(row));
                }}
              />
            )}

            {view === 'invoice' && (
              <div className="space-y-4">
                <InvoiceForm
                  profitRate={store.profitRate}
                  existingNumbers={store.invoices.map((i) => i.number)}
                  onSubmit={store.postInvoice}
                  onProfitRateChange={store.updateProfitRate}
                />
                <InvoiceList invoices={store.invoices} onDelete={store.deleteInvoice} />
              </div>
            )}

            {view === 'treasury' && (
              <TreasuryPanel items={store.state.treasury} onChange={store.updateTreasury} />
            )}

            {view === 'account' && selectedDef && selectedData && (
              <div className="space-y-3">
                <div>
                  <h2 className="text-lg font-bold text-amber-400">{pageTitle || selectedDef.nameAr}</h2>
                  <p className="text-xs text-slate-500">
                    ورقة Excel: {getExcelSheetTitle(selectedDef)}
                    {ledgerFocus === 'usd' && bourseAlias ? ' — مدفوعات (دولار)' : ''}
                    {ledgerFocus === 'gold' && selectedAccountId === 'trading' ? ' — ذهب 995' : ''}
                  </p>
                </div>
                <AccountLedger
                  accountName={pageTitle || getExcelSheetTitle(selectedDef)}
                  entryKind={selectedDef.entryKind}
                  data={selectedData}
                  focus={ledgerFocus}
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
