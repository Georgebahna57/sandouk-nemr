import { supabase } from './supabase';
import { buildAppBackup, backupSummary, type AppBackup } from './backup';
import type { AppState } from '../types';
import type { ValuationRates } from './valuationRates';
import { todayIso } from './utils';

const LOCAL_DAILY_KEY = 'sandouk-daily-cloud-backup-date';
const KEEP_DAYS = 14;

export type CloudDailyBackupMeta = {
  backupDate: string;
  summary: string;
  createdByName: string | null;
  createdAt: string;
};

function requireClient() {
  if (!supabase) throw new Error('Supabase غير مُعدّ');
  return supabase;
}

export async function fetchTodayCloudBackupExists(date = todayIso()): Promise<boolean> {
  const client = requireClient();
  const { data, error } = await client
    .from('daily_backups')
    .select('backup_date')
    .eq('backup_date', date)
    .maybeSingle();
  if (error) {
    if (error.code === '42P01') return false;
    throw error;
  }
  return Boolean(data);
}

export async function saveDailyCloudBackup(
  state: AppState,
  valuationRates?: ValuationRates,
  createdByName?: string,
): Promise<'saved' | 'exists'> {
  const today = todayIso();
  if (localStorage.getItem(LOCAL_DAILY_KEY) === today) {
    const exists = await fetchTodayCloudBackupExists(today);
    if (exists) return 'exists';
  }

  const exists = await fetchTodayCloudBackupExists(today);
  if (exists) {
    localStorage.setItem(LOCAL_DAILY_KEY, today);
    return 'exists';
  }

  const backup = buildAppBackup(state, valuationRates);
  const client = requireClient();
  const { error } = await client.from('daily_backups').insert({
    backup_date: today,
    payload: backup,
    summary: backupSummary(backup),
    created_by_name: createdByName ?? null,
  });
  if (error) {
    if (error.code === '23505') {
      localStorage.setItem(LOCAL_DAILY_KEY, today);
      return 'exists';
    }
    throw error;
  }

  localStorage.setItem(LOCAL_DAILY_KEY, today);
  await pruneOldCloudBackups(KEEP_DAYS);
  return 'saved';
}

async function pruneOldCloudBackups(keepDays: number): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const client = requireClient();
  await client.from('daily_backups').delete().lt('backup_date', cutoffIso);
}

export async function listCloudDailyBackups(limit = 14): Promise<CloudDailyBackupMeta[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('daily_backups')
    .select('backup_date, summary, created_by_name, created_at')
    .order('backup_date', { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return (data ?? []).map(row => ({
    backupDate: row.backup_date as string,
    summary: (row.summary as string) || '',
    createdByName: (row.created_by_name as string) || null,
    createdAt: row.created_at as string,
  }));
}

export async function loadCloudDailyBackup(date: string): Promise<AppBackup> {
  const client = requireClient();
  const { data, error } = await client
    .from('daily_backups')
    .select('payload')
    .eq('backup_date', date)
    .single();
  if (error) throw error;
  return data.payload as AppBackup;
}

export function downloadCloudBackup(backup: AppBackup, date: string): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sandouk-daily-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
