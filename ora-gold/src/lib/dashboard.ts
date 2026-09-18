import { ACCOUNTS, getAccountDef } from './accountsConfig';
import { getAccountBalances } from './ledger';
import type { WorkshopState } from '../types';

function treasuryValue(state: WorkshopState, labelPart: string, field: 'usd' | 'gold995' | 'weight'): number {
  const item = state.treasury.find((t) => t.label.includes(labelPart));
  if (!item) return 0;
  return item[field] ?? 0;
}

/** رصيد حساب كما يظهر في لوحة الملخص / ورقة «رئيسي» */
export function getDashboardBalance(state: WorkshopState, accountId: string): { gold: number; usd: number } {
  const def = getAccountDef(accountId);
  const bal = getAccountBalances(state.accounts[accountId]);
  const override = state.dashboardOverrides?.[accountId];

  if (accountId === 'mainTreasury') {
    const goldTotal = state.treasury.reduce((s, t) => s + (t.gold995 ?? 0), 0);
    const usdBox = treasuryValue(state, 'صندوق دولار', 'usd');
    return { gold: goldTotal || bal.gold, usd: usdBox || bal.usd };
  }
  if (accountId === 'wages18') {
    return { gold: 0, usd: treasuryValue(state, 'مشغول 18', 'usd') || bal.usd };
  }
  if (accountId === 'wages21') {
    return { gold: 0, usd: treasuryValue(state, 'مشغول 21', 'usd') || bal.usd };
  }
  if (accountId === 'silver' || accountId === 'wax' || accountId === 'alloy') {
    return { gold: 0, usd: bal.usd };
  }

  // قيمة ملخص ثابتة من Excel الرئيسي (مثل بورصة 10,000$)
  if (def?.dashboardGold != null || def?.dashboardUsd != null || override) {
    return {
      gold: override?.gold ?? def?.dashboardGold ?? bal.gold,
      usd: override?.usd ?? def?.dashboardUsd ?? bal.usd,
    };
  }

  return bal;
}

export function buildDashboardSummary(state: WorkshopState) {
  const assets: { label: string; gold: number; usd: number; accountId: string }[] = [];
  const liabilities: { label: string; gold: number; usd: number; accountId: string }[] = [];

  for (const def of ACCOUNTS) {
    if (!def.showOnDashboard) continue;
    const bal = getDashboardBalance(state, def.id);
    const row = { label: def.dashboardLabel ?? def.nameAr, gold: bal.gold, usd: bal.usd, accountId: def.id };
    if (def.showOnDashboard === 'assets') assets.push(row);
    else liabilities.push(row);
  }

  const totalAssets = { gold: assets.reduce((s, r) => s + r.gold, 0), usd: assets.reduce((s, r) => s + r.usd, 0) };
  const totalLiab = { gold: liabilities.reduce((s, r) => s + r.gold, 0), usd: liabilities.reduce((s, r) => s + r.usd, 0) };

  return {
    assets,
    liabilities,
    totalAssets,
    totalLiab,
    goldDiff: totalAssets.gold + totalLiab.gold,
    usdDiff: totalAssets.usd + totalLiab.usd,
  };
}
