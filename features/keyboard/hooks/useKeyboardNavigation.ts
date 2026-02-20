'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { GridCoord, ShortcutMap, MoveDirection } from '../types';
import { moveActiveCell } from '../services/gridNavigationService';
import { isInputContext } from '../services/inputContext';
import { resolveDirection } from '../services/keyMappings';
import { matchesKey } from '../services/keyMatch';
import { useKeyboardNavStore } from '../stores/keyboardNavStore';
import { useRowHighlight } from './useRowHighlight';

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

  // Row highlight management (show, fade, blur/focus)
  const { showHighlight, fadeTimerRef, FADE_DELAY } = useRowHighlight({
    activeCell,
    tableRef,
    visibleRowTaskIds,
  });


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
      const eventMods = { key, ctrlKey, metaKey, shiftKey, altKey: e.altKey };

      // Toggle complete and open detail — read from shortcut map
      if (matchesKey(eventMods, shortcutMap['task.toggleComplete'].key)) {
        e.preventDefault();
        e.stopPropagation();
        const taskId = activeCell.taskId ?? visibleRowTaskIdsRef.current[activeCell.row];
        if (taskId) onSpacePressRef.current?.(taskId);
        return;
      }
      if (matchesKey(eventMods, shortcutMap['task.open'].key)) {
        e.preventDefault();
        e.stopPropagation();
        const taskId = activeCell.taskId ?? visibleRowTaskIdsRef.current[activeCell.row];
        if (taskId) onEnterPressRef.current?.(taskId);
        return;
      }

      // gg chord — must be checked before resolveDirection (stateful, needs early return)
      if (!ctrl && key === 'g' && !shiftKey) {
        const now = Date.now();
        if (now - lastGPressTime.current < 300) {
          lastGPressTime.current = 0;
          e.preventDefault();
          e.stopPropagation();
          moveTo('firstRow');
          return;
        }
        lastGPressTime.current = now;
        e.preventDefault();
        e.stopPropagation();
        return; // Wait for potential second g
      }

      // Section skip: [ → previous section, ] → next section
      if (!ctrl && (key === '[' || key === ']') && sectionStartIndicesRef.current.length > 0) {
        if (key === '[') {
          const prevSection = [...sectionStartIndicesRef.current].reverse().find(i => i < activeCell.row);
          if (prevSection !== undefined) {
            const taskId = visibleRowTaskIdsRef.current[prevSection] ?? null;
            updateActiveCell({ row: prevSection, column: activeCell.column, taskId });
            showHighlight();
          }
        } else {
          const nextSection = sectionStartIndicesRef.current.find(i => i > activeCell.row);
          if (nextSection !== undefined) {
            const taskId = visibleRowTaskIdsRef.current[nextSection] ?? null;
            updateActiveCell({ row: nextSection, column: activeCell.column, taskId });
            showHighlight();
          }
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // [ / ] fallback when no sections exist
      let direction: MoveDirection | null = null;
      if (!ctrl && key === '[') direction = 'up';
      else if (!ctrl && key === ']') direction = 'down';
      else direction = resolveDirection(key, ctrl, shiftKey);

      if (direction) {
        e.preventDefault();
        e.stopPropagation();
        moveTo(direction);
      }
    },
    [isDragging, activeCell, moveTo, showHighlight, updateActiveCell, tableRef, shortcutMap],
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
