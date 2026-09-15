import type { Currency, Transaction } from '../types';

/** عامل تحويل الليرة القديمة المخزّنة (SYP) إلى الليرة الموحّدة */
export const LEGACY_OLD_SYP_FACTOR = 100;

export const SYRIAN_UNIFIED_NOTE = 'توحيد ليرة سورية';

function appendNote(existing: string | undefined, addition: string): string {
  if (!existing?.trim()) return addition;
  if (existing.includes(addition)) return existing;
  return `${existing} · ${addition}`;
}

function isSyrianCurrency(currency: Currency | undefined): boolean {
  return currency === 'SYP' || currency === 'NSYP';
}

/** عامل تحويل المبلغ المخزّن إلى الليرة الموحّدة */
function legacyAmountScale(currency: Currency | undefined): number {
  if (currency === 'NSYP') return 1;
  if (currency === 'SYP') return 1 / LEGACY_OLD_SYP_FACTOR;
  return 1;
}

function scaleSyrianAmount(currency: Currency | undefined, amount: number | undefined): number | undefined {
  if (amount == null) return amount;
  return amount * legacyAmountScale(currency);
}

/** يوحّد NSYP → SYP عند الحفظ — بدون تحويل قديم/جديد */
export function normalizeSyrianTransaction<T extends Partial<Transaction>>(tx: T): T {
  let next = { ...tx };

  if (next.currency === 'NSYP') next = { ...next, currency: 'SYP' };
  if (next.exchangeToCurrency === 'NSYP') next = { ...next, exchangeToCurrency: 'SYP' };
  if (next.feeCurrency === 'NSYP') next = { ...next, feeCurrency: 'SYP' };
  if (next.extraFeeCurrency === 'NSYP') next = { ...next, extraFeeCurrency: 'SYP' };
  if (next.halabRemittance?.deliveryCurrency === 'NSYP') {
    next = {
      ...next,
      halabRemittance: { ...next.halabRemittance, deliveryCurrency: 'SYP' },
    };
  }

  return next;
}

export function syrianBalanceCurrency(currency: Currency): Currency {
  return currency === 'NSYP' ? 'SYP' : currency;
}

export function syrianBalanceAmount(_currency: Currency, amount: number): number {
  return amount;
}

export function transactionNeedsSyrianUnification(tx: Transaction): boolean {
  if (tx.note?.includes(SYRIAN_UNIFIED_NOTE)) return false;
  if (tx.currency === 'NSYP' || tx.exchangeToCurrency === 'NSYP') return true;
  if (tx.feeCurrency === 'NSYP' || tx.extraFeeCurrency === 'NSYP') return true;
  if (tx.halabRemittance?.deliveryCurrency === 'NSYP') return true;
  if (tx.currency === 'SYP' || tx.exchangeToCurrency === 'SYP') return true;
  if (tx.feeCurrency === 'SYP' || tx.extraFeeCurrency === 'SYP') return true;
  if (tx.halabRemittance?.deliveryCurrency === 'SYP') return true;
  return false;
}

export function transactionsNeedSyrianUnification(transactions: Transaction[]): boolean {
  return transactions.some(transactionNeedsSyrianUnification);
}

function migrateSyrianTransaction(tx: Transaction): Transaction {
  if (tx.note?.includes(SYRIAN_UNIFIED_NOTE)) return tx;

  const origPaid = tx.currency;
  const origReceived = tx.exchangeToCurrency;
  const paidScale = legacyAmountScale(origPaid);
  const receivedScale = legacyAmountScale(origReceived);

  let next: Transaction = { ...tx };

  if (origPaid === 'NSYP') {
    next.currency = 'SYP';
  } else if (origPaid === 'SYP' && next.amount != null) {
    next.amount = scaleSyrianAmount(origPaid, next.amount)!;
  }

  if (origReceived === 'NSYP') {
    next.exchangeToCurrency = 'SYP';
  } else if (origReceived === 'SYP' && next.exchangeToAmount != null) {
    next.exchangeToAmount = scaleSyrianAmount(origReceived, next.exchangeToAmount)!;
  }

  if (next.kind === 'exchange' && next.exchangeRate && (isSyrianCurrency(origPaid) || isSyrianCurrency(origReceived))) {
    next.exchangeRate = next.exchangeRate * (receivedScale / paidScale);
  }

  if (tx.feeCurrency === 'NSYP') {
    next.feeCurrency = 'SYP';
  } else if (tx.feeCurrency === 'SYP' && next.feeAmount != null) {
    next.feeAmount = scaleSyrianAmount('SYP', next.feeAmount)!;
  }

  if (tx.extraFeeCurrency === 'NSYP') {
    next.extraFeeCurrency = 'SYP';
  } else if (tx.extraFeeCurrency === 'SYP' && next.extraFeeAmount != null) {
    next.extraFeeAmount = scaleSyrianAmount('SYP', next.extraFeeAmount)!;
  }

  if (tx.halabRemittance) {
    const deliveryCurrency = tx.halabRemittance.deliveryCurrency;
    if (deliveryCurrency === 'NSYP') {
      next = {
        ...next,
        halabRemittance: { ...tx.halabRemittance, deliveryCurrency: 'SYP' },
      };
    } else if (deliveryCurrency === 'SYP') {
      const raw = tx.halabRemittance.deliveryAmount?.replace(/,/g, '') ?? '';
      const amount = Number(raw);
      if (amount > 0) {
        next = {
          ...next,
          halabRemittance: {
            ...tx.halabRemittance,
            deliveryAmount: String(scaleSyrianAmount('SYP', amount)!),
          },
        };
      }
    }
  }

  next = normalizeSyrianTransaction(next) as Transaction;
  next.note = appendNote(next.note, SYRIAN_UNIFIED_NOTE);
  return next;
}

/** ترحيل لمرة واحدة: الليرة القديمة ÷100 والجديدة (NSYP) → SYP بنفس القيمة */
export function repairUnifiedSyrianCurrency(transactions: Transaction[]): {
  transactions: Transaction[];
  changed: Transaction[];
} {
  const changed: Transaction[] = [];
  const next = transactions.map(tx => {
    if (!transactionNeedsSyrianUnification(tx)) return tx;
    const fixed = migrateSyrianTransaction(tx);
    changed.push(fixed);
    return fixed;
  });
  return { transactions: next, changed };
}

/** @deprecated استخدم repairUnifiedSyrianCurrency */
export function repairNsypToSypTransactions(transactions: Transaction[]): {
  transactions: Transaction[];
  changed: Transaction[];
} {
  return repairUnifiedSyrianCurrency(transactions);
}

export function isBalanceDisplayCurrency(_currency: Currency): boolean {
  return true;
}
