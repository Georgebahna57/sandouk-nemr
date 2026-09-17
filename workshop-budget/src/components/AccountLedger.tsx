import { Trash2 } from 'lucide-react';
import { formatDateAr, formatNumber } from '../lib/format';
import type { AccountData, EntryKind } from '../types';
import { EntryForm } from './EntryForm';

interface Props {
  accountName: string;
  entryKind: EntryKind;
  data: AccountData;
  onAdd: (side: 'gold' | 'usd', entry: { date: string; debit?: number; credit?: number; description: string }) => void;
  onDelete: (side: 'gold' | 'usd', id: string) => void;
}

function LedgerTable({
  title,
  entries,
  entryKind,
  onDelete,
}: {
  title: string;
  entries: AccountData['gold'];
  entryKind: EntryKind;
  onDelete: (id: string) => void;
}) {
  const headers =
    entryKind === 'profit'
      ? ['التاريخ', 'خسارة', 'ربح', 'الرصيد', 'البيان', '']
      : entryKind === 'inout'
        ? ['التاريخ', 'دخول', 'خروج', 'الرصيد', 'البيان', '']
        : entryKind === 'expense'
          ? ['التاريخ', 'مدفوع', 'مرتجع', 'الرصيد', 'البيان', '']
          : entryKind === 'partner'
            ? ['التاريخ', 'Debit', 'Credit', 'الرصيد', 'البيان', '']
            : ['التاريخ', 'مدفوع له', 'مستلم منه', 'الرصيد', 'البيان', ''];

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
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{formatDateAr(e.date)}</td>
                <td className="num">{e.debit ? formatNumber(e.debit) : ''}</td>
                <td className="num">{e.credit ? formatNumber(e.credit) : ''}</td>
                <td className={`num font-medium ${e.balance < 0 ? 'num-neg' : 'num-pos'}`}>{formatNumber(e.balance)}</td>
                <td className="max-w-[200px] truncate" title={e.description}>{e.description}</td>
                <td>
                  <button type="button" className="text-red-400 hover:text-red-300 p-1" onClick={() => onDelete(e.id)} title="حذف">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AccountLedger({ accountName, entryKind, data, onAdd, onDelete }: Props) {
  const goldBal = data.gold.length ? data.gold[data.gold.length - 1].balance : 0;
  const usdBal = data.usd.length ? data.usd[data.usd.length - 1].balance : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="card px-4 py-3">
          <span className="text-xs text-slate-400">رصيد ذهب</span>
          <div className={`text-xl font-bold num ${goldBal < 0 ? 'num-neg' : 'num-pos'}`}>{formatNumber(goldBal, 4)}</div>
        </div>
        <div className="card px-4 py-3">
          <span className="text-xs text-slate-400">رصيد دولار</span>
          <div className={`text-xl font-bold num ${usdBal < 0 ? 'num-neg' : 'num-pos'}`}>{formatNumber(usdBal)}</div>
        </div>
      </div>

      <EntryForm entryKind={entryKind} onSubmit={(entry) => onAdd('gold', entry)} />

      <div className="grid lg:grid-cols-2 gap-4">
        <LedgerTable title={`${accountName} — ذهب 995`} entries={data.gold} entryKind={entryKind} onDelete={(id) => onDelete('gold', id)} />
        {entryKind !== 'manufacturing' && (
          <LedgerTable title={`${accountName} — دولار`} entries={data.usd} entryKind={entryKind} onDelete={(id) => onDelete('usd', id)} />
        )}
      </div>

      {entryKind !== 'manufacturing' && (
        <EntryForm entryKind={entryKind} onSubmit={(entry) => onAdd('usd', entry)} />
      )}
    </div>
  );
}
