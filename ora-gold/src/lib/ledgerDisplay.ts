import type { EntryKind, LedgerEntry } from '../types';

/** عناوين العمودين المعروضين (col1, col2) */
export function getColumnHeaders(entryKind: EntryKind): [string, string] {
  switch (entryKind) {
    case 'profit':
      return ['خسارة', 'ربح'];
    case 'inout':
      return ['دخول', 'خروج'];
    case 'expense':
      return ['مدفوع', 'مرتجع'];
    case 'partner':
      return ['Debit', 'Credit'];
    default:
      return ['مدفوع له', 'مستلم منه'];
  }
}

/**
 * قيم العرض — بعض الأنواع تخزّن debit/credit معكوساً عن ترتيب Excel:
 * - expense: مدفوع=credit، مرتجع=debit
 * - inout: دخول=credit، خروج=debit
 */
export function getDisplayValues(entry: LedgerEntry, entryKind: EntryKind): { col1?: number; col2?: number } {
  switch (entryKind) {
    case 'expense':
    case 'inout':
      return { col1: entry.credit, col2: entry.debit };
    default:
      return { col1: entry.debit, col2: entry.credit };
  }
}

/** تحويل حقول النموذج (col1=العمود الأول، col2=الثاني) إلى debit/credit مخزّن */
export function formValuesToLedger(
  entryKind: EntryKind,
  col1?: number,
  col2?: number,
): { debit?: number; credit?: number } {
  switch (entryKind) {
    case 'expense':
    case 'inout':
      return { credit: col1, debit: col2 };
    default:
      return { debit: col1, credit: col2 };
  }
}

/** ترتيب صف Excel: [تاريخ، col1، col2، رصيد، بيان] */
export function entryToExcelRow(e: LedgerEntry, entryKind: EntryKind): (string | number)[] {
  const { col1, col2 } = getDisplayValues(e, entryKind);
  return [e.date, col1 ?? '', col2 ?? '', e.balance, e.description];
}

/** تسميات حقول النموذج — col1 ثم col2 */
export function getFormLabels(entryKind: EntryKind): { col1: string; col2: string } {
  const [col1, col2] = getColumnHeaders(entryKind);
  return { col1, col2 };
}
