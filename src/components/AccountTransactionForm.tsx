import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getFund, isHalabFleilatFund } from '../config';
import {
  createLinkedAccountAccountOperation,
  createLinkedAccountFundExchange,
  createLinkedAccountFundOperation,
  createTransaction,
  createTransactionBatch,
  inferKind,
  todayIso,
} from '../lib/utils';
import {
  adjustAccountItemsForFees,
  extraFeeFieldsFromParsed,
  feeFieldsFromParsed,
  isShamelFeeEligible,
  sumAmountForCurrency,
} from '../lib/fees';
import type { Fund, FundId, HalabRemittanceFields, Transaction } from '../types';
import { AmountLinesEditor, createDefaultLines, parseAmountLines } from './AmountLinesEditor';
import { defaultExchangeFieldValues, ExchangeFields, parseExchangeFieldValues, type ExchangeFieldValues } from './ExchangeFields';
import {
  buildFeeFromEditor,
  defaultFeeEditorValue,
  FeeEditor,
  type FeeEditorValue,
} from './FeeEditor';
import { defaultHalabRemittanceFields, resolveHalabDeliverySource, stampHalabRemittance } from '../lib/halabRemittance';
import { appendHalabMirrorTransactions, shouldOfferHalabMirror } from '../lib/halabMirror';
import { HalabRemittanceFieldsEditor } from './HalabRemittanceFields';

type TransferMode = 'none' | 'fund' | 'account';

interface Props {
  accountName: string;
  fundId: FundId;
  fundOptions?: Fund[];
  otherAccountNames?: string[];
  onAdd: (tx: Transaction | Transaction[]) => void;
}

export function AccountTransactionForm({
  accountName,
  fundId,
  fundOptions = [],
  otherAccountNames = [],
  onAdd,
}: Props) {
  const funds = fundOptions.length ? fundOptions : [getFund(fundId)];
  const canPickFund = funds.length > 1;
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [lines, setLines] = useState(createDefaultLines);
  const [note, setNote] = useState('');
  const [isExchange, setIsExchange] = useState(false);
  const [transferMode, setTransferMode] = useState<TransferMode>('none');
  const [targetFundId, setTargetFundId] = useState<FundId>(fundId);
  const [fundDirection, setFundDirection] = useState<'in' | 'out'>('out');
  const [targetAccount, setTargetAccount] = useState('');
  const [targetDirection, setTargetDirection] = useState<'in' | 'out'>('in');
  const [exchangeFields, setExchangeFields] = useState<ExchangeFieldValues>(() => defaultExchangeFieldValues());
  const [feeEditor, setFeeEditor] = useState<FeeEditorValue>(defaultFeeEditorValue);
  const [extraFeeEditor, setExtraFeeEditor] = useState<FeeEditorValue>(defaultFeeEditorValue);
  const [halabRemittance, setHalabRemittance] = useState<HalabRemittanceFields>(() => defaultHalabRemittanceFields());
  const [mirrorToHalab, setMirrorToHalab] = useState(false);
  const showHalabFields = isHalabFleilatFund(fundId);
  const showHalabMirror = showHalabFields && shouldOfferHalabMirror(fundId, accountName);

  const exchangeParsed = parseExchangeFieldValues(exchangeFields);
  const parsedAmount = exchangeParsed.paidAmount;
  const parsedRate = exchangeParsed.rate;
  const exchangeResult = exchangeParsed.receivedAmount;
  const paidCurrency = exchangeFields.paidCurrency;
  const receivedCurrency = exchangeFields.receivedCurrency;
  const parsedLines = parseAmountLines(lines);
  const feeBaseAmount = isExchange
    ? (feeEditor.currency === paidCurrency ? parsedAmount : feeEditor.currency === receivedCurrency ? exchangeResult : 0)
    : sumAmountForCurrency(parsedLines, feeEditor.currency);
  const feeLineCurrencies = isExchange
    ? [paidCurrency, receivedCurrency]
    : [...new Set(parsedLines.map(item => item.currency))];
  const extraFeeBaseAmount = isExchange
    ? (extraFeeEditor.currency === paidCurrency ? parsedAmount : extraFeeEditor.currency === receivedCurrency ? exchangeResult : 0)
    : sumAmountForCurrency(parsedLines, extraFeeEditor.currency);
  const shamelEligible = isShamelFeeEligible(accountName);
  const canLinkAccount = otherAccountNames.length > 0;
  const halabDeliverySource = useMemo(() => resolveHalabDeliverySource({
    isExchange,
    exchangeReceivedAmount: exchangeParsed.receivedAmount,
    exchangeReceivedCurrency: receivedCurrency,
    lines: parsedLines,
  }), [isExchange, exchangeParsed.receivedAmount, receivedCurrency, parsedLines]);

  function reset() {
    setDirection('out');
    setLines(createDefaultLines());
    setNote('');
    setIsExchange(false);
    setTransferMode('none');
    setTargetFundId(fundId);
    setFundDirection('out');
    setTargetAccount('');
    setTargetDirection('in');
    setExchangeFields(defaultExchangeFieldValues());
    setFeeEditor(defaultFeeEditorValue());
    setExtraFeeEditor(defaultFeeEditorValue());
    setHalabRemittance(defaultHalabRemittanceFields());
    setMirrorToHalab(false);
  }

  function setSourceDirection(next: 'in' | 'out') {
    setDirection(next);
    setFundDirection(next);
    setTargetDirection(next === 'in' ? 'out' : 'in');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsedFee = buildFeeFromEditor(feeEditor, feeBaseAmount);
    const parsedExtraFee = shamelEligible ? buildFeeFromEditor(extraFeeEditor, extraFeeBaseAmount) : undefined;
    const feeFields = feeFieldsFromParsed(parsedFee);
    const extraFeeFields = extraFeeFieldsFromParsed(parsedExtraFee);
    const customerFees = [parsedFee, parsedExtraFee];
    const fundLedgerId = transferMode === 'fund' ? targetFundId : fundId;
    const shared = {
      fundId: fundLedgerId,
      date: todayIso(),
      note: note.trim() || undefined,
      status: 'posted' as const,
      ...feeFields,
      ...extraFeeFields,
    };

    let payload: Transaction | Transaction[];

    if (isExchange) {
      if (!exchangeParsed.valid) return;
      if (transferMode === 'account') return;
      payload = transferMode === 'fund'
        ? createLinkedAccountFundExchange(
          shared,
          accountName,
          paidCurrency,
          parsedAmount,
          receivedCurrency,
          parsedRate,
          exchangeResult,
          fundId,
        )
        : createTransaction({
          ...shared,
          fundId,
          ledger: 'account',
          party: accountName,
          kind: 'exchange',
          currency: paidCurrency,
          amount: parsedAmount,
          exchangeToCurrency: receivedCurrency,
          exchangeRate: parsedRate,
          exchangeToAmount: exchangeResult,
        });
    } else {
      const items = parseAmountLines(lines);
      if (!items.length) return;

      if (transferMode === 'fund') {
        payload = createLinkedAccountFundOperation(
          shared,
          accountName,
          direction,
          items,
          fundDirection,
          customerFees,
          fundId,
        );
      } else if (transferMode === 'account') {
        const toAccount = targetAccount.trim();
        if (!toAccount || toAccount === accountName) return;
        payload = createLinkedAccountAccountOperation(
          shared,
          accountName,
          toAccount,
          direction,
          items,
          targetDirection,
          customerFees,
        );
      } else {
        const adjustedItems = adjustAccountItemsForFees(items, customerFees);
        payload = createTransactionBatch({
          ...shared,
          fundId,
          ledger: 'account',
          kind: inferKind(direction, false),
          party: accountName,
        }, adjustedItems);
      }
    }

    const withRemittance = stampHalabRemittance(payload, showHalabFields ? halabRemittance : undefined);
    const mirrored = appendHalabMirrorTransactions(
      Array.isArray(withRemittance) ? withRemittance : [withRemittance],
      mirrorToHalab && showHalabMirror && transferMode !== 'account',
    );
    onAdd(mirrored.length === 1 ? mirrored[0] : mirrored);
    reset();
    setOpen(false);
  }

  const targetFund = getFund(targetFundId);
  const submitLabel = transferMode === 'fund'
    ? `حفظ — حساب + ${targetFund.shortName}`
    : transferMode === 'account'
      ? `حفظ — ${accountName} + ${targetAccount || 'حساب'}`
      : 'حفظ — حساب فقط';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
      >
        <Plus size={14} />
        حركة على الحساب
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-600 bg-slate-900/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-amber-400">حركة حساب — {accountName}</p>
        <button type="button" onClick={() => { reset(); setOpen(false); }} className="text-slate-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => { setSourceDirection('in'); setIsExchange(false); }}
          className={`rounded-lg py-2 text-xs font-medium ${direction === 'in' && !isExchange ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
          وارد
        </button>
        <button type="button" onClick={() => { setSourceDirection('out'); setIsExchange(false); }}
          className={`rounded-lg py-2 text-xs font-medium ${direction === 'out' && !isExchange ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
          صادر
        </button>
        <button type="button" onClick={() => { setIsExchange(true); setTransferMode('none'); }}
          className={`rounded-lg py-2 text-xs font-medium ${isExchange ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
          تبديل
        </button>
      </div>

      {isExchange ? (
        <ExchangeFields values={exchangeFields} onChange={setExchangeFields} compact />
      ) : (
        <AmountLinesEditor lines={lines} onChange={setLines} />
      )}

      {showHalabMirror && transferMode !== 'account' && (
        <label className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-2.5 py-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={mirrorToHalab}
            onChange={e => setMirrorToHalab(e.target.checked)}
            className="rounded"
          />
          عكس الحركة على حساب حلب
        </label>
      )}

      {showHalabFields && (
        <HalabRemittanceFieldsEditor
          values={halabRemittance}
          onChange={setHalabRemittance}
          deliverySource={halabDeliverySource}
          compact
        />
      )}

      <input type="text" placeholder="ملاحظة (اختياري)" value={note} onChange={e => setNote(e.target.value)}
        className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm" />

      {!isExchange && (
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
              hintOurs="تُخصم من مبلغ حساب الزبون وتُسجَّل على حساب «عمولات شاملة»"
              hintCustomer="تُضاف على مبلغ حساب الزبون فقط — ما بتروح لـ «عمولات شاملة»"
            />
          )}
        </>
      )}

      {!isExchange && (
        <div className="space-y-2 rounded-xl border border-slate-600/80 bg-slate-900/40 p-2.5">
          <p className="text-[10px] font-medium text-slate-400">ترحيل مرتبط (اختياري)</p>
          <label className="flex items-center gap-2 text-xs text-emerald-300/90">
            <input
              type="radio"
              name={`transfer-${accountName}`}
              checked={transferMode === 'none'}
              onChange={() => setTransferMode('none')}
            />
            بدون ترحيل
          </label>
          <label className="flex items-center gap-2 text-xs text-emerald-300/90">
            <input
              type="radio"
              name={`transfer-${accountName}`}
              checked={transferMode === 'fund'}
              onChange={() => setTransferMode('fund')}
            />
            ترحيل على الصندوق
          </label>
          {canLinkAccount && (
            <label className="flex items-center gap-2 text-xs text-sky-300/90">
              <input
                type="radio"
                name={`transfer-${accountName}`}
                checked={transferMode === 'account'}
                onChange={() => setTransferMode('account')}
              />
              ترحيل إلى حساب آخر (تحويل بين حسابين)
            </label>
          )}
        </div>
      )}

      {isExchange && transferMode === 'fund' && canPickFund && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5">
          <label className="mb-1 block text-[10px] text-emerald-300/90">صندوق الترحيل</label>
          <select
            value={targetFundId}
            onChange={e => setTargetFundId(e.target.value as FundId)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm"
          >
            {funds.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {isExchange && (
        <label className="flex items-center gap-2 text-xs text-emerald-300/90">
          <input
            type="checkbox"
            checked={transferMode === 'fund'}
            onChange={e => setTransferMode(e.target.checked ? 'fund' : 'none')}
            className="rounded"
          />
          ترحيل نفس التبديل على الصندوق
        </label>
      )}

      {transferMode === 'fund' && !isExchange && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
          {canPickFund && (
            <div>
              <label className="mb-1 block text-[10px] text-emerald-300/90">صندوق الترحيل</label>
              <select
                value={targetFundId}
                onChange={e => setTargetFundId(e.target.value as FundId)}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm"
              >
                {funds.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
          {!canPickFund && (
            <p className="text-xs font-medium text-emerald-300/90">على {getFund(fundId).name}:</p>
          )}
          <p className="text-xs font-medium text-emerald-300/90">اتجاه الحركة على الصندوق:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFundDirection('in')}
              className={`rounded-lg py-2 text-xs font-medium ${fundDirection === 'in' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              استلام
            </button>
            <button
              type="button"
              onClick={() => setFundDirection('out')}
              className={`rounded-lg py-2 text-xs font-medium ${fundDirection === 'out' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              دفع
            </button>
          </div>
        </div>
      )}

      {transferMode === 'account' && !isExchange && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
          <div>
            <label className="mb-1 block text-[10px] text-sky-300/90">الحساب الوجهة</label>
            <select
              value={targetAccount}
              onChange={e => setTargetAccount(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm"
              required
            >
              <option value="">— اختر حساب —</option>
              {otherAccountNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <p className="text-xs font-medium text-sky-300/90">على الحساب الوجهة:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTargetDirection('in')}
              className={`rounded-lg py-2 text-xs font-medium ${targetDirection === 'in' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              وارد
            </button>
            <button
              type="button"
              onClick={() => setTargetDirection('out')}
              className={`rounded-lg py-2 text-xs font-medium ${targetDirection === 'out' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              صادر
            </button>
          </div>
        </div>
      )}

      <button type="submit" className="w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400">
        {submitLabel}
      </button>
    </form>
  );
}
