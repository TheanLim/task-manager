/**
 * Checks if a keyboard event matches a stored shortcut key string.
 * Used by onTableKeyDown to match events against the shortcut map
 * instead of hardcoding key checks.
 *
 * Stored format examples: "Space", "Enter", "Ctrl+Enter", "e", "Escape", "/"
 *
 * Modifier handling:
 * - "Ctrl" in stored key matches both ctrlKey and metaKey (Mac Cmd)
 * - "Alt" matches altKey
 * - "Shift" matches shiftKey (only checked if explicitly in the stored key)
 * - For non-modifier keys, extra modifiers must NOT be held (no false positives)
 *
 * Special keys:
 * - "Space" matches event.key === " "
 * - "?" is a shifted key — shiftKey is allowed implicitly
 */

const SPECIAL_EVENT_KEYS: Record<string, string> = {
  'Space': ' ',
};

// Keys that are produced by holding shift — don't require explicit Shift in stored key
const SHIFTED_CHARS = new Set(['?', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '{', '}', '|', ':', '"', '<', '>', '~']);

export function matchesKey(
  event: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean },
  storedKey: string,
): boolean {
  // Parse stored key into modifiers + base key
  const parts = storedKey.split('+');
  const baseKey = parts[parts.length - 1];
  const modifiers = new Set(parts.slice(0, -1).map(m => m.toLowerCase()));

  const expectCtrl = modifiers.has('ctrl');
  const expectAlt = modifiers.has('alt');
  const expectShift = modifiers.has('shift');

  // Check modifier match
  const hasCtrl = event.ctrlKey || event.metaKey;
  if (expectCtrl !== hasCtrl) return false;
  if (expectAlt !== event.altKey) return false;

  // Shift check: if stored key explicitly requires Shift, check it.
  // If not, shift must NOT be held — unless the base key is a shifted char (like "?")
  if (expectShift) {
    if (!event.shiftKey) return false;
  } else if (event.shiftKey && !SHIFTED_CHARS.has(baseKey)) {
    return false;
  }

  // Check base key match
  const expectedEventKey = SPECIAL_EVENT_KEYS[baseKey] ?? baseKey;
  return event.key === expectedEventKey;
}
