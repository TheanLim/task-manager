import type { MoveDirection } from '../types';

/** Vim key → MoveDirection mapping */
export const VIM_KEY_MAP: Record<string, MoveDirection> = {
  h: 'left',
  j: 'down',
  k: 'up',
  l: 'right',
};

/** Arrow key → MoveDirection mapping */
export const ARROW_KEY_MAP: Record<string, MoveDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * Resolves a keyboard event to a MoveDirection for non-customizable keys only.
 * Arrow keys, Home/End, Ctrl+Home/End, and vim h/j/k/l are hardcoded here
 * because they are OS-level conventions that should not be rebindable.
 *
 * Customizable navigation (G, Ctrl+d, Ctrl+u, [, ]) is handled via matchesKey
 * in onTableKeyDown before this function is called.
 */
export function resolveDirection(
  key: string,
  ctrl: boolean,
  shiftKey: boolean,
): MoveDirection | null {
  // Ctrl combos are no longer mapped to directions (gridHome/gridEnd removed)
  if (ctrl) return null;

  // Arrow keys (non-customizable)
  const arrowDir = ARROW_KEY_MAP[key];
  if (arrowDir) return arrowDir;

  // Vim h/j/k/l (non-customizable — secondary bindings for arrow equivalents)
  if (key in VIM_KEY_MAP) return VIM_KEY_MAP[key];

  return null;
}
