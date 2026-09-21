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
  sale18: 'مبيع مشغول 18',
  sale21: 'مبيع مشغول 21',
  workshop: 'زبون ورشة',
  purchase: 'شراء ذهب',
};

export const MATERIAL_LABELS: Record<MaterialType, string> = {
  usd: 'دولار',
  gold995: 'ذهب رملة 995',
  worked18: 'مشغول عيار 18',
  worked21: 'مشغول عيار 21',
  scrap18_cast: 'كسر 18 صب',
  scrap18_pull: 'كسر 18 سحب',
  scrap21_cast: 'كسر 21 صب',
  scrap21_pull: 'كسر 21 سحب',
  k18: 'K18',
  k21: 'K21',
  raw_gold: 'دهب خام (995)',
};

const MATERIAL_ACCOUNT: Record<MaterialType, { accountId: string; side: 'gold' | 'usd' }> = {
  usd: { accountId: 'dollar', side: 'usd' },
  gold995: { accountId: 'gold', side: 'gold' },
  worked18: { accountId: 'k18', side: 'gold' },
  worked21: { accountId: 'k21', side: 'gold' },
  scrap18_cast: { accountId: 'scrap18Cast', side: 'gold' },
  scrap18_pull: { accountId: 'scrap18Pull', side: 'gold' },
  scrap21_cast: { accountId: 'scrap21Cast', side: 'gold' },
  scrap21_pull: { accountId: 'scrap21Pull', side: 'gold' },
  k18: { accountId: 'k18', side: 'gold' },
  k21: { accountId: 'k21', side: 'gold' },
  raw_gold: { accountId: 'gold', side: 'gold' },
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

/**
 * مبيع مشغول (متاجرة) — مطابق لـ Excel: Trading + مشغول + دولار + Pro
 * (بدون زبائن وبدون K18 تلقائياً — أضف K18/كسر من السطور الإضافية)
 */
function calcSale18(input: InvoiceInput, profitRate: number): InvoicePosting[] {
  const W = input.workedWeight ?? 0;
  const usd = input.usdAmount ?? 0;
  const wageUsd = input.wageUsd ?? 0;
  const karat = input.karat ?? 18;
  const pro = profitGold(W, profitRate);
  const tradingGold = toGold995(W, karat);
  const wagesAccount = karat === 21 ? 'wages21' : 'wages18';
  const cashIn = roundUsd(usd + wageUsd);

  const lines: (InvoicePosting | null)[] = [
    posting('trading', 'gold', tradingGold, undefined, 'مبيع'),
    posting('trading', 'usd', undefined, usd, 'مبيع'),
    posting('pro', 'gold', undefined, pro, 'ربح إنتاج'),
    posting(wagesAccount, 'gold', undefined, W, 'تسليم زبائن'),
    posting(wagesAccount, 'usd', wageUsd, undefined, 'استلام أجور $'),
    cashIn > 0 ? posting('dollar', 'usd', undefined, cashIn, 'صندوق — دخول') : null,
  ];
  return mergePostings(lines.filter(Boolean) as InvoicePosting[]);
}

function calcSale21(input: InvoiceInput, profitRate: number): InvoicePosting[] {
  return calcSale18({ ...input, karat: 21 }, profitRate);
}

/** زبون ورشة — زبائن + أجور + ربح + دهب خام */
function calcWorkshop(input: InvoiceInput, profitRate: number): InvoicePosting[] {
  const W = input.workedWeight ?? 0;
  const usd = input.usdAmount ?? 0;
  const rawGold = input.rawGoldGiven ?? 0;
  const karat = input.karat ?? 18;
  const pro = profitGold(W, profitRate);
  const customerGold = roundGold(Math.max(0, toGold995(W, karat) - rawGold));
  const wagesAccount = karat === 21 ? 'wages21' : 'wages18';

  const lines: (InvoicePosting | null)[] = [
    posting('customers', 'gold', customerGold, undefined, 'زبون'),
    posting('customers', 'usd', undefined, usd, 'زبون'),
    posting(wagesAccount, 'gold', undefined, W, 'تسليم زبائن'),
    posting(wagesAccount, 'usd', usd, undefined, 'استلام أجور $'),
    posting('pro', 'gold', undefined, pro, 'ربح إنتاج'),
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

export function buildInvoiceDescription(number: string, customer: string): string {
  const num = number.trim();
  const cust = customer.trim();
  const prefix = num.startsWith('ف') ? num : `ف ${num}`;
  return cust ? `${prefix} // ${cust}` : prefix;
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
  };
}

export function calculateInvoice(input: InvoiceInput, profitRate = DEFAULT_PROFIT_RATE): CalcResult {
  const rate = input.profitRateOverride ?? profitRate;
  const description = buildInvoiceDescription(input.number, input.customer);

  let base: InvoicePosting[] = [];
  switch (input.type) {
    case 'sale18':
      base = calcSale18(input, rate);
      break;
    case 'sale21':
      base = calcSale21(input, rate);
      break;
    case 'workshop':
      base = calcWorkshop(input, rate);
      break;
    case 'purchase':
      base = calcPurchase(input);
      break;
  }

  const extra = (input.lines ?? []).map(calcMaterialLine).filter(Boolean) as InvoicePosting[];
  const postings = mergePostings([...base, ...extra]);

  const W = input.workedWeight ?? 0;
  const karat = input.karat ?? 18;
  const pro = input.type === 'purchase' ? 0 : profitGold(W, rate);

  return {
    description,
    postings,
    summary: {
      workedWeight995: roundGold(toGold995(W, karat)),
      profitGold: pro,
      totalUsd: roundUsd((input.usdAmount ?? 0) + (input.wageUsd ?? 0)),
    },
  };
}

/** معاينة سريعة للأجور والربح قبل الحفظ */
export function previewWagesProfit(weight: number, karat: 18 | 21, profitRate = DEFAULT_PROFIT_RATE) {
  const pro = profitGold(weight, profitRate);
  const fine = roundGold(toGold995(weight, karat));
  return {
    wagesGold: roundGold(weight),
    profitGold: pro,
    tradingGold995: fine,
    fineGold995: fine,
  };
}

export { fromGold995, toGold995 };
