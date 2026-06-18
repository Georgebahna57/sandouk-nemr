import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2, MessageCircle, Save, Shield } from 'lucide-react';
import { FUNDS } from '../config';
import { fetchFundWhatsAppPhones, saveFundWhatsAppPhones, type FundWhatsAppMap } from '../lib/fundSettings';
import {
  fetchAllPermissions,
  fetchAllProfiles,
  saveUserFundPermissions,
  setUserAdmin,
  updateDisplayName,
} from '../lib/profile';
import {
  PERMISSION_LABELS,
  type FundAccess,
  type UserProfile,
} from '../lib/permissions';
import type { FundId } from '../types';

interface Props {
  onBack: () => void;
  onWhatsAppSaved?: () => void;
}

type PermissionMap = Record<string, Partial<Record<FundId, FundAccess>>>;

function buildPermissionMap(
  profiles: UserProfile[],
  rows: { userId: string; fundId: FundId; permission: 'edit' | 'view' }[],
): PermissionMap {
  const map: PermissionMap = {};
  for (const profile of profiles) {
    const userPerms: Partial<Record<FundId, FundAccess>> = {};
    if (profile.isAdmin) {
      for (const fund of FUNDS) userPerms[fund.id] = 'edit';
    } else {
      for (const fund of FUNDS) userPerms[fund.id] = 'hidden';
      for (const row of rows.filter(r => r.userId === profile.id)) {
        userPerms[row.fundId] = row.permission;
      }
    }
    map[profile.id] = userPerms;
  }
  return map;
}

export function AdminPanel({ onBack, onWhatsAppSaved }: Props) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [permissionMap, setPermissionMap] = useState<PermissionMap>({});
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({});
  const [whatsappEdits, setWhatsappEdits] = useState<FundWhatsAppMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const nonAdminProfiles = useMemo(
    () => profiles.filter(p => !p.isAdmin),
    [profiles],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [allProfiles, allPerms, whatsappPhones] = await Promise.all([
        fetchAllProfiles(),
        fetchAllPermissions(),
        fetchFundWhatsAppPhones(),
      ]);
      setProfiles(allProfiles);
      setPermissionMap(buildPermissionMap(allProfiles, allPerms));
      setNameEdits(Object.fromEntries(allProfiles.map(p => [p.id, p.displayName])));
      setWhatsappEdits(whatsappPhones);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحميل');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setPermission(userId: string, fundId: FundId, access: FundAccess) {
    setPermissionMap(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [fundId]: access },
    }));
  }

  async function saveUser(userId: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveUserFundPermissions(userId, permissionMap[userId] ?? {});
      setSuccess('تم حفظ الصلاحيات');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function saveDisplayName(userId: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateDisplayName(userId, nameEdits[userId] ?? '');
      await load();
      setSuccess('تم حفظ الاسم');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الاسم');
    } finally {
      setSaving(false);
    }
  }

  async function saveWhatsAppNumbers() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveFundWhatsAppPhones(whatsappEdits);
      onWhatsAppSaved?.();
      setSuccess('تم حفظ أرقام واتساب');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ أرقام واتساب');
    } finally {
      setSaving(false);
    }
  }

  async function toggleAdmin(userId: string, isAdmin: boolean) {
    setSaving(true);
    setError(null);
    try {
      await setUserAdmin(userId, isAdmin);
      await load();
      setSuccess(isAdmin ? 'تم تعيين مسؤول' : 'تم إلغاء المسؤول');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحديث');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-amber-500/20 p-3">
            <Shield size={24} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">إدارة المستخدمين</h1>
            <p className="text-xs text-slate-500">صلاحيات الصناديق لكل مستخدم</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-white"
        >
          <ArrowRight size={14} />
          رجوع
        </button>
      </header>

      <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-400">
        <p className="font-medium text-slate-300">إضافة مستخدم جديد</p>
        <p className="mt-1 text-xs">
          من Supabase → Authentication → Users → Add user → Create new user
        </p>
        <p className="mt-2 text-xs">بعد أول دخول، يظهر هون لتحديد صلاحياته.</p>
      </div>

      {(error || success) && (
        <div className={`mb-4 rounded-xl px-3 py-2 text-xs ${error ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {error ?? success}
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <MessageCircle size={18} className="text-emerald-400" />
          <div>
            <p className="font-medium text-slate-200">واتساب قيد الانتظار</p>
            <p className="text-xs text-slate-500">رقم لكل صندوق — يفتح واتساب برسالة جاهزة بعد حفظ عملية pending</p>
          </div>
        </div>
        <div className="space-y-2">
          {FUNDS.map(fund => (
            <div key={fund.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900/50 px-3 py-2">
              <span className="text-sm">{fund.name}</span>
              <input
                type="tel"
                dir="ltr"
                value={whatsappEdits[fund.id] ?? ''}
                onChange={e => setWhatsappEdits(prev => ({ ...prev, [fund.id]: e.target.value }))}
                placeholder="96170123456"
                className="min-w-[10rem] flex-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={saveWhatsAppNumbers}
          disabled={saving}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          <Save size={14} />
          حفظ أرقام واتساب
        </button>
      </div>

      <div className="space-y-4">
        {profiles.map(profile => {
          const isAdmin = profile.isAdmin;
          const perms = permissionMap[profile.id] ?? {};

          return (
            <div key={profile.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs text-slate-500" dir="ltr">{profile.email}</p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={nameEdits[profile.id] ?? profile.displayName}
                      onChange={e => setNameEdits(prev => ({ ...prev, [profile.id]: e.target.value }))}
                      placeholder="اسم المستخدم"
                      className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => saveDisplayName(profile.id)}
                      disabled={saving}
                      className="rounded-xl border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:border-amber-500/50 hover:text-amber-400 disabled:opacity-60"
                    >
                      حفظ الاسم
                    </button>
                  </div>
                  {isAdmin && (
                    <span className="mt-1 inline-block rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">
                      مسؤول — كل الصناديق
                    </span>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={isAdmin}
                    onChange={e => toggleAdmin(profile.id, e.target.checked)}
                    disabled={saving}
                  />
                  مسؤول
                </label>
              </div>

              {!isAdmin && (
                <>
                  <div className="mt-4 space-y-2">
                    {FUNDS.map(fund => {
                      const access = perms[fund.id] ?? 'hidden';
                      return (
                        <div key={fund.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/50 px-3 py-2">
                          <span className="text-sm">{fund.name}</span>
                          <select
                            value={access}
                            onChange={e => setPermission(profile.id, fund.id, e.target.value as FundAccess)}
                            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
                          >
                            {(['edit', 'view', 'hidden'] as FundAccess[]).map(p => (
                              <option key={p} value={p}>{PERMISSION_LABELS[p]}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => saveUser(profile.id)}
                    disabled={saving}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
                  >
                    <Save size={14} />
                    حفظ صلاحيات {profile.displayName}
                  </button>
                </>
              )}
            </div>
          );
        })}

        {nonAdminProfiles.length === 0 && profiles.length > 0 && (
          <p className="text-center text-sm text-slate-500">كل المستخدمين مسؤولين</p>
        )}

        {profiles.length === 0 && (
          <p className="text-center text-sm text-slate-500">لا يوجد مستخدمين بعد — أضفهم من Supabase</p>
        )}
      </div>
    </div>
  );
}
