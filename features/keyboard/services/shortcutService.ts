import type { ShortcutAction, ShortcutBinding, ShortcutMap, ShortcutConflict } from '../types';
import { ShortcutBindingSchema } from '../schemas';

/** Returns the full default shortcut map with all 24 actions. */
export function getDefaultShortcutMap(): ShortcutMap {
  return {
    // Navigation
    'nav.up': { key: 'ArrowUp', label: 'Move up', category: 'Navigation', description: 'Move to the row above' },
    'nav.down': { key: 'ArrowDown', label: 'Move down', category: 'Navigation', description: 'Move to the row below' },
    'nav.left': { key: 'ArrowLeft', label: 'Move left', category: 'Navigation', description: 'Move to the previous column' },
    'nav.right': { key: 'ArrowRight', label: 'Move right', category: 'Navigation', description: 'Move to the next column' },
    'nav.home': { key: 'Home', label: 'First column', category: 'Navigation', description: 'Move to the first column in the current row' },
    'nav.end': { key: 'End', label: 'Last column', category: 'Navigation', description: 'Move to the last column in the current row' },
    'nav.gridHome': { key: 'Ctrl+Home', label: 'First cell', category: 'Navigation', description: 'Move to the first cell of the first row' },
    'nav.gridEnd': { key: 'Ctrl+End', label: 'Last cell', category: 'Navigation', description: 'Move to the last cell of the last row' },
    'nav.sectionPrev': { key: '[', label: 'Previous section', category: 'Navigation', description: 'Jump to the previous section header' },
    'nav.sectionNext': { key: ']', label: 'Next section', category: 'Navigation', description: 'Jump to the next section header' },
    'nav.gg': { key: 'gg', label: 'First row (chord)', category: 'Navigation', description: 'Jump to the first visible row' },
    'nav.G': { key: 'G', label: 'Last row', category: 'Navigation', description: 'Jump to the last visible row' },
    'nav.halfPageDown': { key: 'Ctrl+d', label: 'Half page down', category: 'Navigation', description: 'Move down by half the visible page height' },
    'nav.halfPageUp': { key: 'Ctrl+u', label: 'Half page up', category: 'Navigation', description: 'Move up by half the visible page height' },
    // Global
    'global.newTask': { key: 'n', label: 'New task', category: 'Global', description: 'Create a new task' },
    'global.search': { key: '/', label: 'Search', category: 'Global', description: 'Focus the search input' },
    'global.help': { key: '?', label: 'Shortcut help', category: 'Global', description: 'Open the shortcut help overlay' },
    // Task Actions
    'task.edit': { key: 'e', label: 'Edit task', category: 'Task Actions', description: 'Edit the focused task inline' },
    'task.open': { key: 'Enter', label: 'Open details', category: 'Task Actions', description: 'Open the task detail panel' },
    'task.toggleComplete': { key: 'Space', label: 'Toggle complete', category: 'Task Actions', description: 'Toggle completion status' },
    'task.delete': { key: 'x', label: 'Delete task', category: 'Task Actions', description: 'Delete the focused task' },
    'task.addSubtask': { key: 'a', label: 'Add subtask', category: 'Task Actions', description: 'Add a subtask under the focused task' },
    'task.saveEdit': { key: 'Ctrl+Enter', label: 'Save & close edit', category: 'Task Actions', description: 'Save the current edit and close the editor' },
    'task.cancelEdit': { key: 'Escape', label: 'Cancel edit', category: 'Task Actions', description: 'Cancel the inline edit and restore previous value' },
  };
}

/**
 * Merges a persisted (possibly partial) map with defaults.
 * Persisted values take precedence; missing actions get defaults.
 * Invalid persisted entries (failing Zod validation) are skipped.
 */
export function mergeShortcutMaps(
  defaults: ShortcutMap,
  persisted: Partial<ShortcutMap>,
): ShortcutMap {
  const merged = { ...defaults };

  for (const [action, binding] of Object.entries(persisted)) {
    if (action in defaults) {
      const result = ShortcutBindingSchema.safeParse(binding);
      if (result.success) {
        merged[action as ShortcutAction] = result.data as ShortcutBinding;
      }
    }
  }

  return merged;
}

/**
 * Detects conflicts: returns a list of ShortcutConflict for any
 * key that maps to more than one action.
 */
export function detectConflicts(map: ShortcutMap): ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = [];
  const seen = new Map<string, ShortcutAction>();

  for (const [action, binding] of Object.entries(map)) {
    const existing = seen.get(binding.key);
    if (existing) {
      conflicts.push({
        key: binding.key,
        existingAction: existing,
        newAction: action as ShortcutAction,
      });
    } else {
      seen.set(binding.key, action as ShortcutAction);
    }
  }

  return conflicts;
}

/**
 * Resolves a keyboard event key to the matching ShortcutAction,
 * or null if no match. Respects category scoping:
 * - Navigation shortcuts only fire when grid is focused
 * - Global shortcuts fire when not in input context
 * - Task shortcuts fire when grid is focused and not in input context
 */
export function resolveShortcut(
  key: string,
  map: ShortcutMap,
  context: { isInputContext: boolean; isGridFocused: boolean },
): ShortcutAction | null {
  for (const [action, binding] of Object.entries(map)) {
    if (binding.key !== key) continue;

    const category = binding.category;

    if (category === 'Navigation') {
      if (context.isGridFocused) return action as ShortcutAction;
    } else if (category === 'Global') {
      if (!context.isInputContext) return action as ShortcutAction;
    } else if (category === 'Task Actions') {
      if (context.isGridFocused && !context.isInputContext) return action as ShortcutAction;
    }
  }

  return null;
}

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
