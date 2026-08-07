import { formatAmount } from './utils';
import type { Currency, Transaction } from '../types';

/** 5000 ل.س جديدة = 500000 ل.س قديمة */
export const NSYP_TO_SYP_RATE = 100;

export function isNsyp(currency: Currency): boolean {
  return currency === 'NSYP';
}

export function convertNsypToSyp(amount: number): number {
  return amount * NSYP_TO_SYP_RATE;
}

export function formatNsypConversionHint(nsypAmount: number): string {
  if (!nsypAmount) return '';
  return `= ${formatAmount(convertNsypToSyp(nsypAmount), 'SYP')} ل.س قديمة`;
}

function nsypConversionNote(nsypAmount: number): string {
  return `تحويل: ${formatAmount(nsypAmount, 'NSYP')} ل.س ج → ${formatAmount(convertNsypToSyp(nsypAmount), 'SYP')} ل.س`;
}

function appendNote(existing: string | undefined, addition: string): string {
  if (!existing?.trim()) return addition;
  if (existing.includes(addition)) return existing;
  return `${existing} · ${addition}`;
}

/** يحوّل NSYP إلى SYP قبل الحفظ — الرصيد الأساسي بالليرة القديمة */
export function normalizeSyrianTransaction<T extends Partial<Transaction>>(tx: T): T {
  let next = { ...tx };
  const notes: string[] = [];

  if (next.currency === 'NSYP' && next.amount != null) {
    notes.push(nsypConversionNote(next.amount));
    let rate = next.exchangeRate;
    if (next.kind === 'exchange' && rate && next.exchangeToCurrency && next.exchangeToCurrency !== 'NSYP') {
      rate = rate / NSYP_TO_SYP_RATE;
    }
    next = {
      ...next,
      currency: 'SYP',
      amount: convertNsypToSyp(next.amount),
      exchangeRate: rate,
    };
  }

  if (next.exchangeToCurrency === 'NSYP' && next.exchangeToAmount != null) {
    notes.push(nsypConversionNote(next.exchangeToAmount));
    let rate = next.exchangeRate;
    if (rate) rate = rate * NSYP_TO_SYP_RATE;
    next = {
      ...next,
      exchangeToCurrency: 'SYP',
      exchangeToAmount: convertNsypToSyp(next.exchangeToAmount),
      exchangeRate: rate,
    };
  }

  if (next.feeCurrency === 'NSYP' && next.feeAmount != null) {
    notes.push(nsypConversionNote(next.feeAmount));
    next = {
      ...next,
      feeCurrency: 'SYP',
      feeAmount: convertNsypToSyp(next.feeAmount),
    };
  }

  if (next.extraFeeCurrency === 'NSYP' && next.extraFeeAmount != null) {
    notes.push(nsypConversionNote(next.extraFeeAmount));
    next = {
      ...next,
      extraFeeCurrency: 'SYP',
      extraFeeAmount: convertNsypToSyp(next.extraFeeAmount),
    };
  }

  if (next.halabRemittance?.deliveryCurrency === 'NSYP') {
    const raw = next.halabRemittance.deliveryAmount?.replace(/,/g, '') ?? '';
    const amount = Number(raw);
    if (amount > 0) {
      notes.push(nsypConversionNote(amount));
      next = {
        ...next,
        halabRemittance: {
          ...next.halabRemittance,
          deliveryCurrency: 'SYP',
          deliveryAmount: String(convertNsypToSyp(amount)),
        },
      };
    }
  }

  if (notes.length) {
    const unique = [...new Set(notes)];
    next = { ...next, note: appendNote(next.note, unique.join(' · ')) };
  }

  return next;
}

export function syrianBalanceCurrency(currency: Currency): Currency {
  return currency === 'NSYP' ? 'SYP' : currency;
}

export function syrianBalanceAmount(currency: Currency, amount: number): number {
  return currency === 'NSYP' ? convertNsypToSyp(amount) : amount;
}

export function repairNsypToSypTransactions(transactions: Transaction[]): {
  transactions: Transaction[];
  changed: Transaction[];
} {
  const changed: Transaction[] = [];
  const next = transactions.map(tx => {
    const before = JSON.stringify({
      currency: tx.currency,
      amount: tx.amount,
      exchangeToCurrency: tx.exchangeToCurrency,
      exchangeToAmount: tx.exchangeToAmount,
      feeCurrency: tx.feeCurrency,
      feeAmount: tx.feeAmount,
    });
    const fixed = normalizeSyrianTransaction(tx) as Transaction;
    const after = JSON.stringify({
      currency: fixed.currency,
      amount: fixed.amount,
      exchangeToCurrency: fixed.exchangeToCurrency,
      exchangeToAmount: fixed.exchangeToAmount,
      feeCurrency: fixed.feeCurrency,
      feeAmount: fixed.feeAmount,
    });
    if (before !== after) changed.push(fixed);
    return fixed;
  });
  return { transactions: next, changed };
}

/** عملات تظهر في بطاقات الرصيد — السوري القديم فقط */
export function isBalanceDisplayCurrency(currency: Currency): boolean {
  return currency !== 'NSYP';
}
