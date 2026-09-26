import { getAccountDef } from './accountsConfig';
import { fromGold995, roundGold, roundUsd, toGold995 } from './karat';
import type {
  InvoiceInput,
  InvoiceLineInput,
  InvoicePosting,
  InvoiceType,
  MaterialType,
} from '../types';

export const DEFAULT_PROFIT_RATE = 0.002;

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  sale18: 'فاتورة كاش — مشغول 18',
  sale21: 'فاتورة كاش — مشغول 21',
  workshop: 'زبون ورشة',
  purchase: 'شراء ذهب',
};

export const MATERIAL_LABELS: Record<MaterialType, string> = {
  usd: 'دولار',
  gold995: 'ذهب رملة 995',
  worked18: 'مشغول عيار 18',
  worked21: 'مشغول عيار 21',
  scrap18: 'كسر 18',
  scrap21: 'كسر 21',
  scrap22: 'كسر 22',
  raw_gold: 'دهب خام (995)',
};

const MATERIAL_ACCOUNT: Record<MaterialType, { accountId: string; side: 'gold' | 'usd' }> = {
  usd: { accountId: 'dollar', side: 'usd' },
  gold995: { accountId: 'sand', side: 'gold' },
  worked18: { accountId: 'wages18', side: 'gold' },
  worked21: { accountId: 'wages21', side: 'gold' },
  scrap18: { accountId: 'scrap18', side: 'gold' },
  scrap21: { accountId: 'scrap21', side: 'gold' },
  scrap22: { accountId: 'scrap22', side: 'gold' },
  raw_gold: { accountId: 'sand', side: 'gold' },
};

function posting(
  accountId: string,
  side: 'gold' | 'usd',
  debit?: number,
  credit?: number,
  note?: string,
): InvoicePosting | null {
  const d = debit ? roundGold(debit) : undefined;
  const c = credit ? roundGold(credit) : undefined;
  if (side === 'usd') {
    const rd = debit ? roundUsd(debit) : undefined;
    const rc = credit ? roundUsd(credit) : undefined;
    if (!rd && !rc) return null;
    const def = getAccountDef(accountId);
    return {
      accountId,
      side,
      debit: rd,
      credit: rc,
      accountName: def ? `${def.nameAr} (${def.sheetName})` : accountId,
      note,
    };
  }
  if (!d && !c) return null;
  const def = getAccountDef(accountId);
  return {
    accountId,
    side,
    debit: d,
    credit: c,
    accountName: def ? `${def.nameAr} (${def.sheetName})` : accountId,
    note,
  };
}

function mergePostings(lines: InvoicePosting[]): InvoicePosting[] {
  const map = new Map<string, InvoicePosting>();
  for (const line of lines) {
    if (!line) continue;
    const key = `${line.accountId}:${line.side}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...line });
      continue;
    }
    map.set(key, {
      ...prev,
      debit: roundGold((prev.debit ?? 0) + (line.debit ?? 0)),
      credit: roundGold((prev.credit ?? 0) + (line.credit ?? 0)),
      note: prev.note && line.note ? `${prev.note} · ${line.note}` : prev.note ?? line.note,
    });
  }
  return [...map.values()].filter((p) => (p.debit ?? 0) > 0 || (p.credit ?? 0) > 0);
}

function profitGold(weight: number, rate: number): number {
  return roundGold(weight * rate);
}

/** وزن الذهب الصافي بعد خصم الحجر */
export function resolveMetalWeight(input: Pick<InvoiceInput, 'workedWeight' | 'stoneDiscountGrams'>): number {
  const gross = input.workedWeight ?? 0;
  const stone = Math.max(0, input.stoneDiscountGrams ?? 0);
  return roundGold(Math.max(0, gross - stone));
}

/** إجمالي الأجور $ — من (أجور الغرام × الوزن الصافي) أو من المبلغ الإجمالي القديم */
export function resolveWageUsd(
  input: Pick<InvoiceInput, 'workedWeight' | 'stoneDiscountGrams' | 'wageUsd' | 'wagePerGramUsd'>,
): number {
  const metalW = resolveMetalWeight({
    workedWeight: input.workedWeight,
    stoneDiscountGrams: input.stoneDiscountGrams,
  });
  const perGram = input.wagePerGramUsd;
  if (perGram != null && Number.isFinite(perGram)) {
    return roundUsd(perGram * metalW);
  }
  return roundUsd(input.wageUsd ?? 0);
}

/** مقبوض وأجور → صافي (مقبوض − أجور) */
export function resolveInvoiceUsdAmounts(
  input: Pick<
    InvoiceInput,
    'receivedUsd' | 'usdAmount' | 'wageUsd' | 'wagePerGramUsd' | 'workedWeight' | 'stoneDiscountGrams'
  >,
) {
  const wageUsd = resolveWageUsd(input);
  /** فاتورة كاش: المقبوض في receivedUsd؛ usdAmount للتوافق مع فواتير قديمة (كانت صافيًا) */
  const receivedUsd = roundUsd(
    input.receivedUsd != null ? input.receivedUsd : (input.usdAmount ?? 0),
  );
  const netUsd = roundUsd(Math.max(0, receivedUsd - wageUsd));
  return { receivedUsd, wageUsd, netUsd };
}

function stoneNote(input: InvoiceInput, base: string): string {
  const stone = input.stoneDiscountGrams ?? 0;
  if (!stone) return base;
  return `${base} (خصم حجر ${stone}غ)`;
}

/**
 * فاتورة كاش — مشغول 18/21 + متاجرة (عند قبض $ صافي) + ربح + استلام (رملة/دولار)
 *
 * - مشغول: تسليم وزن الأجور + استلام أجور $
 * - متاجرة: عند وجود «صافي قبض $» (مقبوض − أجور) — بيع 995 + ذلك المبلغ
 * - ربح Pro: 2 غرام / كيلو على وزن المشغول (0.002 × الوزن بالغرام)
 * - استلام: عند عدم وجود صافي $ — قبض مكافئ 995 على «رملة» + دولار للصندوق
 */
function calcSale18(input: InvoiceInput, profitRate: number): InvoicePosting[] {
  const metalW = resolveMetalWeight(input);
  const { receivedUsd, wageUsd, netUsd } = resolveInvoiceUsdAmounts(input);
  const karat = input.karat ?? 18;
  const proGoldAmt = profitGold(metalW, profitRate);
  const fine995 = toGold995(metalW, karat);
  const wagesAccount = karat === 21 ? 'wages21' : 'wages18';
  const cashToBox = receivedUsd;
  /** بيع متاجرة عندما صافي القبض أكبر من الأجور — وإلا استلام رملة (كما في Excel) */
  const useTradingPath = netUsd > 0 && netUsd > wageUsd;

  const lines: (InvoicePosting | null)[] = [
    posting(wagesAccount, 'gold', undefined, metalW, stoneNote(input, 'تسليم زبائن')),
    wageUsd > 0 ? posting(wagesAccount, 'usd', wageUsd, undefined, 'استلام أجور $') : null,
    proGoldAmt > 0 ? posting('pro', 'gold', undefined, proGoldAmt, stoneNote(input, 'ربح إنتاج (2غ/كغ)')) : null,
  ];

  if (useTradingPath && fine995 > 0) {
    lines.push(
      posting('trading', 'gold', fine995, undefined, 'مبيع'),
      posting('trading', 'usd', undefined, netUsd, 'مقبوض − أجور'),
    );
  } else if (fine995 > 0) {
    lines.push(posting('sand', 'gold', undefined, fine995, 'استلام رملة 995'));
  }

  if (cashToBox > 0) {
    lines.push(posting('dollar', 'usd', undefined, cashToBox, 'صندوق — قبض'));
  }

  return mergePostings(lines.filter(Boolean) as InvoicePosting[]);
}

function calcSale21(input: InvoiceInput, profitRate: number): InvoicePosting[] {
  return calcSale18({ ...input, karat: 21 }, profitRate);
}

/** زبون ورشة — زبائن + أجور + ربح + دهب خام */
function calcWorkshop(input: InvoiceInput, profitRate: number): InvoicePosting[] {
  const metalW = resolveMetalWeight(input);
  const usd = input.usdAmount ?? 0;
  const rawGold = input.rawGoldGiven ?? 0;
  const karat = input.karat ?? 18;
  const pro = profitGold(metalW, profitRate);
  const customerGold = roundGold(Math.max(0, toGold995(metalW, karat) - rawGold));
  const wagesAccount = karat === 21 ? 'wages21' : 'wages18';

  const lines: (InvoicePosting | null)[] = [
    posting('customers', 'gold', customerGold, undefined, 'زبون'),
    posting('customers', 'usd', undefined, usd, 'زبون'),
    posting(wagesAccount, 'gold', undefined, metalW, stoneNote(input, 'تسليم زبائن')),
    posting(wagesAccount, 'usd', usd, undefined, 'استلام أجور $'),
    posting('pro', 'gold', undefined, pro, stoneNote(input, 'ربح إنتاج')),
  ];
  if (rawGold > 0) {
    lines.push(posting('gold', 'gold', rawGold, undefined, 'دهب خام'));
  }
  return mergePostings(lines.filter(Boolean) as InvoicePosting[]);
}

/** شراء — متاجرة + دولار */
function calcPurchase(input: InvoiceInput): InvoicePosting[] {
  const W = input.workedWeight ?? 0;
  const usd = input.usdAmount ?? 0;
  const karat = input.karat ?? 18;
  const gold995 = toGold995(W, karat);

  const lines: (InvoicePosting | null)[] = [
    posting('trading', 'gold', undefined, gold995, 'شراء'),
    posting('trading', 'usd', usd, undefined, 'شراء'),
    usd > 0 ? posting('dollar', 'usd', usd, undefined, 'صندوق — خروج') : null,
  ];
  return mergePostings(lines.filter(Boolean) as InvoicePosting[]);
}

/** سطر مادة إضافي (كسر / رملة / دولار…) */
function calcMaterialLine(line: InvoiceLineInput): InvoicePosting | null {
  const { accountId, side } = MATERIAL_ACCOUNT[line.material];
  const amount = line.amount;
  if (!amount) return null;

  if (line.material === 'usd') {
    return line.direction === 'receive'
      ? posting(accountId, side, amount, undefined, MATERIAL_LABELS[line.material])
      : posting(accountId, side, undefined, amount, MATERIAL_LABELS[line.material]);
  }

  const def = getAccountDef(accountId);
  const isInout = def?.entryKind === 'inout';
  if (isInout) {
    return line.direction === 'receive'
      ? posting(accountId, side, undefined, amount, MATERIAL_LABELS[line.material])
      : posting(accountId, side, amount, undefined, MATERIAL_LABELS[line.material]);
  }

  return line.direction === 'receive'
    ? posting(accountId, side, undefined, amount, MATERIAL_LABELS[line.material])
    : posting(accountId, side, amount, undefined, MATERIAL_LABELS[line.material]);
}

export function buildInvoiceDescription(
  number: string,
  customer: string,
  stoneDiscountGrams?: number,
): string {
  const num = number.trim();
  const cust = customer.trim();
  const prefix = num.startsWith('ف') ? num : `ف ${num}`;
  let desc = cust ? `${prefix} // ${cust}` : prefix;
  const stone = stoneDiscountGrams ?? 0;
  if (stone > 0) desc += ` // خصم حجر ${stone}غ`;
  return desc;
}

export function suggestNextInvoiceNumber(existing: string[]): string {
  const nums = existing
    .map((n) => parseInt(n.replace(/\D/g, ''), 10))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 2800;
  return String(max + 1).padStart(6, '0');
}

export interface CalcResult {
  description: string;
  postings: InvoicePosting[];
  summary: {
    workedWeight995: number;
    profitGold: number;
    totalUsd: number;
    netUsd: number;
    receivedUsd: number;
    wageUsd: number;
    metalWeight: number;
    stoneDiscountGrams: number;
  };
}

export function calculateInvoice(input: InvoiceInput, profitRate = DEFAULT_PROFIT_RATE): CalcResult {
  const rate = input.profitRateOverride ?? profitRate;
  const description = buildInvoiceDescription(input.number, input.customer, input.stoneDiscountGrams);
  const effective: InvoiceInput = {
    ...input,
    wageUsd: resolveWageUsd(input),
  };

  let base: InvoicePosting[] = [];
  switch (effective.type) {
    case 'sale18':
      base = calcSale18(effective, rate);
      break;
    case 'sale21':
      base = calcSale21(effective, rate);
      break;
    case 'workshop':
      base = calcWorkshop(effective, rate);
      break;
    case 'purchase':
      base = calcPurchase(effective);
      break;
  }

  const extra = (input.lines ?? []).map(calcMaterialLine).filter(Boolean) as InvoicePosting[];
  const postings = mergePostings([...base, ...extra]);

  const metalW = resolveMetalWeight(effective);
  const karat = effective.karat ?? 18;
  const pro = effective.type === 'purchase' ? 0 : profitGold(metalW, rate);
  const stone = Math.max(0, effective.stoneDiscountGrams ?? 0);
  const usd =
    effective.type === 'sale18' || effective.type === 'sale21'
      ? resolveInvoiceUsdAmounts(effective)
      : {
          receivedUsd: roundUsd(effective.usdAmount ?? 0),
          wageUsd: roundUsd(effective.wageUsd ?? 0),
          netUsd: roundUsd(effective.usdAmount ?? 0),
        };

  return {
    description,
    postings,
    summary: {
      workedWeight995: roundGold(toGold995(metalW, karat)),
      profitGold: pro,
      totalUsd: usd.receivedUsd,
      netUsd: usd.netUsd,
      receivedUsd: usd.receivedUsd,
      wageUsd: usd.wageUsd,
      metalWeight: metalW,
      stoneDiscountGrams: stone,
    },
  };
}

/** معاينة سريعة للأجور والربح قبل الحفظ */
export function previewWagesProfit(
  weight: number,
  karat: 18 | 21,
  profitRate = DEFAULT_PROFIT_RATE,
  receivedUsd = 0,
  wagePerGramUsd?: number,
  stoneDiscountGrams = 0,
  legacyWageUsd = 0,
) {
  const stone = Math.max(0, stoneDiscountGrams);
  const metalW = roundGold(Math.max(0, weight - stone));
  const pro = profitGold(metalW, profitRate);
  const fine = roundGold(toGold995(metalW, karat));
  const wage = resolveWageUsd({
    workedWeight: weight,
    stoneDiscountGrams: stone,
    wagePerGramUsd,
    wageUsd: legacyWageUsd,
  });
  const received = roundUsd(receivedUsd);
  const net = roundUsd(Math.max(0, received - wage));
  const useTrading = net > 0 && net > wage;
  return {
    grossWeight: roundGold(weight),
    stoneDiscountGrams: stone,
    wagesGold: metalW,
    profitGold: pro,
    receivedUsd: received,
    wageUsd: wage,
    wagePerGramUsd: wagePerGramUsd != null && Number.isFinite(wagePerGramUsd) ? wagePerGramUsd : undefined,
    profitUsd: net,
    tradingGold995: fine,
    fineGold995: fine,
    settlementPath: useTrading ? ('trading' as const) : ('sand' as const),
  };
}

export { fromGold995, toGold995 };
