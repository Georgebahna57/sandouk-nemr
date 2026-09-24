import type { AccountDef, DashboardAlias, TreasuryItem } from '../types';

export const ACCOUNTS: AccountDef[] = [
  { id: 'setup', nameAr: 'تأسيس ورشة', sheetName: 'تأسيس ورشة', entryKind: 'standard', goldBalanceMode: 'debit-minus-credit', showOnDashboard: 'assets', dashboardLabel: 'مصاريف تأسيس الورشة' },
  { id: 'machines', nameAr: 'ماكينات', sheetName: 'ماكينات', entryKind: 'standard', goldBalanceMode: 'debit-minus-credit', showOnDashboard: 'assets', dashboardLabel: 'ماكينات' },
  { id: 'operational', nameAr: 'مصاريف تشغيلية', sheetName: 'مصاريف تشغيلية', entryKind: 'expense', showOnDashboard: 'assets', dashboardLabel: 'مصاريف تشغيلية' },
  { id: 'monthly', nameAr: 'مصاريف شهرية', sheetName: 'مصاريف اخرى', entryKind: 'expense', showOnDashboard: 'assets', dashboardLabel: 'مصاريف شهرية' },
  { id: 'mainTreasury', nameAr: 'خزنة رئيسية', sheetName: 'خزنة رئيسية', entryKind: 'standard', showOnDashboard: 'assets', dashboardLabel: 'خزنة رئيسية' },
  { id: 'underMfg', nameAr: 'تحت التصنيع', sheetName: 'تحت التصنيع', entryKind: 'manufacturing', goldBalanceMode: 'debit-minus-credit', showOnDashboard: 'assets', dashboardLabel: 'تحت التصنيع' },
  { id: 'customers', nameAr: 'زبائن ورشة', sheetName: 'زبائن', entryKind: 'inout', goldBalanceMode: 'debit-minus-credit', showOnDashboard: 'assets', dashboardLabel: 'زبائن ورشة' },
  { id: 'silver', nameAr: 'فضة', sheetName: 'فضة', entryKind: 'inout', showOnDashboard: 'assets', dashboardLabel: 'SILVER $' },
  { id: 'wax', nameAr: 'شمع', sheetName: 'شمع', entryKind: 'inout', showOnDashboard: 'assets', dashboardLabel: 'شمع' },
  { id: 'alloy', nameAr: 'ALLOY', sheetName: 'ALLOY', entryKind: 'inout', showOnDashboard: 'assets', dashboardLabel: 'ALLOY' },
  { id: 'trading', nameAr: 'متاجرة', sheetName: 'Trading', entryKind: 'trading', goldBalanceMode: 'debit-minus-credit', usdBalanceMode: 'debit-minus-credit', showOnDashboard: 'assets', dashboardLabel: 'متاجرة' },
  { id: 'cash', nameAr: 'Cash', sheetName: 'CASH', entryKind: 'standard', dashboardUsd: 10000 },
  { id: 'pro', nameAr: 'أرباح الإنتاج', sheetName: 'Pro', entryKind: 'profit', goldBalanceMode: 'debit-minus-credit', usdBalanceMode: 'debit-minus-credit', showOnDashboard: 'liabilities', dashboardLabel: 'profit' },
  { id: 'ahmad', nameAr: 'مدفوع من أحمد', sheetName: 'Ahmad', entryKind: 'partner', goldBalanceMode: 'debit-minus-credit', usdBalanceMode: 'debit-minus-credit', showOnDashboard: 'liabilities', dashboardLabel: 'Paid from Ahmad' },
  { id: 'mzen', nameAr: 'مدفوع من مازن', sheetName: 'Mzen', entryKind: 'partner', goldBalanceMode: 'debit-minus-credit', usdBalanceMode: 'debit-minus-credit', showOnDashboard: 'liabilities', dashboardLabel: 'Paid from Mazen' },
  { id: 'wages18', nameAr: 'أجور عيار 18', sheetName: 'مشغول 18', entryKind: 'worked', showOnDashboard: 'liabilities', dashboardLabel: 'اجور مستلمة عن 18' },
  { id: 'wages21', nameAr: 'أجور عيار 21', sheetName: 'مشغول 21', entryKind: 'worked', showOnDashboard: 'liabilities', dashboardLabel: 'اجور مستلمة عن 21' },
  { id: 'gold', nameAr: 'دهب', sheetName: 'دهب', entryKind: 'inout' },
  { id: 'dollar', nameAr: 'دولار', sheetName: 'دولار', entryKind: 'inout' },
  { id: 'alloyCast', nameAr: 'Alloy Cast', sheetName: 'Alloy Cast', entryKind: 'inout' },
  { id: 'alloyPull', nameAr: 'Alloy سحب', sheetName: 'Alloy سحب', entryKind: 'inout' },
  { id: 'scrap18', nameAr: 'كسر 18', sheetName: 'كسر 18', entryKind: 'inout' },
  { id: 'scrap21', nameAr: 'كسر 21', sheetName: 'كسر 21', entryKind: 'inout' },
  { id: 'scrap22', nameAr: 'كسر 22', sheetName: 'كسر 22', entryKind: 'inout' },
  { id: 'sand', nameAr: 'رملة', sheetName: 'رملة', entryKind: 'inout' },
  { id: 'cast18', nameAr: 'صب 18', sheetName: 'صب 18', entryKind: 'inout' },
  { id: 'k18', nameAr: 'K18', sheetName: 'K18', entryKind: 'inout' },
  { id: 'k21', nameAr: 'K21', sheetName: 'K21', entryKind: 'inout' },
  { id: 'k22', nameAr: 'K22', sheetName: 'K22', entryKind: 'inout' },
];

/** صفوف الملخص المرتبطة بورقة أخرى — مطابق لـ Excel */
export const DASHBOARD_ALIASES: DashboardAlias[] = [
  { id: 'bourse', label: 'بورصة', sourceAccountId: 'cash', side: 'usd', showOnDashboard: 'assets' },
];

export const DEFAULT_TREASURY: TreasuryItem[] = [
  { id: 'usd_box', label: 'صندوق دولار' },
  { id: 'gold_sand', label: 'دهب رملة 995' },
  { id: 'silver_rob', label: 'فضة روباص' },
  { id: 'alloy_cast', label: 'Alloy Cast' },
  { id: 'alloy_pull', label: 'Alloy سحب' },
  { id: 'worked18', label: 'مشغول 18' },
  { id: 'worked21', label: 'مشغول 21' },
  { id: 'k18_740', label: 'K18 - 740' },
  { id: 'k22_905', label: 'K22 - 905' },
  { id: 'k21_865', label: 'K21 - 865' },
];

/** حسابات مُوقَفة — لا تظهر في القائمة ولا في الفواتير (قد تبقى في بيانات قديمة) */
export const RETIRED_ACCOUNT_IDS = new Set([
  'gold',
  'scrap18Cast',
  'scrap18Pull',
  'scrap21Cast',
  'scrap21Pull',
]);

export function getAccountDef(id: string): AccountDef | undefined {
  return ACCOUNTS.find((a) => a.id === id);
}

/** تطبيع اسم ورقة Excel للمقارنة (حساسية حالة، مسافات) */
export function normalizeSheetKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** البحث عن حساب باسم ورقة Excel — يدعم Cash/CASH، والأسماء العربية البديلة */
export function getAccountBySheet(sheetName: string): AccountDef | undefined {
  const key = normalizeSheetKey(sheetName);
  if (!key) return undefined;

  return ACCOUNTS.find((a) => {
    if (normalizeSheetKey(a.sheetName) === key) return true;
    if (normalizeSheetKey(a.nameAr) === key) return true;
    if (a.dashboardLabel && normalizeSheetKey(a.dashboardLabel) === key) return true;
    return false;
  });
}

/** اسم العرض في القائمة — الاسم العربي مع ورقة Excel إن اختلفت */
export function getAccountNavLabel(def: AccountDef): string {
  if (normalizeSheetKey(def.sheetName) === normalizeSheetKey(def.nameAr)) return def.nameAr;
  return `${def.nameAr} (${def.sheetName})`;
}

/** عنوان صفحة الحساب */
export function getAccountPageTitle(def: AccountDef): string {
  return getAccountNavLabel(def);
}

/** اسم الورقة كما في Excel (للتصدير والعناوين) */
export function getExcelSheetTitle(def: AccountDef): string {
  return def.sheetName;
}

export function getBalanceMode(def: AccountDef, side: 'gold' | 'usd'): import('../types').BalanceMode {
  const mode = side === 'gold' ? def.goldBalanceMode : def.usdBalanceMode;
  if (mode) return mode;
  if (def.entryKind === 'expense') return 'credit-minus-debit';
  if (def.entryKind === 'profit' || def.entryKind === 'trading' || def.entryKind === 'partner') return 'debit-minus-credit';
  if (def.entryKind === 'worked') return side === 'usd' ? 'credit-minus-debit' : 'debit-minus-credit';
  if (def.entryKind === 'inout') return 'credit-minus-debit';
  if (side === 'usd') return 'credit-minus-debit';
  return 'debit-minus-credit';
}
