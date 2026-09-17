import type { AccountData, BalanceMode, CurrencySide, LedgerEntry } from '../types';

export function newEntryId(): string {
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function recalcBalances(entries: LedgerEntry[], mode: BalanceMode = 'credit-minus-debit'): LedgerEntry[] {
  let balance = 0;
  return entries.map((e) => {
    const debit = e.debit ?? 0;
    const credit = e.credit ?? 0;
    balance = mode === 'debit-minus-credit' ? balance + debit - credit : balance + credit - debit;
    return { ...e, balance };
  });
}

export function getLastBalance(entries: LedgerEntry[]): number {
  if (entries.length === 0) return 0;
  return entries[entries.length - 1].balance;
}

export function getAccountBalances(account: AccountData): { gold: number; usd: number } {
  return {
    gold: getLastBalance(account.gold),
    usd: getLastBalance(account.usd),
  };
}

export function addEntry(
  account: AccountData,
  side: CurrencySide,
  entry: Omit<LedgerEntry, 'id' | 'balance'>,
  mode: BalanceMode = 'credit-minus-debit',
): AccountData {
  const list = [...account[side], { ...entry, id: newEntryId(), balance: 0 }];
  const recalculated = recalcBalances(list, mode);
  return { ...account, [side]: recalculated };
}

export function updateEntry(
  account: AccountData,
  side: CurrencySide,
  entryId: string,
  patch: Partial<Omit<LedgerEntry, 'id' | 'balance'>>,
  mode: BalanceMode = 'credit-minus-debit',
): AccountData {
  const list = account[side].map((e) => (e.id === entryId ? { ...e, ...patch } : e));
  return { ...account, [side]: recalcBalances(list, mode) };
}

export function deleteEntry(
  account: AccountData,
  side: CurrencySide,
  entryId: string,
  mode: BalanceMode = 'credit-minus-debit',
): AccountData {
  const list = account[side].filter((e) => e.id !== entryId);
  return { ...account, [side]: recalcBalances(list, mode) };
}

export function sortEntriesByDate(entries: LedgerEntry[], mode: BalanceMode = 'credit-minus-debit'): LedgerEntry[] {
  return recalcBalances(
    [...entries].sort((a, b) => {
      const da = a.date || '0000-00-00';
      const db = b.date || '0000-00-00';
      return da.localeCompare(db);
    }),
    mode,
  );
}
