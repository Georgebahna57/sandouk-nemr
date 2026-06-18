import { ArrowDownLeft, ArrowUpRight, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { getFund } from '../config';
import { describeTransaction, formatDateAr, formatExecutor, formatValueWithUnit, groupTransactionsForDisplay } from '../lib/utils';
import type { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
  onApprove?: (id: string) => void;
  onEdit?: (id: string) => void;
  showApprove?: boolean;
  showFund?: boolean;
}

function kindIcon(kind: Transaction['kind']) {
  if (kind === 'exchange') return <RefreshCw size={14} className="text-violet-400" />;
  if (kind === 'payment') return <ArrowUpRight size={14} className="text-rose-400" />;
  return <ArrowDownLeft size={14} className="text-emerald-400" />;
}

function renderAmounts(txs: Transaction[]) {
  if (txs.length === 1 && txs[0].kind === 'exchange' && txs[0].exchangeToCurrency && txs[0].exchangeToAmount) {
    const tx = txs[0];
    return (
      <>
        <p className="font-bold tabular-nums text-rose-400">
          -{formatValueWithUnit(tx.amount, tx.currency)}
        </p>
        <p className="font-bold tabular-nums text-emerald-400">
          +{formatValueWithUnit(tx.exchangeToAmount!, tx.exchangeToCurrency!)}
        </p>
      </>
    );
  }

  return txs.map(tx => (
    <p
      key={tx.id}
      className={`font-bold tabular-nums ${tx.kind === 'payment' ? 'text-rose-400' : 'text-emerald-400'}`}
    >
      {tx.kind === 'payment' ? '-' : '+'}{formatValueWithUnit(tx.amount, tx.currency)}
    </p>
  ));
}

function MetaLine({ tx }: { tx: Transaction }) {
  const executor = formatExecutor(tx);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
      <span>{formatDateAr(tx.date)}</span>
      {executor && (
        <>
          <span>•</span>
          <span>{executor}</span>
          {tx.createdByEmail && tx.createdByName && (
            <span className="text-slate-600" dir="ltr">({tx.createdByEmail})</span>
          )}
        </>
      )}
      {!executor && <span>• منفّذ: غير مسجّل</span>}
      {tx.lastEditedAt && (
        <>
          <span>•</span>
          <span className="text-amber-500/80">
            عُدّل {formatDateAr(tx.lastEditedAt.slice(0, 10))}
            {tx.lastEditedByName ? ` — ${tx.lastEditedByName}` : ''}
          </span>
        </>
      )}
    </div>
  );
}

export function TransactionList({ transactions, onDelete, onEdit, onApprove, showApprove, showFund }: Props) {
  const items = groupTransactionsForDisplay(transactions);

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
        لا توجد حركات
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(item => {
        const txs = item.kind === 'batch' ? item.transactions : [item.transaction];
        const lead = txs[0];
        const isBatch = item.kind === 'batch';

        return (
          <div key={isBatch ? lead.batchId! : lead.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {kindIcon(lead.kind)}
                  <span className="truncate">
                    {isBatch
                      ? `${lead.kind === 'payment' ? 'مدفوع' : 'مقبوض'} — ${txs.length} بنود`
                      : describeTransaction(lead)}
                  </span>
                </div>
                <p className="mt-1 truncate text-slate-300">
                  {showFund
                    ? getFund(lead.fundId).name
                    : (lead.counterparty || lead.party)}
                </p>
                {lead.linkId && !showFund && (
                  <p className="mt-1 text-xs text-emerald-400/80">مرتبط بحساب {lead.counterparty || '—'}</p>
                )}
                {showFund && (
                  <p className="mt-0.5 truncate text-xs text-slate-500">حساب: {lead.party}</p>
                )}
                {!isBatch && lead.kind === 'exchange' && lead.exchangeRate && (
                  <p className="mt-1 text-xs text-violet-400">
                    ريت: {lead.exchangeRate.toLocaleString('ar-LB')}
                  </p>
                )}
                {lead.note && <p className="mt-1 text-xs text-slate-500">{lead.note}</p>}
                <MetaLine tx={lead} />
              </div>
              <div className="text-left shrink-0 space-y-1">
                {renderAmounts(txs)}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {showApprove && onApprove && (
                <button type="button" onClick={() => onApprove(lead.id)}
                  className="rounded-lg bg-emerald-600/20 px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30">
                  اعتماد → الصندوق
                </button>
              )}
              {onEdit && lead.kind !== 'exchange' && (
                <button type="button" onClick={() => onEdit(lead.id)}
                  className="rounded-lg p-1 text-slate-500 hover:bg-amber-600/20 hover:text-amber-400"
                  title="تعديل (مسؤول فقط)">
                  <Pencil size={14} />
                </button>
              )}
              {onDelete && (
                <button type="button" onClick={() => onDelete(lead.id)}
                  className="rounded-lg p-1 text-slate-500 hover:bg-rose-600/20 hover:text-rose-400"
                  title="حذف (مسؤول فقط)">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
