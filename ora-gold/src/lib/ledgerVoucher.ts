import type { CurrencySide, EntryKind, LedgerEntry } from '../types';
import { ACCOUNTS, getAccountDef, getAccountNavLabel } from './accountsConfig';
import { formValuesToLedger, getColumnHeaders, resolveLedgerKind } from './ledgerDisplay';

export type VoucherLineDirection = 'col1' | 'col2';

export interface VoucherLineInput {
  side: CurrencySide;
  direction: VoucherLineDirection;
  amount: number;
  /** حساب مقابل — يُرحَّل فيه الاتجاه المعاكس بنفس الكمية */
  offsetAccountId?: string;
}

export interface LedgerVoucherInput {
  invoiceNumber: string;
  date: string;
  description: string;
  lines: VoucherLineInput[];
}

export interface VoucherPosting {
  accountId: string;
  entryKind: EntryKind;
  side: CurrencySide;
  entry: Omit<LedgerEntry, 'id' | 'balance'>;
}

function oppositeDirection(direction: VoucherLineDirection): VoucherLineDirection {
  return direction === 'col1' ? 'col2' : 'col1';
}

function directionLabel(entryKind: EntryKind, side: CurrencySide, direction: VoucherLineDirection): string {
  const [col1Label, col2Label] = getColumnHeaders(entryKind, side);
  return direction === 'col1' ? col1Label : col2Label;
}

function buildLineDescription(
  invoiceNumber: string,
  baseDescription: string,
  accountName: string,
  directionLabel: string,
  amount: number,
  side: CurrencySide,
  linkedAccountName?: string,
  linkedDirectionLabel?: string,
): string {
  const prefix = `ف ${invoiceNumber}`;
  const unit = side === 'gold' ? 'غ' : '$';
  const main = `${accountName} — ${directionLabel} ${amount}${unit}`;
  const detail =
    linkedAccountName && linkedDirectionLabel
      ? `${main} ↔ ${linkedAccountName} — ${linkedDirectionLabel} ${amount}${unit}`
      : main;
  return baseDescription.trim() ? `${prefix} | ${baseDescription.trim()} | ${detail}` : `${prefix} | ${detail}`;
}

function lineToPosting(
  accountId: string,
  entryKind: EntryKind,
  line: VoucherLineInput,
  voucher: LedgerVoucherInput,
  direction: VoucherLineDirection,
  accountName: string,
  linkedAccountName?: string,
  linkedDirectionLabel?: string,
): VoucherPosting {
  const dirLabel = directionLabel(entryKind, line.side, direction);
  const col1 = direction === 'col1' ? line.amount : undefined;
  const col2 = direction === 'col2' ? line.amount : undefined;
  const { debit, credit } = formValuesToLedger(entryKind, col1, col2, line.side);
  const oppositeDir = linkedDirectionLabel ?? directionLabel(entryKind, line.side, oppositeDirection(direction));

  return {
    accountId,
    entryKind,
    side: line.side,
    entry: {
      date: voucher.date,
      debit,
      credit,
      description: buildLineDescription(
        voucher.invoiceNumber,
        voucher.description,
        accountName,
        dirLabel,
        line.amount,
        line.side,
        linkedAccountName,
        linkedAccountName ? oppositeDir : undefined,
      ),
    },
  };
}

export function voucherToLedgerPostings(
  accountId: string,
  entryKind: EntryKind,
  voucher: LedgerVoucherInput,
): VoucherPosting[] {
  const mainDef = getAccountDef(accountId);
  const mainName = mainDef?.nameAr ?? accountId;
  const postings: VoucherPosting[] = [];

  for (const line of voucher.lines.filter((l) => l.amount > 0)) {
    const offsetId = line.offsetAccountId?.trim();
    const offsetDef = offsetId && offsetId !== accountId ? getAccountDef(offsetId) : undefined;
    const offsetName = offsetDef?.nameAr;
    const mainKind = resolveLedgerKind(accountId, line.side, entryKind);
    const offsetKind = offsetDef && offsetId
      ? resolveLedgerKind(offsetId, line.side, offsetDef.entryKind)
      : mainKind;
    const mainDirLabel = directionLabel(mainKind, line.side, line.direction);
    const offsetDirLabel = offsetDef ? directionLabel(offsetKind, line.side, oppositeDirection(line.direction)) : undefined;

    postings.push(
      lineToPosting(accountId, mainKind, line, voucher, line.direction, mainName, offsetName, offsetDirLabel),
    );

    if (offsetDef && offsetId) {
      postings.push(
        lineToPosting(
          offsetId,
          offsetKind,
          line,
          voucher,
          oppositeDirection(line.direction),
          offsetName!,
          mainName,
          mainDirLabel,
        ),
      );
    }
  }

  return postings;
}

/** @deprecated استخدم voucherToLedgerPostings */
export function voucherToLedgerEntries(
  accountId: string,
  entryKind: EntryKind,
  voucher: LedgerVoucherInput,
): Array<{ side: CurrencySide; entry: Omit<LedgerEntry, 'id' | 'balance'> }> {
  return voucherToLedgerPostings(accountId, entryKind, voucher).filter((p) => p.accountId === accountId);
}

export function extractInvoiceNumbers(entries: LedgerEntry[]): string[] {
  const nums = new Set<string>();
  for (const e of entries) {
    const m = e.description.match(/ف\s*(\d+)/);
    if (m) nums.add(m[1]);
  }
  return [...nums];
}

export interface OffsetAccountOption {
  id: string;
  label: string;
}

/** حسابات يمكن الترحيل المقابل إليها */
export function getOffsetAccountOptions(currentAccountId: string, allowUsd: boolean): OffsetAccountOption[] {
  return ACCOUNTS
    .filter((a) => a.id !== currentAccountId)
    .filter((a) => {
      if (allowUsd) return a.entryKind !== 'manufacturing';
      return a.entryKind !== 'manufacturing' && a.id !== 'dollar';
    })
    .map((a) => ({ id: a.id, label: getAccountNavLabel(a) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'));
}
