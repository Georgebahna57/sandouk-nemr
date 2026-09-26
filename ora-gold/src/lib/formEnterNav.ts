import type { KeyboardEvent } from 'react';

const FIELD_SELECTOR =
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

function visibleFields(form: HTMLFormElement): HTMLElement[] {
  return Array.from(form.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter(
    (el) => !el.closest('[hidden]') && el.getClientRects().length > 0,
  );
}

/** Enter ينقل بين الحقول ولا يُرسل النموذج — الحفظ بالزر فقط */
export function handleFormEnterKeyDown(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;

  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  if (target instanceof HTMLTextAreaElement) return;

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement
  ) {
    e.preventDefault();
  }

  if (target instanceof HTMLButtonElement) return;

  const form = e.currentTarget;
  const fields = visibleFields(form);
  const idx = fields.indexOf(target);
  if (idx >= 0 && idx < fields.length - 1) {
    const next = fields[idx + 1];
    next.focus();
    if (next instanceof HTMLInputElement && next.type !== 'date') {
      next.select();
    }
  }
}

export function preventFormSubmit(e: { preventDefault: () => void }) {
  e.preventDefault();
}
