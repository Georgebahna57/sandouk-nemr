import type { FundId } from '../types';

/** صناديق تُسجَّل كل عملية فيها بين حساب الصندوق وحساب زبون يختاره المستخدم */
const FUNDS_WITH_ACCOUNT_LINK: FundId[] = ['nemr', 'zalqa', 'george'];

export function fundRequiresAccountLink(fundId: FundId): boolean {
  return FUNDS_WITH_ACCOUNT_LINK.includes(fundId);
}
