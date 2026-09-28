import { getAccountDef } from './accountsConfig';
import { getDashboardBalance, getLedgerBalance } from './dashboard';
import { scrapBalanceToRamla995 } from './karat';
import type { DashboardRow, WorkshopState } from '../types';

export type AccountLedgerFocus = 'both' | 'gold' | 'usd';

export interface AccountSideSummaryDisplay {
  value: number;
  ledgerRaw: number;
  fromMainSheet: boolean;
}

export type AccountGoldSummaryDisplay = AccountSideSummaryDisplay;

/** كل صفوف «رئيسي» المرتبطة بنفس الحساب (مثل مشغول 18 + أجور 18 → wages18) */
export function findMainSheetRowsForAccount(state: WorkshopState, accountId: string): DashboardRow[] {
  const snap = state.mainSheetSnapshot;
  if (!snap) return [];
  return [...snap.assets, ...snap.liabilities].filter(
    (r) => r.navigateAccountId === accountId || r.accountId === accountId,
  );
}

function pickMainSheetSide(
  rows: DashboardRow[],
  side: 'gold' | 'usd',
  focus: AccountLedgerFocus,
): number | undefined {
  if (!rows.length) return undefined;

  const focusKey = focus === 'gold' ? 'gold' : focus === 'usd' ? 'usd' : undefined;
  if (focusKey) {
    const byFocus = rows.find((r) => r.ledgerFocus === focusKey);
    if (byFocus) return byFocus[side];
  }

  const withSideFocus = rows.find((r) => r.ledgerFocus === side);
  if (withSideFocus) return withSideFocus[side];

  const nonZero = rows.find((r) => Math.abs(r[side]) > 0.0001);
  if (nonZero) return nonZero[side];

  return rows[0][side];
}

function goldFromDashboardRules(state: WorkshopState, accountId: string, ledgerGold: number): number {
  const fineness = getAccountDef(accountId)?.goldSummaryFineness;
  if (fineness != null) return scrapBalanceToRamla995(ledgerGold, fineness);
  return getDashboardBalance(state, accountId).gold;
}

function usdFromDashboardRules(state: WorkshopState, accountId: string): number {
  return getDashboardBalance(state, accountId).usd;
}

export function getAccountGoldSummaryDisplay(
  state: WorkshopState,
  accountId: string,
  focus: AccountLedgerFocus = 'both',
): AccountSideSummaryDisplay {
  const ledgerRaw = getLedgerBalance(state, accountId).gold;
  const rows = findMainSheetRowsForAccount(state, accountId);

  if (rows.length > 0) {
    const picked = pickMainSheetSide(rows, 'gold', focus);
    return {
      value: picked ?? ledgerRaw,
      ledgerRaw,
      fromMainSheet: true,
    };
  }

  if (!state.mainSheetSnapshot) {
    return {
      value: goldFromDashboardRules(state, accountId, ledgerRaw),
      ledgerRaw,
      fromMainSheet: false,
    };
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

export function getAccountUsdSummaryDisplay(
  state: WorkshopState,
  accountId: string,
  focus: AccountLedgerFocus = 'both',
): AccountSideSummaryDisplay {
  const ledgerRaw = getLedgerBalance(state, accountId).usd;
  const rows = findMainSheetRowsForAccount(state, accountId);

  if (rows.length > 0) {
    const picked = pickMainSheetSide(rows, 'usd', focus);
    return {
      value: picked ?? ledgerRaw,
      ledgerRaw,
      fromMainSheet: true,
    };
  }

  return {
    value: usdFromDashboardRules(state, accountId),
    ledgerRaw,
    fromMainSheet: !state.mainSheetSnapshot ? false : false,
  };
}

/** هل يُفضَّل إظهار ملاحظة أن الدفتر يختلف عن الملخص؟ */
export function shouldShowLedgerRawNote(
  display: AccountSideSummaryDisplay,
  tolerance = 0.02,
): boolean {
  return Math.abs(display.ledgerRaw - display.value) > tolerance;
}
