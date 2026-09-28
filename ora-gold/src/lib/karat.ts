/** نقاوة العيارات — مطابقة لخزنة الورشة */
export const KARAT_PURITY = {
  18: 750,
  21: 875,
  22: 905,
  995: 995,
} as const;

export type KaratKey = keyof typeof KARAT_PURITY;

/** تحويل وزن عيار إلى مكافئ ذهب 995 */
export function toGold995(weight: number, karat: KaratKey): number {
  if (!weight) return 0;
  const purity = KARAT_PURITY[karat];
  return (weight * purity) / KARAT_PURITY[995];
}

/** تحويل من 995 إلى وزن عيار */
export function fromGold995(gold995: number, karat: KaratKey): number {
  if (!gold995) return 0;
  const purity = KARAT_PURITY[karat];
  return (gold995 * KARAT_PURITY[995]) / purity;
}

export function roundGold(n: number): number {
  return Math.round(n * 100) / 100;
}

export function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

/** مكافئ رملة 995 لرصيد كسر — مطابق لصيغة Excel (الرصيد × العيار ÷ 1000) */
export function scrapBalanceToRamla995(balance: number, fineness: number): number {
  if (!balance || !fineness) return 0;
  return (balance * fineness) / 1000;
}

/** عيار قديم في ورقة «رئيسي» قبل التصحيح (مثلاً كسر 22 كان ×910÷1000) */
export const SCRAP_MAIN_SHEET_LEGACY_FINENESS: Partial<Record<string, number>> = {
  scrap22: 910,
};

/**
 * إعادة حساب مكافئ رملة من قيمة «رئيسي» عند تغيّر العيار في التطبيق.
 * مثال: 13.21 (×910) → 13.14 (×905) لنفس وزن الكسر.
 */
export function scrap995FromMainSheetValue(
  accountId: string,
  mainSheetGold995: number,
  fineness: number,
): number {
  const legacy = SCRAP_MAIN_SHEET_LEGACY_FINENESS[accountId];
  if (legacy != null && legacy !== fineness) {
    const scrapWeight = (mainSheetGold995 * 1000) / legacy;
    return roundGold(scrapBalanceToRamla995(scrapWeight, fineness));
  }
  return mainSheetGold995;
}
