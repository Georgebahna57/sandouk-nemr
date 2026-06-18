export function formatDbError(error: unknown): Error {
  if (!error || typeof error !== 'object') {
    return new Error('فشل الحفظ — خطأ غير معروف');
  }

  const err = error as { message?: string; code?: string; details?: string; hint?: string };
  const msg = (err.message ?? '').toLowerCase();

  if (msg.includes('ledger') || msg.includes('counterparty') || msg.includes('batch_id')) {
    return new Error(
      'فشل الحفظ — قاعدة البيانات تحتاج تحديث. شغّل ملف supabase/migrate-all.sql في Supabase → SQL Editor',
    );
  }

  if (msg.includes('fund_id') && msg.includes('null')) {
    return new Error('فشل الحفظ — الحساب لازم يكون مربوط بصندوق. شغّل supabase/accounts-per-fund.sql');
  }

  if (err.code === '42501' || msg.includes('permission') || msg.includes('policy')) {
    return new Error('فشل الحفظ — ما عندك صلاحية تعديل على هالصندوق');
  }

  if (err.message) return new Error(`فشل الحفظ — ${err.message}`);
  return new Error('فشل الحفظ');
}
