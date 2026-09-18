import * as XLSX from 'xlsx';
import { ACCOUNTS, getExcelSheetTitle } from './accountsConfig';
import { buildDashboardSummary } from './dashboard';
import type { AccountData, EntryKind, LedgerEntry, WorkshopState } from '../types';
import { calcLedgerTotals, entryToExcelRow } from './ledgerDisplay';

export { buildDashboardSummary };

function entryRow(e: LedgerEntry, kind: EntryKind, side: 'gold' | 'usd'): (string | number)[] {
  return entryToExcelRow(e, kind, side);
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
    const goldPart = g ? entryRow(g, entryKind, 'gold') : ['', '', '', '', ''];
    const usdPart = u ? entryRow(u, entryKind, 'usd') : ['', '', '', '', ''];
    rows.push([...goldPart, '', ...usdPart]);
  }

  // صف المجموع
  if (data.gold.length || data.usd.length) {
    const gTot = calcLedgerTotals(data.gold, entryKind, 'gold');
    const uTot = calcLedgerTotals(data.usd, entryKind, 'usd');
    const goldTotal = data.gold.length
      ? ['المجموع', gTot.sumCol1, gTot.sumCol2, gTot.balance, '']
      : ['', '', '', '', ''];
    const usdTotal = data.usd.length
      ? ['المجموع', uTot.sumCol1, uTot.sumCol2, uTot.balance, '']
      : ['', '', '', '', ''];
    rows.push([...goldTotal, '', ...usdTotal]);
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

function buildMainSheet(state: WorkshopState): XLSX.WorkSheet {
  const summary = buildDashboardSummary(state);
  const assetRows = summary.assets.map((r) => [r.label, r.gold || '', r.usd || '']);
  const liabilityRows = summary.liabilities.map((r) => [r.label, r.gold || '', r.usd || '']);
  const { gold: goldAssets, usd: usdAssets } = summary.totalAssets;
  const { gold: goldLiab, usd: usdLiab } = summary.totalLiab;

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
    XLSX.utils.book_append_sheet(wb, buildAccountSheet(getExcelSheetTitle(def), data, def.entryKind), def.sheetName);
  }

  const filename = `ميزانية-${state.periodLabel}.xlsx`;
  XLSX.writeFile(wb, filename);
}

