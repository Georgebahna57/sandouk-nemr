import { ACCOUNTS, DASHBOARD_ALIASES, getAccountDef } from './accountsConfig';
import { getAccountBalances } from './ledger';
import type { DashboardRow, WorkshopState } from '../types';

function treasuryValue(state: WorkshopState, labelPart: string, field: 'usd' | 'gold995' | 'weight'): number {
  const item = state.treasury.find((t) => t.label.includes(labelPart));
  if (!item) return 0;
  return item[field] ?? 0;
}

/** رصيد دفتر الحساب الكامل */
export function getLedgerBalance(state: WorkshopState, accountId: string): { gold: number; usd: number } {
  return getAccountBalances(state.accounts[accountId]);
}

/** رصيد حساب كما يظهر في لوحة الملخص / ورقة «رئيسي» */
export function getDashboardBalance(state: WorkshopState, accountId: string): { gold: number; usd: number } {
  const def = getAccountDef(accountId);
  const bal = getLedgerBalance(state, accountId);
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

  // بورصة — CASH: رصيد الدفتر، أو 10,000$ الافتراضية من Excel إن كان الدفتر صفراً
  if (accountId === 'cash') {
    const fallbackUsd = override?.usd ?? def?.dashboardUsd;
    if (bal.usd !== 0) return bal;
    if (fallbackUsd != null) return { gold: bal.gold, usd: fallbackUsd };
    return bal;
  }

  if (def?.dashboardGold != null || def?.dashboardUsd != null || override) {
    return {
      gold: override?.gold ?? def?.dashboardGold ?? bal.gold,
      usd: override?.usd ?? def?.dashboardUsd ?? bal.usd,
    };
  }

  return bal;
}

function applyDashboardSide(
  bal: { gold: number; usd: number },
  side?: 'gold' | 'usd',
): { gold: number; usd: number } {
  if (side === 'gold') return { gold: bal.gold, usd: 0 };
  if (side === 'usd') return { gold: 0, usd: bal.usd };
  return bal;
}

function buildRow(
  label: string,
  accountId: string,
  navigateAccountId: string,
  bal: { gold: number; usd: number },
  side?: 'gold' | 'usd',
): DashboardRow {
  const filtered = applyDashboardSide(bal, side);
  return {
    label,
    gold: filtered.gold,
    usd: filtered.usd,
    accountId,
    navigateAccountId,
  };
}

function pushAccountRows(
  target: DashboardRow[],
  def: typeof ACCOUNTS[number],
  state: WorkshopState,
) {
  const bal = getDashboardBalance(state, def.id);
  target.push(buildRow(def.dashboardLabel ?? def.nameAr, def.id, def.id, bal, def.dashboardSide));
  for (const alias of DASHBOARD_ALIASES.filter(
    (a) => a.sourceAccountId === def.id && a.showOnDashboard === def.showOnDashboard,
  )) {
    const sourceBal = getDashboardBalance(state, alias.sourceAccountId);
    target.push(buildRow(alias.label, alias.id, alias.sourceAccountId, sourceBal, alias.side));
  }
}

export function buildDashboardSummary(state: WorkshopState) {
  if (state.mainSheetSnapshot) {
    const snap = state.mainSheetSnapshot;
    return {
      assets: snap.assets,
      liabilities: snap.liabilities,
      totalAssets: snap.totalAssets,
      totalLiab: snap.totalLiab,
      goldDiff: snap.goldDiff,
      usdDiff: snap.usdDiff,
    };
  }

  const assets: DashboardRow[] = [];
  const liabilities: DashboardRow[] = [];

  for (const def of ACCOUNTS) {
    if (!def.showOnDashboard) continue;
    if (def.showOnDashboard === 'assets') pushAccountRows(assets, def, state);
    else pushAccountRows(liabilities, def, state);
  }

  // صفوف مرتبطة بحسابات ليست في الملخص (مثل بورصة ← CASH)
  for (const alias of DASHBOARD_ALIASES) {
    const sourceDef = getAccountDef(alias.sourceAccountId);
    if (sourceDef?.showOnDashboard) continue;
    const sourceBal = getDashboardBalance(state, alias.sourceAccountId);
    const row = buildRow(alias.label, alias.id, alias.sourceAccountId, sourceBal, alias.side);
    if (alias.showOnDashboard === 'assets') assets.push(row);
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

/** الحساب الذي يُفتح عند النقر على صف الملخص */
export function resolveDashboardNavigation(accountId: string): string {
  const alias = DASHBOARD_ALIASES.find((a) => a.id === accountId);
  return alias?.sourceAccountId ?? accountId;
}
