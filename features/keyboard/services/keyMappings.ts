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
 * Resolves a keyboard event to a MoveDirection based on key, ctrl, and shift state.
 * Returns null if the key doesn't map to a direction.
 *
 * Does NOT handle: gg chord (stateful), section skip [ ] (needs row context).
 * Those are handled by the hook.
 */
export function resolveDirection(
  key: string,
  ctrl: boolean,
  shiftKey: boolean,
): MoveDirection | null {
  // Ctrl/Cmd+key combos
  if (ctrl) {
    if (key === 'Home' || key === 'ArrowUp') return 'gridHome';
    if (key === 'End' || key === 'ArrowDown') return 'gridEnd';
    if (key === 'd') return 'halfPageDown';
    if (key === 'u') return 'halfPageUp';
    return null;
  }

  // Arrow keys
  const arrowDir = ARROW_KEY_MAP[key];
  if (arrowDir) return arrowDir;

  // Home/End
  if (key === 'Home') return 'home';
  if (key === 'End') return 'end';

  // Vim keys (no ctrl, no shift except G)
  if (key === 'G' && shiftKey) return 'lastRow';

  // h/j/k/l
  if (key in VIM_KEY_MAP) return VIM_KEY_MAP[key];

  return null;
}
