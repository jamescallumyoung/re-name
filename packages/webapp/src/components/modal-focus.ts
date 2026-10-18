// Focus helpers for modals (design doc §7.4). The app shell makes whatever is behind a
// modal `inert`, which keeps Tab inside it, and uses these to move focus in and back.

/** The focused element, looking inside shadow roots; null when nothing is (focus is on the body). */
export function deepActiveElement(): HTMLElement | null {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el instanceof HTMLElement && el !== document.body ? el : null;
}

/** Focuses `[autofocus]` in `root`, or else the dialog itself (which has `tabindex="-1"`). */
export function focusInto(root: ParentNode): void {
  const target = root.querySelector<HTMLElement>('[autofocus]') ??
    root.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');
  target?.focus();
}
