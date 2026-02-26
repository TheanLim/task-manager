/**
 * DIT hotkeys — tests for tms.moveToToday (t), tms.moveToTomorrow (w), tms.moveToInbox (i)
 */

import { describe, it, expect } from 'vitest';
import { getDefaultShortcutMap, resolveShortcut } from './shortcutService';

describe('DIT hotkeys in shortcut map', () => {
  const map = getDefaultShortcutMap();

  it.each([
    ['tms.moveToToday', 't', 'Task Actions'],
    ['tms.moveToTomorrow', 'w', 'Task Actions'],
    ['tms.moveToInbox', 'i', 'Task Actions'],
  ] as const)('includes %s action with key "%s"', (action, key, category) => {
    const binding = map[action as keyof typeof map];
    expect(binding).toBeDefined();
    expect(binding.key).toBe(key);
    expect(binding.category).toBe(category);
  });

  it.each([
    ['t', 'tms.moveToToday'],
    ['w', 'tms.moveToTomorrow'],
    ['i', 'tms.moveToInbox'],
  ])('resolves "%s" to %s when grid is focused and not in input', (key, expectedAction) => {
    const action = resolveShortcut(key, map, { isInputContext: false, isGridFocused: true });
    expect(action).toBe(expectedAction);
  });

  it.each(['t', 'w', 'i'])('does NOT resolve "%s" when in input context', (key) => {
    const action = resolveShortcut(key, map, { isInputContext: true, isGridFocused: true });
    expect(action).toBeNull();
  });

  it.each(['t', 'w', 'i'])('does NOT resolve "%s" when grid is not focused', (key) => {
    const action = resolveShortcut(key, map, { isInputContext: false, isGridFocused: false });
    expect(action).toBeNull();
  });
});
