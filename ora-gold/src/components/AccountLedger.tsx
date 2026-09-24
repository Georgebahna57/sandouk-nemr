import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { LedgerEntryEditDialog } from './LedgerEntryEditDialog';
import { formatDateAr, formatNumber } from '../lib/format';
import { sortEntriesNewestFirst } from '../lib/ledger';
import { calcLedgerTotals, getColumnHeaders, getDisplayValues, resolveLedgerKind } from '../lib/ledgerDisplay';
import type { AccountData, CurrencySide, EntryKind } from '../types';
import { extractInvoiceNumbers, getOffsetAccountOptions, type LedgerVoucherInput } from '../lib/ledgerVoucher';
import { LedgerVoucherForm } from './LedgerVoucherForm';

export type LedgerFocus = 'both' | 'gold' | 'usd';

interface Props {
  accountId: string;
  accountName: string;
  entryKind: EntryKind;
  data: AccountData;
  focus?: LedgerFocus;
  onAddVoucher: (voucher: LedgerVoucherInput) => void;
  onDelete: (side: CurrencySide, id: string) => void;
  onEdit: (side: CurrencySide, id: string, patch: Partial<Omit<import('../types').LedgerEntry, 'id' | 'balance'>>) => void;
}

function LedgerTable({
  title,
  entries,
  ledgerKind,
  side,
  onDelete,
  onEdit,
}: {
  title: string;
  entries: AccountData['gold'];
  ledgerKind: EntryKind;
  side: CurrencySide;
  onDelete: (id: string) => void;
  onEdit: (entry: import('../types').LedgerEntry) => void;
}) {
  const [col1Label, col2Label] = getColumnHeaders(ledgerKind, side);
  const headers = ['التاريخ', col1Label, col2Label, 'الرصيد', 'البيان', ''];
  const decimals = side === 'gold' ? 4 : 2;
  const totals = calcLedgerTotals(entries, ledgerKind, side);
  const displayEntries = sortEntriesNewestFirst(entries);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-700 px-4 py-2 bg-slate-800/40">
        <h3 className="font-semibold text-amber-400">{title}</h3>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full table-ledger">
          <thead>
            <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-500 py-6">لا توجد حركات</td></tr>
            )}
            {displayEntries.map((e) => {
              const { col1: v1, col2: v2 } = getDisplayValues(e, ledgerKind, side);
              return (
                <tr key={e.id}>
                  <td>{formatDateAr(e.date)}</td>
                  <td className="num">{v1 ? formatNumber(v1, decimals) : ''}</td>
                  <td className="num">{v2 ? formatNumber(v2, decimals) : ''}</td>
                  <td className={`num font-medium ${e.balance < 0 ? 'num-neg' : 'num-pos'}`}>
                    {formatNumber(e.balance, decimals)}
                  </td>
                  <td className="max-w-[200px] truncate" title={e.description}>{e.description}</td>
                  <td className="flex gap-1 justify-end">
                    <button type="button" className="text-sky-400 hover:text-sky-300 p-1" onClick={() => onEdit(e)} title="تعديل">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="text-red-400 hover:text-red-300 p-1" onClick={() => onDelete(e.id)} title="حذف">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="ledger-total-row">
                <td className="font-bold text-amber-400">المجموع</td>
                <td className="num font-bold">{formatNumber(totals.sumCol1, decimals)}</td>
                <td className="num font-bold">{formatNumber(totals.sumCol2, decimals)}</td>
                <td className={`num font-bold ${totals.balance < 0 ? 'num-neg' : 'num-pos'}`}>
                  {formatNumber(totals.balance, decimals)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function AccountLedger({ accountId, accountName, entryKind, data, focus = 'both', onAddVoucher, onDelete, onEdit }: Props) {
  const [editing, setEditing] = useState<{ entry: import('../types').LedgerEntry; side: CurrencySide } | null>(null);
  const showGold = focus === 'both' || focus === 'gold';
  const showUsd = (focus === 'both' || focus === 'usd') && entryKind !== 'manufacturing';

  const goldBal = data.gold.length ? data.gold[data.gold.length - 1].balance : 0;
  const usdBal = data.usd.length ? data.usd[data.usd.length - 1].balance : 0;

  const defaultSide: CurrencySide = focus === 'usd' ? 'usd' : 'gold';
  const existingNumbers = extractInvoiceNumbers([...data.gold, ...data.usd]);
  const offsetAccounts = getOffsetAccountOptions(accountId, showUsd);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {showGold && (
          <div className="card px-4 py-3">
            <span className="text-xs text-slate-400">رصيد ذهب</span>
            <div className={`text-xl font-bold num ${goldBal < 0 ? 'num-neg' : 'num-pos'}`}>{formatNumber(goldBal, 4)}</div>
          </div>
        )}
        {showUsd && (
          <div className="card px-4 py-3">
            <span className="text-xs text-slate-400">رصيد دولار</span>
            <div className={`text-xl font-bold num ${usdBal < 0 ? 'num-neg' : 'num-pos'}`}>{formatNumber(usdBal)}</div>
          </div>
        )}
      </div>

      <LedgerVoucherForm
        accountId={accountId}
        entryKind={entryKind}
        allowUsd={showUsd}
        defaultSide={defaultSide}
        existingNumbers={existingNumbers}
        offsetAccounts={offsetAccounts}
        onSubmit={onAddVoucher}
      />

      <div className={`grid gap-4 ${showGold && showUsd ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {showGold && (
          <LedgerTable
            title={`${accountName} — ذهب 995`}
            entries={data.gold}
            ledgerKind={resolveLedgerKind(accountId, 'gold', entryKind)}
            side="gold"
            onDelete={(id) => onDelete('gold', id)}
            onEdit={(entry) => setEditing({ entry, side: 'gold' })}
          />
        )}
        {showUsd && (
          <LedgerTable
            title={`${accountName} — دولار`}
            entries={data.usd}
            ledgerKind={resolveLedgerKind(accountId, 'usd', entryKind)}
            side="usd"
            onDelete={(id) => onDelete('usd', id)}
            onEdit={(entry) => setEditing({ entry, side: 'usd' })}
          />
        )}
      </div>

      {editing && (
        <LedgerEntryEditDialog
          entry={editing.entry}
          entryKind={resolveLedgerKind(accountId, editing.side, entryKind)}
          side={editing.side}
          onClose={() => setEditing(null)}
          onSave={(patch) => onEdit(editing.side, editing.entry.id, patch)}
        />
      )}
    </div>
  );
}
