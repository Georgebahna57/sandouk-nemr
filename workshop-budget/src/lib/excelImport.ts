import * as XLSX from 'xlsx';
import { ACCOUNTS, DEFAULT_TREASURY, getAccountBySheet, getBalanceMode } from './accountsConfig';
import { excelDateToIso, parseNum } from './format';
import { newEntryId, recalcBalances } from './ledger';
import type { AccountData, LedgerEntry, TreasuryItem, WorkshopState } from '../types';
import { createEmptyState } from './storage';

function parseLedgerSide(
  rows: unknown[][],
  startCol: number,
  entryKind: string,
  side: 'gold' | 'usd' = 'gold',
  balanceMode: import('../types').BalanceMode = 'credit-minus-debit',
): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const date = excelDateToIso(row[startCol]);
    const desc = String(row[startCol + 4] ?? '').trim();

    let debit: number | undefined;
    let credit: number | undefined;

    if (entryKind === 'profit') {
      debit = parseNum(row[startCol + 1]);
      credit = parseNum(row[startCol + 2]);
    } else if (entryKind === 'expense') {
      // مدفوع يزيد رصيد المصروف، مرتجع ينقصه
      credit = parseNum(row[startCol + 1]);
      debit = parseNum(row[startCol + 2]);
    } else if (entryKind === 'partner') {
      debit = parseNum(row[startCol + 1]);
      credit = parseNum(row[startCol + 2]);
    } else if (entryKind === 'inout') {
      debit = parseNum(row[startCol + 2]); // خروج
      credit = parseNum(row[startCol + 1]); // دخول
    } else if (entryKind === 'manufacturing') {
      debit = parseNum(row[startCol + 1]);
      credit = parseNum(row[startCol + 5]);
    } else if (side === 'usd') {
      // لنا / علينا — العمود الأول زيادة والثاني نقص
      credit = parseNum(row[startCol + 1]);
      debit = parseNum(row[startCol + 2]);
    } else {
      debit = parseNum(row[startCol + 1]);
      credit = parseNum(row[startCol + 2]);
    }

    const descLower = desc.toLowerCase();
    if (descLower.includes('المجموع') || descLower.includes('الرصيد') || desc === 'لنا معكم دولار') continue;
    if (String(row[startCol] ?? '').includes('المجموع') || String(row[startCol] ?? '').includes('الرصيد')) continue;

    if (!date && !debit && !credit && !desc) continue;
    if (!debit && !credit && !desc) continue;

    entries.push({
      id: newEntryId(),
      date,
      debit,
      credit,
      balance: 0,
      description: desc,
    });
  }
  return recalcBalances(entries, balanceMode);
}

function parseManufacturingGold(rows: unknown[][]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const date = excelDateToIso(row[0]);
    const deliver = parseNum(row[1]);
    const receive = parseNum(row[5]);
    const desc = String(row[9] ?? '').trim();
    if (desc.includes('المجموع') || desc.includes('الرصيد') || String(row[0] ?? '').includes('المجموع') || String(row[0] ?? '').includes('الرصيد')) continue;
    if (!date && !deliver && !receive && !desc) continue;
    if (!deliver && !receive && !desc) continue;
    entries.push({
      id: newEntryId(),
      date,
      debit: deliver,
      credit: receive,
      balance: 0,
      description: desc,
      karat750: parseNum(row[2]),
      karat875: parseNum(row[3]),
      karat995: parseNum(row[4]),
    });
  }
  return recalcBalances(entries, 'debit-minus-credit');
}

function parseAccountSheet(rows: unknown[][]): AccountData {
  const sheetName = String(rows[0]?.[0] ?? '');
  const accountDef = getAccountBySheet(sheetName) ?? ACCOUNTS[0];

  let gold: LedgerEntry[];
  let usd: LedgerEntry[];

  if (accountDef.entryKind === 'manufacturing') {
    gold = parseManufacturingGold(rows);
    usd = [];
  } else {
    gold = parseLedgerSide(rows, 0, accountDef.entryKind, 'gold', getBalanceMode(accountDef, 'gold'));
    usd = parseLedgerSide(rows, 6, accountDef.entryKind, 'usd', getBalanceMode(accountDef, 'usd'));
  }

  return { gold, usd };
}

function parseTreasury(rows: unknown[][]): TreasuryItem[] {
  const items: TreasuryItem[] = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row?.[0]) continue;
    const label = String(row[0]).trim();
    if (!label) continue;
    items.push({
      id: `t_${i}`,
      label,
      usd: parseNum(row[1]),
      weight: parseNum(row[2]),
      gold995: parseNum(row[3]),
    });
  }
  return items.length ? items : DEFAULT_TREASURY.map((t) => ({ ...t }));
}

export function importWorkbookFromArrayBuffer(buffer: ArrayBuffer, periodLabel?: string): WorkshopState {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const state = createEmptyState(periodLabel ?? 'imported');

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];

    if (sheetName === 'خزنة رئيسية') {
      state.treasury = parseTreasury(rows);
      continue;
    }

    const accountDef = getAccountBySheet(sheetName);
    if (!accountDef) continue;

    state.accounts[accountDef.id] = parseAccountSheet(rows);
  }

  return state;
}

export async function importExcelFile(file: File): Promise<WorkshopState> {
  const buffer = await file.arrayBuffer();
  const match = file.name.match(/(\d{2}-\d{4})/);
  const period = match?.[1] ?? 'imported';
  return importWorkbookFromArrayBuffer(buffer, period);
}
