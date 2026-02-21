import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { moveActiveCell, computeVisibleRows } from './gridNavigationService';
import type { GridCoord, MoveDirection } from '../types';

// ── Unit Tests: moveActiveCell ──

describe('moveActiveCell', () => {
  const bounds = { rows: 5, columns: 4 };
  const start: GridCoord = { row: 2, column: 1, taskId: 'task-1' };

  it('moves up by 1 row', () => {
    const result = moveActiveCell(start, 'up', bounds);
    expect(result).toEqual({ row: 1, column: 1, taskId: null });
  });

  it('moves down by 1 row', () => {
    const result = moveActiveCell(start, 'down', bounds);
    expect(result).toEqual({ row: 3, column: 1, taskId: null });
  });

  it('moves left by 1 column', () => {
    const result = moveActiveCell(start, 'left', bounds);
    expect(result).toEqual({ row: 2, column: 0, taskId: null });
  });

  it('moves right by 1 column', () => {
    const result = moveActiveCell(start, 'right', bounds);
    expect(result).toEqual({ row: 2, column: 2, taskId: null });
  });

  it('firstRow sets row=0, keeps column', () => {
    const result = moveActiveCell(start, 'firstRow', bounds);
    expect(result).toEqual({ row: 0, column: 1, taskId: null });
  });

  it('lastRow sets row=last, keeps column', () => {
    const result = moveActiveCell(start, 'lastRow', bounds);
    expect(result).toEqual({ row: 4, column: 1, taskId: null });
  });

  it('halfPageDown moves by floor(pageSize/2)', () => {
    const result = moveActiveCell({ row: 0, column: 0, taskId: null }, 'halfPageDown', { rows: 10, columns: 3, pageSize: 6 });
    expect(result).toEqual({ row: 3, column: 0, taskId: null });
  });

  it('halfPageUp moves by floor(pageSize/2)', () => {
    const result = moveActiveCell({ row: 5, column: 0, taskId: null }, 'halfPageUp', { rows: 10, columns: 3, pageSize: 6 });
    expect(result).toEqual({ row: 2, column: 0, taskId: null });
  });

  // Boundary clamping
  it('clamps up at row 0', () => {
    const result = moveActiveCell({ row: 0, column: 1, taskId: null }, 'up', bounds);
    expect(result.row).toBe(0);
  });

  it('clamps down at last row', () => {
    const result = moveActiveCell({ row: 4, column: 1, taskId: null }, 'down', bounds);
    expect(result.row).toBe(4);
  });

  it('clamps left at column 0', () => {
    const result = moveActiveCell({ row: 2, column: 0, taskId: null }, 'left', bounds);
    expect(result.column).toBe(0);
  });

  it('clamps right at last column', () => {
    const result = moveActiveCell({ row: 2, column: 3, taskId: null }, 'right', bounds);
    expect(result.column).toBe(3);
  });

  it('halfPageDown clamps to last row', () => {
    const result = moveActiveCell({ row: 8, column: 0, taskId: null }, 'halfPageDown', { rows: 10, columns: 3, pageSize: 10 });
    expect(result.row).toBe(9);
  });

  it('halfPageUp clamps to row 0', () => {
    const result = moveActiveCell({ row: 1, column: 0, taskId: null }, 'halfPageUp', { rows: 10, columns: 3, pageSize: 10 });
    expect(result.row).toBe(0);
  });

  it('always sets taskId to null', () => {
    const result = moveActiveCell({ row: 2, column: 1, taskId: 'some-id' }, 'down', bounds);
    expect(result.taskId).toBeNull();
  });
});

// ── Unit Tests: computeVisibleRows ──

describe('computeVisibleRows', () => {
  it('returns empty array for no tasks', () => {
    const result = computeVisibleRows([], [], new Set());
    expect(result).toEqual([]);
  });

  it('returns top-level tasks sorted by order', () => {
    const tasks = [
      { id: 't2', parentTaskId: null, sectionId: null, order: 2 },
      { id: 't1', parentTaskId: null, sectionId: null, order: 1 },
    ];
    const result = computeVisibleRows(tasks, [], new Set());
    expect(result).toHaveLength(2);
    expect(result[0].taskId).toBe('t1');
    expect(result[1].taskId).toBe('t2');
  });

  it('includes subtasks when parent is expanded', () => {
    const tasks = [
      { id: 't1', parentTaskId: null, sectionId: null, order: 1 },
      { id: 's1', parentTaskId: 't1', sectionId: null, order: 1 },
      { id: 's2', parentTaskId: 't1', sectionId: null, order: 2 },
    ];
    const result = computeVisibleRows(tasks, [], new Set(['t1']));
    expect(result).toHaveLength(3);
    expect(result[0].taskId).toBe('t1');
    expect(result[0].depth).toBe(0);
    expect(result[1].taskId).toBe('s1');
    expect(result[1].depth).toBe(1);
    expect(result[2].taskId).toBe('s2');
    expect(result[2].depth).toBe(1);
  });

  it('excludes subtasks when parent is collapsed', () => {
    const tasks = [
      { id: 't1', parentTaskId: null, sectionId: null, order: 1 },
      { id: 's1', parentTaskId: 't1', sectionId: null, order: 1 },
    ];
    const result = computeVisibleRows(tasks, [], new Set());
    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe('t1');
  });

  it('skips tasks in collapsed sections', () => {
    const tasks = [
      { id: 't1', parentTaskId: null, sectionId: 'sec1', order: 1 },
      { id: 't2', parentTaskId: null, sectionId: 'sec2', order: 1 },
    ];
    const sections = [
      { id: 'sec1', collapsed: true, order: 1 },
      { id: 'sec2', collapsed: false, order: 2 },
    ];
    const result = computeVisibleRows(tasks, sections, new Set());
    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe('t2');
  });

  it('processes no-section tasks before sectioned tasks', () => {
    const tasks = [
      { id: 't1', parentTaskId: null, sectionId: 'sec1', order: 1 },
      { id: 't2', parentTaskId: null, sectionId: null, order: 1 },
    ];
    const sections = [{ id: 'sec1', collapsed: false, order: 1 }];
    const result = computeVisibleRows(tasks, sections, new Set());
    expect(result).toHaveLength(2);
    expect(result[0].taskId).toBe('t2'); // no-section first
    expect(result[1].taskId).toBe('t1');
  });

  it('handles deeply nested subtasks', () => {
    const tasks = [
      { id: 't1', parentTaskId: null, sectionId: null, order: 1 },
      { id: 's1', parentTaskId: 't1', sectionId: null, order: 1 },
      { id: 'ss1', parentTaskId: 's1', sectionId: null, order: 1 },
    ];
    const result = computeVisibleRows(tasks, [], new Set(['t1', 's1']));
    expect(result).toHaveLength(3);
    expect(result[2].taskId).toBe('ss1');
    expect(result[2].depth).toBe(2);
  });

  it('section headers are not included as rows', () => {
    const tasks = [
      { id: 't1', parentTaskId: null, sectionId: 'sec1', order: 1 },
    ];
    const sections = [{ id: 'sec1', collapsed: false, order: 1 }];
    const result = computeVisibleRows(tasks, sections, new Set());
    expect(result).toHaveLength(1);
    expect(result.every((r) => !r.isSectionHeader)).toBe(true);
  });
});


// ── Property-Based Tests ──

const ALL_DIRECTIONS: MoveDirection[] = [
  'up', 'down', 'left', 'right',
  'firstRow', 'lastRow', 'halfPageDown', 'halfPageUp',
];

// Feature: keyboard-navigation, Property 1: Directional movement with boundary clamping
// **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.11, 1.12, 1.13, 1.14, 3.5, 3.6, 3.7, 3.8**
describe('Property 1: Directional movement with boundary clamping', () => {
  it('result is always within bounds and correct for the direction', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),  // rows
        fc.integer({ min: 1, max: 10 }),   // columns
        fc.integer({ min: 1, max: 100 }),  // pageSize
        fc.constantFrom(...ALL_DIRECTIONS),
        (rows, columns, pageSize, direction) => {
          // Generate a valid starting position within bounds
          const row = rows === 1 ? 0 : Math.floor(Math.random() * rows);
          const col = columns === 1 ? 0 : Math.floor(Math.random() * columns);
          const coord: GridCoord = { row, column: col, taskId: null };
          const bounds = { rows, columns, pageSize };

          const result = moveActiveCell(coord, direction, bounds);

          // Result is always within bounds
          expect(result.row).toBeGreaterThanOrEqual(0);
          expect(result.row).toBeLessThan(rows);
          expect(result.column).toBeGreaterThanOrEqual(0);
          expect(result.column).toBeLessThan(columns);

          // taskId is always null
          expect(result.taskId).toBeNull();

          // Verify correctness per direction
          switch (direction) {
            case 'up':
              expect(result.row).toBe(Math.max(0, row - 1));
              expect(result.column).toBe(col);
              break;
            case 'down':
              expect(result.row).toBe(Math.min(rows - 1, row + 1));
              expect(result.column).toBe(col);
              break;
            case 'left':
              expect(result.column).toBe(Math.max(0, col - 1));
              expect(result.row).toBe(row);
              break;
            case 'right':
              expect(result.column).toBe(Math.min(columns - 1, col + 1));
              expect(result.row).toBe(row);
              break;
            case 'firstRow':
              expect(result.row).toBe(0);
              expect(result.column).toBe(col);
              break;
            case 'lastRow':
              expect(result.row).toBe(rows - 1);
              expect(result.column).toBe(col);
              break;
            case 'halfPageDown':
              expect(result.row).toBe(Math.min(rows - 1, row + Math.floor(pageSize / 2)));
              expect(result.column).toBe(col);
              break;
            case 'halfPageUp':
              expect(result.row).toBe(Math.max(0, row - Math.floor(pageSize / 2)));
              expect(result.column).toBe(col);
              break;
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

// Feature: keyboard-navigation, Property 2: Visible row list excludes collapsed content
// **Validates: Requirements 2.1, 2.2, 2.3**
describe('Property 2: Visible row list excludes collapsed content', () => {
  /** Generate a random task tree with sections */
  const arbTaskTree = fc.record({
    sectionCount: fc.integer({ min: 0, max: 5 }),
    tasksPerSection: fc.integer({ min: 0, max: 5 }),
    subtasksPerTask: fc.integer({ min: 0, max: 3 }),
    unsectionedTasks: fc.integer({ min: 0, max: 5 }),
  }).chain(({ sectionCount, tasksPerSection, subtasksPerTask, unsectionedTasks }) => {
    const sections = Array.from({ length: sectionCount }, (_, i) => ({
      id: `sec-${i}`,
      order: i,
    }));

    return fc.record({
      collapsedSections: fc.subarray(sections.map((s) => s.id), { minLength: 0 }),
      expandedTaskIds: fc.subarray(
        // All possible task IDs that could be expanded
        Array.from({ length: (sectionCount * tasksPerSection) + unsectionedTasks }, (_, i) => `task-${i}`),
        { minLength: 0 },
      ),
    }).map(({ collapsedSections, expandedTaskIds }) => {
      const collapsedSet = new Set(collapsedSections);
      const expandedSet = new Set(expandedTaskIds);

      const sectionInputs = sections.map((s) => ({
        ...s,
        collapsed: collapsedSet.has(s.id),
      }));

      const tasks: Array<{ id: string; parentTaskId: string | null; sectionId: string | null; order: number }> = [];
      let taskIdx = 0;

      // Unsectioned tasks
      for (let i = 0; i < unsectionedTasks; i++) {
        const taskId = `task-${taskIdx++}`;
        tasks.push({ id: taskId, parentTaskId: null, sectionId: null, order: i });
        for (let j = 0; j < subtasksPerTask; j++) {
          tasks.push({ id: `sub-${taskId}-${j}`, parentTaskId: taskId, sectionId: null, order: j });
        }
      }

      // Sectioned tasks
      for (const section of sections) {
        for (let i = 0; i < tasksPerSection; i++) {
          const taskId = `task-${taskIdx++}`;
          tasks.push({ id: taskId, parentTaskId: null, sectionId: section.id, order: i });
          for (let j = 0; j < subtasksPerTask; j++) {
            tasks.push({ id: `sub-${taskId}-${j}`, parentTaskId: taskId, sectionId: null, order: j });
          }
        }
      }

      return { tasks, sections: sectionInputs, expandedTaskIds: expandedSet, collapsedSections: collapsedSet };
    });
  });

  it('visible rows contain no tasks from collapsed sections and no subtasks of collapsed parents', () => {
    fc.assert(
      fc.property(arbTaskTree, ({ tasks, sections, expandedTaskIds, collapsedSections }) => {
        const visibleRows = computeVisibleRows(tasks, sections, expandedTaskIds);

        // Build lookup: taskId → task
        const taskMap = new Map(tasks.map((t) => [t.id, t]));

        for (const row of visibleRows) {
          const task = taskMap.get(row.taskId);
          expect(task).toBeDefined();

          // No row should belong to a collapsed section
          if (task!.parentTaskId === null && task!.sectionId !== null) {
            expect(collapsedSections.has(task!.sectionId)).toBe(false);
          }

          // No subtask row should have a non-expanded parent
          if (task!.parentTaskId !== null) {
            expect(expandedTaskIds.has(task!.parentTaskId)).toBe(true);
          }
        }

        // All top-level tasks in expanded sections should be present
        const visibleTaskIds = new Set(visibleRows.map((r) => r.taskId));
        for (const task of tasks) {
          if (task.parentTaskId !== null) continue; // skip subtasks for this check

          if (task.sectionId === null) {
            // Unsectioned tasks are always visible
            expect(visibleTaskIds.has(task.id)).toBe(true);
          } else if (!collapsedSections.has(task.sectionId)) {
            // Task in expanded section should be visible
            expect(visibleTaskIds.has(task.id)).toBe(true);
          } else {
            // Task in collapsed section should NOT be visible
            expect(visibleTaskIds.has(task.id)).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: keyboard-navigation, Property 3: Vim key equivalence
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
describe('Property 3: Vim key equivalence', () => {
  const vimToArrow: Array<[MoveDirection, MoveDirection]> = [
    ['left', 'left'],   // h → left
    ['down', 'down'],   // j → down
    ['up', 'up'],       // k → up
    ['right', 'right'], // l → right
  ];

  it('vim direction keys produce the same result as arrow direction keys', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),  // rows
        fc.integer({ min: 1, max: 10 }),   // columns
        fc.constantFrom(...vimToArrow),
        (rows, columns, [vimDir, arrowDir]) => {
          const row = rows === 1 ? 0 : Math.floor(Math.random() * rows);
          const col = columns === 1 ? 0 : Math.floor(Math.random() * columns);
          const coord: GridCoord = { row, column: col, taskId: null };
          const bounds = { rows, columns };

          const vimResult = moveActiveCell(coord, vimDir, bounds);
          const arrowResult = moveActiveCell(coord, arrowDir, bounds);

          expect(vimResult).toEqual(arrowResult);
        },
      ),
      { numRuns: 100 },
    );
  });
});
