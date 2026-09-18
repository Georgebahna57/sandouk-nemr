import * as XLSX from 'xlsx';
import { ACCOUNTS } from './accountsConfig';
import type { AccountData, EntryKind, LedgerEntry, WorkshopState } from '../types';
import { getAccountBalances } from './ledger';
import { entryToExcelRow } from './ledgerDisplay';

function entryRow(e: LedgerEntry, kind: EntryKind): (string | number)[] {
  return entryToExcelRow(e, kind);
}

function buildAccountSheet(name: string, data: AccountData, entryKind: EntryKind): XLSX.WorkSheet {
  const goldHeaders = entryKind === 'profit'
    ? ['التاريخ', 'خسارة', 'ربح', 'الرصيد', 'البيان']
    : entryKind === 'inout'
      ? ['التاريخ', 'دخول ', 'خروج', 'الرصيد', 'البيان']
      : entryKind === 'expense'
        ? ['التاريخ', 'مدفوع ', 'مرتجع مصروف', 'الرصيد', 'البيان']
        : ['التاريخ', 'مدفوع له', 'مستلم منه', 'الرصيد', 'البيان'];

  const usdHeaders = entryKind === 'profit'
    ? ['التاريخ', 'مدفوع', 'مستلم', 'الرصيد', 'البيان']
    : entryKind === 'partner'
      ? ['التاريخ', 'Debit', 'Credit', 'الرصيد', 'البيان']
      : entryKind === 'expense'
        ? ['التاريخ', 'مدفوع ', 'مرتجع مصروف', 'رصيد المصروف', 'البيان']
        : entryKind === 'inout'
          ? ['التاريخ', 'دخول', 'خروج', 'الرصيد', 'البيان']
          : ['التاريخ', 'لنا', 'علينا', 'الرصيد', 'البيان'];

  const maxLen = Math.max(data.gold.length, data.usd.length);
  const rows: (string | number)[][] = [
    [name],
    ['دهب 995 ', '', '', name, '', '', 'حساب دولار $', '', '', name],
    ['من تاريخ :'],
    ['إلى تاريخ : '],
    [...goldHeaders, '', ...usdHeaders],
  ];

  for (let i = 0; i < maxLen; i++) {
    const g = data.gold[i];
    const u = data.usd[i];
    const goldPart = g ? entryRow(g, entryKind) : ['', '', '', '', ''];
    const usdPart = u ? entryRow(u, entryKind) : ['', '', '', '', ''];
    rows.push([...goldPart, '', ...usdPart]);
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

function buildMainSheet(state: WorkshopState): XLSX.WorkSheet {
  const assetRows: (string | number)[][] = [];
  const liabilityRows: (string | number)[][] = [];

  let goldAssets = 0;
  let usdAssets = 0;
  let goldLiab = 0;
  let usdLiab = 0;

  for (const def of ACCOUNTS) {
    if (!def.showOnDashboard) continue;
    const bal = getAccountBalances(state.accounts[def.id]);
    const label = def.dashboardLabel ?? def.nameAr;
    if (def.showOnDashboard === 'assets') {
      assetRows.push([label, bal.gold || '', bal.usd || '']);
      goldAssets += bal.gold;
      usdAssets += bal.usd;
    } else {
      liabilityRows.push([label, bal.gold || '', bal.usd || '']);
      goldLiab += bal.gold;
      usdLiab += bal.usd;
    }
  }

  const rows: (string | number)[][] = [
    ['', 'حسابات الورشة - معمل'],
    ['', 'الحساب', 'ذهب', 'دولار', '', 'الحساب', 'ذهب', 'دولار'],
    ...assetRows.map((r, i) => {
      const l = liabilityRows[i];
      return ['', r[0], r[1], r[2], '', l?.[0] ?? '', l?.[1] ?? '', l?.[2] ?? ''];
    }),
    ...(liabilityRows.length > assetRows.length
      ? liabilityRows.slice(assetRows.length).map((l) => ['', '', '', '', '', l[0], l[1], l[2]])
      : []),
    ['', 'المجموع', goldAssets, usdAssets, '', 'المجموع', goldLiab, usdLiab],
    [],
    ['', '', '', goldAssets + goldLiab, '', 'الفرق ذهب'],
    ['', '', '', usdAssets + usdLiab, '', 'الفرق دولار'],
  ];

  return XLSX.utils.aoa_to_sheet(rows);
}

function buildTreasurySheet(state: WorkshopState): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['خزنة  / رئيسي'],
    ['النوع', 'دولار', 'وزن', ''],
    ...state.treasury.map((t) => [t.label, t.usd ?? '', t.weight ?? '', t.gold995 ?? '']),
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

export function exportWorkbook(state: WorkshopState): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildMainSheet(state), 'رئيسي');
  XLSX.utils.book_append_sheet(wb, buildTreasurySheet(state), 'خزنة رئيسية');

  for (const def of ACCOUNTS) {
    if (def.id === 'mainTreasury') continue;
    const data = state.accounts[def.id];
    if (!data) continue;
    const hasData = data.gold.length > 0 || data.usd.length > 0;
    if (!hasData && def.showOnDashboard === undefined) continue;
    XLSX.utils.book_append_sheet(wb, buildAccountSheet(def.nameAr, data, def.entryKind), def.sheetName);
  }

  const filename = `ميزانية-${state.periodLabel}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function treasuryValue(state: WorkshopState, labelPart: string, field: 'usd' | 'gold995' | 'weight'): number {
  const item = state.treasury.find((t) => t.label.includes(labelPart));
  if (!item) return 0;
  return item[field] ?? 0;
}

function dashboardBalances(state: WorkshopState, accountId: string): { gold: number; usd: number } {
  const bal = getAccountBalances(state.accounts[accountId]);
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
  return bal;
}

export function buildDashboardSummary(state: WorkshopState) {
  const assets: { label: string; gold: number; usd: number; accountId: string }[] = [];
  const liabilities: { label: string; gold: number; usd: number; accountId: string }[] = [];

  for (const def of ACCOUNTS) {
    if (!def.showOnDashboard) continue;
    const bal = dashboardBalances(state, def.id);
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
