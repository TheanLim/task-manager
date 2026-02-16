'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { GridCoord, ShortcutMap, MoveDirection } from '../types';
import { moveActiveCell } from '../services/gridNavigationService';
import { isInputContext } from '../services/shortcutService';
import { useKeyboardNavStore } from '../stores/keyboardNavStore';

interface CellProps {
  tabIndex: 0 | -1;
  onFocus: () => void;
  ref: (el: HTMLElement | null) => void;
  'data-grid-row': number;
  'data-grid-col': number;
}

interface UseKeyboardNavigationOptions {
  visibleRowCount: number;
  columnCount: number;
  tableRef: React.RefObject<HTMLTableElement | null>;
  onActiveCellChange?: (coord: GridCoord) => void;
  shortcutMap: ShortcutMap;
  isDragging: boolean;
  visibleRowTaskIds?: string[];
  /** Row indices where each section starts (for [ and ] section-skip) */
  sectionStartIndices?: number[];
  /** Called when Space is pressed on a focused task row (for toggle complete) */
  onSpacePress?: (taskId: string) => void;
  /** Called when Enter is pressed on a focused task row (for open detail) */
  onEnterPress?: (taskId: string) => void;
}

export interface UseKeyboardNavigationReturn {
  activeCell: GridCoord | null;
  setActiveCell: (coord: GridCoord) => void;
  getTabIndex: (row: number, column: number) => 0 | -1;
  getCellProps: (row: number, column: number) => CellProps;
  onTableKeyDown: (e: React.KeyboardEvent) => void;
  savedCell: React.MutableRefObject<GridCoord | null>;
}

/** Vim key → MoveDirection mapping */
const VIM_KEY_MAP: Record<string, MoveDirection> = {
  h: 'left',
  j: 'down',
  k: 'up',
  l: 'right',
};

/** Arrow key → MoveDirection mapping */
const ARROW_KEY_MAP: Record<string, MoveDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

// ── Pure helper functions (exported for testing) ──

/**
 * Returns 0 if the given row/column matches the active cell, -1 otherwise.
 * Pure function — no side effects.
 */
export function getTabIndexForCell(
  activeCell: GridCoord | null,
  row: number,
  column: number,
): 0 | -1 {
  if (!activeCell) return -1;
  return activeCell.row === row && activeCell.column === column ? 0 : -1;
}

/**
 * Restores a GridCoord by looking up the taskId in the visible row list.
 * Falls back to clamped row index if taskId not found.
 * Returns null if no rows exist.
 */
export function restoreFocus(
  saved: GridCoord,
  visibleRowTaskIds: string[],
): GridCoord | null {
  if (visibleRowTaskIds.length === 0) return null;

  // Try taskId lookup first
  if (saved.taskId) {
    const idx = visibleRowTaskIds.indexOf(saved.taskId);
    if (idx !== -1) {
      return { row: idx, column: saved.column, taskId: saved.taskId };
    }
  }

  // Fallback: nearest row by index
  return findNearestRow(saved.row, visibleRowTaskIds);
}

/**
 * Finds the nearest visible row when a task has been removed.
 * Returns the row at the same index if possible, otherwise the last row.
 * Returns null if no rows exist.
 */
export function findNearestRow(
  removedRowIndex: number,
  visibleRowTaskIds: string[],
): GridCoord | null {
  if (visibleRowTaskIds.length === 0) return null;

  const clampedRow = Math.min(removedRowIndex, visibleRowTaskIds.length - 1);
  return {
    row: clampedRow,
    column: 0,
    taskId: visibleRowTaskIds[clampedRow] ?? null,
  };
}

// ── Hook ──

export function useKeyboardNavigation(
  options: UseKeyboardNavigationOptions,
): UseKeyboardNavigationReturn {
  const {
    visibleRowCount,
    columnCount,
    tableRef,
    onActiveCellChange,
    shortcutMap,
    isDragging,
    visibleRowTaskIds = [],
    sectionStartIndices = [],
    onSpacePress,
    onEnterPress,
  } = options;

  const [activeCell, setActiveCellState] = useState<GridCoord | null>(null);

  const savedCell = useRef<GridCoord | null>(null);
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const lastGPressTime = useRef<number>(0);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSpacePressRef = useRef(onSpacePress);
  const onEnterPressRef = useRef(onEnterPress);
  onSpacePressRef.current = onSpacePress;
  onEnterPressRef.current = onEnterPress;
  // Keep refs for values that change frequently to avoid stale closures
  const visibleRowTaskIdsRef = useRef(visibleRowTaskIds);
  visibleRowTaskIdsRef.current = visibleRowTaskIds;
  const visibleRowCountRef = useRef(visibleRowCount);
  visibleRowCountRef.current = visibleRowCount;
  const sectionStartIndicesRef = useRef(sectionStartIndices);
  sectionStartIndicesRef.current = sectionStartIndices;
  const FADE_DELAY = 2000; // ms before highlight fades

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


  // Recover activeCell when grid changes (tasks added/deleted, sections collapsed)
  useEffect(() => {
    if (visibleRowCount === 0) {
      updateActiveCell(null);
    } else if (activeCell === null) {
      // Don't auto-initialize — wait for user interaction
    } else if (activeCell.taskId && !visibleRowTaskIds.includes(activeCell.taskId)) {
      // Active task was deleted or filtered out — recover to nearest row and refocus table
      const clampedRow = Math.min(activeCell.row, visibleRowCount - 1);
      updateActiveCell({ row: clampedRow, column: activeCell.column, taskId: visibleRowTaskIds[clampedRow] ?? null });
      // Focus the table after React finishes rendering
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          tableRef.current?.focus();
        });
      });
    }
  }, [visibleRowCount, visibleRowTaskIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show highlight when activeCell changes (keyboard nav or click)
  useEffect(() => {
    showHighlight();
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [showHighlight]);

  // Click on a row sets it as active
  useEffect(() => {
    if (!tableRef.current) return;
    
    const handleClick = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest?.('tr[data-task-id]') as HTMLElement;
      if (!row) return;
      const taskId = row.getAttribute('data-task-id');
      if (!taskId) return;
      const rowIndex = visibleRowTaskIds.indexOf(taskId);
      if (rowIndex !== -1) {
        updateActiveCell({ row: rowIndex, column: 0, taskId });
      }
    };
    
    tableRef.current.addEventListener('click', handleClick);
    return () => tableRef.current?.removeEventListener('click', handleClick);
  }, [tableRef, visibleRowTaskIds]);

  // Clear highlight when table loses focus
  useEffect(() => {
    if (!tableRef.current) return;
    
    const handleFocusOut = (e: FocusEvent) => {
      // Check if focus moved outside the table
      if (!tableRef.current?.contains(e.relatedTarget as Node)) {
        // Small delay to let the browser settle focus — if focus ends up on body,
        // it means an inline edit finished (Enter) and we should refocus the table.
        // If focus went to a real element outside the table, clear the highlight.
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
    
    // Re-apply highlight when table regains focus
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

  // Notify parent and global store of active cell changes — synchronously
  const setFocusedTask = useKeyboardNavStore(s => s.setFocusedTask);
  
  // Wrapper that updates both local state and global store synchronously
  const updateActiveCell = useCallback((cell: GridCoord | null) => {
    setActiveCellState(cell);
    if (cell) {
      setFocusedTask(cell.taskId, cell);
    } else {
      setFocusedTask(null, null);
    }
  }, [setFocusedTask]);

  // Still notify parent via effect (for onActiveCellChange callback)
  useEffect(() => {
    if (activeCell) onActiveCellChange?.(activeCell);
  }, [activeCell, onActiveCellChange]);

  const setActiveCell = useCallback(
    (coord: GridCoord) => {
      updateActiveCell(coord);
    },
    [],
  );

  const getTabIndex = useCallback(
    (row: number, column: number): 0 | -1 => {
      return getTabIndexForCell(activeCell, row, column);
    },
    [activeCell],
  );

  const getCellProps = useCallback(
    (row: number, column: number): CellProps => {
      const key = `${row},${column}`;
      return {
        tabIndex: getTabIndexForCell(activeCell, row, column),
        onFocus: () => {
          const taskId = visibleRowTaskIds[row] ?? null;
          updateActiveCell({ row, column, taskId });
        },
        ref: (el: HTMLElement | null) => {
          if (el) {
            cellRefs.current.set(key, el);
          } else {
            cellRefs.current.delete(key);
          }
        },
        'data-grid-row': row,
        'data-grid-col': column,
      };
    },
    [activeCell, visibleRowTaskIds],
  );

  const moveTo = useCallback(
    (direction: MoveDirection) => {
      if (!activeCell || visibleRowCountRef.current === 0) return;
      const bounds = { rows: visibleRowCountRef.current, columns: columnCount, pageSize: visibleRowCountRef.current };
      const next = moveActiveCell(activeCell, direction, bounds);
      const taskId = visibleRowTaskIdsRef.current[next.row] ?? null;
      updateActiveCell({ ...next, taskId });
    },
    [activeCell, columnCount, updateActiveCell],
  );

  const onTableKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isDragging) return;
      if (visibleRowCountRef.current === 0) return;
      if (isInputContext(document.activeElement)) return;

      // Initialize active cell on first keyboard interaction
      if (!activeCell) {
        const taskId = visibleRowTaskIdsRef.current[0] ?? null;
        updateActiveCell({ row: 0, column: 0, taskId });
        // Directly highlight the first row (can't use showHighlight — activeCell is stale in this closure)
        if (taskId && tableRef.current) {
          if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
          tableRef.current.querySelectorAll('tr[data-kb-active]').forEach(el => el.removeAttribute('data-kb-active'));
          const row = tableRef.current.querySelector(`tr[data-task-id="${taskId}"]`) as HTMLElement;
          if (row) {
            row.setAttribute('data-kb-active', 'true');
            row.scrollIntoView?.({ block: 'nearest' });
          }
          fadeTimerRef.current = setTimeout(() => {
            tableRef.current?.querySelectorAll('tr[data-kb-active]').forEach(el => el.removeAttribute('data-kb-active'));
          }, FADE_DELAY);
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const { key, ctrlKey, metaKey, shiftKey } = e;
      const ctrl = ctrlKey || metaKey;

      // Space and Enter — handle directly on the table (more reliable than react-hotkeys-hook for focused elements)
      if (key === ' ' && !ctrl && !shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const taskId = activeCell.taskId ?? visibleRowTaskIdsRef.current[activeCell.row];
        if (taskId) onSpacePressRef.current?.(taskId);
        return;
      }
      if (key === 'Enter' && !ctrl && !shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const taskId = activeCell.taskId ?? visibleRowTaskIdsRef.current[activeCell.row];
        if (taskId) onEnterPressRef.current?.(taskId);
        return;
      }

      let direction: MoveDirection | null = null;

      // Ctrl/Cmd+key combos (Cmd on Mac)
      if (ctrl) {
        if (key === 'Home' || key === 'ArrowUp') direction = 'gridHome';
        else if (key === 'End' || key === 'ArrowDown') direction = 'gridEnd';
        else if (key === 'd') direction = 'halfPageDown';
        else if (key === 'u') direction = 'halfPageUp';
      }

      // Arrow keys (no ctrl)
      if (!direction && !ctrl) {
        direction = ARROW_KEY_MAP[key] ?? null;
      }

      // Home/End (no ctrl)
      if (!direction && !ctrl) {
        if (key === 'Home') direction = 'home';
        else if (key === 'End') direction = 'end';
      }

      // Vim keys (no ctrl, no shift except G)
      if (!direction && !ctrl) {
        // G (Shift+g) → lastRow
        if (key === 'G' && shiftKey) {
          direction = 'lastRow';
        }
        // gg chord
        else if (key === 'g' && !shiftKey) {
          const now = Date.now();
          if (now - lastGPressTime.current < 300) {
            direction = 'firstRow';
            lastGPressTime.current = 0;
          } else {
            lastGPressTime.current = now;
            e.preventDefault();
            e.stopPropagation();
            return; // Wait for potential second g
          }
        }
        // h/j/k/l
        else if (key in VIM_KEY_MAP) {
          direction = VIM_KEY_MAP[key];
        }
        // Section skip: [ → previous section, ] → next section
        else if (key === '[' && sectionStartIndicesRef.current.length > 0) {
          // Find the previous section start before current row
          const prevSection = [...sectionStartIndicesRef.current].reverse().find(i => i < activeCell.row);
          if (prevSection !== undefined) {
            const taskId = visibleRowTaskIdsRef.current[prevSection] ?? null;
            updateActiveCell({ row: prevSection, column: activeCell.column, taskId });
            showHighlight();
          }
          e.preventDefault();
          e.stopPropagation();
          return;
        } else if (key === ']' && sectionStartIndicesRef.current.length > 0) {
          // Find the next section start after current row
          const nextSection = sectionStartIndicesRef.current.find(i => i > activeCell.row);
          if (nextSection !== undefined) {
            const taskId = visibleRowTaskIdsRef.current[nextSection] ?? null;
            updateActiveCell({ row: nextSection, column: activeCell.column, taskId });
            showHighlight();
          }
          e.preventDefault();
          e.stopPropagation();
          return;
        } else if (key === '[') {
          direction = 'up';
        } else if (key === ']') {
          direction = 'down';
        }
      }

      if (direction) {
        e.preventDefault();
        e.stopPropagation();
        moveTo(direction);
      }
    },
    [isDragging, activeCell, moveTo, showHighlight, updateActiveCell, tableRef],
  );

  return {
    activeCell,
    setActiveCell,
    getTabIndex,
    getCellProps,
    onTableKeyDown,
    savedCell,
  };
}
