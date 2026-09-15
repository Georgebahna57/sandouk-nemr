import {
  loadValuationRatesLocal,
  normalizeValuationRates,
  saveValuationRatesLocal,
  type ValuationRates,
} from './valuationRates';
import { supabase } from './supabase';

const VALUATION_KEY = 'valuation_rates';
const SYRIAN_UNIFIED_KEY = 'syrian_currency_unified_v1';
const SYRIAN_UNIFIED_LOCAL = 'sandouk-syrian-unified-v1';

async function readSettingValue(key: string): Promise<unknown | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.warn('app_settings:', error.message);
    return null;
  }
  return data?.value ?? null;
}

export function isSyrianCurrencyUnifiedLocal(): boolean {
  try {
    return localStorage.getItem(SYRIAN_UNIFIED_LOCAL) === '1';
  } catch {
    return false;
  }
}

function markSyrianCurrencyUnifiedLocal() {
  try {
    localStorage.setItem(SYRIAN_UNIFIED_LOCAL, '1');
  } catch {
    // تجاهل
  }
}

export async function isSyrianCurrencyUnified(): Promise<boolean> {
  if (isSyrianCurrencyUnifiedLocal()) return true;
  const value = await readSettingValue(SYRIAN_UNIFIED_KEY);
  if (value === true || value === 'true' || value === 1) {
    markSyrianCurrencyUnifiedLocal();
    return true;
  }
  return false;
}

export async function markSyrianCurrencyUnified(): Promise<void> {
  markSyrianCurrencyUnifiedLocal();
  if (!supabase) return;
  const { error } = await supabase.from('app_settings').upsert({
    key: SYRIAN_UNIFIED_KEY,
    value: true,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.warn('app_settings save:', error.message);
    if (error.message.includes('app_settings') || error.code === 'PGRST205' || error.code === '42P01') {
      return;
    }
    throw error;
  }
}

export async function fetchValuationRates(): Promise<ValuationRates> {
  const local = loadValuationRatesLocal();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', VALUATION_KEY)
    .maybeSingle();

  if (error) {
    console.warn('app_settings:', error.message);
    return local;
  }

  if (!data?.value) return local;
  const merged = normalizeValuationRates(data.value);
  saveValuationRatesLocal(merged);
  return merged;
}

export async function saveValuationRates(rates: ValuationRates): Promise<void> {
  const normalized = normalizeValuationRates(rates);
  saveValuationRatesLocal(normalized);
  if (!supabase) return;

  const { error } = await supabase.from('app_settings').upsert({
    key: VALUATION_KEY,
    value: normalized,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.warn('app_settings save:', error.message);
    if (error.message.includes('app_settings') || error.code === 'PGRST205' || error.code === '42P01') {
      return;
    }
    throw error;
  }
}
