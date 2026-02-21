'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import {
  getDefaultShortcutMap,
  mergeShortcutMaps,
  detectConflicts,
  isShortcutCustomized,
} from '../services/shortcutService';
import type { ShortcutAction, ShortcutBinding, ShortcutConflict } from '../types';

interface ShortcutSettingsProps {
  className?: string;
}

const CATEGORIES = ['Navigation', 'Global', 'Task Actions'] as const;

export function ShortcutSettings({ className }: ShortcutSettingsProps) {
  const keyboardShortcuts = useAppStore((s) => s.keyboardShortcuts);
  const setKeyboardShortcut = useAppStore((s) => s.setKeyboardShortcut);
  const resetKeyboardShortcut = useAppStore((s) => s.resetKeyboardShortcut);
  const resetKeyboardShortcuts = useAppStore((s) => s.resetKeyboardShortcuts);

  const shortcutMap = mergeShortcutMaps(getDefaultShortcutMap(), keyboardShortcuts);
  const conflicts = detectConflicts(shortcutMap);

  const [recordingAction, setRecordingAction] = useState<ShortcutAction | null>(null);

  const conflictsByAction = new Map<ShortcutAction, ShortcutConflict>();
  for (const conflict of conflicts) {
    conflictsByAction.set(conflict.existingAction, conflict);
    conflictsByAction.set(conflict.newAction, conflict);
  }

  const handleKeyCapture = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingAction) return;
      e.preventDefault();
      e.stopPropagation();

      // Build key string from the event
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey && e.key.length > 1) parts.push('Shift');

      // Use the key value directly for printable chars, or the key name for special keys
      const key = e.key === ' ' ? 'Space' : e.key;
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        parts.push(key);
      } else {
        // Modifier-only press — ignore
        return;
      }

      const keyStr = parts.join('+');
      setKeyboardShortcut(recordingAction, keyStr);
      setRecordingAction(null);
    },
    [recordingAction, setKeyboardShortcut],
  );

  useEffect(() => {
    if (!recordingAction) return;
    document.addEventListener('keydown', handleKeyCapture, { capture: true });
    return () =>
      document.removeEventListener('keydown', handleKeyCapture, { capture: true });
  }, [recordingAction, handleKeyCapture]);

  // Group shortcuts by category
  const grouped = CATEGORIES.map((category) => {
    const entries = Object.entries(shortcutMap).filter(
      ([, binding]) => binding.category === category,
    ) as [ShortcutAction, ShortcutBinding][];
    return { category, entries };
  });

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h3>
        <button
          onClick={resetKeyboardShortcuts}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      <div className="space-y-5">
        {grouped.map(({ category, entries }) => (
          <section key={category}>
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              {category}
            </h4>
            <ul className="space-y-1">
              {entries.map(([action, binding]) => {
                const conflict = conflictsByAction.get(action);
                const isRecording = recordingAction === action;
                const isCustomizable = binding.customizable !== false;

                return (
                  <li key={action} className="group flex items-center justify-between py-1.5">
                    <span className={`text-sm ${isCustomizable ? 'text-foreground' : 'text-muted-foreground'}`}>{binding.label}</span>
                    <div className="flex items-center gap-2">
                      {conflict && !isRecording && isCustomizable && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          conflict
                        </span>
                      )}
                      {isCustomizable && isShortcutCustomized(action, shortcutMap) && !isRecording && (
                        <button
                          onClick={() => resetKeyboardShortcut(action)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs text-muted-foreground hover:text-foreground transition-opacity px-1 py-0.5 rounded hover:bg-muted"
                          title="Reset to default"
                          aria-label={`Reset ${binding.label} to default`}
                        >
                          ↺
                        </button>
                      )}
                      <kbd
                        role={isCustomizable ? 'button' : undefined}
                        tabIndex={isCustomizable ? 0 : undefined}
                        onClick={() => isCustomizable && setRecordingAction(isRecording ? null : action)}
                        onKeyDown={(e) => {
                          if (isCustomizable && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            setRecordingAction(isRecording ? null : action);
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                          !isCustomizable
                            ? 'bg-muted border-border text-muted-foreground cursor-default'
                            : isRecording
                            ? 'bg-primary/10 border-primary text-primary cursor-pointer'
                            : 'bg-muted border-border hover:border-foreground/30 cursor-pointer'
                        }`}
                        title={isCustomizable ? undefined : 'This shortcut cannot be customized'}
                      >
                        {isRecording ? 'Press a key…' : binding.key}
                      </kbd>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
