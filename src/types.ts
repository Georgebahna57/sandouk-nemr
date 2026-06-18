export type FundId = 'nemr' | 'aura' | 'tiger' | 'zalqa' | 'george';

export type Currency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'CAD'
  | 'SAR'
  | 'QAR'
  | 'KWD'
  | 'JOD'
  | 'AED'
  | 'SYP'
  | 'LBP'
  | 'GOLD'
  | 'SILVER';

export type TransactionStatus = 'posted' | 'pending';
export type TransactionKind = 'receipt' | 'payment' | 'exchange';
export type TransactionLedger = 'fund' | 'account';

export interface Fund {
  id: FundId;
  name: string;
  shortName: string;
  accent: string;
}

export interface Customer {
  id: string;
  fundId: FundId;
  name: string;
  phone?: string;
  note?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  fundId: FundId;
  /** fund = حركة على حساب الصندوق | account = حركة على حساب زبون */
  ledger: TransactionLedger;
  date: string;
  currency: Currency;
  kind: TransactionKind;
  amount: number;
  /** صاحب الحساب — حساب الصندوق أو حساب زبون */
  party: string;
  /** الطرف الآخر (من / لـ) — للعرض فقط */
  counterparty?: string;
  intermediary?: string;
  note?: string;
  status: TransactionStatus;
  createdAt: string;
  /** يربط عدة بنود ضمن عملية واحدة */
  batchId?: string;
  /** يربط حركة الصندوق مع حركة الحساب */
  linkId?: string;
  createdByUserId?: string;
  createdByEmail?: string;
  createdByName?: string;
  lastEditedAt?: string;
  lastEditedByName?: string;
  lastEditedByEmail?: string;
  editHistory?: TransactionEditRecord[];
  exchangeToCurrency?: Currency;
  exchangeRate?: number;
  exchangeToAmount?: number;
  /** نص رسالة واتساب عند الإرسال من قيد الانتظار */
  pendingWhatsAppMessage?: string;
  approvalDetails?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  approvedAt?: string;
}

export interface Bill {
  id: string;
  fundId: FundId;
  invoiceNo: string;
  description: string;
  amount?: number;
  currency?: Currency;
  paidAt?: string;
  createdAt: string;
}

export interface CurrencyBalance {
  receipts: number;
  payments: number;
  balance: number;
}

export type FundBalances = Record<Currency, CurrencyBalance>;

export interface CustomerCurrencyBalance {
  receipts: number;
  payments: number;
  balance: number;
}

export type CustomerBalances = Record<Currency, CustomerCurrencyBalance>;

export interface CustomerSummary {
  name: string;
  customerId?: string;
  balances: CustomerBalances;
  hasActivity: boolean;
}

export interface AppState {
  transactions: Transaction[];
  bills: Bill[];
  customers: Customer[];
}

export type ViewId = 'ledger' | 'pending' | 'customers' | 'bills';

export interface TransactionEditRecord {
  at: string;
  byName?: string;
  byEmail?: string;
  summary: string;
}

export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  query?: string;
  currency?: Currency | '';
}
