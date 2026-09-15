import type { Currency } from '../types';
import { normalizeAccountNumber } from './accountMerge';
import { num, type TrialBalanceImportAccount } from './trialBalanceImport';

const PDF_CURRENCY: Record<string, Currency> = {
  USD: 'USD',
  EUR: 'EUR',
  SYP: 'SYP',
  SYL: 'SYP',
  NSYP: 'SYP',
  LBP: 'LBP',
  GOLD: 'GOLD',
  SILVER: 'SILVER',
  Silver: 'SILVER',
  AED: 'AED',
  GBP: 'GBP',
  CAD: 'CAD',
  SAR: 'SAR',
  QAR: 'QAR',
  KWD: 'KWD',
  JOD: 'JOD',
};

/** سطر أو مقطع ميزان مراجعة — حسابات ورقية (تنتهي بـ 1) */
const RECORD_RE = /(.+?)\s+_\s+_\s+([A-Za-z][A-Za-z.]*)\s+(\d{3,4})\s+([-]?[\d,]+\.?\d*)\s+(\d+)\s+1(?=\s|$)/g;

const LINE_TAIL_RE = /\s([A-Za-z][A-Za-z.]*)\s+(\d{3,4})\s+([-]?[\d,]+\.?\d*)\s+(\d+)\s+1\s*$/;

function pdfCurrencyToAppCurrency(raw: string): Currency | null {
  return PDF_CURRENCY[raw.trim()] ?? null;
}

function isSkippableLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^--\s+\d+\s+of\s+\d+\s+--$/i.test(t)) return true;
  if (/Page\s+\d+\s+of\s+\d+/i.test(t)) return true;
  if (/Account No\./i.test(t)) return true;
  if (/Account Name/i.test(t)) return true;
  if (/Prev\.\s*Balance/i.test(t)) return true;
  if (t === 'Trial Balance' || t === 'Main' || t === '.') return true;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(t)) return true;
  if (/^(Date|Time|For Transactions|Evaluated By)\s*:/i.test(t)) return true;
  if (/^Between\s*:/i.test(t)) return true;
  return false;
}

function looksLikePdfHeaderGarbage(name: string): boolean {
  return /Page\s+\d+\s+of\s+\d+/i.test(name)
    || /Account No\./i.test(name)
    || /Account Name/i.test(name)
    || /Prev\.\s*Balance/i.test(name);
}

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (LINE_TAIL_RE.test(t)) return false;
  return /^\S.+\t\d{3,4}$/.test(t) || /^\S.+\s+\d{3,4}$/.test(t);
}

function cleanAccountName(raw: string): string {
  return raw
    .replace(/Page\s+\d+\s+of\s+\d+[\s\S]*?(?=(?:USD|EUR|SYP|SYL|NSYP|LBP|GOLD|SILVER|AED|GBP|CAD|SAR|QAR|KWD|JOD)\s+\d{3,4}\s)/gi, '')
    .replace(/Account No\.\s*Account Name[\s\S]*?Prev\.\s*Balance\s*/gi, '')
    .replace(/\s+[-]?[\d,]+\.?\d*(\s+[-]?[\d,]+\.?\d*)*\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNamePrefix(line: string): string {
  const beforeMarker = line.split('_ _')[0] ?? line.split(/_\s+_/)[0] ?? line;
  const tabPart = beforeMarker.split('\t')[0] ?? beforeMarker;
  return cleanAccountName(tabPart);
}

function pickBetterName(current: string, candidate: string): string {
  const a = current.trim();
  const b = candidate.trim();
  if (!a) return b;
  if (!b) return a;
  const aGarbage = looksLikePdfHeaderGarbage(a);
  const bGarbage = looksLikePdfHeaderGarbage(b);
  if (aGarbage && !bGarbage) return b;
  if (bGarbage && !aGarbage) return a;
  if (aGarbage && bGarbage) return b.length <= a.length ? b : a;
  return b.length > a.length ? b : a;
}

interface ParsedRow {
  code: string;
  name: string;
  currency: Currency;
  balance: number;
}

function parseRecordMatch(nameRaw: string, currencyRaw: string, parent: string, balanceRaw: string, sub: string): ParsedRow | null {
  const currency = pdfCurrencyToAppCurrency(currencyRaw);
  if (!currency) return null;
  const name = cleanAccountName(nameRaw);
  if (!name || looksLikePdfHeaderGarbage(name)) return null;
  return {
    code: `${parent}-${sub}`,
    name,
    currency,
    balance: num(balanceRaw),
  };
}

function parseFlatPdfText(text: string): ParsedRow[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  const rows: ParsedRow[] = [];
  for (const match of normalized.matchAll(RECORD_RE)) {
    const row = parseRecordMatch(match[1], match[2], match[3], match[4], match[5]);
    if (row) rows.push(row);
  }
  return rows;
}

function parseLineBasedPdfText(text: string): ParsedRow[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const rows: ParsedRow[] = [];
  let pendingName = '';

  for (const line of lines) {
    if (isSkippableLine(line)) {
      pendingName = '';
      continue;
    }

    const tail = line.match(LINE_TAIL_RE);
    if (tail && tail[5] === '1') {
      const row = parseRecordMatch(
        [pendingName, extractNamePrefix(line)].filter(Boolean).join(' '),
        tail[1],
        tail[2],
        tail[3],
        tail[4],
      );
      if (row) rows.push(row);
      pendingName = '';
      continue;
    }

    if (isSectionHeader(line)) {
      pendingName = '';
      continue;
    }

    const trimmed = line.trim();
    if (trimmed && !LINE_TAIL_RE.test(trimmed)) {
      pendingName = pendingName ? `${pendingName} ${trimmed}` : trimmed;
    } else {
      pendingName = '';
    }
  }

  return rows;
}

/** يدمج صفوف PDF لنفس رقم الحساب (عملات متعددة) */
export function mergeTrialBalanceByAccountNumber(
  rows: ParsedRow[],
): TrialBalanceImportAccount[] {
  const map = new Map<string, TrialBalanceImportAccount>();

  for (const row of rows) {
    const key = normalizeAccountNumber(row.code);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        code: row.code,
        name: row.name,
        currencies: { [row.currency]: { debit: 0, credit: 0, balance: row.balance } },
      });
      continue;
    }
    existing.name = pickBetterName(existing.name, row.name);
    existing.currencies[row.currency] = { debit: 0, credit: 0, balance: row.balance };
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

/** يحلّل نص ميزان مراجعة مُستخرج من PDF */
export function parseTrialBalancePdfText(text: string): TrialBalanceImportAccount[] {
  const flatRows = parseFlatPdfText(text);
  const rows = flatRows.length > 0 ? flatRows : parseLineBasedPdfText(text);
  return mergeTrialBalanceByAccountNumber(rows);
}
