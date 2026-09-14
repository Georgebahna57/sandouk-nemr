import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { useState } from 'react';
import { ACCOUNT_BRANCH_LABELS } from '../lib/accountBranch';
import { extractPdfText } from '../lib/pdfText';
import { parseTrialBalancePdfText } from '../lib/trialBalancePdfImport';
import {
  filterImportableTrialBalanceAccounts,
  parseTrialBalanceWorkbook,
  trialBalanceImportTargetLabel,
  type TrialBalanceImportAccount,
  type TrialBalanceImportResult,
  type TrialBalanceImportTarget,
} from '../lib/trialBalanceImport';
import type { AccountBranchId } from '../types';

interface Props {
  onImport: (accounts: TrialBalanceImportAccount[], target: TrialBalanceImportTarget) => Promise<TrialBalanceImportResult>;
  busy?: boolean;
}

export function TrialBalanceImportSection({ onImport, busy = false }: Props) {
  const [accountBranch, setAccountBranch] = useState<AccountBranchId>('customers');
  const [preview, setPreview] = useState<TrialBalanceImportAccount[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);
  const [skippedNotice, setSkippedNotice] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const target: TrialBalanceImportTarget = { accountBranch };

  function applyParsedAccounts(raw: TrialBalanceImportAccount[]) {
    const { accounts: importable, skippedNames } = filterImportableTrialBalanceAccounts(raw);
    setPreview(importable);
    setSkippedNotice(skippedNames.length
      ? `تم تجاهل ${skippedNames.length} حساب (صندوق/أجور) — لا تُسجَّل على حركة الصندوق`
      : null);
    if (importable.length === 0) {
      setError(raw.length
        ? 'كل الحسابات بالملف صناديق أو أجور — اختر حسابات زبائن/مراكز فقط'
        : 'ما لقينا حسابات في الملف');
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setSuccess(null);
    setCreatedNotice(null);
    setSkippedNotice(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.pdf')) {
        const text = await extractPdfText(file);
        applyParsedAccounts(parseTrialBalancePdfText(text));
      } else {
        const XLSX = await import('xlsx');
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        applyParsedAccounts(parseTrialBalanceWorkbook(
          wb.SheetNames,
          name => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) as unknown[][],
        ));
      }
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'فشل قراءة الملف');
    } finally {
      setParsing(false);
    }
  }

  async function runImport() {
    if (!preview?.length) return;
    setError(null);
    setSuccess(null);
    setCreatedNotice(null);
    try {
      const result = await onImport(preview, target);
      setSuccess(
        `تم استيراد ${result.importedCount} حساب — ${trialBalanceImportTargetLabel(target)} — رصيد الصندوق لم يتغيّر`,
      );
      if (result.skippedNames.length > 0) {
        setSkippedNotice(`تم تجاهل ${result.skippedNames.length} حساب صندوق/أجور`);
      }
      if (result.createdAccounts.length > 0) {
        const sample = result.createdAccounts.slice(0, 8).join(' · ');
        const more = result.createdAccounts.length > 8
          ? ` … و${result.createdAccounts.length - 8} حساب آخر`
          : '';
        setCreatedNotice(
          `⚠️ تم إنشاء ${result.createdAccounts.length} حساب جديد: ${sample}${more}`,
        );
      }
      setPreview(null);
      setFileName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الاستيراد');
    }
  }

  const txEstimate = preview?.reduce((sum, a) => {
    let n = 0;
    for (const row of Object.values(a.currencies)) {
      if (!row) continue;
      if (row.credit > 0) n++;
      if (row.debit > 0) n++;
      const opening = row.balance - (row.debit - row.credit);
      if (opening > 0) n++;
      if (opening < 0) n++;
    }
    return sum + n;
  }, 0) ?? 0;

  const multiCurrencyCount = preview?.filter(a => Object.keys(a.currencies).length > 1).length ?? 0;

  return (
    <div className="mb-4 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileSpreadsheet size={18} className="text-violet-400" />
        <div>
          <p className="font-medium text-slate-200">استيراد ميزان مراجعة (Excel / PDF)</p>
          <p className="text-xs text-slate-500">
            حسابات الزبائن والمراكز فقط — لا يمس أرصدة الصناديق
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={accountBranch}
          onChange={e => setAccountBranch(e.target.value as AccountBranchId)}
          className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          aria-label="نوع الحسابات"
        >
          <option value="customers">حسابات — زبائن</option>
          <option value="centers">حسابات — مراكز</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:border-violet-500/50">
          <Upload size={16} />
          {parsing ? 'جاري القراءة...' : 'اختر ملف Excel أو PDF'}
          <input
            type="file"
            accept=".xlsx,.xls,.pdf"
            className="hidden"
            disabled={parsing || busy}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <p className="mb-2 text-[10px] text-slate-500">
        الوجهة: {ACCOUNT_BRANCH_LABELS[accountBranch]} — حركات حساب فقط
      </p>

      {fileName && (
        <p className="mb-2 text-xs text-slate-500">الملف: {fileName}</p>
      )}

      {preview && (
        <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
          <p>{preview.length} حساب · {multiCurrencyCount} بحسابات متعددة العملات · تقريب {txEstimate} حركة</p>
          <p className="mt-1 text-slate-500">
            عينة: {preview.slice(0, 3).map(a => `${a.name} (${a.code})`).join(' · ')}
          </p>
        </div>
      )}

      {(error || success || createdNotice || skippedNotice) && (
        <div className="mb-3 space-y-2">
          {error && (
            <div className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{error}</div>
          )}
          {skippedNotice && (
            <div className="rounded-xl border border-slate-600 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
              {skippedNotice}
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">{success}</div>
          )}
          {createdNotice && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {createdNotice}
            </div>
          )}
        </div>
      )}

      {preview && preview.length > 0 && (
        <button
          type="button"
          onClick={() => void runImport()}
          disabled={busy || parsing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          استيراد {preview.length} حساب — {ACCOUNT_BRANCH_LABELS[accountBranch]}
        </button>
      )}

      <p className="mt-2 text-[10px] text-slate-500">
        يضبط أرصدة الحسابات على الملف — يحذف فقط حركات الاستيراد السابقة ولا يمسّ الصناديق.
      </p>
    </div>
  );
}
