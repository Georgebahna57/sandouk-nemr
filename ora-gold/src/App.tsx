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
import { DisbursementOrdersPanel } from './components/DisbursementOrdersPanel';
import { EditLockBadge, EditProtectionProvider, useEditProtection } from './components/EditProtectionProvider';
import type { DashboardRow } from './types';

type View = 'dashboard' | 'treasury' | 'account' | 'invoice' | 'disbursements';

function focusForRow(row: DashboardRow): LedgerFocus {
  if (row.ledgerFocus) return row.ledgerFocus;
  if (row.accountId === 'bourse') return 'usd';
  return 'both';
}

function AppContent({ store }: { store: ReturnType<typeof useWorkshopStore> }) {
  const { guard } = useEditProtection();
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

  const confirmDelete = (message: string, action: () => void) => {
    guard(() => {
      if (confirm(message)) action();
    }, 'تأكيد التعديل أو الحذف');
  };

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3 flex-wrap">
          <Gem className="h-8 w-8 text-amber-500" />
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-xl font-bold text-amber-400">Ora Gold</h1>
            <p className="text-xs text-slate-400">ميزانية معمل الذهب — مصاريف · أجور · أرباح · مدفوعات</p>
          </div>
          <EditLockBadge />
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
                  onSubmit={(input) => guard(() => store.postInvoice(input), 'ترحيل فاتورة جديدة')}
                  onProfitRateChange={(rate) => guard(() => store.updateProfitRate(rate), 'تعديل نسبة الربح')}
                />
                <InvoiceList
                  invoices={store.invoices}
                  onDelete={(id) =>
                    confirmDelete('حذف الفاتورة؟ سيتم عكس كل الحركات المرتبطة.', () => store.deleteInvoice(id))
                  }
                  onEdit={(id, input) => guard(() => store.updateInvoice(id, input), 'تعديل فاتورة')}
                />
              </div>
            )}

            {view === 'disbursements' && (
              <DisbursementOrdersPanel
                state={store.state}
                onAddManual={(input) => guard(() => store.addManualDisbursementOrder(input), 'إضافة أمر صرف')}
                onUpdateManual={(id, input) => guard(() => store.updateManualDisbursementOrder(id, input), 'تعديل أمر صرف')}
                onDeleteManual={(id) =>
                  confirmDelete('حذف أمر الصرف اليدوي؟', () => store.deleteManualDisbursementOrder(id))
                }
                onSaveTemplates={(overrides, defaultId) =>
                  guard(() => store.saveDisbursementTemplates(overrides, defaultId), 'حفظ قوالب الطباعة')
                }
              />
            )}

            {view === 'treasury' && (
              <TreasuryPanel
                items={store.state.treasury}
                onSave={(items) => guard(() => store.updateTreasury(items), 'حفظ تعديلات الخزنة')}
              />
            )}

            {view === 'account' && selectedDef && selectedData && (
              <div className="space-y-3">
                <div>
                  <h2 className="text-lg font-bold text-amber-400">{pageTitle || selectedDef.nameAr}</h2>
                  <p className="text-xs text-slate-500">
                    ورقة Excel: {getExcelSheetTitle(selectedDef)}
                    {ledgerFocus === 'usd' && bourseAlias && selectedAccountId === 'cash' ? ' — بورصة (دولار)' : ''}
                  </p>
                </div>
                <AccountLedger
                  accountId={selectedAccountId!}
                  accountName={pageTitle || getExcelSheetTitle(selectedDef)}
                  entryKind={selectedDef.entryKind}
                  data={selectedData}
                  focus={ledgerFocus}
                  onAddVoucher={(voucher) =>
                    guard(
                      () => store.addLedgerVoucher(selectedAccountId!, selectedDef.entryKind, voucher),
                      'إضافة قيد في الدفتر',
                    )
                  }
                  onDelete={(side, id) =>
                    confirmDelete('حذف هذه الحركة؟', () => store.removeLedgerEntry(selectedAccountId!, side, id))
                  }
                  onEdit={(side, id, patch) =>
                    guard(() => store.editLedgerEntry(selectedAccountId!, side, id, patch), 'تعديل حركة في الدفتر')
                  }
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const store = useWorkshopStore();
  return (
    <EditProtectionProvider editPin={store.state.settings?.editPin} onEditPinChange={store.updateEditPin}>
      <AppContent store={store} />
    </EditProtectionProvider>
  );
}
