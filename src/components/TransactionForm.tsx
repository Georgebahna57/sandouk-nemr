import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { getFundAccountName } from '../config';
import { buildPendingWhatsAppMessage, getApprovalWhatsAppLine } from '../lib/whatsapp';
import {
  createLinkedFundAccountOperation,
  createLinkedAccountFundExchange,
  createTransaction,
  createTransactionBatch,
  formatIntermediary,
  inferKind,
  todayIso,
} from '../lib/utils';
import type { FundId, Transaction } from '../types';
import { AmountLinesEditor, createDefaultLines, parseAmountLines } from './AmountLinesEditor';
import { defaultExchangeFieldValues, ExchangeFields, parseExchangeFieldValues, type ExchangeFieldValues } from './ExchangeFields';
import {
  buildFeeFromEditor,
  defaultFeeEditorValue,
  FeeEditor,
  type FeeEditorValue,
} from './FeeEditor';
import { extraFeeFieldsFromParsed, feeFieldsFromParsed, isShamelFeeEligible, sumAmountForCurrency } from '../lib/fees';

interface Props {
  fundId: FundId;
  onAdd: (tx: Transaction | Transaction[]) => void | Promise<void>;
  defaultPending?: boolean;
  counterpartyNames?: string[];
  whatsappDestinations?: string[];
  actorName?: string;
  onPendingWhatsApp?: (payload: { message: string; destinations: string[] }) => void;
}

function LinkedAccountDirectionPicker({
  direction,
  onChange,
}: {
  direction: 'in' | 'out';
  onChange: (d: 'in' | 'out') => void;
}) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
      <p className="text-xs font-medium text-emerald-300/90">على الحساب:</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange('in')}
          className={`rounded-lg py-2 text-sm font-medium ${direction === 'in' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          إيداع
        </button>
        <button
          type="button"
          onClick={() => onChange('out')}
          className={`rounded-lg py-2 text-sm font-medium ${direction === 'out' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          سحب
        </button>
      </div>
    </div>
  );
}

export function TransactionForm({ fundId, onAdd, defaultPending = false, counterpartyNames = [], whatsappDestinations, actorName, onPendingWhatsApp }: Props) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [lines, setLines] = useState(createDefaultLines);
  const [counterparty, setCounterparty] = useState('');
  const [intermediary, setIntermediary] = useState('');
  const [feeEditor, setFeeEditor] = useState<FeeEditorValue>(defaultFeeEditorValue);
  const [extraFeeEditor, setExtraFeeEditor] = useState<FeeEditorValue>(defaultFeeEditorValue);
  const [note, setNote] = useState('');
  const [isExchange, setIsExchange] = useState(false);
  const [exchangeFields, setExchangeFields] = useState<ExchangeFieldValues>(() => defaultExchangeFieldValues());
  const [linkToAccount, setLinkToAccount] = useState(true);
  const [accountDirection, setAccountDirection] = useState<'in' | 'out'>('out');
  const [pending, setPending] = useState(defaultPending);
  const [sendWhatsApp, setSendWhatsApp] = useState(defaultPending);

  const fundAccount = getFundAccountName(fundId);
  const exchangeParsed = parseExchangeFieldValues(exchangeFields);
  const parsedAmount = exchangeParsed.paidAmount;
  const parsedRate = exchangeParsed.rate;
  const exchangeResult = exchangeParsed.receivedAmount;
  const paidCurrency = exchangeFields.paidCurrency;
  const receivedCurrency = exchangeFields.receivedCurrency;

  const counterpartyTrimmed = counterparty.trim();
  const matchedAccount = counterpartyNames.find(n => n === counterpartyTrimmed);
  const canLink = !!matchedAccount;
  const shamelEligible = isShamelFeeEligible(matchedAccount ?? counterpartyTrimmed);

  function reset() {
    setDirection('out');
    setLines(createDefaultLines());
    setCounterparty('');
    setIntermediary('');
    setFeeEditor(defaultFeeEditorValue());
    setExtraFeeEditor(defaultFeeEditorValue());
    setNote('');
    setIsExchange(false);
    setExchangeFields(defaultExchangeFieldValues());
    setPending(defaultPending);
    setSendWhatsApp(defaultPending);
    setLinkToAccount(true);
    setAccountDirection('out');
  }

  function setFundDirection(next: 'in' | 'out') {
    setDirection(next);
    setAccountDirection(next);
  }

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsedFee = buildFeeFromEditor(feeEditor, feeBaseAmount);
    const parsedExtraFee = shamelEligible ? buildFeeFromEditor(extraFeeEditor, extraFeeBaseAmount) : undefined;
    const feeFields = feeFieldsFromParsed(parsedFee);
    const extraFeeFields = extraFeeFieldsFromParsed(parsedExtraFee);
    const shared = {
      fundId,
      date: todayIso(),
      intermediary: formatIntermediary(intermediary),
      ...feeFields,
      ...extraFeeFields,
      note: note.trim() || undefined,
      status: (pending ? 'pending' : 'posted') as Transaction['status'],
    };

    let payload: Transaction | Transaction[];

    if (isExchange) {
      if (!exchangeParsed.valid) return;
      payload = linkToAccount && canLink && matchedAccount
        ? createLinkedAccountFundExchange(
          shared,
          matchedAccount,
          paidCurrency,
          parsedAmount,
          receivedCurrency,
          parsedRate,
          exchangeResult,
        )
        : createTransaction({
          ...shared,
          ledger: 'fund',
          party: fundAccount,
          currency: paidCurrency,
          kind: 'exchange',
          amount: parsedAmount,
          counterparty: counterpartyTrimmed || 'تبديل',
          exchangeToCurrency: receivedCurrency,
          exchangeRate: parsedRate,
          exchangeToAmount: exchangeResult,
        });
    } else {
      const items = parseAmountLines(lines);
      if (!items.length) return;

      if (linkToAccount && canLink) {
        payload = createLinkedFundAccountOperation(
          shared,
          counterpartyTrimmed,
          direction,
          items,
          counterpartyTrimmed,
          accountDirection,
          [parsedFee, parsedExtraFee],
        );
      } else {
        payload = createTransactionBatch(
          {
            ...shared,
            ledger: 'fund',
            party: fundAccount,
            kind: inferKind(direction, false),
            counterparty: counterpartyTrimmed || undefined,
          },
          items,
        );
      }
    }

    const wasPending = pending;
    const txs = Array.isArray(payload) ? payload : [payload];
    const targets = (whatsappDestinations ?? []).map(s => s.trim()).filter(Boolean);
    const shouldWhatsApp = sendWhatsApp && targets.length > 0;
    const lead = txs[0];
    const whatsappMessage = shouldWhatsApp
      ? (wasPending
        ? buildPendingWhatsAppMessage(fundId, txs, actorName)
        : getApprovalWhatsAppLine(lead.kind))
      : undefined;
    const enriched = txs.map((t, i) => (
      i === 0 && wasPending && whatsappMessage ? { ...t, pendingWhatsAppMessage: whatsappMessage } : t
    ));
    const toSave = Array.isArray(payload) ? enriched : enriched[0];

    try {
      await Promise.resolve(onAdd(toSave));
      if (shouldWhatsApp && whatsappMessage) {
        onPendingWhatsApp?.({ message: whatsappMessage, destinations: targets });
      }
      reset();
      setOpen(false);
    } catch {
      // فشل الحفظ — لا نفتح واتساب
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-slate-900 transition hover:bg-amber-400"
      >
        <Plus size={18} />
        حركة صندوق
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-amber-400">دخل / خرج الصندوق</h3>
          <p className="text-xs text-slate-500">{fundAccount}</p>
        </div>
        <button type="button" onClick={() => { reset(); setOpen(false); }} className="text-slate-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => { setFundDirection('in'); setIsExchange(false); }}
          className={`rounded-xl py-2 text-sm font-medium ${direction === 'in' && !isExchange ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
          استلام
        </button>
        <button type="button" onClick={() => { setFundDirection('out'); setIsExchange(false); }}
          className={`rounded-xl py-2 text-sm font-medium ${direction === 'out' && !isExchange ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
          دفع
        </button>
        <button type="button" onClick={() => setIsExchange(true)}
          className={`rounded-xl py-2 text-sm font-medium ${isExchange ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
          تبديل
        </button>
      </div>

      {isExchange ? (
        <>
          <ExchangeFields values={exchangeFields} onChange={setExchangeFields} />
          <input type="text" placeholder="ملاحظة طرف (اختياري)" value={counterparty} onChange={e => setCounterparty(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" list="counterparty-names" />
          {counterpartyNames.length > 0 && (
            <select
              value={matchedAccount ?? ''}
              onChange={e => setCounterparty(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm"
            >
              <option value="">اختر حساب موجود...</option>
              {counterpartyNames.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          )}
          {canLink && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-emerald-300/90">
                <input type="checkbox" checked={linkToAccount} onChange={e => setLinkToAccount(e.target.checked)} className="rounded" />
                نفّذ أيضاً على حساب {matchedAccount}
              </label>
              {linkToAccount && (
                <LinkedAccountDirectionPicker direction={accountDirection} onChange={setAccountDirection} />
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <AmountLinesEditor lines={lines} onChange={setLines} />
          {counterpartyNames.length > 0 && (
            <select
              value={matchedAccount ?? ''}
              onChange={e => setCounterparty(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm"
            >
              <option value="">اختر حساب موجود...</option>
              {counterpartyNames.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          )}
          <input type="text" placeholder="الطرف / الحساب (أو اكتب اسم جديد)" value={counterparty} onChange={e => setCounterparty(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" list="counterparty-names" />
          {canLink && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-emerald-300/90">
                <input type="checkbox" checked={linkToAccount} onChange={e => setLinkToAccount(e.target.checked)} className="rounded" />
                نفّذ أيضاً على حساب {matchedAccount}
              </label>
              {linkToAccount && (
                <LinkedAccountDirectionPicker direction={accountDirection} onChange={setAccountDirection} />
              )}
            </div>
          )}
        </>
      )}

      <datalist id="counterparty-names">
        {counterpartyNames.map(n => <option key={n} value={n} />)}
      </datalist>

      <input type="text" placeholder="بيد (اختياري)" value={intermediary} onChange={e => setIntermediary(e.target.value)}
        className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" />

      <FeeEditor
        value={feeEditor}
        onChange={setFeeEditor}
        baseAmount={feeBaseAmount}
        availableCurrencies={feeLineCurrencies.length ? feeLineCurrencies : undefined}
      />

      {shamelEligible && (
        <FeeEditor
          value={extraFeeEditor}
          onChange={setExtraFeeEditor}
          baseAmount={extraFeeBaseAmount}
          availableCurrencies={feeLineCurrencies.length ? feeLineCurrencies : undefined}
          title="عمولات شاملة"
          hintOurs="تُخصم من مبلغ حساب الزبون وتُسجَّل على حساب «عمولات شاملة»"
          hintCustomer="تُضاف على مبلغ حساب الزبون فقط — ما بتروح لـ «عمولات شاملة»"
        />
      )}

      <input type="text" placeholder="ملاحظة (اختياري)" value={note} onChange={e => setNote(e.target.value)}
        className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" />

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={pending} onChange={e => setPending(e.target.checked)} className="rounded" />
        حطها بقيد الانتظار
      </label>

      {(whatsappDestinations?.length ?? 0) > 0 ? (
        <label className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={sendWhatsApp} onChange={e => setSendWhatsApp(e.target.checked)} className="rounded" />
          أرسل رسالة على واتساب
          <span className="text-xs text-emerald-400">
            ({whatsappDestinations!.length} كروب/رقم — {pending ? 'رسالة انتظار' : 'تم الاستلام/الدفع/التبديل'})
          </span>
        </label>
      ) : (
        <p className="text-xs text-amber-400">ما في كروبات واتساب لهالصندوق — ضبطها من الإدارة</p>
      )}

      <button type="submit" className="w-full rounded-xl bg-amber-500 py-2.5 font-semibold text-slate-900 hover:bg-amber-400">
        حفظ على حساب الصندوق
      </button>
    </form>
  );
}
