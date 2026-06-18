import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { FUNDS } from '../config';
import {
  ensureProfile,
  fetchMyPermissions,
} from '../lib/profile';
import {
  canEditFund,
  canViewFund,
  resolveFundAccess,
  type FundAccess,
  type UserProfile,
} from '../lib/permissions';
import type { FundId } from '../types';

export function usePermissions(user: User | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Partial<Record<FundId, 'edit' | 'view'>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setPermissions({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const p = await ensureProfile(user);
      const perms = p.isAdmin ? {} : await fetchMyPermissions(user.id);
      setProfile(p);
      setPermissions(perms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل الصلاحيات');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const fundAccess = useMemo(() => {
    const map = {} as Record<FundId, FundAccess>;
    for (const fund of FUNDS) {
      map[fund.id] = resolveFundAccess(fund.id, profile?.isAdmin ?? false, permissions);
    }
    return map;
  }, [profile, permissions]);

  const visibleFunds = useMemo(
    () => FUNDS.filter(f => canViewFund(fundAccess[f.id])),
    [fundAccess],
  );

  const getAccess = useCallback((fundId: FundId) => fundAccess[fundId], [fundAccess]);
  const canEdit = useCallback((fundId: FundId) => canEditFund(fundAccess[fundId]), [fundAccess]);

  return {
    profile,
    permissions,
    fundAccess,
    visibleFunds,
    loading,
    error,
    isAdmin: profile?.isAdmin ?? false,
    getAccess,
    canEdit,
    reload,
  };
}
