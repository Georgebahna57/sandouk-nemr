import { getAccountDef } from './accountsConfig';
import { getLedgerBalance } from './dashboard';
import { scrapBalanceToRamla995 } from './karat';
import type { WorkshopState } from '../types';

/** صف ورقة «رئيسي» المرتبط بحساب — نفس مصدر لوحة الملخص */
export function findMainSheetRowForAccount(state: WorkshopState, accountId: string) {
  const snap = state.mainSheetSnapshot;
  if (!snap) return undefined;
  return [...snap.assets, ...snap.liabilities].find(
    (r) => r.navigateAccountId === accountId || r.accountId === accountId,
  );
}

export interface AccountGoldSummaryDisplay {
  /** القيمة المعروضة أعلى الدفتر — ذهب 995 / مكافئ رملة */
  value: number;
  /** رصيد آخر حركة في دفتر الذهب (وزن كسر أو 995 حسب الحساب) */
  ledgerRaw: number;
  /** من ورقة رئيسي — مطابق لوحة الملخص */
  fromMainSheet: boolean;
}

/**
 * رصيد الذهب المعروض داخل الحساب — يطابق لوحة الملخص عند وجود ورقة «رئيسي».
 * حسابات الكسر في Excel: الملخص يعرض مكافئ 995 المحسوب في الورقة، وليس تحويلاً من دفتر قد يكون ناقصاً بعد الاستيراد.
 */
export function getAccountGoldSummaryDisplay(
  state: WorkshopState,
  accountId: string,
): AccountGoldSummaryDisplay {
  const ledgerRaw = getLedgerBalance(state, accountId).gold;
  const mainRow = findMainSheetRowForAccount(state, accountId);
  if (mainRow != null) {
    return { value: mainRow.gold, ledgerRaw, fromMainSheet: true };
  }

  const fineness = getAccountDef(accountId)?.goldSummaryFineness;
  if (fineness != null) {
    return {
      value: scrapBalanceToRamla995(ledgerRaw, fineness),
      ledgerRaw,
      fromMainSheet: false,
    };
  }

  return { value: ledgerRaw, ledgerRaw, fromMainSheet: false };
}
