import type { Transaction } from '../types';
import type { ParsedFee } from './fees';
import {
  inferFeeSourceAccount,
  isAutoFeeTransaction,
  isFeeAccountName,
  isShamelFeeEligible,
  resolveFeeAccountName,
  resolveTransactionExtraFee,
  resolveTransactionFee,
  SHAMEL_FEE_ACCOUNT,
} from './fees';
import { createAccountTransaction, getOperationGroupIds } from './utils';
import { encodeNoteMeta } from './txMeta';

export function getFundOperationKeys(tx: Transaction): string {
  return tx.linkId ?? tx.batchId ?? tx.id;
}

export function getFundLeadsForFeeSync(txs: Transaction[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const tx of txs) {
    if (tx.ledger !== 'fund' || tx.kind === 'exchange') continue;
    const key = getFundOperationKeys(tx);
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(tx.id);
  }
  return ids;
}

function operationHasFundLead(txs: Transaction[], txId: string): boolean {
  const opIds = getOperationGroupIds(txs, txId);
  return txs.some(t => opIds.includes(t.id) && t.ledger === 'fund' && t.kind !== 'exchange');
}

/** عمليات حساب فقط (بدون صندوق) تحمل أجوراً */
export function getAccountLeadsForFeeSync(txs: Transaction[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const tx of txs) {
    if (tx.ledger !== 'account' || tx.kind === 'exchange' || isFeeAccountName(tx.party) || tx.feeSourceId) {
      continue;
    }
    if (!resolveTransactionFee(tx) && !resolveTransactionExtraFee(tx)) continue;
    if (operationHasFundLead(txs, tx.id)) continue;
    const key = getFundOperationKeys(tx);
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(tx.id);
  }
  return ids;
}

export function getFeeSyncLeadIds(txs: Transaction[]): string[] {
  return [...getFundLeadsForFeeSync(txs), ...getAccountLeadsForFeeSync(txs)];
}

export function findAutoFeeTx(
  transactions: Transaction[],
  fundLeadId: string,
  feeAccount: string,
): Transaction | undefined {
  return transactions.find(
    t => isAutoFeeTransaction(t) && t.feeSourceId === fundLeadId && t.party === feeAccount,
  );
}

function feeNoteLabel(
  feeAccount: string,
  label?: string,
): string {
  if (feeAccount === SHAMEL_FEE_ACCOUNT) {
    return label ? `عمولات شاملة — ${label}` : 'عمولات شاملة';
  }
  return label ? `أجور — ${label}` : 'أجور تلقائية';
}

export function buildAutoFeeTransaction(
  fundLead: Transaction,
  operationTxs: Transaction[],
  feeAccount: string,
  resolveFee: (tx: Transaction) => ParsedFee | undefined,
  existing?: Transaction,
): Transaction | undefined {
  const fee = resolveFee(fundLead);
  if (fundLead.status !== 'posted' || !fee || fee.amount <= 0) {
    return undefined;
  }
  if (fee.side !== 'ours') {
    return undefined;
  }

  const sourceAccount = inferFeeSourceAccount(operationTxs);
  if (feeAccount === SHAMEL_FEE_ACCOUNT && !isShamelFeeEligible(sourceAccount ?? fundLead.counterparty)) {
    return undefined;
  }

  const label = sourceAccount ?? fundLead.counterparty;
  const userNote = feeNoteLabel(feeAccount, label);

  const base = createAccountTransaction({
    fundId: fundLead.fundId,
    date: fundLead.date,
    currency: fee.currency,
    kind: 'receipt',
    amount: fee.amount,
    party: feeAccount,
    note: encodeNoteMeta(userNote, { feeSourceId: fundLead.id }),
    status: 'posted',
    feeSourceId: fundLead.id,
    createdByUserId: fundLead.createdByUserId,
    createdByEmail: fundLead.createdByEmail,
    createdByName: fundLead.createdByName,
  });

  if (existing) {
    return { ...base, id: existing.id, createdAt: existing.createdAt };
  }
  return base;
}

function syncOneAutoFee(
  transactions: Transaction[],
  lead: Transaction,
  opTxs: Transaction[],
  feeAccount: string,
  resolveFee: (tx: Transaction) => ParsedFee | undefined,
): { transactions: Transaction[]; changed: Transaction[]; removedIds: string[] } {
  const existing = findAutoFeeTx(transactions, lead.id, feeAccount);
  const built = buildAutoFeeTransaction(lead, opTxs, feeAccount, resolveFee, existing);

  if (!built) {
    if (!existing) return { transactions, changed: [], removedIds: [] };
    return {
      transactions: transactions.filter(t => t.id !== existing.id),
      changed: [],
      removedIds: [existing.id],
    };
  }

  if (existing) {
    const same = existing.amount === built.amount
      && existing.currency === built.currency
      && existing.party === built.party
      && existing.date === built.date
      && existing.status === built.status
      && existing.feeSourceId === built.feeSourceId;
    if (same) return { transactions, changed: [], removedIds: [] };
    return {
      transactions: transactions.map(t => (t.id === existing.id ? built : t)),
      changed: [built],
      removedIds: [],
    };
  }

  return {
    transactions: [...transactions, built],
    changed: [built],
    removedIds: [],
  };
}

export function syncAutoFeesForOperations(
  transactions: Transaction[],
  leadIds: string[],
): { transactions: Transaction[]; changed: Transaction[]; removedIds: string[] } {
  let next = transactions;
  const changed: Transaction[] = [];
  const removedIds: string[] = [];

  for (const leadId of leadIds) {
    const lead = next.find(t => t.id === leadId && (t.ledger === 'fund' || t.ledger === 'account'));
    if (!lead || lead.kind === 'exchange') continue;

    const opIds = getOperationGroupIds(next, leadId);
    const opTxs = next.filter(t => opIds.includes(t.id));
    const sourceAccount = inferFeeSourceAccount(opTxs) ?? lead.counterparty;
    const slots: { account: string; resolveFee: (tx: Transaction) => ParsedFee | undefined }[] = [
      { account: resolveFeeAccountName(sourceAccount), resolveFee: resolveTransactionFee },
    ];
    if (isShamelFeeEligible(sourceAccount)) {
      slots.push({ account: SHAMEL_FEE_ACCOUNT, resolveFee: resolveTransactionExtraFee });
    }

    for (const slot of slots) {
      const result = syncOneAutoFee(next, lead, opTxs, slot.account, slot.resolveFee);
      next = result.transactions;
      changed.push(...result.changed);
      removedIds.push(...result.removedIds);
    }
  }

  return { transactions: next, changed, removedIds };
}

export function collectFeeSyncLeadIds(
  transactions: Transaction[],
  affectedIds: string[],
): string[] {
  const keys = new Set<string>();
  const leadIds: string[] = [];

  for (const id of affectedIds) {
    for (const opId of getOperationGroupIds(transactions, id)) {
      const tx = transactions.find(t => t.id === opId);
      if (!tx || tx.kind === 'exchange') continue;

      if (tx.ledger === 'fund') {
        const key = getFundOperationKeys(tx);
        if (keys.has(key)) continue;
        keys.add(key);
        leadIds.push(tx.id);
        continue;
      }

      if (
        tx.ledger === 'account'
        && !isFeeAccountName(tx.party)
        && !tx.feeSourceId
        && !operationHasFundLead(transactions, tx.id)
        && (resolveTransactionFee(tx) || resolveTransactionExtraFee(tx))
      ) {
        const key = getFundOperationKeys(tx);
        if (keys.has(key)) continue;
        keys.add(key);
        leadIds.push(tx.id);
      }
    }
  }

  return leadIds;
}
