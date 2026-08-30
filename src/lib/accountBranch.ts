import { CENTERS_FUND_ID, isBoxFund } from '../config';
import type { AccountBranchId, Customer, Fund, FundId, Transaction } from '../types';
import { applyCustomerFundMove } from './utils';

export const ACCOUNT_BRANCH_LABELS: Record<AccountBranchId, string> = {
  centers: 'مراكز',
  customers: 'زبائن',
};

/** صندوق الحركات الداخلي لقسم الزبائن — لا يُعرض كتبعيّة للحساب */
export function getCustomersLedgerFundId(boxFunds: Fund[]): FundId {
  const f = boxFunds.find(b => b.id !== CENTERS_FUND_ID && b.id !== 'halabFleilat');
  return f?.id ?? 'nemr';
}

export function customerBoxFundIds(boxFundIds: FundId[]): FundId[] {
  return boxFundIds.filter(id => id !== CENTERS_FUND_ID && id !== 'halabFleilat');
}

export function getCustomerAccountBranch(customer: Customer): AccountBranchId {
  if (customer.accountBranch) return customer.accountBranch;
  if (customer.fundId === CENTERS_FUND_ID) return 'centers';
  return 'customers';
}

export function inferAccountBranch(
  transactions: Transaction[],
  accountName: string,
  customer?: Customer,
): AccountBranchId {
  if (customer) return getCustomerAccountBranch(customer);

  const trimmed = accountName.trim();
  let onCenters = false;
  let onCustomers = false;

  for (const tx of transactions) {
    if ((tx.ledger ?? 'fund') !== 'account' || tx.party !== trimmed) continue;
    if (tx.fundId === CENTERS_FUND_ID) onCenters = true;
    else if (isBoxFund(tx.fundId) && tx.fundId !== 'halabFleilat') onCustomers = true;
  }

  if (onCenters && !onCustomers) return 'centers';
  if (onCustomers) return 'customers';
  return 'centers';
}

export function branchLedgerFundId(
  branch: AccountBranchId,
  customersLedgerFundId: FundId,
): FundId {
  return branch === 'centers' ? CENTERS_FUND_ID : customersLedgerFundId;
}

export function accountExistsInBranch(
  customers: Customer[],
  branch: AccountBranchId,
  name: string,
  excludeCustomerId?: string,
): boolean {
  const trimmed = name.trim();
  return customers.some(c => (
    c.id !== excludeCustomerId
    && c.name === trimmed
    && getCustomerAccountBranch(c) === branch
  ));
}

export function prepareCustomerForBranch(
  customer: Customer,
  branch: AccountBranchId,
  customersLedgerFundId: FundId,
): Customer {
  return {
    ...customer,
    fundId: branchLedgerFundId(branch, customersLedgerFundId),
    accountBranch: branch,
    sharedFundIds: undefined,
  };
}

/** نقل الحساب بين مراكز ↔ زبائن — يجمع الحركات من كل الصناديق ثم ينقلها */
export function applyAccountBranchMove(
  transactions: Transaction[],
  accountName: string,
  toBranch: AccountBranchId,
  customersLedgerFundId: FundId,
): { transactions: Transaction[]; changed: Transaction[] } {
  const targetFundId = branchLedgerFundId(toBranch, customersLedgerFundId);
  const trimmed = accountName.trim();
  const sourceFunds = new Set<FundId>();

  for (const tx of transactions) {
    if ((tx.ledger ?? 'fund') === 'account' && tx.party === trimmed) {
      sourceFunds.add(tx.fundId);
    }
  }

  let updated = transactions;
  const changedMap = new Map<string, Transaction>();

  for (const sourceFund of sourceFunds) {
    if (sourceFund === targetFundId) continue;
    const result = applyCustomerFundMove(updated, trimmed, sourceFund, targetFundId);
    updated = result.transactions;
    for (const tx of result.changed) changedMap.set(tx.id, tx);
  }

  return { transactions: updated, changed: [...changedMap.values()] };
}
