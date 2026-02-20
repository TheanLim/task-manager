/**
 * Converts a stored shortcut key string to react-hotkeys-hook format.
 *
 * Our stored format: "Ctrl+Enter", "Shift+/", "Space", "Escape", "/", "G"
 * react-hotkeys-hook format: "ctrl+enter", "shift+slash", "space", "escape", "slash", "shift+g"
 *
 * Special key mappings:
 * - "/" → "slash"
 * - "?" → "shift+slash"
 * - Single uppercase letter → "shift+<letter>"
 */

const SPECIAL_KEYS: Record<string, string> = {
  '/': 'slash',
  '?': 'shift+slash',
  ' ': 'space',
  'Space': 'space',
};

export function toHotkeyFormat(key: string): string {
  // Direct special key match (single char or named key)
  if (key in SPECIAL_KEYS) return SPECIAL_KEYS[key];

  // Single uppercase letter → shift+<lower>
  if (key.length === 1 && key >= 'A' && key <= 'Z') {
    return `shift+${key.toLowerCase()}`;
  }

  // Contains "+" → modifier combo like "Ctrl+Enter" or "Ctrl+Shift+k"
  if (key.includes('+')) {
    const parts = key.split('+');
    const hasCtrl = parts.some(p => p.toLowerCase() === 'ctrl');

    const converted = parts
      .map((part) => {
        if (part in SPECIAL_KEYS) return SPECIAL_KEYS[part];
        return part.toLowerCase();
      })
      .join('+');

    // For Ctrl combos, also register meta variant (Mac Cmd)
    if (hasCtrl) {
      const metaVariant = converted.replace('ctrl+', 'meta+');
      return `${converted}, ${metaVariant}`;
    }

    return converted;
  }

  // Everything else: just lowercase ("Enter" → "enter", "ArrowUp" → "arrowup", "n" → "n")
  return key.toLowerCase();
}
