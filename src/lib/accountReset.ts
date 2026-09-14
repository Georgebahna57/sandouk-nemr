import type { Transaction } from '../types';
import {
  collectAutoFeeRemovalIds,
  findCounterpartyLinkedPeerIds,
  isCustomerAccountName,
  isFundOperationLead,
  isFundPartyForLedger,
  isMislabeledLinkedAccountFundLeg,
} from './utils';

/** حركة تُحسب ضمن رصيد الحسابات (ledger حساب أو حركة حساب مخزّنة كصندوق) */
export function isAccountSideTransaction(tx: Transaction, transactions: Transaction[]): boolean {
  if ((tx.ledger ?? 'fund') === 'account') return true;
  if (isMislabeledLinkedAccountFundLeg(tx, transactions, tx.fundId)) return true;
  if (
    (tx.ledger ?? 'fund') === 'fund'
    && isCustomerAccountName(tx.party)
    && !isFundPartyForLedger(tx.party, tx.fundId)
    && transactions.some(f => isFundOperationLead(f) && findCounterpartyLinkedPeerIds(transactions, f).includes(tx.id))
  ) {
    return true;
  }
  return false;
}

export interface AccountResetPreview {
  transactionCount: number;
  accountNames: string[];
}

export function previewAccountReset(transactions: Transaction[]): AccountResetPreview {
  const accountNames = new Set<string>();
  let transactionCount = 0;
  for (const tx of transactions) {
    if (!isAccountSideTransaction(tx, transactions)) continue;
    transactionCount += 1;
    if (isCustomerAccountName(tx.party)) accountNames.add(tx.party.trim());
  }
  return {
    transactionCount,
    accountNames: [...accountNames].sort((a, b) => a.localeCompare(b, 'ar')),
  };
}

/** معرّفات كل حركات الحسابات — لا يمس حركات الصندوق */
export function collectAccountResetIds(transactions: Transaction[]): string[] {
  const accountIds = transactions
    .filter(tx => isAccountSideTransaction(tx, transactions))
    .map(tx => tx.id);
  const feeIds = collectAutoFeeRemovalIds(transactions, accountIds);
  return [...new Set([...accountIds, ...feeIds])];
}
