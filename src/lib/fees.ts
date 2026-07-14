import { getCurrencySymbol } from '../config';
import type { Currency, FeeMode, FeeSide, Transaction } from '../types';
import { formatAmount } from './utils';

const FEE_META_PREFIX = '[[FEE]]';
const EXTRA_FEE_META_PREFIX = '[[XFEE]]';

export interface ParsedFee {
  mode: FeeMode;
  rate: number;
  side: FeeSide;
  amount: number;
  currency: Currency;
  display: string;
}

interface FeeMeta {
  m: FeeMode;
  r: number;
  s: FeeSide;
  a: number;
  c: Currency;
}

export const DEFAULT_FEE_ACCOUNT = 'اجور';

/** حسابات الزبائن اللي أجورها منفصلة عن حساب «اجور» العام */
export const SEPARATE_FEE_SOURCE_KEYS = ['كندا', 'نور'] as const;

export const SEPARATE_FEE_ACCOUNTS: Record<(typeof SEPARATE_FEE_SOURCE_KEYS)[number], string> = {
  كندا: 'اجور كندا',
  نور: 'اجور نور',
};

/** عمولات شاملة — كندا ونور فقط */
export const SHAMEL_FEE_ACCOUNT = 'عمولات شاملة';

export const ALL_FEE_ACCOUNTS = [
  DEFAULT_FEE_ACCOUNT,
  ...Object.values(SEPARATE_FEE_ACCOUNTS),
  SHAMEL_FEE_ACCOUNT,
] as const;

export function isShamelFeeEligible(name?: string): boolean {
  const key = normalizeFeeSourceAccount(name);
  return key === 'كندا' || key === 'نور';
}

export function normalizeFeeSourceAccount(name?: string): string | undefined {
  if (!name?.trim()) return undefined;
  let n = name.trim().replace(/^حساب\s+/u, '');
  const lower = n.toLowerCase();
  if (lower === 'canada' || n === 'كندا') return 'كندا';
  if (n === 'نور') return 'نور';
  return n;
}

export function resolveFeeAccountName(sourceAccount?: string): string {
  const key = normalizeFeeSourceAccount(sourceAccount);
  if (key === 'كندا') return SEPARATE_FEE_ACCOUNTS.كندا;
  if (key === 'نور') return SEPARATE_FEE_ACCOUNTS.نور;
  return DEFAULT_FEE_ACCOUNT;
}

export function isFeeAccountName(name: string): boolean {
  const trimmed = name.trim();
  return (ALL_FEE_ACCOUNTS as readonly string[]).includes(trimmed);
}

export function isAutoFeeTransaction(tx: Transaction): boolean {
  return !!tx.feeSourceId && tx.ledger === 'account' && isFeeAccountName(tx.party);
}

export function inferFeeSourceAccount(operationTxs: Transaction[]): string | undefined {
  const linked = operationTxs.find(
    t => t.ledger === 'account' && !isFeeAccountName(t.party) && !t.feeSourceId,
  );
  if (linked) return linked.party;
  const fundLead = operationTxs.find(t => t.ledger === 'fund');
  return fundLead?.counterparty;
}

/** مبلغ الحساب بعد الأجور — لنا: يُخصم | له: يُضاف */
export function accountAmountAfterFee(
  grossAmount: number,
  fee: ParsedFee | undefined,
  itemCurrency: Currency,
): number {
  if (!fee || fee.amount <= 0 || fee.currency !== itemCurrency) {
    return grossAmount;
  }
  const net = fee.side === 'ours'
    ? grossAmount - fee.amount
    : grossAmount + fee.amount;
  return Math.max(0, Math.round(net * 100) / 100);
}

/** عكس accountAmountAfterFee — لاستعادة المبلغ الإجمالي من الصافي */
export function accountGrossAmount(
  netAmount: number,
  fees: (ParsedFee | undefined)[],
  itemCurrency: Currency,
): number {
  return fees.reduce((amount, fee) => {
    if (!fee || fee.amount <= 0 || fee.currency !== itemCurrency) return amount;
    const gross = fee.side === 'ours'
      ? amount + fee.amount
      : amount - fee.amount;
    return Math.max(0, Math.round(gross * 100) / 100);
  }, netAmount);
}

/** @deprecated use accountAmountAfterFee */
export function accountAmountAfterCustomerFee(
  _accountKind: 'receipt' | 'payment',
  grossAmount: number,
  fee: ParsedFee | undefined,
  itemCurrency: Currency,
): number {
  return accountAmountAfterFee(grossAmount, fee, itemCurrency);
}

export function adjustAccountItemsForFees(
  items: { currency: Currency; amount: number }[],
  fees: (ParsedFee | undefined)[],
): { currency: Currency; amount: number }[] {
  return fees.reduce(
    (acc, fee) => adjustAccountItemsForFee(acc, fee),
    items,
  );
}

function adjustAccountItemsForFee(
  items: { currency: Currency; amount: number }[],
  fee: ParsedFee | undefined,
): { currency: Currency; amount: number }[] {
  if (!fee || fee.amount <= 0) return items;
  let applied = false;
  return items.map(item => {
    if (applied || item.currency !== fee.currency) return item;
    applied = true;
    return {
      ...item,
      amount: accountAmountAfterFee(item.amount, fee, item.currency),
    };
  });
}

/** @deprecated use adjustAccountItemsForFees */
export function adjustAccountItemsForCustomerFee(
  items: { currency: Currency; amount: number }[],
  _accountKind: 'receipt' | 'payment',
  fee: ParsedFee | undefined,
): { currency: Currency; amount: number }[] {
  return adjustAccountItemsForFee(items, fee);
}

/** @deprecated use adjustAccountItemsForFees */
export function adjustAccountItemsForCustomerFees(
  items: { currency: Currency; amount: number }[],
  _accountKind: 'receipt' | 'payment',
  fees: (ParsedFee | undefined)[],
): { currency: Currency; amount: number }[] {
  return adjustAccountItemsForFees(items, fees);
}

export function feeSideLabel(side: FeeSide): string {
  return side === 'ours' ? 'لنا' : 'للزبون';
}

export function feeModeLabel(mode: FeeMode): string {
  if (mode === 'fixed') return 'مبلغ ثابت';
  if (mode === 'percent') return 'نسبة %';
  return 'بالألف ‰';
}

export function calcFeeAmount(mode: FeeMode, rate: number, baseAmount: number): number {
  if (!rate || !baseAmount) return mode === 'fixed' ? rate : 0;
  switch (mode) {
    case 'fixed':
      return Math.round(rate * 100) / 100;
    case 'percent':
      return Math.round(baseAmount * rate / 100 * 100) / 100;
    case 'per_mille':
      return Math.round(baseAmount * rate / 1000 * 100) / 100;
  }
}

export function sumAmountForCurrency(
  items: { currency: Currency; amount: number }[],
  currency: Currency,
): number {
  return items
    .filter(item => item.currency === currency)
    .reduce((sum, item) => sum + item.amount, 0);
}

export function formatFeeDisplay(fee: ParsedFee): string {
  const sym = getCurrencySymbol(fee.currency);
  const amountText = `${formatAmount(fee.amount, fee.currency)} ${sym}`;
  const side = feeSideLabel(fee.side);
  if (fee.mode === 'fixed') return `${amountText} — ${side}`;
  if (fee.mode === 'percent') return `${fee.rate}% = ${amountText} — ${side}`;
  return `${fee.rate}‰ = ${amountText} — ${side}`;
}

export function buildParsedFee(
  mode: FeeMode,
  rate: number,
  side: FeeSide,
  currency: Currency,
  baseAmount: number,
): ParsedFee | undefined {
  if (!rate) return undefined;
  const amount = calcFeeAmount(mode, rate, baseAmount);
  if (!amount) return undefined;
  const fee: ParsedFee = { mode, rate, side, amount, currency, display: '' };
  fee.display = formatFeeDisplay(fee);
  return fee;
}

export function serializeFee(fee: ParsedFee): string {
  const meta: FeeMeta = { m: fee.mode, r: fee.rate, s: fee.side, a: fee.amount, c: fee.currency };
  return `${FEE_META_PREFIX}${JSON.stringify(meta)}`;
}

export function serializeExtraFee(fee: ParsedFee): string {
  const meta: FeeMeta = { m: fee.mode, r: fee.rate, s: fee.side, a: fee.amount, c: fee.currency };
  return `${EXTRA_FEE_META_PREFIX}${JSON.stringify(meta)}`;
}

function parseFeeBlob(raw: string | undefined, prefix: string): ParsedFee | undefined {
  const trimmed = raw?.trim();
  if (!trimmed?.startsWith(prefix)) return undefined;
  try {
    const meta = JSON.parse(trimmed.slice(prefix.length)) as FeeMeta;
    if (!meta.m || meta.r == null || !meta.s || meta.a == null || !meta.c) return undefined;
    const fee: ParsedFee = {
      mode: meta.m,
      rate: meta.r,
      side: meta.s,
      amount: meta.a,
      currency: meta.c,
      display: '',
    };
    fee.display = formatFeeDisplay(fee);
    return fee;
  } catch {
    return undefined;
  }
}

export function parseStoredFee(raw?: string): ParsedFee | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  const structured = parseFeeBlob(trimmed, FEE_META_PREFIX);
  if (structured) return structured;

  const legacyAmount = Number(trimmed.replace(/,/g, ''));
  if (legacyAmount > 0 && /^\d/.test(trimmed)) {
    const fee: ParsedFee = {
      mode: 'fixed',
      rate: legacyAmount,
      side: 'ours',
      amount: legacyAmount,
      currency: 'USD',
      display: trimmed,
    };
    return fee;
  }

  return { mode: 'fixed', rate: 0, side: 'ours', amount: 0, currency: 'USD', display: trimmed };
}

export function parseStoredExtraFee(raw?: string): ParsedFee | undefined {
  return parseFeeBlob(raw, EXTRA_FEE_META_PREFIX);
}

export function resolveTransactionExtraFee(tx?: Transaction): ParsedFee | undefined {
  if (!tx) return undefined;
  if (
    tx.extraFeeMode
    && tx.extraFeeRate != null
    && tx.extraFeeSide
    && tx.extraFeeAmount != null
    && tx.extraFeeCurrency
  ) {
    const fee: ParsedFee = {
      mode: tx.extraFeeMode,
      rate: tx.extraFeeRate,
      side: tx.extraFeeSide,
      amount: tx.extraFeeAmount,
      currency: tx.extraFeeCurrency,
      display: '',
    };
    fee.display = formatFeeDisplay(fee);
    return fee;
  }
  return parseStoredExtraFee(tx.extraFee);
}

export function attachExtraFeeFields(tx: Transaction): Transaction {
  const parsed = parseStoredExtraFee(tx.extraFee);
  if (!parsed || parsed.amount <= 0) {
    if (!parsed?.display || parsed.amount > 0) return tx;
    return { ...tx, extraFee: parsed.display };
  }
  return {
    ...tx,
    extraFee: parsed.display,
    extraFeeMode: parsed.mode,
    extraFeeRate: parsed.rate,
    extraFeeSide: parsed.side,
    extraFeeAmount: parsed.amount,
    extraFeeCurrency: parsed.currency,
  };
}

export function resolveTransactionFee(tx?: Transaction): ParsedFee | undefined {
  if (!tx) return undefined;
  if (tx.feeMode && tx.feeRate != null && tx.feeSide && tx.feeAmount != null && tx.feeCurrency) {
    const fee: ParsedFee = {
      mode: tx.feeMode,
      rate: tx.feeRate,
      side: tx.feeSide,
      amount: tx.feeAmount,
      currency: tx.feeCurrency,
      display: '',
    };
    fee.display = formatFeeDisplay(fee);
    return fee;
  }
  return parseStoredFee(tx.fee);
}

export function attachFeeFields(tx: Transaction): Transaction {
  const parsed = parseStoredFee(tx.fee);
  if (!parsed || parsed.amount <= 0) {
    if (!parsed?.display || parsed.amount > 0) return tx;
    return { ...tx, fee: parsed.display };
  }
  return {
    ...tx,
    fee: parsed.display,
    feeMode: parsed.mode,
    feeRate: parsed.rate,
    feeSide: parsed.side,
    feeAmount: parsed.amount,
    feeCurrency: parsed.currency,
  };
}

export function feeFieldsFromParsed(fee: ParsedFee | undefined): Pick<
  Transaction,
  'fee' | 'feeMode' | 'feeRate' | 'feeSide' | 'feeAmount' | 'feeCurrency'
> {
  if (!fee) {
    return {
      fee: undefined,
      feeMode: undefined,
      feeRate: undefined,
      feeSide: undefined,
      feeAmount: undefined,
      feeCurrency: undefined,
    };
  }
  return {
    fee: serializeFee(fee),
    feeMode: fee.mode,
    feeRate: fee.rate,
    feeSide: fee.side,
    feeAmount: fee.amount,
    feeCurrency: fee.currency,
  };
}

export function extraFeeFieldsFromParsed(fee: ParsedFee | undefined): Pick<
  Transaction,
  'extraFee' | 'extraFeeMode' | 'extraFeeRate' | 'extraFeeSide' | 'extraFeeAmount' | 'extraFeeCurrency'
> {
  if (!fee) {
    return {
      extraFee: undefined,
      extraFeeMode: undefined,
      extraFeeRate: undefined,
      extraFeeSide: undefined,
      extraFeeAmount: undefined,
      extraFeeCurrency: undefined,
    };
  }
  return {
    extraFee: serializeExtraFee(fee),
    extraFeeMode: fee.mode,
    extraFeeRate: fee.rate,
    extraFeeSide: fee.side,
    extraFeeAmount: fee.amount,
    extraFeeCurrency: fee.currency,
  };
}

export function extraFeeToDbValue(tx: Pick<
  Transaction,
  'extraFee' | 'extraFeeMode' | 'extraFeeRate' | 'extraFeeSide' | 'extraFeeAmount' | 'extraFeeCurrency'
>): string | undefined {
  if (
    tx.extraFeeMode
    && tx.extraFeeRate != null
    && tx.extraFeeSide
    && tx.extraFeeAmount != null
    && tx.extraFeeCurrency
  ) {
    return serializeExtraFee({
      mode: tx.extraFeeMode,
      rate: tx.extraFeeRate,
      side: tx.extraFeeSide,
      amount: tx.extraFeeAmount,
      currency: tx.extraFeeCurrency,
      display: '',
    });
  }
  const raw = tx.extraFee?.trim();
  return raw || undefined;
}

export function formatExtraFee(value?: string): string | undefined {
  const parsed = parseStoredExtraFee(value);
  if (parsed?.display) return parsed.display;
  return value?.trim() || undefined;
}

export function formatTransactionFees(tx: Transaction): string | undefined {
  const parts: string[] = [];
  const main = resolveTransactionFee(tx)?.display ?? tx.fee?.trim();
  const extra = resolveTransactionExtraFee(tx)?.display ?? tx.extraFee?.trim();
  if (main) parts.push(`أجور: ${main}`);
  if (extra) parts.push(`عمولات شاملة: ${extra}`);
  return parts.length ? parts.join(' · ') : undefined;
}

export function feeToDbValue(tx: Pick<
  Transaction,
  'fee' | 'feeMode' | 'feeRate' | 'feeSide' | 'feeAmount' | 'feeCurrency'
>): string | undefined {
  if (tx.feeMode && tx.feeRate != null && tx.feeSide && tx.feeAmount != null && tx.feeCurrency) {
    return serializeFee({
      mode: tx.feeMode,
      rate: tx.feeRate,
      side: tx.feeSide,
      amount: tx.feeAmount,
      currency: tx.feeCurrency,
      display: '',
    });
  }
  const raw = tx.fee?.trim();
  return raw || undefined;
}

export function computeOurFeesByCurrency(
  transactions: Transaction[],
  fundId: Transaction['fundId'],
  opts?: { dateFrom?: string; dateTo?: string; status?: Transaction['status'] },
): Partial<Record<Currency, number>> {
  const seen = new Set<string>();
  const totals: Partial<Record<Currency, number>> = {};

  for (const tx of transactions) {
    if (tx.fundId !== fundId || tx.ledger !== 'fund') continue;
    if (opts?.status && tx.status !== opts.status) continue;
    if (opts?.dateFrom && tx.date < opts.dateFrom) continue;
    if (opts?.dateTo && tx.date > opts.dateTo) continue;

    const opKey = tx.linkId ?? tx.batchId ?? tx.id;
    if (seen.has(opKey)) continue;
    seen.add(opKey);

    const fee = resolveTransactionFee(tx);
    if (fee && fee.amount > 0 && fee.side === 'ours') {
      totals[fee.currency] = (totals[fee.currency] ?? 0) + fee.amount;
    }
    const extraFee = resolveTransactionExtraFee(tx);
    if (extraFee && extraFee.amount > 0 && extraFee.side === 'ours') {
      totals[extraFee.currency] = (totals[extraFee.currency] ?? 0) + extraFee.amount;
    }
  }

  return totals;
}
