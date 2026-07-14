import {
  loadValuationRatesLocal,
  normalizeValuationRates,
  saveValuationRatesLocal,
  type ValuationRates,
} from './valuationRates';
import { supabase } from './supabase';

const VALUATION_KEY = 'valuation_rates';

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
