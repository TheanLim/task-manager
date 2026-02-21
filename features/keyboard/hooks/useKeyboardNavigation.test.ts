import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { GridCoord, MoveDirection } from '../types';
import { moveActiveCell } from '../services/gridNavigationService';
import {
  getTabIndexForCell,
  restoreFocus,
  findNearestRow,
} from './useKeyboardNavigation';

// ── Unit Tests: getTabIndexForCell ──

describe('getTabIndexForCell', () => {
  it('returns -1 when activeCell is null', () => {
    expect(getTabIndexForCell(null, 0, 0)).toBe(-1);
  });

  it('returns 0 when row and column match activeCell', () => {
    const cell: GridCoord = { row: 2, column: 3, taskId: 'task-1' };
    expect(getTabIndexForCell(cell, 2, 3)).toBe(0);
  });

  it('returns -1 when row matches but column does not', () => {
    const cell: GridCoord = { row: 2, column: 3, taskId: 'task-1' };
    expect(getTabIndexForCell(cell, 2, 0)).toBe(-1);
  });

  it('returns -1 when column matches but row does not', () => {
    const cell: GridCoord = { row: 2, column: 3, taskId: 'task-1' };
    expect(getTabIndexForCell(cell, 0, 3)).toBe(-1);
  });
});

// ── Unit Tests: restoreFocus ──

describe('restoreFocus', () => {
  it('returns null when visible row list is empty', () => {
    const saved: GridCoord = { row: 0, column: 0, taskId: 'task-1' };
    expect(restoreFocus(saved, [])).toBeNull();
  });

  it('restores by taskId when found in visible rows', () => {
    const saved: GridCoord = { row: 0, column: 2, taskId: 'task-b' };
    const result = restoreFocus(saved, ['task-a', 'task-b', 'task-c']);
    expect(result).toEqual({ row: 1, column: 2, taskId: 'task-b' });
  });

  it('falls back to clamped row index when taskId not found', () => {
    const saved: GridCoord = { row: 1, column: 0, taskId: 'deleted-task' };
    const result = restoreFocus(saved, ['task-a', 'task-c']);
    expect(result).toEqual({ row: 1, column: 0, taskId: 'task-c' });
  });

  it('clamps to last row when saved row exceeds list length', () => {
    const saved: GridCoord = { row: 10, column: 0, taskId: 'deleted-task' };
    const result = restoreFocus(saved, ['task-a', 'task-b']);
    expect(result).toEqual({ row: 1, column: 0, taskId: 'task-b' });
  });

  it('falls back to row index when taskId is null', () => {
    const saved: GridCoord = { row: 0, column: 1, taskId: null };
    const result = restoreFocus(saved, ['task-a', 'task-b']);
    expect(result).toEqual({ row: 0, column: 0, taskId: 'task-a' });
  });
});

// ── Unit Tests: findNearestRow ──

describe('findNearestRow', () => {
  it('returns null for empty list', () => {
    expect(findNearestRow(0, [])).toBeNull();
  });

  it('returns same index when within bounds', () => {
    const result = findNearestRow(1, ['a', 'b', 'c']);
    expect(result).toEqual({ row: 1, column: 0, taskId: 'b' });
  });

  it('clamps to last row when index exceeds length', () => {
    const result = findNearestRow(5, ['a', 'b']);
    expect(result).toEqual({ row: 1, column: 0, taskId: 'b' });
  });

  it('returns first row for index 0', () => {
    const result = findNearestRow(0, ['a', 'b']);
    expect(result).toEqual({ row: 0, column: 0, taskId: 'a' });
  });
});

// ── Property-Based Tests ──

const ALL_DIRECTIONS: MoveDirection[] = [
  'up', 'down', 'left', 'right',
  'firstRow', 'lastRow', 'halfPageDown', 'halfPageUp',
];

// Feature: keyboard-navigation, Property 8: Single active cell invariant
// **Validates: Requirements 9.3**
describe('Property 8: Single active cell invariant', () => {
  it('exactly one cell has tabindex=0 after any sequence of moveActiveCell operations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),  // rows
        fc.integer({ min: 1, max: 10 }),  // columns
        fc.array(fc.constantFrom(...ALL_DIRECTIONS), { minLength: 1, maxLength: 20 }),
        (rows, columns, directions) => {
          const bounds = { rows, columns, pageSize: rows };

          // Start at (0, 0)
          let current: GridCoord = { row: 0, column: 0, taskId: null };

          for (const dir of directions) {
            current = moveActiveCell(current, dir, bounds);

            // After each move, verify the single-active-cell invariant:
            // getTabIndexForCell returns 0 for exactly one cell (the current one)
            // and -1 for all others.
            let zeroCount = 0;
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < columns; c++) {
                const tabIndex = getTabIndexForCell(current, r, c);
                if (tabIndex === 0) zeroCount++;
              }
            }
            expect(zeroCount).toBe(1);

            // The active cell itself must have tabindex=0
            expect(getTabIndexForCell(current, current.row, current.column)).toBe(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: keyboard-navigation, Property 9: Focus restoration round trip
// **Validates: Requirements 10.3**
describe('Property 9: Focus restoration round trip', () => {
  it('saving a coord, clearing it, and restoring via taskId produces the same coord', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),  // list length
        fc.integer({ min: 0, max: 5 }),   // column
        (listLen, column) => {
          // Build a visible row list with unique taskIds
          const visibleRowTaskIds = Array.from({ length: listLen }, (_, i) => `task-${i}`);

          // Pick a random row within bounds
          const row = Math.floor(Math.random() * listLen);
          const taskId = visibleRowTaskIds[row];

          // Save the coord
          const saved: GridCoord = { row, column, taskId };

          // Simulate clearing (activeCell = null) then restoring
          const restored = restoreFocus(saved, visibleRowTaskIds);

          // The restored coord should point to the same taskId at the correct row
          expect(restored).not.toBeNull();
          expect(restored!.taskId).toBe(taskId);
          expect(restored!.row).toBe(row);
          expect(restored!.column).toBe(column);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('restoring after taskId moved to a different row finds the new row', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }),  // list length (at least 2 to shuffle)
        fc.integer({ min: 0, max: 5 }),   // column
        (listLen, column) => {
          const originalIds = Array.from({ length: listLen }, (_, i) => `task-${i}`);
          const row = Math.floor(Math.random() * listLen);
          const taskId = originalIds[row];

          const saved: GridCoord = { row, column, taskId };

          // Shuffle the list (taskId is still present but may be at a different index)
          const shuffled = [...originalIds].sort(() => Math.random() - 0.5);
          const newIndex = shuffled.indexOf(taskId);

          const restored = restoreFocus(saved, shuffled);

          expect(restored).not.toBeNull();
          expect(restored!.taskId).toBe(taskId);
          expect(restored!.row).toBe(newIndex);
          expect(restored!.column).toBe(column);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: keyboard-navigation, Property 10: Focus fallback on deleted task
// **Validates: Requirements 10.4**
describe('Property 10: Focus fallback on deleted task', () => {
  it('returns the nearest visible row when a taskId is removed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),  // original list length
        (listLen) => {
          const taskIds = Array.from({ length: listLen }, (_, i) => `task-${i}`);
          const removeIndex = Math.floor(Math.random() * listLen);
          const removedTaskId = taskIds[removeIndex];

          // Remove the task
          const remaining = taskIds.filter((id) => id !== removedTaskId);

          const result = findNearestRow(removeIndex, remaining);

          if (remaining.length === 0) {
            // No rows remain → null
            expect(result).toBeNull();
          } else {
            expect(result).not.toBeNull();
            // Row index should be within bounds
            expect(result!.row).toBeGreaterThanOrEqual(0);
            expect(result!.row).toBeLessThan(remaining.length);
            // If removed row was the last, new last row is selected
            if (removeIndex >= remaining.length) {
              expect(result!.row).toBe(remaining.length - 1);
            } else {
              // Same index (next task slides into position)
              expect(result!.row).toBe(removeIndex);
            }
            // taskId matches the row in the remaining list
            expect(result!.taskId).toBe(remaining[result!.row]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null when all tasks are removed', () => {
    const result = findNearestRow(0, []);
    expect(result).toBeNull();
  });
});
