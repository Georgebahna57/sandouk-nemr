import { UNASSIGNED_SECTION_LABEL } from './accountSections';
import type { AccountSectionsState } from './accountSections';
import { sectionNameById } from './accountSections';
import type { CustomerSummary } from '../types';

export interface AccountGroupSection {
  id: string;
  label: string;
  summaries: CustomerSummary[];
}

export function groupSummariesBySection(
  summaries: CustomerSummary[],
  sectionsState: AccountSectionsState,
): AccountGroupSection[] {
  const bySection = new Map<string, CustomerSummary[]>();

  for (const summary of summaries) {
    const sectionId = summary.accountSectionId || UNASSIGNED_SECTION_LABEL;
    const bucket = bySection.get(sectionId) ?? [];
    bucket.push(summary);
    bySection.set(sectionId, bucket);
  }

  const configured = sectionsState.sections.map(section => ({
    id: section.id,
    label: section.name,
    summaries: (bySection.get(section.id) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'ar')),
  })).filter(section => section.summaries.length > 0);

  const unassigned = (bySection.get(UNASSIGNED_SECTION_LABEL) ?? [])
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  if (unassigned.length > 0) {
    configured.push({
      id: UNASSIGNED_SECTION_LABEL,
      label: UNASSIGNED_SECTION_LABEL,
      summaries: unassigned,
    });
  }

  return configured;
}

export function hasConfiguredSections(sectionsState: AccountSectionsState, branch?: string): boolean {
  if (branch) {
    return sectionsState.sections.some(section => section.branch === branch);
  }
  return sectionsState.sections.length > 0;
}

export function sectionLabelForSummary(
  summary: CustomerSummary,
  sectionsState: AccountSectionsState,
): string {
  if (!summary.accountSectionId) return UNASSIGNED_SECTION_LABEL;
  return sectionNameById(sectionsState, summary.accountSectionId) ?? UNASSIGNED_SECTION_LABEL;
}
