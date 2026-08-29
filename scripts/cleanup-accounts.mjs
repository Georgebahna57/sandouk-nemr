/**
 * حذف كل الحسابات (customers + حركات account) إلا القائمة المسموحة.
 * الاستخدام: node scripts/cleanup-accounts.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const path = resolve(root, '.env');
  if (!existsSync(path)) throw new Error('ملف .env غير موجود');
  const text = readFileSync(path, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const ALLOWED = new Set([
  'اجور',
  'اجور كندا',
  'اجور نور',
  'عمولات شاملة',
  'كندا',
  'نور',
]);

const dryRun = process.argv.includes('--dry-run');

const env = loadEnv();
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('عيّن VITE_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY (أو anon) في .env');
  process.exit(1);
}

const supabase = createClient(url, key);

function isAllowedAccountName(name) {
  const n = (name ?? '').trim();
  if (!n) return false;
  if (ALLOWED.has(n)) return true;
  const lower = n.toLowerCase();
  if (lower === 'canada') return true;
  if (n.replace(/^حساب\s+/u, '').trim() === 'كندا') return true;
  return false;
}

async function main() {
  const { data: customers, error: cErr } = await supabase.from('customers').select('id, name, fund_id');
  if (cErr) throw cErr;

  const toDeleteCustomers = customers.filter(c => !isAllowedAccountName(c.name));
  console.log(`customers: ${customers.length} total, ${toDeleteCustomers.length} للحذف`);

  const { data: transactions, error: tErr } = await supabase
    .from('transactions')
    .select('id, party, ledger, counterparty, fund_id')
    .eq('ledger', 'account');
  if (tErr) throw tErr;

  const toDeleteTx = transactions.filter(t => !isAllowedAccountName(t.party));
  console.log(`حركات account: ${transactions.length} total, ${toDeleteTx.length} للحذف`);

  if (dryRun) {
    console.log('\n--- عينة حسابات للحذف ---');
    toDeleteCustomers.slice(0, 30).forEach(c => console.log(`  ${c.fund_id}: ${c.name}`));
    if (toDeleteCustomers.length > 30) console.log(`  ... و ${toDeleteCustomers.length - 30} أكثر`);
    return;
  }

  if (toDeleteTx.length > 0) {
    const ids = toDeleteTx.map(t => t.id);
    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const { error } = await supabase.from('transactions').delete().in('id', batch);
      if (error) throw error;
      console.log(`حذف حركات: ${Math.min(i + batchSize, ids.length)}/${ids.length}`);
    }
  }

  if (toDeleteCustomers.length > 0) {
    const ids = toDeleteCustomers.map(c => c.id);
    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const { error } = await supabase.from('customers').delete().in('id', batch);
      if (error) throw error;
      console.log(`حذف حسابات: ${Math.min(i + batchSize, ids.length)}/${ids.length}`);
    }
  }

  const kept = customers.filter(c => isAllowedAccountName(c.name));
  console.log('\nتم. الحسابات المحفوظة في customers:');
  kept.forEach(c => console.log(`  ${c.fund_id}: ${c.name}`));
  console.log(`\nالحركات account المتبقية: ${transactions.length - toDeleteTx.length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
