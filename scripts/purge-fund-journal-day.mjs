/**
 * حذف دفتر يومية صندوق ليوم محدد — بدون مس حركات الحساب المربوطة.
 *
 * الاستخدام:
 *   node scripts/purge-fund-journal-day.mjs --fund nemr --date 2026-09-15
 *   node scripts/purge-fund-journal-day.mjs --fund nemr --date today --dry-run
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const FUND_ACCOUNT_NAMES = {
  nemr: 'صندوق نمر',
  tiger: 'صندوق تايغر',
  aura: 'صندوق اورا',
  zalqa: 'صندوق زلقا',
  george: 'صندوق جورج',
  marakiz: 'مراكز',
};

function loadEnv() {
  const path = resolve(root, '.env');
  if (!existsSync(path)) throw new Error('ملف .env غير موجود — انسخ .env.example وعبّي مفاتيح Supabase');
  const text = readFileSync(path, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function parseArgs(argv) {
  const args = { dryRun: false, fund: 'nemr', date: 'today' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--fund') args.fund = argv[++i];
    else if (a === '--date') args.date = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function resolveDate(value) {
  if (!value || value === 'today') return new Date().toISOString().slice(0, 10);
  return value;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('node scripts/purge-fund-journal-day.mjs [--fund nemr] [--date YYYY-MM-DD|today] [--dry-run]');
    process.exit(0);
  }

  const fundId = args.fund;
  const party = FUND_ACCOUNT_NAMES[fundId];
  if (!party) throw new Error(`صندوق غير معروف: ${fundId}`);

  const date = resolveDate(args.date);
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('عيّن VITE_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في .env');
  }

  const supabase = createClient(url, key);
  const { data: rows, error } = await supabase
    .from('transactions')
    .select('id, party, counterparty, currency, amount, kind, link_id, ledger, status')
    .eq('fund_id', fundId)
    .eq('date', date)
    .eq('ledger', 'fund')
    .eq('party', party)
    .eq('status', 'posted');

  if (error) throw error;

  const toDelete = rows ?? [];
  console.log(`صندوق: ${party}`);
  console.log(`التاريخ: ${date}`);
  console.log(`حركات دفتر اليومية للحذف: ${toDelete.length}`);

  if (!toDelete.length) {
    console.log('لا توجد حركات — انتهى.');
    return;
  }

  const linkedIds = new Set(toDelete.map(r => r.link_id).filter(Boolean));
  if (linkedIds.size) {
    const { data: linked, error: linkErr } = await supabase
      .from('transactions')
      .select('id, party, ledger')
      .in('link_id', [...linkedIds])
      .eq('ledger', 'account');
    if (linkErr) throw linkErr;
    console.log(`حركات حساب مربوطة ستُبقي (${(linked ?? []).length}):`);
    for (const tx of linked ?? []) console.log(`  - ${tx.party} (${tx.id})`);
  }

  if (args.dryRun) {
    console.log('\n--- عينة للحذف ---');
    toDelete.slice(0, 20).forEach(tx => {
      console.log(`  ${tx.kind} ${tx.amount} ${tx.currency} ← ${tx.counterparty ?? '—'} (${tx.id})`);
    });
    if (toDelete.length > 20) console.log(`  ... و ${toDelete.length - 20} أكثر`);
    console.log('\n--dry-run: لم يُحذف شيء');
    return;
  }

  const ids = toDelete.map(r => r.id);
  const batchSize = 100;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { error: delErr } = await supabase.from('transactions').delete().in('id', batch);
    if (delErr) throw delErr;
    console.log(`حذف: ${Math.min(i + batchSize, ids.length)}/${ids.length}`);
  }

  console.log(`\nتم حذف ${ids.length} حركة من دفتر اليومية — الحسابات لم تُمس.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
