'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getDefaultShortcutMap, mergeShortcutMaps } from '../services/shortcutService';
import type { ShortcutBinding } from '../types';

interface ShortcutHelpOverlayProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = ['Navigation', 'Global', 'Task Actions'] as const;

/** Format key display for the current platform (Ctrl → ⌘ on Mac, except vim conventions) */
function formatKeyForDisplay(key: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
  let display = key
    .replace('ArrowUp', '↑')
    .replace('ArrowDown', '↓')
    .replace('ArrowLeft', '←')
    .replace('ArrowRight', '→');
  if (isMac) {
    // Keep Ctrl+d and Ctrl+u as-is (vim conventions)
    if (display !== 'Ctrl+d' && display !== 'Ctrl+u') {
      display = display.replace('Ctrl+', '⌘');
    }
  }
  return display;
}

/** Actions to hide on Mac (Home/End don't exist on Mac keyboards) */
const MAC_HIDDEN_ACTIONS = new Set(['nav.home', 'nav.end', 'nav.gridHome', 'nav.gridEnd']);

/** Extra entries to show on Mac as replacements for hidden actions */
const MAC_EXTRA_ENTRIES: Array<[string, { key: string; label: string; category: 'Navigation'; description: string }]> = [
  ['nav.macGridHome', { key: '⌘↑', label: 'First cell', category: 'Navigation', description: 'Move to the first cell of the first row' }],
  ['nav.macGridEnd', { key: '⌘↓', label: 'Last cell', category: 'Navigation', description: 'Move to the last cell of the last row' }],
];

export function ShortcutHelpOverlay({ open, onClose }: ShortcutHelpOverlayProps) {
  const previousFocusRef = useRef<Element | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const keyboardShortcuts = useAppStore((s) => s.keyboardShortcuts);

  const shortcutMap = mergeShortcutMaps(getDefaultShortcutMap(), keyboardShortcuts);

  // Capture the previously focused element when opening
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      // Focus the panel after mount
      requestAnimationFrame(() => panelRef.current?.focus());
    }
  }, [open]);

  // Close on Escape with capture: true (highest priority)
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape, { capture: true });
    return () => document.removeEventListener('keydown', handleEscape, { capture: true });
  }, [open, onClose]);

  // Return focus to previously focused element on close
  useEffect(() => {
    if (!open && previousFocusRef.current) {
      const el = previousFocusRef.current;
      previousFocusRef.current = null;
      if (el instanceof HTMLElement) {
        requestAnimationFrame(() => el.focus());
      }
    }
  }, [open]);

  if (!open) return null;

  // Group shortcuts by category, filtering platform-specific entries
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
  const grouped = CATEGORIES.map((category) => {
    const entries = (Object.entries(shortcutMap) as [string, ShortcutBinding][]).filter(
      ([action, binding]) => {
        if (binding.category !== category) return false;
        if (isMac && MAC_HIDDEN_ACTIONS.has(action)) return false;
        return true;
      },
    );
    // Add Mac-specific replacement entries
    if (isMac) {
      for (const [action, binding] of MAC_EXTRA_ENTRIES) {
        if (binding.category === category) {
          entries.push([action, binding]);
        }
      }
    }
    return { category, entries };
  });

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      tabIndex={-1}
      className="fixed inset-y-0 right-0 z-50 w-[400px] bg-card border-l dark:border-white/5 shadow-elevation-overlay animate-slide-in-right overflow-y-auto outline-none"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b dark:border-white/5">
        <h2 className="text-base font-semibold text-foreground">Keyboard Shortcuts</h2>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-4 space-y-6">
        {grouped.map(({ category, entries }) => (
          <section key={category}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              {category}
            </h3>
            <ul className="space-y-1.5">
              {entries.map(([action, binding]) => (
                <li key={action} className="flex items-center justify-between py-1">
                  <span className="text-sm text-foreground">{binding.label}</span>
                  <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono border border-border">
                    {formatKeyForDisplay(binding.key)}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
