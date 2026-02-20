/**
 * Checks if the active element is an input context where shortcuts
 * should be suppressed: input, textarea, contenteditable (including
 * nested via closest), role="combobox", or data-keyboard-trap.
 */
export function isInputContext(activeElement: Element | null): boolean {
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea') return true;

  if (activeElement.getAttribute('contenteditable') === 'true') return true;
  if (activeElement.closest?.('[contenteditable="true"]')) return true;

  if (activeElement.getAttribute('role') === 'combobox') return true;

  if (activeElement.hasAttribute('data-keyboard-trap')) return true;

  return false;
}
