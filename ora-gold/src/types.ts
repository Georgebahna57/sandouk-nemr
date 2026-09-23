export type CurrencySide = 'gold' | 'usd';

/** نوع الحركة حسب طبيعة الحساب */
export type EntryKind =
  | 'standard'      // مدفوع له / مستلم منه
  | 'expense'       // مدفوع / مرتجع مصروف
  | 'profit'        // خسارة / ربح (Pro)
  | 'trading'       // بيع / شراء — ورقة Trading
  | 'worked'        // مشغول 18/21 — تسليم زبائن + أجور $
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
  /** قيمة ثابتة في ورقة «رئيسي» — قد تختلف عن رصيد الدفتر */
  dashboardGold?: number;
  dashboardUsd?: number;
  /** في الملخص: عرض الذهب فقط أو الدولار فقط */
  dashboardSide?: 'gold' | 'usd';
}

/** صف ملخص مرتبط بحساب آخر — مثل بورصة ← دولار CASH */
export interface DashboardAlias {
  id: string;
  label: string;
  sourceAccountId: string;
  side: 'gold' | 'usd';
  showOnDashboard: 'assets' | 'liabilities';
}

export interface DashboardOverride {
  gold?: number;
  usd?: number;
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

export type InvoiceType = 'sale18' | 'sale21' | 'workshop' | 'purchase';

export type MaterialType =
  | 'usd'
  | 'gold995'
  | 'worked18'
  | 'worked21'
  | 'scrap18_cast'
  | 'scrap18_pull'
  | 'scrap21_cast'
  | 'scrap21_pull'
  | 'k18'
  | 'k21'
  | 'raw_gold';

export type LineDirection = 'receive' | 'give';

export interface InvoiceLineInput {
  material: MaterialType;
  direction: LineDirection;
  amount: number;
}

export interface InvoiceInput {
  number: string;
  date: string;
  customer: string;
  type: InvoiceType;
  workedWeight?: number;
  karat?: 18 | 21;
  usdAmount?: number;
  wageUsd?: number;
  rawGoldGiven?: number;
  /** وزن الحجر المخصوم من المشغول (غرام) */
  stoneDiscountGrams?: number;
  lines?: InvoiceLineInput[];
  profitRateOverride?: number;
}

export interface InvoicePosting {
  accountId: string;
  accountName: string;
  side: CurrencySide;
  debit?: number;
  credit?: number;
  note?: string;
}

export interface InvoiceEntryRef {
  accountId: string;
  side: CurrencySide;
  entryId: string;
}

export interface WorkshopInvoice {
  id: string;
  number: string;
  date: string;
  customer: string;
  type: InvoiceType;
  description: string;
  postings: InvoicePosting[];
  entryRefs: InvoiceEntryRef[];
  workedWeight?: number;
  usdAmount?: number;
  wageUsd?: number;
  rawGoldGiven?: number;
  stoneDiscountGrams?: number;
  profitRate: number;
  createdAt: string;
}

export interface WorkshopSettings {
  profitRate: number;
}

export interface WorkshopState {
  version: 1;
  periodLabel: string;
  accounts: Record<string, AccountData>;
  treasury: TreasuryItem[];
  invoices?: WorkshopInvoice[];
  settings?: WorkshopSettings;
  /** تعديلات يدوية لقيم الملخص الرئيسي */
  dashboardOverrides?: Record<string, DashboardOverride>;
  /** ملخص مستورد من ورقة «رئيسي» في Excel */
  mainSheetSnapshot?: MainSheetSnapshot;
  updatedAt: string;
}

export interface DashboardRow {
  label: string;
  gold: number;
  usd: number;
  accountId: string;
  /** الحساب الذي يُفتح عند النقر (قد يختلف عن accountId للأسماء المستعارة) */
  navigateAccountId: string;
  /** تركيز الدفتر عند فتح الصف من الملخص */
  ledgerFocus?: 'gold' | 'usd' | 'both';
}

/** نسخة ورقة «رئيسي» من Excel — لعرض الملخص مطابقاً للملف */
export interface MainSheetSnapshot {
  assets: DashboardRow[];
  liabilities: DashboardRow[];
  totalAssets: { gold: number; usd: number };
  totalLiab: { gold: number; usd: number };
  goldDiff: number;
  usdDiff: number;
}

export interface AccountSummary {
  accountId: string;
  nameAr: string;
  goldBalance: number;
  usdBalance: number;
}
