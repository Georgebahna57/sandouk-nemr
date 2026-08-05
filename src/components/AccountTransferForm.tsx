import { ArrowLeftRight, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  extraFeeFieldsFromParsed,
  feeFieldsFromParsed,
  isFeeAccountName,
  isShamelFeeEligible,
  sumAmountForCurrency,
} from '../lib/fees';
import { createLinkedAccountAccountOperation, todayIso } from '../lib/utils';
import type { FundId, Transaction } from '../types';
import { AmountLinesEditor, createDefaultLines, parseAmountLines } from './AmountLinesEditor';
import {
  buildFeeFromEditor,
  defaultFeeEditorValue,
  FeeEditor,
  type FeeEditorValue,
} from './FeeEditor';

interface Props {
  accountNames: string[];
  fundId: FundId;
  onAdd: (tx: Transaction | Transaction[]) => void;
}

export function AccountTransferForm({ accountNames, fundId, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [lines, setLines] = useState(createDefaultLines);
  const [note, setNote] = useState('');
  const [feeEditor, setFeeEditor] = useState<FeeEditorValue>(defaultFeeEditorValue);
  const [extraFeeEditor, setExtraFeeEditor] = useState<FeeEditorValue>(defaultFeeEditorValue);

  const parsedLines = parseAmountLines(lines);
  const feeBaseAmount = sumAmountForCurrency(parsedLines, feeEditor.currency);
  const feeLineCurrencies = [...new Set(parsedLines.map(item => item.currency))];
  const extraFeeBaseAmount = sumAmountForCurrency(parsedLines, extraFeeEditor.currency);
  const shamelEligible = isShamelFeeEligible(fromAccount);
  const canTransfer = accountNames.length >= 2;

  const toOptions = useMemo(
    () => accountNames.filter(name => name !== fromAccount),
    [accountNames, fromAccount],
  );

  function reset() {
    setFromAccount('');
    setToAccount('');
    setLines(createDefaultLines());
    setNote('');
    setFeeEditor(defaultFeeEditorValue());
    setExtraFeeEditor(defaultFeeEditorValue());
  }

  function swapAccounts() {
    setFromAccount(toAccount);
    setToAccount(fromAccount);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const from = fromAccount.trim();
    const to = toAccount.trim();
    if (!from || !to || from === to) return;
    const items = parseAmountLines(lines);
    if (!items.length) return;

    const parsedFee = buildFeeFromEditor(feeEditor, feeBaseAmount);
    const parsedExtraFee = shamelEligible ? buildFeeFromEditor(extraFeeEditor, extraFeeBaseAmount) : undefined;
    const payload = createLinkedAccountAccountOperation(
      {
        fundId,
        date: todayIso(),
        note: note.trim() || undefined,
        status: 'posted',
        ...feeFieldsFromParsed(parsedFee),
        ...extraFeeFieldsFromParsed(parsedExtraFee),
      },
      from,
      to,
      'out',
      items,
      'in',
      [parsedFee, parsedExtraFee],
    );
    if (!payload.length) return;

    onAdd(payload);
    reset();
    setOpen(false);
  }

  if (!canTransfer) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2.5 text-sm font-medium text-sky-200 hover:bg-sky-500/20"
      >
        <ArrowLeftRight size={14} />
        تحويل بين حسابين
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-sky-200">تحويل بين حسابين</p>
        <button type="button" onClick={() => { reset(); setOpen(false); }} className="text-slate-500 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <label className="block space-y-1">
          <span className="text-[10px] text-slate-500">من حساب</span>
          <select
            value={fromAccount}
            onChange={e => {
              setFromAccount(e.target.value);
              if (e.target.value === toAccount) setToAccount('');
            }}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm"
            required
          >
            <option value="">— اختر —</option>
            {accountNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={swapAccounts}
          disabled={!fromAccount && !toAccount}
          className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-400 hover:text-sky-300 disabled:opacity-40"
          title="تبديل"
        >
          <ArrowLeftRight size={16} />
        </button>

        <label className="block space-y-1">
          <span className="text-[10px] text-slate-500">إلى حساب</span>
          <select
            value={toAccount}
            onChange={e => setToAccount(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm"
            required
          >
            <option value="">— اختر —</option>
            {toOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-[10px] text-slate-500">
        تحويل داخلي بين حسابات الزبائن — مثلاً كندا → موني آوت (بدون صندوق أو حلب)
      </p>

      <AmountLinesEditor lines={lines} onChange={setLines} />

      {fromAccount && !isFeeAccountName(fromAccount) && (
        <>
          <FeeEditor
            value={feeEditor}
            onChange={setFeeEditor}
            baseAmount={feeBaseAmount}
            availableCurrencies={feeLineCurrencies.length ? feeLineCurrencies : undefined}
            compact
          />
          {shamelEligible && (
            <FeeEditor
              value={extraFeeEditor}
              onChange={setExtraFeeEditor}
              baseAmount={extraFeeBaseAmount}
              availableCurrencies={feeLineCurrencies.length ? feeLineCurrencies : undefined}
              compact
              title="عمولات شاملة"
            />
          )}
        </>
      )}

      <input
        type="text"
        placeholder="ملاحظة (اختياري)"
        value={note}
        onChange={e => setNote(e.target.value)}
        className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm"
      />

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-500"
      >
        <Plus size={14} />
        حفظ التحويل — {fromAccount || '…'} → {toAccount || '…'}
      </button>
    </form>
  );
}
