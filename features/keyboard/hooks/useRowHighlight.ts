'use client';

import { useCallback, useRef, useEffect } from 'react';
import type { GridCoord } from '../types';

const FADE_DELAY = 2000; // ms before highlight fades

interface UseRowHighlightOptions {
  activeCell: GridCoord | null;
  tableRef: React.RefObject<HTMLTableElement | null>;
  visibleRowTaskIds: string[];
}

/**
 * Manages the data-kb-active highlight on the focused table row.
 * Handles: show on cell change, auto-fade after 2s, clear on blur, re-apply on focus.
 */
export function useRowHighlight({
  activeCell,
  tableRef,
  visibleRowTaskIds,
}: UseRowHighlightOptions) {
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Show the highlight on the active row and reset the fade timer */
  const showHighlight = useCallback(() => {
    if (!tableRef.current || !activeCell) return;

    // Clear any pending fade
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

    // Remove previous highlight
    tableRef.current.querySelectorAll('tr[data-kb-active]').forEach(el => {
      el.removeAttribute('data-kb-active');
    });

    // Apply highlight
    const taskId = activeCell.taskId ?? visibleRowTaskIds[activeCell.row];
    if (taskId) {
      const row = tableRef.current.querySelector(`tr[data-task-id="${taskId}"]`) as HTMLElement;
      if (row) {
        row.setAttribute('data-kb-active', 'true');
        row.scrollIntoView?.({ block: 'nearest' });
      }
    }

    // Start fade timer
    fadeTimerRef.current = setTimeout(() => {
      tableRef.current?.querySelectorAll('tr[data-kb-active]').forEach(el => {
        el.removeAttribute('data-kb-active');
      });
    }, FADE_DELAY);
  }, [activeCell, tableRef, visibleRowTaskIds]);

  // Show highlight when activeCell changes (keyboard nav or click)
  useEffect(() => {
    showHighlight();
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [showHighlight]);

  // Clear highlight when table loses focus, re-apply on focus-in
  useEffect(() => {
    if (!tableRef.current) return;

    const handleFocusOut = (e: FocusEvent) => {
      if (!tableRef.current?.contains(e.relatedTarget as Node)) {
        setTimeout(() => {
          if (document.activeElement === document.body && tableRef.current) {
            tableRef.current.focus();
          } else if (!tableRef.current?.contains(document.activeElement)) {
            tableRef.current?.querySelectorAll('tr[data-kb-active]').forEach(el => {
              el.removeAttribute('data-kb-active');
            });
          }
        }, 50);
      }
    };

    const handleFocusIn = () => {
      showHighlight();
    };

    tableRef.current.addEventListener('focusout', handleFocusOut);
    tableRef.current.addEventListener('focusin', handleFocusIn);
    return () => {
      tableRef.current?.removeEventListener('focusout', handleFocusOut);
      tableRef.current?.removeEventListener('focusin', handleFocusIn);
    };
  }, [tableRef, activeCell, visibleRowTaskIds]);

  return { showHighlight, fadeTimerRef, FADE_DELAY };
}
