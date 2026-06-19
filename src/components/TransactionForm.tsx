import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CURRENCIES, getFundAccountName, getValueInputLabel, isWeightCurrency } from '../config';
import { buildPendingWhatsAppMessage, getApprovalWhatsAppLine } from '../lib/whatsapp';
import {
  calcExchangeAmount,
  createLinkedFundAccountOperation,
  createTransaction,
  createTransactionBatch,
  exchangeRateLabel,
  formatValueWithUnit,
  inferKind,
  todayIso,
} from '../lib/utils';
import type { Currency, FundId, Transaction } from '../types';
import { AmountLinesEditor, createDefaultLines, parseAmountLines } from './AmountLinesEditor';

interface Props {
  fundId: FundId;
  onAdd: (tx: Transaction | Transaction[]) => void | Promise<void>;
  defaultPending?: boolean;
  counterpartyNames?: string[];
  whatsappDestinations?: string[];
  actorName?: string;
  onPendingWhatsApp?: (payload: { message: string; destinations: string[] }) => void;
}

function assetOptionLabel(c: (typeof CURRENCIES)[number]) {
  return c.kind === 'weight' ? `${c.label} (وزن بالغرام)` : `${c.label} (${c.symbol})`;
}

export function TransactionForm({ fundId, onAdd, defaultPending = false, counterpartyNames = [], whatsappDestinations, actorName, onPendingWhatsApp }: Props) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [lines, setLines] = useState(createDefaultLines);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [intermediary, setIntermediary] = useState('');
  const [note, setNote] = useState('');
  const [isExchange, setIsExchange] = useState(false);
  const [pending, setPending] = useState(defaultPending);
  const [sendWhatsApp, setSendWhatsApp] = useState(defaultPending);
  const [toCurrency, setToCurrency] = useState<Currency>('LBP');
  const [rate, setRate] = useState('');
  const [linkToAccount, setLinkToAccount] = useState(true);

  const fundAccount = getFundAccountName(fundId);
  const parsedAmount = Number(amount.replace(/,/g, '')) || 0;
  const parsedRate = Number(rate.replace(/,/g, '')) || 0;
  const exchangeResult = calcExchangeAmount(parsedAmount, parsedRate);
  const amountStep = isWeightCurrency(currency) ? '0.01' : '1';
  const valueLabel = getValueInputLabel(currency);
  const toValueLabel = getValueInputLabel(toCurrency);

  const counterpartyTrimmed = counterparty.trim();
  const canLink = useMemo(
    () => !!counterpartyTrimmed && counterpartyNames.some(n => n === counterpartyTrimmed),
    [counterpartyTrimmed, counterpartyNames],
  );

  function reset() {
    setDirection('in');
    setLines(createDefaultLines());
    setCurrency('USD');
    setToCurrency('LBP');
    setAmount('');
    setRate('');
    setCounterparty('');
    setIntermediary('');
    setNote('');
    setIsExchange(false);
    setPending(defaultPending);
    setSendWhatsApp(defaultPending);
    setLinkToAccount(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const shared = {
      fundId,
      date: todayIso(),
      intermediary: intermediary.trim() || undefined,
      note: note.trim() || undefined,
      status: (pending ? 'pending' : 'posted') as Transaction['status'],
    };

    let payload: Transaction | Transaction[];

    if (isExchange) {
      if (!parsedAmount || !parsedRate || !toCurrency || currency === toCurrency) return;
      payload = createTransaction({
        ...shared,
        ledger: 'fund',
        party: fundAccount,
        currency,
        kind: 'exchange',
        amount: parsedAmount,
        counterparty: counterpartyTrimmed || 'تبديل',
        exchangeToCurrency: toCurrency,
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
        <button type="button" onClick={() => { setDirection('in'); setIsExchange(false); }}
          className={`rounded-xl py-2 text-sm font-medium ${direction === 'in' && !isExchange ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
          استلام
        </button>
        <button type="button" onClick={() => { setDirection('out'); setIsExchange(false); }}
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
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 space-y-3">
            <p className="text-xs font-medium text-violet-300">تبديل داخل الصندوق</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">من</label>
                <select value={currency} onChange={e => setCurrency(e.target.value as Currency)}
                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm">
                  {CURRENCIES.map(c => <option key={c.id} value={c.id}>{assetOptionLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">{valueLabel}</label>
                <input type="number" min="0" step={amountStep} placeholder="0" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">إلى</label>
                <select value={toCurrency} onChange={e => setToCurrency(e.target.value as Currency)}
                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm">
                  {CURRENCIES.filter(c => c.id !== currency).map(c => (
                    <option key={c.id} value={c.id}>{assetOptionLabel(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">{exchangeRateLabel(currency, toCurrency)}</label>
                <input type="number" min="0" step="any" placeholder="الريت" value={rate} onChange={e => setRate(e.target.value)}
                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" required />
              </div>
            </div>
            {parsedAmount > 0 && parsedRate > 0 && (
              <div className="rounded-xl bg-slate-900/80 px-3 py-2.5 text-sm">
                <span className="text-slate-400">{toValueLabel}: </span>
                <span className="font-bold text-violet-300">
                  {formatValueWithUnit(exchangeResult, toCurrency)}
                </span>
              </div>
            )}
          </div>
          <input type="text" placeholder="ملاحظة طرف (اختياري)" value={counterparty} onChange={e => setCounterparty(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" list="counterparty-names" />
        </>
      ) : (
        <>
          <AmountLinesEditor lines={lines} onChange={setLines} />
          <input type="text" placeholder="الطرف / الحساب" value={counterparty} onChange={e => setCounterparty(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" list="counterparty-names" />
          {canLink && (
            <label className="flex items-center gap-2 text-sm text-emerald-300/90">
              <input type="checkbox" checked={linkToAccount} onChange={e => setLinkToAccount(e.target.checked)} className="rounded" />
              حدّث حساب {counterpartyTrimmed} مع الصندوق
            </label>
          )}
        </>
      )}

      <datalist id="counterparty-names">
        {counterpartyNames.map(n => <option key={n} value={n} />)}
      </datalist>

      <input type="text" placeholder="بيد (اختياري)" value={intermediary} onChange={e => setIntermediary(e.target.value)}
        className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm" />

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
