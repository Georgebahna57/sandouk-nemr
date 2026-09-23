import { parseNum } from './format';
import type { DashboardRow, MainSheetSnapshot } from '../types';

/** ربط صفوف ورقة «رئيسي» بحسابات التطبيق */
const MAIN_LABEL_TO_ACCOUNT: Record<string, string> = {
  ماكينات: 'machines',
  'مصاريف تأسيس الورشة': 'setup',
  'خزنة رئيسية': 'mainTreasury',
  'تحت التصنيع': 'underMfg',
  'مشغول 18': 'wages18',
  'مشغول 21': 'wages21',
  'كسر 18': 'scrap18',
  كسر21: 'scrap21',
  رملة: 'sand',
  'كسر 22': 'scrap22',
  'كسر صب 18': 'cast18',
  'SILVER $': 'silver',
  شمع: 'wax',
  'ALLOY سحب': 'alloyPull',
  'ALLOY صب': 'alloyCast',
  'زبائن ورشة': 'customers',
  'مصاريف تشغيلية': 'operational',
  'مصاريف شهرية': 'monthly',
  بورصة: 'cash',
  متاجرة: 'trading',
  'Paid from Ahmad': 'ahmad',
  'Paid from Mazen': 'mzen',
  'اجور مستلمة عن 21': 'wages21',
  'اجور مستلمة عن 18': 'wages18',
  profit: 'pro',
};

function slugId(label: string): string {
  return `main_${label.replace(/\s+/g, '_')}`;
}

function rowFromExcelLabel(label: string, gold: number, usd: number): DashboardRow {
  const accountId = MAIN_LABEL_TO_ACCOUNT[label] ?? slugId(label);
  const navigateAccountId = MAIN_LABEL_TO_ACCOUNT[label] ?? accountId;
  let ledgerFocus: DashboardRow['ledgerFocus'];
  if (label === 'اجور مستلمة عن 18' || label === 'اجور مستلمة عن 21') ledgerFocus = 'usd';
  if (label === 'مشغول 18' || label === 'مشغول 21') ledgerFocus = 'gold';
  if (label === 'بورصة') ledgerFocus = 'usd';
  if (label === 'SILVER $' || label === 'شمع' || label === 'ALLOY سحب' || label === 'ALLOY صب') ledgerFocus = 'usd';

  return {
    label,
    gold,
    usd,
    accountId,
    navigateAccountId,
    ledgerFocus,
  };
}

/** قراءة ورقة «رئيسي» كما في Excel */
export function parseMainSheet(rows: unknown[][]): MainSheetSnapshot | null {
  const assets: DashboardRow[] = [];
  const liabilities: DashboardRow[] = [];
  let totalAssets = { gold: 0, usd: 0 };
  let totalLiab = { gold: 0, usd: 0 };
  let goldDiff = 0;
  let usdDiff = 0;

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const leftLabel = String(row[1] ?? '').trim();
    const rightLabel = String(row[5] ?? '').trim();

    if (leftLabel === 'المجموع') {
      totalAssets = { gold: parseNum(row[2]) ?? 0, usd: parseNum(row[3]) ?? 0 };
      totalLiab = { gold: parseNum(row[6]) ?? 0, usd: parseNum(row[7]) ?? 0 };
      continue;
    }
    if (leftLabel === 'الفرق ذهب' || rightLabel === 'الفرق ذهب') {
      goldDiff = parseNum(row[3]) ?? parseNum(row[6]) ?? 0;
      continue;
    }
    if (leftLabel === 'الفرق دولار' || rightLabel === 'الفرق دولار') {
      usdDiff = parseNum(row[3]) ?? parseNum(row[6]) ?? 0;
      continue;
    }

    if (leftLabel) {
      assets.push(rowFromExcelLabel(leftLabel, parseNum(row[2]) ?? 0, parseNum(row[3]) ?? 0));
    }
    if (rightLabel) {
      liabilities.push(rowFromExcelLabel(rightLabel, parseNum(row[6]) ?? 0, parseNum(row[7]) ?? 0));
    }
  }

  if (!assets.length && !liabilities.length) return null;

  if (!totalAssets.gold && !totalAssets.usd && assets.length) {
    totalAssets = {
      gold: assets.reduce((s, r) => s + r.gold, 0),
      usd: assets.reduce((s, r) => s + r.usd, 0),
    };
  }
  if (!totalLiab.gold && !totalLiab.usd && liabilities.length) {
    totalLiab = {
      gold: liabilities.reduce((s, r) => s + r.gold, 0),
      usd: liabilities.reduce((s, r) => s + r.usd, 0),
    };
  }
  if (!goldDiff && !usdDiff) {
    goldDiff = totalAssets.gold + totalLiab.gold;
    usdDiff = totalAssets.usd + totalLiab.usd;
  }

  return { assets, liabilities, totalAssets, totalLiab, goldDiff, usdDiff };
}
