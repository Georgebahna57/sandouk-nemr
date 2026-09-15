import { FolderPlus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  addAccountSection,
  removeAccountSection,
  sectionsForBranch,
  UNASSIGNED_SECTION_LABEL,
  type AccountSectionsState,
} from '../lib/accountSections';
import { groupSummariesBySection } from '../lib/accountGroups';
import type { AccountBranchId, CustomerSummary, FundId } from '../types';
import { AccountsGrandTotalCard } from './AccountsGrandTotalCard';
import { AssignAccountSectionModal } from './AssignAccountSectionModal';

interface Props {
  branch: AccountBranchId;
  summaries: CustomerSummary[];
  sectionsState: AccountSectionsState;
  panelFundId: FundId;
  readOnly?: boolean;
  onChangeSections: (next: AccountSectionsState) => void | Promise<void>;
  onAssignAccount: (summary: CustomerSummary, sectionId: string | null) => void | Promise<void>;
}

export function AccountSectionsPanel({
  branch,
  summaries,
  sectionsState,
  panelFundId,
  readOnly = false,
  onChangeSections,
  onAssignAccount,
}: Props) {
  const [newSectionName, setNewSectionName] = useState('');
  const [assigningSummary, setAssigningSummary] = useState<CustomerSummary | null>(null);
  const [error, setError] = useState('');

  const branchSections = useMemo(
    () => sectionsForBranch(sectionsState, branch),
    [sectionsState, branch],
  );

  const grouped = useMemo(
    () => groupSummariesBySection(summaries, sectionsState),
    [summaries, sectionsState],
  );

  const unassigned = useMemo(
    () => summaries.filter(summary => !summary.accountSectionId),
    [summaries],
  );

  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newSectionName.trim();
    if (!trimmed) return;
    if (branchSections.some(section => section.name === trimmed)) {
      setError('يوجد قسم بنفس الاسم');
      return;
    }
    setError('');
    const next = addAccountSection(sectionsState, trimmed, branch);
    await onChangeSections(next);
    setNewSectionName('');
  }

  async function handleDeleteSection(sectionId: string) {
    const section = sectionsState.sections.find(item => item.id === sectionId);
    if (!section) return;
    if (!window.confirm(`حذف قسم «${section.name}»؟ الحسابات ستبقى بدون قسم.`)) return;
    await onChangeSections(removeAccountSection(sectionsState, sectionId));
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <form onSubmit={handleAddSection} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-amber-400">قسم جديد</h3>
          <p className="text-[11px] text-slate-500">
            أنشئ الأقسام هنا ثم عيّن الحسابات الموجودة لها من زر «قسم» بجانب كل حساب
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSectionName}
              onChange={e => { setNewSectionName(e.target.value); setError(''); }}
              placeholder="مثال: مصاريف نثرية"
              className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400"
            >
              <FolderPlus size={15} />
              إضافة
            </button>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </form>
      )}

      {branchSections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
          لا يوجد أقسام بعد — أنشئ قسماً ثم عيّن الحسابات له
        </div>
      ) : (
        <div className="space-y-4">
          {branchSections.map(section => {
            const sectionSummaries = grouped.find(group => group.id === section.id)?.summaries ?? [];
            return (
            <div key={section.id} className="space-y-2">
              <AccountsGrandTotalCard
                summaries={sectionSummaries}
                title={section.name}
                subtitle={`${sectionSummaries.length} حساب`}
                compact
              />
              {!readOnly && section.id !== UNASSIGNED_SECTION_LABEL && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDeleteSection(section.id)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 size={12} />
                    حذف القسم
                  </button>
                </div>
              )}
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/30 divide-y divide-slate-800">
                {sectionSummaries.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-500">لا يوجد حسابات في هذا القسم بعد</p>
                )}
                {sectionSummaries.map(summary => (
                  <div key={`${summary.fundId ?? panelFundId}:${summary.name}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-slate-200">{summary.name}</span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => setAssigningSummary(summary)}
                        className="shrink-0 rounded-lg border border-slate-600 px-2 py-1 text-[10px] text-slate-400 hover:text-amber-300"
                      >
                        تغيير القسم
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {!readOnly && unassigned.length > 0 && branchSections.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-3">
          <p className="text-sm font-medium text-slate-300">حسابات بدون قسم ({unassigned.length})</p>
          <div className="mt-2 space-y-1">
            {unassigned.map(summary => (
              <div key={`${summary.fundId ?? panelFundId}:${summary.name}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/50 px-2 py-1.5 text-sm">
                <span className="min-w-0 truncate text-slate-400">{summary.name}</span>
                <button
                  type="button"
                  onClick={() => setAssigningSummary(summary)}
                  className="shrink-0 rounded-lg bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-300 hover:bg-amber-500/25"
                >
                  تعيين قسم
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {assigningSummary && (
        <AssignAccountSectionModal
          summary={assigningSummary}
          sections={branchSections}
          currentSectionId={assigningSummary.accountSectionId}
          onClose={() => setAssigningSummary(null)}
          onAssign={sectionId => onAssignAccount(assigningSummary, sectionId)}
        />
      )}
    </div>
  );
}
