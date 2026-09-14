import type { Transaction } from '../types';

export const TRIAL_BALANCE_IMPORT_NOTE = 'استيراد ميزان مراجعة';
export const TRIAL_BALANCE_OPENING_NOTE = 'رصيد مرحّل - استيراد';

/** نسخة بدون تشكيل — بعض الاستيرادات القديمة */
const TRIAL_BALANCE_OPENING_NOTE_PLAIN = 'رصيد مرحل - استيراد';

export function isTrialBalanceImportNote(note?: string): boolean {
  const n = note ?? '';
  return n.includes(TRIAL_BALANCE_IMPORT_NOTE)
    || n.includes(TRIAL_BALANCE_OPENING_NOTE)
    || n.includes(TRIAL_BALANCE_OPENING_NOTE_PLAIN);
}

export function isTrialBalanceImportTransaction(tx: Pick<Transaction, 'note'>): boolean {
  return isTrialBalanceImportNote(tx.note);
}
