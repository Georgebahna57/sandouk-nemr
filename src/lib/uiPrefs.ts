import type { AccountBranchId, AppSectionId, FundId, ViewId } from '../types';

const PREFIX = 'sandouk-ui-';

export type DisplayMode = 'default' | 'highContrast';

export interface NavPrefs {
  appSection: AppSectionId;
  fundId: FundId;
  view: ViewId;
  accountsBranch: AccountBranchId;
  accountsTab: 'list' | 'reconciliations';
}

export interface UiPrefs {
  displayMode: DisplayMode;
  pendingNotify: boolean;
  nav: Partial<NavPrefs>;
}

const DEFAULTS: UiPrefs = {
  displayMode: 'default',
  pendingNotify: true,
  nav: {},
};

function readRaw(): UiPrefs {
  try {
    const raw = localStorage.getItem(`${PREFIX}prefs`);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return {
      displayMode: parsed.displayMode === 'highContrast' ? 'highContrast' : 'default',
      pendingNotify: parsed.pendingNotify !== false,
      nav: parsed.nav ?? {},
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeRaw(prefs: UiPrefs) {
  localStorage.setItem(`${PREFIX}prefs`, JSON.stringify(prefs));
}

export function loadUiPrefs(): UiPrefs {
  return readRaw();
}

export function saveUiPrefs(patch: Partial<UiPrefs>) {
  const current = readRaw();
  writeRaw({
    ...current,
    ...patch,
    nav: patch.nav ? { ...current.nav, ...patch.nav } : current.nav,
  });
}

export function saveNavPrefs(patch: Partial<NavPrefs>) {
  saveUiPrefs({ nav: patch });
}

export function applyDisplayMode(mode: DisplayMode) {
  document.documentElement.dataset.display = mode;
}

export function initDisplayMode() {
  applyDisplayMode(readRaw().displayMode);
}
