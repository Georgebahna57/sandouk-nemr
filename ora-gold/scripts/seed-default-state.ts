/**
 * يولّد src/data/defaultState.json من ملف Excel.
 * npm run seed:excel -- <path-to.xlsx> [periodLabel]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { importWorkbookFromArrayBuffer } from '../src/lib/excelImport';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const xlsxPath = process.argv[2];
const periodArg = process.argv[3];

if (!xlsxPath) {
  console.error('Usage: npx tsx scripts/seed-default-state.ts <file.xlsx> [MM-YYYY]');
  process.exit(1);
}

const buffer = fs.readFileSync(xlsxPath);
const periodFromName = path.basename(xlsxPath).match(/(\d{2}-\d{4})/)?.[1];
const periodLabel = periodArg ?? periodFromName ?? '05-2026';

const state = importWorkbookFromArrayBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), periodLabel);

const out = {
  version: 1,
  periodLabel: state.periodLabel,
  accounts: state.accounts,
  treasury: state.treasury,
  dashboardOverrides: state.dashboardOverrides ?? {},
  updatedAt: new Date().toISOString(),
};

const entryCount = Object.values(out.accounts).reduce(
  (sum, acc) => sum + acc.gold.length + acc.usd.length,
  0,
);

const outPath = path.join(root, 'src/data/defaultState.json');
fs.writeFileSync(outPath, JSON.stringify(out));

console.log(`Wrote ${outPath}`);
console.log(`periodLabel: ${out.periodLabel}`);
console.log(`entries: ${entryCount}`);
