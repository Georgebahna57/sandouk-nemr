import { ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { getFund } from '../config';
import { isTransactionReconciled } from '../lib/customerMeta';
import { describeTransaction, formatAmount, formatDateAr, formatExecutor, formatFee, formatIntermediary, formatValueWithUnit, getOrderedDateNote, groupTransactionsForDisplay } from '../lib/utils';
import { formatTransactionFees } from '../lib/fees';
import type { Transaction } from '../types';
import { TransactionCoordination } from './TransactionCoordination';
import { HalabRemittanceSummary } from './HalabRemittanceFields';

interface TeamMember {
  id: string;
  displayName: string;
}

interface Props {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
  onApprove?: (id: string) => void;
  onEdit?: (id: string) => void;
  showApprove?: boolean;
  showFund?: boolean;
  showCoordination?: boolean;
  currentUserId?: string;
  teamMembers?: TeamMember[];
  onAddComment?: (txId: string, text: string) => void | Promise<void>;
  onClaim?: (txId: string) => void | Promise<void>;
  onReleaseClaim?: (txId: string) => void | Promise<void>;
  readOnly?: boolean;
  compact?: boolean;
  reconciledThroughDate?: string;
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
        <p className="font-bold tabular-nums text-emerald-400">
          +{formatValueWithUnit(tx.exchangeToAmount!, tx.exchangeToCurrency!)}
        </p>
        <p className="font-bold tabular-nums text-rose-400">
          -{formatValueWithUnit(tx.amount, tx.currency)}
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

function kindLabel(kind: Transaction['kind']) {
  if (kind === 'payment') return 'دفع';
  if (kind === 'exchange') return 'تبديل';
  return 'استلام';
}

function CompactSummary({
  lead,
  isBatch,
  batchCount,
  commentCount,
}: {
  lead: Transaction;
  isBatch: boolean;
  batchCount: number;
  commentCount: number;
}) {
  const party = lead.counterparty || lead.party;
  const via = formatIntermediary(lead.intermediary);
  const fee = formatTransactionFees(lead) ?? formatFee(lead.fee);
  const orderedNote = getOrderedDateNote(lead);

  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium">
        {kindIcon(lead.kind)}
        <span className="truncate">
          {kindLabel(lead.kind)}{isBatch ? ` (${batchCount} بنود)` : ''}
        </span>
      </div>
      <p className="mt-1 truncate text-sm text-slate-300">حساب: {party}</p>
      <p className="mt-1 text-xs text-slate-400">بيد: {via ?? '—'}</p>
      <p className="mt-1 text-xs text-amber-400/90">أجور/عمولة: {fee ?? '—'}</p>
      <p className="mt-1 text-xs text-slate-400 line-clamp-2">ملاحظة: {lead.note?.trim() || '—'}</p>
      <HalabRemittanceSummary fields={lead.halabRemittance} />
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
        <span>{formatDateAr(lead.date)}</span>
        {orderedNote && (
          <>
            <span>•</span>
            <span className="text-sky-400/90">{orderedNote}</span>
          </>
        )}
        {lead.claimedByName && (
          <>
            <span>•</span>
            <span className="text-sky-400/90">يتابع: {lead.claimedByName}</span>
          </>
        )}
        {commentCount > 0 && (
          <>
            <span>•</span>
            <span>{commentCount} تعليق</span>
          </>
        )}
      </div>
    </>
  );
}

function MetaLine({ tx }: { tx: Transaction }) {
  const executor = formatExecutor(tx);
  const orderedNote = getOrderedDateNote(tx);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
      <span>{formatDateAr(tx.date)}</span>
      {orderedNote && (
        <>
          <span>•</span>
          <span className="text-sky-400/90">{orderedNote}</span>
        </>
      )}
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

export function TransactionList({
  transactions,
  onDelete,
  onEdit,
  onApprove,
  showApprove,
  showFund,
  showCoordination = false,
  currentUserId,
  teamMembers,
  onAddComment,
  onClaim,
  onReleaseClaim,
  readOnly = false,
  compact = false,
  reconciledThroughDate,
}: Props) {
  const items = groupTransactionsForDisplay(transactions);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        const rowKey = isBatch ? lead.batchId! : lead.id;
        const expanded = !compact || expandedIds.has(rowKey);
        const party = lead.counterparty || lead.party;
        const commentCount = lead.comments?.length ?? 0;
        const reconciled = isTransactionReconciled(lead.date, reconciledThroughDate);

        return (
          <div key={rowKey} className={`rounded-2xl border p-3 ${reconciled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700 bg-slate-800/60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {compact && !expanded ? (
                  <CompactSummary
                    lead={lead}
                    isBatch={isBatch}
                    batchCount={txs.length}
                    commentCount={commentCount}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {kindIcon(lead.kind)}
                      <span className="truncate">
                        {isBatch
                          ? `${kindLabel(lead.kind)} — ${txs.length} بنود`
                          : describeTransaction(lead)}
                      </span>
                      {reconciled && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400" title="مطابق">
                          <CheckCircle2 size={10} />
                          مطابق
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-slate-300">
                      {showFund
                        ? getFund(lead.fundId).name
                        : party}
                    </p>
                    {lead.linkId && showFund && (
                      <p className="mt-1 text-xs text-emerald-400/80">مرتبط بحساب {lead.counterparty || '—'}</p>
                    )}
                    {showFund && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">حساب: {lead.party}</p>
                    )}
                    {!isBatch && lead.kind === 'exchange' && lead.exchangeRate && (
                      <p className="mt-1 text-xs text-violet-400">
                        ريت: {formatAmount(lead.exchangeRate, lead.currency)}
                      </p>
                    )}
                    {lead.approvalDetails && (
                      <p className="mt-1 text-xs text-emerald-400/90">تفاصيل الاعتماد: {lead.approvalDetails}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">بيد: {formatIntermediary(lead.intermediary) ?? '—'}</p>
                    <p className="mt-1 text-xs text-amber-400/90">أجور/عمولة: {formatTransactionFees(lead) ?? formatFee(lead.fee) ?? '—'}</p>
                    <p className="mt-1 text-xs text-slate-500">ملاحظة: {lead.note?.trim() || '—'}</p>
                    <HalabRemittanceSummary fields={lead.halabRemittance} />
                    <MetaLine tx={lead} />
                  </>
                )}
              </div>
              <div className="text-left shrink-0 space-y-1">
                {renderAmounts(txs)}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {compact && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(rowKey)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                >
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expanded ? 'إخفاء التفاصيل' : 'التفاصيل'}
                </button>
              )}
              {showApprove && onApprove && (
                <button type="button" onClick={() => onApprove(lead.id)}
                  className="rounded-lg bg-emerald-600/20 px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30">
                  اعتماد → الصندوق
                </button>
              )}
              {onEdit && (
                <button type="button" onClick={() => onEdit(lead.id)}
                  className="rounded-lg p-1 text-slate-500 hover:bg-amber-600/20 hover:text-amber-400"
                  title={showApprove ? 'تعديل' : 'تعديل (مسؤول فقط)'}>
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
            {(expanded && (showCoordination || (lead.comments?.length ?? 0) > 0 || lead.claimedByUserId)) && (
              <TransactionCoordination
                tx={lead}
                currentUserId={currentUserId}
                teamMembers={teamMembers}
                onAddComment={showCoordination ? onAddComment : undefined}
                onClaim={showCoordination ? onClaim : undefined}
                onReleaseClaim={showCoordination ? onReleaseClaim : undefined}
                readOnly={readOnly || !showCoordination}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
