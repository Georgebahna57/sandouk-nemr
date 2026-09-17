export type CurrencySide = 'gold' | 'usd';

/** نوع الحركة حسب طبيعة الحساب */
export type EntryKind =
  | 'standard'      // مدفوع له / مستلم منه
  | 'expense'       // مدفوع / مرتجع مصروف
  | 'profit'        // خسارة / ربح
  | 'partner'       // Debit / Credit
  | 'inout'         // دخول / خروج
  | 'manufacturing'; // تسليم / استلام بعيارات

export interface LedgerEntry {
  id: string;
  date: string;
  /** مدفوع له / خسارة / دخول / تسليم */
  debit?: number;
  /** مستلم منه / ربح / خروج / استلام */
  credit?: number;
  balance: number;
  description: string;
  /** للتصنيع — عيارات إضافية */
  karat750?: number;
  karat875?: number;
  karat995?: number;
}

export type BalanceMode = 'credit-minus-debit' | 'debit-minus-credit';

export interface AccountDef {
  id: string;
  nameAr: string;
  sheetName: string;
  entryKind: EntryKind;
  goldBalanceMode?: BalanceMode;
  usdBalanceMode?: BalanceMode;
  /** يظهر في لوحة الملخص الرئيسية */
  showOnDashboard?: 'assets' | 'liabilities' | 'none';
  dashboardLabel?: string;
}

export interface AccountData {
  gold: LedgerEntry[];
  usd: LedgerEntry[];
}

export interface TreasuryItem {
  id: string;
  label: string;
  usd?: number;
  weight?: number;
  gold995?: number;
}

export interface WorkshopState {
  version: 1;
  periodLabel: string;
  accounts: Record<string, AccountData>;
  treasury: TreasuryItem[];
  updatedAt: string;
}

export interface DashboardRow {
  label: string;
  gold: number;
  usd: number;
  accountId?: string;
}

export interface AccountSummary {
  accountId: string;
  nameAr: string;
  goldBalance: number;
  usdBalance: number;
}
