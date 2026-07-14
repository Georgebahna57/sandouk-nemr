import { CURRENCIES, isWeightCurrency } from '../config';
import type { Currency, CustomerBalances } from '../types';

/** قيمة 1 وحدة (أو 1 غرام) بالدولار الأمريكي */
export type ValuationRates = Partial<Record<Currency, number>>;

export type AccountValuationMode = 'breakdown' | 'usd' | 'gold';

const STORAGE_KEY = 'sandouk-valuation-rates-v1';

/** عملات يُعرض فيها الريت كـ «1 USD = X» بدل USD لكل وحدة */
export const INVERSE_RATE_CURRENCIES = new Set<Currency>(['LBP', 'SYP']);

export const DEFAULT_VALUATION_RATES: ValuationRates = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.72,
  SAR: 0.27,
  QAR: 0.27,
  KWD: 3.25,
  JOD: 1.41,
  AED: 0.27,
  SYP: 1 / 15000,
  LBP: 1 / 89500,
  GOLD: 95,
  SILVER: 1.1,
};

export function loadValuationRatesLocal(): ValuationRates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VALUATION_RATES };
    return normalizeValuationRates(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_VALUATION_RATES };
  }
}

export function saveValuationRatesLocal(rates: ValuationRates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeValuationRates(rates)));
}

export function normalizeValuationRates(raw: unknown): ValuationRates {
  const base = { ...DEFAULT_VALUATION_RATES };
  if (!raw || typeof raw !== 'object') return base;
  for (const c of CURRENCIES) {
    const value = (raw as Record<string, unknown>)[c.id];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      base[c.id] = value;
    }
  }
  base.USD = 1;
  return base;
}

export function mergeValuationRates(base: ValuationRates, overrides?: ValuationRates): ValuationRates {
  if (!overrides) return base;
  return normalizeValuationRates({ ...base, ...overrides });
}

export function getUsdPerUnit(currency: Currency, rates: ValuationRates): number {
  if (currency === 'USD') return 1;
  return rates[currency] ?? DEFAULT_VALUATION_RATES[currency] ?? 0;
}

export function convertAmountToUsd(amount: number, currency: Currency, rates: ValuationRates): number {
  return amount * getUsdPerUnit(currency, rates);
}

export function convertUsdToGoldGrams(usd: number, rates: ValuationRates): number {
  const goldRate = getUsdPerUnit('GOLD', rates);
  if (!goldRate) return 0;
  return usd / goldRate;
}

export function sumBalancesInUsd(balances: CustomerBalances, rates: ValuationRates): number {
  let total = 0;
  for (const c of CURRENCIES) {
    const balance = balances[c.id]?.balance ?? 0;
    if (balance === 0) continue;
    total += convertAmountToUsd(balance, c.id, rates);
  }
  return total;
}

export interface ValuationLine {
  currency: Currency;
  label: string;
  balance: number;
  usdValue: number;
  rateLabel: string;
}

export function buildValuationLines(balances: CustomerBalances, rates: ValuationRates): ValuationLine[] {
  const lines: ValuationLine[] = [];
  for (const c of CURRENCIES) {
    const balance = balances[c.id]?.balance ?? 0;
    if (balance === 0) continue;
    lines.push({
      currency: c.id,
      label: c.label,
      balance,
      usdValue: convertAmountToUsd(balance, c.id, rates),
      rateLabel: formatRateLabel(c.id, rates),
    });
  }
  return lines;
}

export function formatRateLabel(currency: Currency, rates: ValuationRates): string {
  if (currency === 'USD') return '1 $ = 1 $';
  const usdPerUnit = getUsdPerUnit(currency, rates);
  if (!usdPerUnit) return '—';
  if (INVERSE_RATE_CURRENCIES.has(currency)) {
    const localPerUsd = Math.round(1 / usdPerUnit);
    return `1 $ = ${localPerUsd.toLocaleString('en-US')}`;
  }
  if (isWeightCurrency(currency)) {
    return `1 غ = ${usdPerUnit.toLocaleString('en-US', { maximumFractionDigits: 2 })} $`;
  }
  return `1 ${CURRENCIES.find(c => c.id === currency)?.symbol ?? currency} = ${usdPerUnit.toLocaleString('en-US', { maximumFractionDigits: 4 })} $`;
}

/** إدخال المستخدم — إما USD لكل وحدة أو «1 USD = X» لليرة */
export function readRateInput(currency: Currency, raw: string): number | undefined {
  const parsed = Number(raw.replace(/,/g, '').trim());
  if (!parsed || !Number.isFinite(parsed) || parsed <= 0) return undefined;
  if (INVERSE_RATE_CURRENCIES.has(currency)) return 1 / parsed;
  return parsed;
}

export function rateInputValue(currency: Currency, rates: ValuationRates): string {
  const usdPerUnit = getUsdPerUnit(currency, rates);
  if (!usdPerUnit) return '';
  if (INVERSE_RATE_CURRENCIES.has(currency)) {
    return String(Math.round(1 / usdPerUnit));
  }
  if (Number.isInteger(usdPerUnit)) return String(usdPerUnit);
  return String(Number(usdPerUnit.toFixed(6)));
}

export function rateInputLabel(currency: Currency): string {
  const asset = CURRENCIES.find(c => c.id === currency);
  if (!asset) return currency;
  if (INVERSE_RATE_CURRENCIES.has(currency)) return `1 $ = ؟ ${asset.symbol}`;
  if (isWeightCurrency(currency)) return `1 غ ${asset.label} = ؟ $`;
  return `1 ${asset.symbol} = ؟ $`;
}
