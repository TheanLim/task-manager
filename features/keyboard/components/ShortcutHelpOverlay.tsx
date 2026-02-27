'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getDefaultShortcutMap, mergeShortcutMaps } from '../services/shortcutService';
import { ShortcutSettings } from './ShortcutSettings';
import type { ShortcutBinding } from '../types';

interface ShortcutHelpOverlayProps {
  open: boolean;
  onClose: () => void;
  /** When set, renders a mode-specific shortcut section (AF4 or FVP) in the overlay. */
  activeTMSMode?: string | null;
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

export function ShortcutHelpOverlay({ open, onClose, activeTMSMode }: ShortcutHelpOverlayProps) {
  const previousFocusRef = useRef<Element | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const keyboardShortcuts = useAppStore((s) => s.keyboardShortcuts);
  const [showSettings, setShowSettings] = useState(false);

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
        // Close settings first if open, then the overlay
        if (showSettings) {
          setShowSettings(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape, { capture: true });
    return () => document.removeEventListener('keydown', handleEscape, { capture: true });
  }, [open, onClose, showSettings]);

  // Return focus to previously focused element on close
  useEffect(() => {
    if (!open && previousFocusRef.current) {
      const el = previousFocusRef.current;
      previousFocusRef.current = null;
      setShowSettings(false);
      if (el instanceof HTMLElement) {
        requestAnimationFrame(() => el.focus());
      }
    }
  }, [open]);

  if (!open) return null;

  // Group shortcuts by category
  const grouped = CATEGORIES.map((category) => {
    const entries = (Object.entries(shortcutMap) as [string, ShortcutBinding][]).filter(
      ([, binding]) => binding.category === category,
    );
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
        <h2 className="text-base font-semibold text-foreground">
          {showSettings ? 'Edit Shortcuts' : 'Keyboard Shortcuts'}
        </h2>
        <div className="flex items-center gap-2">
          {showSettings && (
            <button
              onClick={() => setShowSettings(false)}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs"
              aria-label="Back to shortcuts"
            >
              ← Back
            </button>
          )}
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
      </div>

      {showSettings ? (
        <div className="px-5 py-4">
          <ShortcutSettings />
        </div>
      ) : (
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

          <section key="review-mode">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Review mode
            </h3>
            <ul className="space-y-1.5">
              <li className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">Open the review mode selector</span>
                <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono border border-border">
                  {formatKeyForDisplay(shortcutMap['tms.openModeSelector'].key)}
                </kbd>
              </li>
              <li className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">Exit the active review mode</span>
                <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono border border-border">
                  Esc
                </kbd>
              </li>
            </ul>
          </section>

          {/* AF4 mode-specific shortcuts — only shown when AF4 is active */}
          {activeTMSMode === 'af4' && (
            <section key="af4-shortcuts">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                AF4
              </h3>
              <ul className="space-y-1.5">
                {([
                  { key: 'p', label: 'Made Progress on candidate' },
                  { key: 'd', label: 'Done — mark candidate complete' },
                  { key: 's', label: 'Skip candidate' },
                  { key: 'f', label: 'Flag candidate as stubborn' },
                ] as const).map(({ key, label }) => (
                  <li key={key} className="flex items-center justify-between py-1">
                    <span className="text-sm text-foreground">{label}</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono border border-border">{key}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* FVP mode-specific shortcuts — only shown when FVP is active */}
          {activeTMSMode === 'fvp' && (
            <section key="fvp-shortcuts">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                FVP
              </h3>
              <ul className="space-y-1.5">
                {([
                  { key: 'y', label: 'Yes — prioritise candidate' },
                  { key: 'n', label: 'No — skip candidate' },
                  { key: 'b', label: 'Begin / restart preselection' },
                  { key: 'd', label: 'Done — complete top dotted task' },
                ] as const).map(({ key, label }) => (
                  <li key={key} className="flex items-center justify-between py-1">
                    <span className="text-sm text-foreground">{label}</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono border border-border">{key}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="pt-2 border-t dark:border-white/5">
            <button
              onClick={() => setShowSettings(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Edit shortcuts…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
