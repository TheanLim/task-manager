'use client';

import { useHotkeys } from 'react-hotkeys-hook';
import type { ShortcutMap } from '../types';
import { isInputContext } from '../services/inputContext';
import { toHotkeyFormat } from '../services/hotkeyFormat';
import { useKeyboardNavStore } from '../stores/keyboardNavStore';

interface UseGlobalShortcutsOptions {
  onNewTask: () => void;
  onSearch: () => void;
  onHelp: () => void;
  onEditTask: () => void;
  onOpenTask: () => void;
  onToggleComplete: () => void;
  onDeleteTask: () => void;
  onAddSubtask: () => void;
  onReinsertTask: () => void;
  isTaskFocused: boolean;
  shortcutMap: ShortcutMap;
  enabled?: boolean;
}

export function useGlobalShortcuts({
  onNewTask,
  onSearch,
  onHelp,
  onEditTask,
  onOpenTask,
  onToggleComplete,
  onDeleteTask,
  onAddSubtask,
  onReinsertTask,
  isTaskFocused,
  shortcutMap,
  enabled = true,
}: UseGlobalShortcutsOptions): void {
  const hotkeyOpts = { enableOnFormTags: false as const, preventDefault: true, enabled };

  // Global shortcuts — fire when not in input context
  useHotkeys(toHotkeyFormat(shortcutMap['global.newTask'].key), () => {
    if (!isInputContext(document.activeElement)) {
      onNewTask();
    }
  }, hotkeyOpts, [shortcutMap, onNewTask]);

  useHotkeys(toHotkeyFormat(shortcutMap['global.search'].key), () => {
    if (!isInputContext(document.activeElement)) {
      onSearch();
    }
  }, hotkeyOpts, [shortcutMap, onSearch]);

  useHotkeys(toHotkeyFormat(shortcutMap['global.help'].key), () => {
    if (!isInputContext(document.activeElement)) {
      onHelp();
    }
  }, hotkeyOpts, [shortcutMap, onHelp]);

  // Task-context shortcuts — read focusedTaskId from store directly (not from closure)
  // to avoid stale isTaskFocused after click-to-focus
  useHotkeys(toHotkeyFormat(shortcutMap['task.edit'].key), () => {
    const focused = useKeyboardNavStore.getState().focusedTaskId;
    if (focused && !isInputContext(document.activeElement)) {
      onEditTask();
    }
  }, hotkeyOpts, [shortcutMap, onEditTask]);

  // Note: Enter and Space are handled directly in useKeyboardNavigation's onTableKeyDown
  // for more reliable behavior when the table has focus. The bindings below are kept
  // as fallbacks for when the table doesn't have focus but a task is conceptually focused.

  useHotkeys(toHotkeyFormat(shortcutMap['task.delete'].key), () => {
    const focused = useKeyboardNavStore.getState().focusedTaskId;
    if (focused && !isInputContext(document.activeElement)) {
      onDeleteTask();
    }
  }, hotkeyOpts, [shortcutMap, onDeleteTask]);

  useHotkeys(toHotkeyFormat(shortcutMap['task.addSubtask'].key), () => {
    const focused = useKeyboardNavStore.getState().focusedTaskId;
    if (focused && !isInputContext(document.activeElement)) {
      onAddSubtask();
    }
  }, hotkeyOpts, [shortcutMap, onAddSubtask]);

  useHotkeys(toHotkeyFormat(shortcutMap['task.reinsert'].key), () => {
    const focused = useKeyboardNavStore.getState().focusedTaskId;
    if (focused && !isInputContext(document.activeElement)) {
      onReinsertTask();
    }
  }, hotkeyOpts, [shortcutMap, onReinsertTask]);

  // Save inline edit — Ctrl/Cmd+Enter (blur triggers save in InlineEditable)
  useHotkeys(toHotkeyFormat(shortcutMap['task.saveEdit'].key), () => {
    if (isInputContext(document.activeElement)) {
      (document.activeElement as HTMLElement)?.blur();
      const table = document.querySelector('table[role="grid"]') as HTMLElement;
      table?.focus();
    }
  }, { enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true, enabled }, [shortcutMap]);

  // Cancel edit — blur the active element and refocus the table
  useHotkeys(toHotkeyFormat(shortcutMap['task.cancelEdit'].key), () => {
    if (isInputContext(document.activeElement)) {
      (document.activeElement as HTMLElement)?.blur();
      // Refocus the nearest grid table so keyboard shortcuts work again
      const table = document.querySelector('table[role="grid"]') as HTMLElement;
      table?.focus();
    }
  }, { enableOnFormTags: true, preventDefault: false, enabled }, [shortcutMap]);

  // Vim navigation keys as global fallback — if table exists but doesn't have focus,
  // focus it so the table's onTableKeyDown can handle the next keypress.
  // This handles the case where focus is on document.body after a dialog closes.
  useHotkeys('j,k,g,shift+g', (e) => {
    if (isInputContext(document.activeElement)) return;
    const table = document.querySelector('table[role="grid"]') as HTMLElement;
    if (table && !table.contains(document.activeElement)) {
      e.preventDefault();
      table.focus();
      // Re-dispatch the key event on the table so onTableKeyDown picks it up
      table.dispatchEvent(new KeyboardEvent('keydown', {
        key: e.key,
        code: e.code,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        bubbles: true,
      }));
    }
  }, { enableOnFormTags: false, preventDefault: false, enabled }, []);
}
