import { ACCOUNTS, getAccountNavLabel, normalizeSheetKey } from './accountsConfig';
import type { AccountDef } from '../types';

export interface AccountAuditRow {
  id: string;
  nameAr: string;
  sheetName: string;
  dashboardLabel?: string;
  entryKind: string;
  matchesExcel: boolean;
  navLabel: string;
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
export function accountsWithSheetAlias(): AccountDef[] {
  return ACCOUNTS.filter((a) => normalizeSheetKey(a.nameAr) !== normalizeSheetKey(a.sheetName));
}
