import { CURRENCIES, emptyBalances, emptyCustomerBalances, getCurrencyLabel, getCurrencySymbol, getFundAccountName, isFundAccountName, isWeightCurrency } from '../config';
import type {
  AppState,
  Currency,
  Customer,
  CustomerBalances,
  CustomerSummary,
  FundBalances,
  FundId,
  Transaction,
  TransactionEditRecord,
  TransactionFilters,
  TransactionKind,
  TransactionLedger,
  TransactionStatus,
} from '../types';

const STORAGE_KEY = 'sandouk-nemr-v1';

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { transactions: [], bills: [], customers: [] };
    const parsed = JSON.parse(raw) as AppState & { denominations?: unknown };
    return {
      transactions: normalizeTransactions(parsed.transactions ?? []),
      bills: parsed.bills ?? [],
      customers: (parsed.customers ?? []).map(c => ({
        ...c,
        fundId: c.fundId ?? 'nemr',
      })),
    };
  } catch {
    return { transactions: [], bills: [], customers: [] };
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function calcExchangeAmount(fromAmount: number, rate: number): number {
  if (!fromAmount || !rate) return 0;
  return Math.round(fromAmount * rate * 100) / 100;
}

export function describeTransaction(tx: Transaction): string {
  if (tx.kind === 'exchange' && tx.exchangeToCurrency && tx.exchangeToAmount && tx.exchangeRate) {
    return `تبديل ${formatValueWithUnit(tx.amount, tx.currency)} → ${formatValueWithUnit(tx.exchangeToAmount, tx.exchangeToCurrency)}`;
  }
  if (tx.kind === 'exchange') return 'تبديل';
  const other = tx.counterparty?.trim();
  if (tx.kind === 'payment') return other ? `دفع لـ ${other}` : 'دفع';
  if (tx.intermediary) return other ? `استلام من ${other} بيد ${tx.intermediary}` : `استلام بيد ${tx.intermediary}`;
  return other ? `استلام من ${other}` : (isFundAccountName(tx.party) ? 'حركة صندوق' : 'حركة حساب');
}

/** يحوّل الحركات القديمة (party = الطرف) إلى النموذج الجديد */
export function normalizeTransaction(tx: Transaction): Transaction {
  if (tx.ledger === 'account') return tx;
  if (isFundAccountName(tx.party) || tx.counterparty) {
    return { ...tx, ledger: tx.ledger ?? 'fund' };
  }
  return {
    ...tx,
    ledger: 'fund',
    counterparty: tx.party,
    party: getFundAccountName(tx.fundId),
  };
}

export function normalizeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.map(normalizeTransaction);
}

export function formatWeight(grams: number): string {
  return grams.toLocaleString('ar-LB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAmount(amount: number, currency: Currency): string {
  if (isWeightCurrency(currency)) return formatWeight(amount);
  const noDecimals = currency === 'LBP' || currency === 'SYP';
  return amount.toLocaleString('ar-LB', {
    minimumFractionDigits: noDecimals ? 0 : 0,
    maximumFractionDigits: noDecimals ? 0 : 0,
  });
}

export function formatValueWithUnit(amount: number, currency: Currency): string {
  const formatted = formatAmount(amount, currency);
  if (isWeightCurrency(currency)) return `${formatted} غ`;
  return `${formatted} ${getCurrencySymbol(currency)}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateAr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d} - ${m} - ${y}`;
}

export function filterByFund<T extends { fundId: FundId }>(items: T[], fundId: FundId): T[] {
  return items.filter(i => i.fundId === fundId);
}

export function filterTransactions(
  transactions: Transaction[],
  fundId: FundId,
  opts?: { date?: string; status?: TransactionStatus; ledger?: TransactionLedger },
): Transaction[] {
  return transactions.filter(tx => {
    if (tx.fundId !== fundId) return false;
    const ledger = tx.ledger ?? 'fund';
    if (opts?.ledger && ledger !== opts.ledger) return false;
    if (!opts?.ledger && ledger !== 'fund') return false;
    if (ledger === 'fund' && tx.party !== getFundAccountName(fundId)) return false;
    if (opts?.date && tx.date !== opts.date) return false;
    if (opts?.status && tx.status !== opts.status) return false;
    return true;
  });
}

function applyTransactionToFundBalance(balances: FundBalances, tx: Transaction) {
  if (tx.kind === 'exchange' && tx.exchangeToCurrency && tx.exchangeToAmount) {
    const fromBucket = balances[tx.currency];
    const toBucket = balances[tx.exchangeToCurrency];
    if (fromBucket) {
      fromBucket.payments += tx.amount;
      fromBucket.balance = fromBucket.receipts - fromBucket.payments;
    }
    if (toBucket) {
      toBucket.receipts += tx.exchangeToAmount;
      toBucket.balance = toBucket.receipts - toBucket.payments;
    }
    return;
  }

  const bucket = balances[tx.currency];
  if (!bucket) return;
  if (tx.kind === 'receipt') {
    bucket.receipts += tx.amount;
  } else {
    bucket.payments += tx.amount;
  }
  bucket.balance = bucket.receipts - bucket.payments;
}

function applyTransactionToCustomerBalance(balances: CustomerBalances, tx: Transaction) {
  if (tx.kind === 'exchange') return;

  const bucket = balances[tx.currency];
  if (!bucket) return;
  if (tx.kind === 'receipt') {
    bucket.receipts += tx.amount;
  } else {
    bucket.payments += tx.amount;
  }
  bucket.balance = bucket.receipts - bucket.payments;
}

export function computeBalances(transactions: Transaction[], fundId: FundId): FundBalances {
  const balances = emptyBalances();
  const posted = filterTransactions(transactions, fundId, { status: 'posted', ledger: 'fund' });
  for (const tx of posted) applyTransactionToFundBalance(balances, tx);
  return balances;
}

export function computeAccountBalances(
  transactions: Transaction[],
  fundId: FundId,
  accountName: string,
): CustomerBalances {
  const balances = emptyCustomerBalances();
  const posted = transactions.filter(
    tx => tx.fundId === fundId
      && tx.status === 'posted'
      && (tx.ledger ?? 'fund') === 'account'
      && tx.party === accountName
      && tx.kind !== 'exchange',
  );
  for (const tx of posted) applyTransactionToCustomerBalance(balances, tx);
  return balances;
}

export function isCustomerAccountName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || isFundAccountName(trimmed)) return false;
  return true;
}

export function buildAccountSummaries(
  transactions: Transaction[],
  customers: Customer[],
  fundId: FundId,
): CustomerSummary[] {
  const names = new Set<string>();
  const fundCustomers = customers.filter(c => c.fundId === fundId);

  for (const c of fundCustomers) {
    if (isCustomerAccountName(c.name)) names.add(c.name.trim());
  }
  for (const tx of transactions) {
    if (
      tx.fundId === fundId
      && (tx.ledger ?? 'fund') === 'account'
      && isCustomerAccountName(tx.party)
    ) {
      names.add(tx.party.trim());
    }
  }

  const summaries = [...names].sort((a, b) => a.localeCompare(b, 'ar')).map(name => {
    const balances = computeAccountBalances(transactions, fundId, name);
    const hasActivity = CURRENCIES.some(c => {
      const b = balances[c.id];
      return b.receipts !== 0 || b.payments !== 0;
    });
    const customer = fundCustomers.find(c => c.name === name);
    return { name, customerId: customer?.id, balances, hasActivity };
  });

  return summaries.filter(s => s.hasActivity || s.customerId);
}

/** @deprecated use computeAccountBalances */
export function computeCustomerBalances(
  transactions: Transaction[],
  fundId: FundId,
  party: string,
): CustomerBalances {
  return computeAccountBalances(transactions, fundId, party);
}

/** @deprecated use buildAccountSummaries */
export function buildCustomerSummaries(
  transactions: Transaction[],
  customers: Customer[],
  fundId: FundId,
): CustomerSummary[] {
  return buildAccountSummaries(transactions, customers, fundId);
}

export function createTransaction(input: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
  return {
    ...input,
    ledger: input.ledger ?? 'fund',
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

export function createAccountTransaction(input: Omit<Transaction, 'id' | 'createdAt' | 'ledger'>): Transaction {
  return createTransaction({ ...input, ledger: 'account' });
}

type TxBase = Omit<Transaction, 'id' | 'createdAt' | 'currency' | 'amount' | 'batchId'>;

export function createTransactionBatch(
  base: TxBase,
  items: { currency: Currency; amount: number }[],
  opts?: { batchId?: string; linkId?: string },
): Transaction[] {
  if (!items.length) return [];
  const batchId = opts?.batchId ?? (items.length > 1 ? crypto.randomUUID() : undefined);
  const createdAt = new Date().toISOString();
  return items.map(item => ({
    ...base,
    ledger: base.ledger ?? 'fund',
    id: crypto.randomUUID(),
    createdAt,
    batchId,
    linkId: opts?.linkId,
    currency: item.currency,
    amount: item.amount,
  }));
}

/** حركة صندوق + حركة حساب الطرف بعملية واحدة */
export function createLinkedFundAccountOperation(
  shared: Omit<TxBase, 'kind' | 'party' | 'ledger' | 'counterparty'>,
  accountName: string,
  direction: 'in' | 'out',
  items: { currency: Currency; amount: number }[],
  counterparty?: string,
): Transaction[] {
  const linkId = crypto.randomUUID();
  const fundKind = inferKind(direction, false);
  const accountKind: TransactionKind = fundKind === 'receipt' ? 'payment' : 'receipt';
  const fundAccount = getFundAccountName(shared.fundId);
  const multi = items.length > 1;

  const fundTxs = createTransactionBatch(
    {
      ...shared,
      ledger: 'fund',
      party: fundAccount,
      kind: fundKind,
      counterparty: counterparty || accountName,
    },
    items,
    { batchId: multi ? crypto.randomUUID() : undefined, linkId },
  );

  const accountTxs = createTransactionBatch(
    {
      ...shared,
      ledger: 'account',
      party: accountName,
      kind: accountKind,
      counterparty: undefined,
      intermediary: undefined,
    },
    items,
    { batchId: multi ? crypto.randomUUID() : undefined, linkId },
  );

  return [...fundTxs, ...accountTxs];
}

export function getOperationGroupIds(transactions: Transaction[], id: string): string[] {
  const target = transactions.find(tx => tx.id === id);
  if (!target) return [id];

  if (target.linkId) {
    return transactions.filter(tx => tx.linkId === target.linkId).map(tx => tx.id);
  }
  if (target.batchId) {
    return transactions.filter(tx => tx.batchId === target.batchId).map(tx => tx.id);
  }
  return [id];
}

/** @deprecated use getOperationGroupIds */
export function getTransactionGroupIds(transactions: Transaction[], id: string): string[] {
  return getOperationGroupIds(transactions, id);
}

export function appendEditHistory(
  tx: Transaction,
  summary: string,
  actor?: { displayName: string; email: string },
): Transaction {
  const record: TransactionEditRecord = {
    at: new Date().toISOString(),
    byName: actor?.displayName,
    byEmail: actor?.email,
    summary,
  };
  return {
    ...tx,
    lastEditedAt: record.at,
    lastEditedByName: actor?.displayName,
    lastEditedByEmail: actor?.email,
    editHistory: [...(tx.editHistory ?? []), record],
  };
}

export function applyTransactionFilters(
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const q = filters.query?.trim().toLowerCase();
  return transactions.filter(tx => {
    if (filters.dateFrom && tx.date < filters.dateFrom) return false;
    if (filters.dateTo && tx.date > filters.dateTo) return false;
    if (filters.currency && tx.currency !== filters.currency) return false;
    if (q) {
      const hay = [tx.party, tx.counterparty, tx.note, tx.createdByName, tx.createdByEmail]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** يوسّع النتائج لتشمل كل بنود الدفعة أو العملية المرتبطة */
export function expandFilteredTransactions(
  all: Transaction[],
  filtered: Transaction[],
): Transaction[] {
  const ids = new Set<string>();
  for (const tx of filtered) {
    for (const id of getOperationGroupIds(all, tx.id)) ids.add(id);
  }
  return all.filter(tx => ids.has(tx.id));
}

export type TransactionDisplayItem =
  | { kind: 'single'; transaction: Transaction }
  | { kind: 'batch'; transactions: Transaction[] };

/** يعرض العمليات متعددة البنود كبطاقة واحدة */
export function groupTransactionsForDisplay(transactions: Transaction[]): TransactionDisplayItem[] {
  const seen = new Set<string>();
  const items: TransactionDisplayItem[] = [];

  for (const tx of transactions) {
    if (!tx.batchId) {
      items.push({ kind: 'single', transaction: tx });
      continue;
    }
    if (seen.has(tx.batchId)) continue;
    seen.add(tx.batchId);
    const group = transactions.filter(t => t.batchId === tx.batchId);
    items.push(group.length > 1 ? { kind: 'batch', transactions: group } : { kind: 'single', transaction: tx });
  }

  return items;
}

export function createCustomer(input: Omit<Customer, 'id' | 'createdAt'>): Customer {
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

export function inferKind(
  direction: 'in' | 'out',
  isExchange: boolean,
): TransactionKind {
  if (isExchange) return 'exchange';
  return direction === 'in' ? 'receipt' : 'payment';
}

export function formatExecutor(tx: Transaction): string | undefined {
  if (tx.createdByName) return tx.createdByName;
  if (tx.createdByEmail) return tx.createdByEmail;
  return undefined;
}

export function exchangeRateLabel(from: Currency, to: Currency): string {
  const fromLabel = isWeightCurrency(from) ? `1 غ ${getCurrencyLabel(from)}` : `1 ${getCurrencyLabel(from)}`;
  const toLabel = isWeightCurrency(to) ? `غ ${getCurrencyLabel(to)}` : getCurrencyLabel(to);
  return `${fromLabel} = ؟ ${toLabel}`;
}
