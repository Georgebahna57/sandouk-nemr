import { ACCOUNTS, DASHBOARD_ALIASES, getAccountNavLabel, normalizeSheetKey } from './accountsConfig';

export interface AccountAuditRow {
  id: string;
  nameAr: string;
  sheetName: string;
  dashboardLabel?: string;
  entryKind: string;
  matchesExcel: boolean;
  navLabel: string;
}

export interface DashboardLinkRow {
  id: string;
  label: string;
  sourceAccountId: string;
  side: string;
  sourceSheet: string;
}

/** تقرير مطابقة الحسابات مع أوراق Excel */
export function auditAccountMappings(): AccountAuditRow[] {
  return ACCOUNTS.map((def) => ({
    id: def.id,
    nameAr: def.nameAr,
    sheetName: def.sheetName,
    dashboardLabel: def.dashboardLabel,
    entryKind: def.entryKind,
    matchesExcel: normalizeSheetKey(def.nameAr) === normalizeSheetKey(def.sheetName),
    navLabel: getAccountNavLabel(def),
  }));
}

/** الحسابات التي يختلف اسمها العربي عن ورقة Excel */
export function accountsWithSheetAlias() {
  return ACCOUNTS.filter((a) => normalizeSheetKey(a.nameAr) !== normalizeSheetKey(a.sheetName));
}

/** روابط الملخص الرئيسي — مثل بورصة ← Trading */
export function dashboardLinks(): DashboardLinkRow[] {
  return DASHBOARD_ALIASES.map((a) => {
    const source = ACCOUNTS.find((d) => d.id === a.sourceAccountId);
    return {
      id: a.id,
      label: a.label,
      sourceAccountId: a.sourceAccountId,
      side: a.side,
      sourceSheet: source?.sheetName ?? a.sourceAccountId,
    };
  });
}
