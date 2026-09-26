import { getAccountDef, getBalanceMode } from './accountsConfig';
import { addEntry, deleteEntry } from './ledger';
import type { CurrencySide, InvoicePosting, LedgerEntry, WorkshopInvoice, WorkshopState } from '../types';

export interface PostedEntryRef {
  accountId: string;
  side: CurrencySide;
  entryId: string;
}

function postOne(
  state: WorkshopState,
  accountId: string,
  side: CurrencySide,
  entry: Omit<LedgerEntry, 'id' | 'balance'>,
): { state: WorkshopState; entryId: string } {
  const def = getAccountDef(accountId);
  const mode = def ? getBalanceMode(def, side) : 'credit-minus-debit';
  const account = state.accounts[accountId];
  const updated = addEntry(account, side, entry, mode);
  return {
    state: {
      ...state,
      accounts: { ...state.accounts, [accountId]: updated },
    },
    entryId: updated[side][updated[side].length - 1].id,
  };
}

export function applyInvoicePostings(
  state: WorkshopState,
  description: string,
  date: string,
  postings: InvoicePosting[],
): { state: WorkshopState; refs: PostedEntryRef[] } {
  let next = state;
  const refs: PostedEntryRef[] = [];

  for (const p of postings) {
    const entry = {
      date,
      debit: p.debit,
      credit: p.credit,
      description,
    };
    const result = postOne(next, p.accountId, p.side, entry);
    next = result.state;
    refs.push({ accountId: p.accountId, side: p.side, entryId: result.entryId });
  }

  return { state: next, refs };
}

export function removeInvoiceFromState(state: WorkshopState, invoice: WorkshopInvoice): WorkshopState {
  let next = state;

  for (const ref of invoice.entryRefs) {
    const def = getAccountDef(ref.accountId);
    const mode = def ? getBalanceMode(def, ref.side) : 'credit-minus-debit';
    const account = next.accounts[ref.accountId];
    next = {
      ...next,
      accounts: {
        ...next.accounts,
        [ref.accountId]: deleteEntry(account, ref.side, ref.entryId, mode),
      },
    };
  }

  return {
    ...next,
    invoices: (next.invoices ?? []).filter((i) => i.id !== invoice.id),
  };
}

export function createInvoiceRecord(
  input: {
    number: string;
    date: string;
    customer: string;
    type: WorkshopInvoice['type'];
    description: string;
    postings: InvoicePosting[];
    entryRefs: PostedEntryRef[];
    workedWeight?: number;
    receivedUsd?: number;
    usdAmount?: number;
    wageUsd?: number;
    wagePerGramUsd?: number;
    rawGoldGiven?: number;
    stoneDiscountGrams?: number;
    profitRate: number;
  },
): WorkshopInvoice {
  return {
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    number: input.number,
    date: input.date,
    customer: input.customer,
    type: input.type,
    description: input.description,
    postings: input.postings,
    entryRefs: input.entryRefs,
    workedWeight: input.workedWeight,
    receivedUsd: input.receivedUsd,
    usdAmount: input.receivedUsd ?? input.usdAmount,
    wageUsd: input.wageUsd,
    wagePerGramUsd: input.wagePerGramUsd,
    rawGoldGiven: input.rawGoldGiven,
    stoneDiscountGrams: input.stoneDiscountGrams,
    profitRate: input.profitRate,
    createdAt: new Date().toISOString(),
  };
}
