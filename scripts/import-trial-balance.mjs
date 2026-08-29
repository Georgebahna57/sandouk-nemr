/**
 * استيراد حسابات وأرصدة من Trial_Balance_By_Currency.xlsx
 *
 * الاستخدام:
 *   node scripts/import-trial-balance.mjs [مسار-الملف] [--fund=nemr] [--dry-run]
 *
 * يتطلب SUPABASE_SERVICE_ROLE_KEY في .env (من Supabase → Settings → API)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, copyFileSync } from 'fs';
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

function loadEnv() {
  const path = resolve(root, '.env');
  if (!existsSync(path)) throw new Error('ملف .env غير موجود');
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

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

async function batchDelete(supabase, table, ids) {
  const size = 100;
  for (let i = 0; i < ids.length; i += size) {
    const batch = ids.slice(i, i + size);
    const { error } = await supabase.from(table).delete().in('id', batch);
    if (error) throw error;
  }
}

async function batchInsert(supabase, table, rows) {
  const size = 100;
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw error;
    console.log(`  ${table}: ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
}

async function getSupabaseClient(env) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY
    || env.VITE_SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) return createClient(url, serviceKey);

  const anonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('عيّن VITE_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY (أو anon + بريد) في .env');
  }

  const client = createClient(url, anonKey);
  const email = env.SUPABASE_IMPORT_EMAIL || process.env.SUPABASE_IMPORT_EMAIL;
  const password = env.SUPABASE_IMPORT_PASSWORD || process.env.SUPABASE_IMPORT_PASSWORD;
  if (email && password) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`فشل تسجيل الدخول: ${error.message}`);
    console.log('تم تسجيل الدخول:', email);
  } else {
    throw new Error('بدون service_role — عيّن SUPABASE_IMPORT_EMAIL و SUPABASE_IMPORT_PASSWORD في .env');
  }
  return client;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fundArg = args.find(a => a.startsWith('--fund='));
  const fundId = fundArg?.split('=')[1] ?? 'nemr';
  const fileArg = args.find(a => !a.startsWith('--'));
  const defaultFile = resolve(__dirname, 'data/Trial_Balance_By_Currency.xlsx');
  const sourceFile = fileArg
    ? resolve(fileArg)
    : existsSync(defaultFile)
      ? defaultFile
      : 'c:\\Users\\gm57\\Downloads\\Trial_Balance_By_Currency.xlsx';

  if (!existsSync(sourceFile)) {
    console.error('الملف غير موجود:', sourceFile);
    process.exit(1);
  }

  const env = loadEnv();
  const wb = XLSX.readFile(sourceFile);
  const accounts = parseWorkbook(wb);
  console.log(`ملف: ${sourceFile}`);
  console.log(`صندوق: ${fundId}`);
  console.log(`حسابات: ${accounts.length}`);

  const allTxs = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const acc of accounts) {
    for (const [currency, row] of Object.entries(acc.currencies)) {
      allTxs.push(...buildTxs(fundId, acc.name, currency, row, today));
    }
  }
  console.log(`حركات للإضافة: ${allTxs.length}`);

  if (dryRun) {
    accounts.slice(0, 10).forEach(a => console.log(`  ${a.code} ${a.name}`));
    console.log(`... و ${accounts.length - 10} أكثر`);
    return;
  }

  const supabase = await getSupabaseClient(env);
  const accountNames = accounts.map(a => a.name);

  const { data: existingCustomers, error: cErr } = await supabase
    .from('customers')
    .select('id, name, fund_id')
    .eq('fund_id', fundId);
  if (cErr) throw cErr;

  const existingByName = new Map((existingCustomers ?? []).map(c => [c.name.trim(), c]));

  const { data: existingTx, error: tErr } = await supabase
    .from('transactions')
    .select('id, party, note, ledger, fund_id')
    .eq('fund_id', fundId)
    .eq('ledger', 'account');
  if (tErr) throw tErr;

  const importTxIds = (existingTx ?? [])
    .filter(t => (t.note ?? '').includes(IMPORT_NOTE) || (t.note ?? '').includes(OPENING_NOTE))
    .map(t => t.id);

  const wipeTxIds = (existingTx ?? [])
    .filter(t => accountNames.includes((t.party ?? '').trim()))
    .map(t => t.id);

  const deleteIds = [...new Set([...importTxIds, ...wipeTxIds])];
  console.log(`حذف حركات سابقة: ${deleteIds.length}`);
  if (deleteIds.length) await batchDelete(supabase, 'transactions', deleteIds);

  const customerUpdates = accounts
    .filter(a => a.code?.trim() && existingByName.has(a.name.trim()))
    .map(a => ({
      id: existingByName.get(a.name.trim()).id,
      note: encodeCustomerNote(
        a.code ? `رقم: ${a.code}` : undefined,
        a.code,
      ),
    }));

  const existingNames = new Set((existingCustomers ?? []).map(c => c.name.trim()));
  const newCustomers = accounts
    .filter(a => !existingNames.has(a.name.trim()))
    .map(a => ({
      id: randomUUID(),
      fund_id: fundId,
      name: a.name.trim(),
      note: encodeCustomerNote(
        a.code ? `رقم: ${a.code}` : undefined,
        a.code,
      ),
      created_at: new Date().toISOString(),
    }));

  console.log(`حسابات جديدة: ${newCustomers.length}`);
  console.log(`تحديث أرقام: ${customerUpdates.length}`);
  if (newCustomers.length) await batchInsert(supabase, 'customers', newCustomers);
  if (customerUpdates.length) {
    for (const c of customerUpdates) {
      const { error } = await supabase.from('customers').update({ note: c.note }).eq('id', c.id);
      if (error) throw error;
    }
  }

  console.log('إضافة حركات...');
  await batchInsert(supabase, 'transactions', allTxs);

  console.log('\nتم الاستيراد بنجاح.');
  console.log(`  ${accounts.length} حساب`);
  console.log(`  ${allTxs.length} حركة`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
