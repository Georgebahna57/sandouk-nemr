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
