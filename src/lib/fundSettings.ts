import type { FundId } from '../types';
import { parseWhatsAppDestinations } from './whatsapp';
import { supabase } from './supabase';

export type FundWhatsAppMap = Partial<Record<FundId, string[]>>;

const STORAGE_KEY = 'sandouk-fund-whatsapp-v2';

function normalizeMap(raw: unknown): FundWhatsAppMap {
  if (!raw || typeof raw !== 'object') return {};
  const map: FundWhatsAppMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const list = value.map(String).map(s => s.trim()).filter(Boolean);
      if (list.length) map[key as FundId] = list;
    } else if (typeof value === 'string' && value.trim()) {
      map[key as FundId] = parseWhatsAppDestinations(value);
    }
  }
  return map;
}

export function loadFundWhatsAppLocal(): FundWhatsAppMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeMap(JSON.parse(raw));

    const legacy = localStorage.getItem('sandouk-fund-whatsapp');
    if (!legacy) return {};
    const old = normalizeMap(JSON.parse(legacy));
    saveFundWhatsAppLocal(old);
    return old;
  } catch {
    return {};
  }
}

function saveFundWhatsAppLocal(map: FundWhatsAppMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function rowToDestinations(row: {
  whatsapp_destinations?: string[] | null;
  whatsapp_phone?: string | null;
}): string[] {
  const fromJson = Array.isArray(row.whatsapp_destinations)
    ? row.whatsapp_destinations.map(String).map(s => s.trim()).filter(Boolean)
    : [];
  if (fromJson.length) return fromJson;
  const legacy = row.whatsapp_phone?.trim();
  return legacy ? [legacy] : [];
}

export async function fetchFundWhatsAppPhones(): Promise<FundWhatsAppMap> {
  const local = loadFundWhatsAppLocal();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from('fund_settings')
    .select('fund_id, whatsapp_phone, whatsapp_destinations');

  if (error) {
    console.warn('fund_settings:', error.message);
    return local;
  }

  const map: FundWhatsAppMap = { ...local };
  for (const row of data ?? []) {
    const list = rowToDestinations(row);
    if (list.length) map[row.fund_id as FundId] = list;
  }
  saveFundWhatsAppLocal(map);
  return map;
}

export async function saveFundWhatsAppPhones(map: FundWhatsAppMap): Promise<void> {
  saveFundWhatsAppLocal(map);
  if (!supabase) return;

  const rows = (Object.entries(map) as [FundId, string[] | undefined][]).map(([fund_id, destinations]) => {
    const list = (destinations ?? []).map(s => s.trim()).filter(Boolean);
    return {
      fund_id,
      whatsapp_destinations: list.length ? list : null,
      whatsapp_phone: list[0] ?? null,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase.from('fund_settings').upsert(rows);
  if (error) {
    console.warn('fund_settings save:', error.message);
    if (error.message.includes('fund_settings') || error.code === 'PGRST205' || error.code === '42P01') {
      return;
    }
    throw error;
  }
}
