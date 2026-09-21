import type { CurrencySide, EntryKind, LedgerEntry } from '../types';

/** نوع العرض الفعلي حسب الحساب — بعض الأوراق هجينة (زبائن) */
export function resolveLedgerKind(accountId: string, side: CurrencySide, accountEntryKind: EntryKind): EntryKind {
  if (accountId === 'trading') return 'trading';
  if (accountId === 'wages18' || accountId === 'wages21') return 'worked';
  if (accountId === 'customers') return side === 'gold' ? 'standard' : 'inout';
  return accountEntryKind;
}

/** عناوين العمودين المعروضين (col1, col2) — مطابقة لـ Excel */
export function getColumnHeaders(entryKind: EntryKind, side: CurrencySide = 'gold'): [string, string] {
  switch (entryKind) {
    case 'trading':
      return side === 'usd' ? ['شراء', 'بيع'] : ['بيع', 'شراء'];
    case 'worked':
      return side === 'usd' ? ['تسليم', 'استلام'] : ['مستلم من تصنيع', 'تسليم زبائن'];
    case 'profit':
      return side === 'usd' ? ['مدفوع', 'مستلم'] : ['خسارة', 'ربح'];
    case 'inout':
      return ['دخول', 'خروج'];
    case 'expense':
      return ['مدفوع', 'مرتجع'];
    case 'partner':
      return ['Debit', 'Credit'];
    case 'manufacturing':
      return ['تسليم', 'استلام'];
    default:
      return side === 'usd' ? ['لنا', 'علينا'] : ['مدفوع له', 'مستلم منه'];
  }
}

/**
 * هل العمود الأول (col1) يُخزَّن في credit؟
 * - expense: مدفوع=credit، مرتجع=debit
 * - inout: دخول=credit، خروج=debit
 * - standard/usd: لنا=credit، علينا=debit
 */
function col1IsCredit(entryKind: EntryKind, side: CurrencySide): boolean {
  if (entryKind === 'expense' || entryKind === 'inout') return true;
  if (entryKind === 'standard' && side === 'usd') return true;
  return false;
}

export function getDisplayValues(
  entry: LedgerEntry,
  entryKind: EntryKind,
  side: CurrencySide = 'gold',
): { col1?: number; col2?: number } {
  if (col1IsCredit(entryKind, side)) {
    return { col1: entry.credit, col2: entry.debit };
  }
  return { col1: entry.debit, col2: entry.credit };
}

/** تحويل حقول النموذج (col1=العمود الأول، col2=الثاني) إلى debit/credit مخزّن */
export function formValuesToLedger(
  entryKind: EntryKind,
  col1?: number,
  col2?: number,
  side: CurrencySide = 'gold',
): { debit?: number; credit?: number } {
  if (col1IsCredit(entryKind, side)) {
    return { credit: col1, debit: col2 };
  }
  return { debit: col1, credit: col2 };
}

/** مجموع الأعمدة والرصيد النهائي */
export function calcLedgerTotals(
  entries: LedgerEntry[],
  entryKind: EntryKind,
  side: CurrencySide = 'gold',
): { sumCol1: number; sumCol2: number; balance: number } {
  let sumCol1 = 0;
  let sumCol2 = 0;
  for (const e of entries) {
    const { col1, col2 } = getDisplayValues(e, entryKind, side);
    sumCol1 += col1 ?? 0;
    sumCol2 += col2 ?? 0;
  }
  return {
    sumCol1,
    sumCol2,
    balance: entries.length ? entries[entries.length - 1].balance : 0,
  };
}

/** ترتيب صف Excel: [تاريخ، col1، col2، رصيد، بيان] */
export function entryToExcelRow(
  e: LedgerEntry,
  entryKind: EntryKind,
  side: CurrencySide = 'gold',
): (string | number)[] {
  const { col1, col2 } = getDisplayValues(e, entryKind, side);
  return [e.date, col1 ?? '', col2 ?? '', e.balance, e.description];
}

/** تسميات حقول النموذج — col1 ثم col2 */
export function getFormLabels(entryKind: EntryKind, side: CurrencySide = 'gold'): { col1: string; col2: string } {
  const [col1, col2] = getColumnHeaders(entryKind, side);
  return { col1, col2 };
}
