export function formatNumber(n: number | undefined | null, decimals = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (n === 0) return '0';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatDateAr(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function parseNum(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export function excelDateToIso(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const epoch = new Date((v - 25569) * 86400 * 1000);
    return epoch.toISOString().slice(0, 10);
  }
  const d = new Date(String(v));
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
