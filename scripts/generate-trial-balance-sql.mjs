/**
 * يولّد SQL لاستيراد ميزان المراجعة — شغّله من Supabase SQL Editor
 * node scripts/generate-trial-balance-sql.mjs [مسار-الملف] [--fund=nemr] [--out=supabase/import-trial-balance.sql]
 */
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const IMPORT_NOTE = 'استيراد ميزان مراجعة';
const OPENING_NOTE = 'رصيد مرحّل - استيراد';
const META_PREFIX = '[[SNDK-C]]';

function encodeCustomerNote(userNote, accountNumber) {
  const ac = accountNumber?.trim();
  if (!ac) return userNote?.trim() || null;
  const tag = `${META_PREFIX}${JSON.stringify({ ac })}`;
  const trimmed = userNote?.trim();
  return trimmed ? `${tag}\n${trimmed}` : tag;
}

const SHEET_CURRENCY = {
  USD: 'USD', EUR: 'EUR', SYP: 'SYP', GOLD: 'GOLD', SILVER: 'SILVER', LBP: 'LBP',
};

function num(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '').trim();
  if (!s || s === '-') return 0;
  const negative = s.includes('(') && s.includes(')');
  const n = parseFloat(s.replace(/[^0.0-9.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return negative && n > 0 ? -n : n;
}

function sheetCurrency(name) {
  const key = name.split('-')[0].trim();
  return SHEET_CURRENCY[key] ?? null;
}

function parseWorkbook(wb) {
  const map = new Map();
  for (const sheetName of wb.SheetNames) {
    const currency = sheetCurrency(sheetName);
    if (!currency) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const code = String(row[0] ?? '').trim();
      const name = String(row[1] ?? '').trim();
      if (!name || name.includes('مجموع')) continue;
      const debit = num(row[2]);
      const credit = num(row[3]);
      const balance = num(row[4]);
      let acc = map.get(name);
      if (!acc) {
        acc = { code, name, currencies: {} };
        map.set(name, acc);
      }
      if (!acc.code && code) acc.code = code;
      if (debit !== 0 || credit !== 0 || balance !== 0) {
        acc.currencies[currency] = { debit, credit, balance };
      }
    }
  }
  return [...map.values()];
}

function sqlStr(s) {
  if (s == null) return 'null';
  const str = String(s);
  if (!str.includes('\n') && !str.includes('\r') && !str.includes("'")) {
    return `'${str}'`;
  }
  const tag = `s${randomUUID().replace(/-/g, '')}`;
  return `$${tag}$${str}$${tag}$`;
}

function buildTxs(fundId, accountName, currency, row, date) {
  const { debit, credit, balance } = row;
  const txs = [];
  const mk = (kind, amount, note) => ({
    id: randomUUID(),
    fund_id: fundId,
    ledger: 'account',
    date,
    currency,
    kind,
    amount,
    party: accountName,
    status: 'posted',
    note,
    created_at: new Date().toISOString(),
  });

  if (credit > 0) txs.push(mk('payment', credit, IMPORT_NOTE));
  if (debit > 0) txs.push(mk('receipt', debit, IMPORT_NOTE));
  const openingNet = balance - (debit - credit);
  if (openingNet > 0) txs.push(mk('receipt', openingNet, OPENING_NOTE));
  else if (openingNet < 0) txs.push(mk('payment', Math.abs(openingNet), OPENING_NOTE));
  return txs;
}

function main() {
  const args = process.argv.slice(2);
  const fundArg = args.find(a => a.startsWith('--fund='));
  const fundId = fundArg?.split('=')[1] ?? 'nemr';
  const outArg = args.find(a => a.startsWith('--out='));
  const outPath = outArg
    ? resolve(outArg.split('=')[1])
    : resolve(root, 'supabase/import-trial-balance.sql');
  const fileArg = args.find(a => !a.startsWith('--'));
  const sourceFile = fileArg
    ? resolve(fileArg)
    : 'c:\\Users\\gm57\\Downloads\\Trial_Balance_By_Currency.xlsx';

  if (!existsSync(sourceFile)) {
    console.error('الملف غير موجود:', sourceFile);
    process.exit(1);
  }

  const wb = XLSX.readFile(sourceFile);
  const accounts = parseWorkbook(wb);
  const today = new Date().toISOString().slice(0, 10);
  const allTxs = [];
  for (const acc of accounts) {
    for (const [currency, row] of Object.entries(acc.currencies)) {
      allTxs.push(...buildTxs(fundId, acc.name, currency, row, today));
    }
  }

  const accountNames = accounts.map(a => a.name.trim());
  const lines = [
    '-- استيراد ميزان مراجعة من Excel',
    `-- ${accounts.length} حساب · ${allTxs.length} حركة · صندوق ${fundId}`,
    'begin;',
    '',
    '-- حذف حركات الاستيراد السابقة',
    `delete from transactions`,
    `where fund_id = ${sqlStr(fundId)}`,
    `  and ledger = 'account'`,
    `  and (note like '%${IMPORT_NOTE}%' or note like '%${OPENING_NOTE}%'`,
    `    or party in (${accountNames.map(n => sqlStr(n)).join(', ')}));`,
    '',
    '-- تحديث رقم الحساب للحسابات الموجودة',
    ...accounts.map(a => {
      const note = encodeCustomerNote(a.code ? `رقم: ${a.code}` : undefined, a.code);
      return `update customers set note = ${sqlStr(note)} where fund_id = ${sqlStr(fundId)} and name = ${sqlStr(a.name.trim())};`;
    }),
    '',
    '-- إضافة حسابات جديدة (تجاهل الموجود بنفس الاسم)',
    ...accounts.map(a => {
      const id = randomUUID();
      const note = encodeCustomerNote(a.code ? `رقم: ${a.code}` : undefined, a.code);
      return `insert into customers (id, fund_id, name, note, created_at)
select ${sqlStr(id)}, ${sqlStr(fundId)}, ${sqlStr(a.name.trim())}, ${sqlStr(note)}, now()
where not exists (
  select 1 from customers c where c.fund_id = ${sqlStr(fundId)} and c.name = ${sqlStr(a.name.trim())}
);`;
    }),
    '',
    '-- حركات الأرصدة',
    ...allTxs.map(t =>
      `insert into transactions (id, fund_id, ledger, date, currency, kind, amount, party, status, note, created_at)
values (${sqlStr(t.id)}, ${sqlStr(t.fund_id)}, 'account', ${sqlStr(t.date)}, ${sqlStr(t.currency)}, ${sqlStr(t.kind)}, ${t.amount}, ${sqlStr(t.party)}, 'posted', ${sqlStr(t.note)}, now());`,
    ),
    '',
    'commit;',
  ];

  writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`تم: ${outPath}`);
  console.log(`${accounts.length} حساب · ${allTxs.length} حركة`);
}

main();
