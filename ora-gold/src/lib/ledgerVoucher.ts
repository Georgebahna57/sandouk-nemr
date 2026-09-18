import type { CurrencySide, EntryKind, LedgerEntry } from '../types';
import { formValuesToLedger, getColumnHeaders } from './ledgerDisplay';

export type VoucherLineDirection = 'col1' | 'col2';

export interface VoucherLineInput {
  side: CurrencySide;
  direction: VoucherLineDirection;
  amount: number;
}

export interface LedgerVoucherInput {
  invoiceNumber: string;
  date: string;
  description: string;
  lines: VoucherLineInput[];
}

function buildLineDescription(
  invoiceNumber: string,
  baseDescription: string,
  side: CurrencySide,
  directionLabel: string,
  amount: number,
): string {
  const prefix = `ف ${invoiceNumber}`;
  const detail = `${side === 'gold' ? 'ذهب' : 'دولار'} — ${directionLabel} ${amount}`;
  return baseDescription.trim() ? `${prefix} | ${baseDescription.trim()} | ${detail}` : `${prefix} | ${detail}`;
}

export function voucherToLedgerEntries(
  entryKind: EntryKind,
  voucher: LedgerVoucherInput,
): Array<{ side: CurrencySide; entry: Omit<LedgerEntry, 'id' | 'balance'> }> {
  return voucher.lines
    .filter((l) => l.amount > 0)
    .map((line) => {
      const [col1Label, col2Label] = getColumnHeaders(entryKind, line.side);
      const directionLabel = line.direction === 'col1' ? col1Label : col2Label;
      const col1 = line.direction === 'col1' ? line.amount : undefined;
      const col2 = line.direction === 'col2' ? line.amount : undefined;
      const { debit, credit } = formValuesToLedger(entryKind, col1, col2, line.side);
      return {
        side: line.side,
        entry: {
          date: voucher.date,
          debit,
          credit,
          description: buildLineDescription(voucher.invoiceNumber, voucher.description, line.side, directionLabel, line.amount),
        },
      };
    });
}

export function extractInvoiceNumbers(entries: LedgerEntry[]): string[] {
  const nums = new Set<string>();
  for (const e of entries) {
    const m = e.description.match(/ف\s*(\d+)/);
    if (m) nums.add(m[1]);
  }
  return [...nums];
}
