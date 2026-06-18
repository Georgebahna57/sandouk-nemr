import type { FundId } from '../types';
import { supabase } from './supabase';

export type FundWhatsAppMap = Partial<Record<FundId, string>>;

const STORAGE_KEY = 'sandouk-fund-whatsapp';

export function loadFundWhatsAppLocal(): FundWhatsAppMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FundWhatsAppMap) : {};
  } catch {
    return {};
  }
}

function saveFundWhatsAppLocal(map: FundWhatsAppMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export async function fetchFundWhatsAppPhones(): Promise<FundWhatsAppMap> {
  const local = loadFundWhatsAppLocal();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from('fund_settings')
    .select('fund_id, whatsapp_phone');

  if (error) {
    console.warn('fund_settings:', error.message);
    return local;
  }

  const map: FundWhatsAppMap = { ...local };
  for (const row of data ?? []) {
    const phone = (row.whatsapp_phone as string | null)?.trim();
    if (phone) map[row.fund_id as FundId] = phone;
  }
  saveFundWhatsAppLocal(map);
  return map;
}

export async function saveFundWhatsAppPhones(map: FundWhatsAppMap): Promise<void> {
  saveFundWhatsAppLocal(map);
  if (!supabase) return;

  const rows = (Object.entries(map) as [FundId, string | undefined][]).map(([fund_id, whatsapp_phone]) => ({
    fund_id,
    whatsapp_phone: whatsapp_phone?.trim() || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('fund_settings').upsert(rows);
  if (error) {
    console.warn('fund_settings save:', error.message);
    // الأرقام محفوظة محلياً — يكفي للتجربة على نفس الجهاز
    if (error.message.includes('fund_settings') || error.code === 'PGRST205' || error.code === '42P01') {
      return;
    }
    throw error;
  }
}
