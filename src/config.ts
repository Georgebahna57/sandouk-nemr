import type { Currency, CustomerBalances, Fund, FundBalances, FundId } from './types';

export type AssetKind = 'money' | 'weight';

export interface AssetConfig {
  id: Currency;
  label: string;
  symbol: string;
  kind: AssetKind;
  unit: string;
}

export const FUNDS: Fund[] = [
  { id: 'nemr', name: 'صندوق نمر', shortName: 'نمر', accent: '#f59e0b' },
  { id: 'tiger', name: 'صندوق تايغر', shortName: 'تايغر', accent: '#f97316' },
  { id: 'aura', name: 'صندوق اورا', shortName: 'اورا', accent: '#8b5cf6' },
  { id: 'zalqa', name: 'صندوق زلقا', shortName: 'زلقا', accent: '#10b981' },
  { id: 'george', name: 'صندوق جورج', shortName: 'جورج', accent: '#3b82f6' },
];

export const CURRENCIES: AssetConfig[] = [
  { id: 'USD', label: 'دولار أمريكي', symbol: '$', kind: 'money', unit: 'مبلغ' },
  { id: 'EUR', label: 'يورو', symbol: '€', kind: 'money', unit: 'مبلغ' },
  { id: 'GBP', label: 'جنيه استرليني', symbol: '£', kind: 'money', unit: 'مبلغ' },
  { id: 'CAD', label: 'دولار كندي', symbol: 'C$', kind: 'money', unit: 'مبلغ' },
  { id: 'SAR', label: 'ريال سعودي', symbol: 'ر.س', kind: 'money', unit: 'مبلغ' },
  { id: 'QAR', label: 'ريال قطري', symbol: 'ر.ق', kind: 'money', unit: 'مبلغ' },
  { id: 'KWD', label: 'دينار كويتي', symbol: 'د.ك', kind: 'money', unit: 'مبلغ' },
  { id: 'JOD', label: 'دينار أردني', symbol: 'د.أ', kind: 'money', unit: 'مبلغ' },
  { id: 'AED', label: 'درهم إماراتي', symbol: 'د.إ', kind: 'money', unit: 'مبلغ' },
  { id: 'SYP', label: 'ليرة سورية', symbol: 'ل.س', kind: 'money', unit: 'مبلغ' },
  { id: 'LBP', label: 'ليرة لبنانية', symbol: 'ل.ل.', kind: 'money', unit: 'مبلغ' },
  { id: 'GOLD', label: 'ذهب', symbol: 'غ', kind: 'weight', unit: 'غرام' },
  { id: 'SILVER', label: 'فضة', symbol: 'غ', kind: 'weight', unit: 'غرام' },
];

export function getFund(id: FundId) {
  return FUNDS.find(f => f.id === id) ?? FUNDS[0];
}

/** اسم حساب الصندوق الافتراضي — رصيد الصندوق = رصيد هالحساب فقط */
export function getFundAccountName(fundId: FundId): string {
  return getFund(fundId).name;
}

const FUND_ACCOUNT_NAMES = new Set(FUNDS.map(f => f.name));

export function isFundAccountName(name: string): boolean {
  return FUND_ACCOUNT_NAMES.has(name.trim());
}

export function getAsset(currency: Currency) {
  return CURRENCIES.find(c => c.id === currency);
}

export function isWeightCurrency(currency: Currency): boolean {
  return getAsset(currency)?.kind === 'weight';
}

export function getCurrencyLabel(currency: Currency) {
  return getAsset(currency)?.label ?? currency;
}

export function getCurrencySymbol(currency: Currency) {
  return getAsset(currency)?.symbol ?? currency;
}

export function getValueInputLabel(currency: Currency): string {
  const asset = getAsset(currency);
  if (asset?.kind === 'weight') return `الوزن (${asset.unit})`;
  return 'المبلغ';
}

export function emptyBalances(): FundBalances {
  const zero = { receipts: 0, payments: 0, balance: 0 };
  return Object.fromEntries(CURRENCIES.map(c => [c.id, { ...zero }])) as FundBalances;
}

export function emptyCustomerBalances(): CustomerBalances {
  const zero = { receipts: 0, payments: 0, balance: 0 };
  return Object.fromEntries(CURRENCIES.map(c => [c.id, { ...zero }])) as CustomerBalances;
}
