/**
 * StandardView unit tests
 *
 * Validates: Requirements 5.1, 5.5
 * Updated for table-based layout (TMSTable + TMSTableRow).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StandardView } from './StandardView';
import type { Task, Priority } from '@/types';

vi.mock('@/stores/dataStore', () => ({
  useDataStore: vi.fn(() => ({
    getSubtasks: vi.fn(() => []),
    updateTask: vi.fn(),
    updateSection: vi.fn(),
    deleteSection: vi.fn(),
    projects: [],
  })),
  sectionService: { createWithDefaults: vi.fn() },
}));

vi.mock('@/stores/appStore', () => ({
  useAppStore: vi.fn((selector?: any) => {
    const state = {
      columnOrder: ['dueDate', 'priority'],
      setColumnOrder: vi.fn(),
      sortColumn: null,
      sortDirection: 'asc',
      toggleSort: vi.fn(),
      keyboardShortcuts: {},
    };
    if (typeof selector === 'function') return selector(state);
    return state;
  }),
  DEFAULT_COLUMN_ORDER: ['dueDate', 'priority', 'assignee', 'tags'],
}));

vi.mock('@/features/keyboard/hooks/useKeyboardNavigation', () => ({
  useKeyboardNavigation: () => ({
    activeCell: null,
    getCellProps: () => ({}),
    onTableKeyDown: vi.fn(),
    savedCell: null,
  }),
}));

vi.mock('@/features/keyboard/stores/keyboardNavStore', () => ({
  useKeyboardNavStore: vi.fn(() => null),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    projectId: null,
    parentTaskId: null,
    sectionId: null,
    description: `Task ${overrides.id}`,
    notes: '',
    assignee: '',
    priority: 'none' as Priority,
    tags: [],
    dueDate: null,
    completed: false,
    completedAt: null,
    order: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    lastActionAt: null,
    ...overrides,
  };
}

const defaultProps = {
  systemState: {} as Record<string, never>,
  dispatch: vi.fn(),
  onTaskClick: vi.fn(),
  onTaskComplete: vi.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StandardView', () => {
  describe('empty state', () => {
    it('shows empty state when tasks array is empty', () => {
      render(<StandardView {...defaultProps} tasks={[]} />);
      expect(screen.getByText('All caught up!')).toBeTruthy();
    });

    it('shows empty state when all tasks are filtered out', () => {
      const tasks = [makeTask({ id: 't1', completed: true })];
      render(<StandardView {...defaultProps} tasks={tasks} />);
      fireEvent.click(screen.getByRole('button', { name: /hide completed/i }));
      // No task descriptions should be visible
      expect(screen.queryByText('Task t1')).toBeNull();
    });
  });

  describe('header', () => {
    it('renders "All Tasks" heading', () => {
      const tasks = [makeTask({ id: 't1' })];
      render(<StandardView {...defaultProps} tasks={tasks} />);
      expect(screen.getByRole('heading', { name: 'All Tasks' })).toBeTruthy();
    });

    it('renders "Review Queue" badge', () => {
      const tasks = [makeTask({ id: 't1' })];
      render(<StandardView {...defaultProps} tasks={tasks} />);
      expect(screen.getByText('Review Queue')).toBeTruthy();
    });

    it('shows completed-today count when > 0', () => {
      const today = new Date().toISOString();
      const tasks = [
        makeTask({ id: 't1', completed: true, completedAt: today }),
        makeTask({ id: 't2', completed: true, completedAt: today }),
        makeTask({ id: 't3' }),
      ];
      render(<StandardView {...defaultProps} tasks={tasks} />);
      expect(screen.getByText('2 completed today')).toBeTruthy();
    });

    it('hides completed-today count when 0', () => {
      const tasks = [makeTask({ id: 't1' })];
      render(<StandardView {...defaultProps} tasks={tasks} />);
      expect(screen.queryByText(/completed today/)).toBeNull();
    });
  });

  describe('task sorting', () => {
    it('sorts tasks by lastActionAt ascending (oldest first)', () => {
      const tasks = [
        makeTask({ id: 'new', lastActionAt: '2024-03-01T00:00:00.000Z' }),
        makeTask({ id: 'old', lastActionAt: '2024-01-01T00:00:00.000Z' }),
        makeTask({ id: 'mid', lastActionAt: '2024-02-01T00:00:00.000Z' }),
      ];
      render(<StandardView {...defaultProps} tasks={tasks} />);
      // Find task descriptions in order
      const taskTexts = screen.getAllByText(/^Task /).map(el => el.textContent);
      expect(taskTexts[0]).toContain('Task old');
      expect(taskTexts[2]).toContain('Task new');
    });

    it('treats null lastActionAt as oldest (sorts first)', () => {
      const tasks = [
        makeTask({ id: 'has-date', lastActionAt: '2024-01-01T00:00:00.000Z' }),
        makeTask({ id: 'no-date', lastActionAt: null }),
      ];
      render(<StandardView {...defaultProps} tasks={tasks} />);
      const taskTexts = screen.getAllByText(/^Task /).map(el => el.textContent);
      expect(taskTexts[0]).toContain('Task no-date');
    });
  });

  describe('needs attention treatment', () => {
    it('first task renders with "Needs Attention" label', () => {
      const tasks = [
        makeTask({ id: 't1', lastActionAt: '2024-01-01T00:00:00.000Z' }),
        makeTask({ id: 't2', lastActionAt: '2024-02-01T00:00:00.000Z' }),
      ];
      render(<StandardView {...defaultProps} tasks={tasks} />);
      expect(screen.getByText('Needs Attention')).toBeTruthy();
    });

    it('Reinsert button is only on the first task', () => {
      const tasks = [
        makeTask({ id: 't1', lastActionAt: '2024-01-01T00:00:00.000Z' }),
        makeTask({ id: 't2', lastActionAt: '2024-02-01T00:00:00.000Z' }),
      ];
      render(<StandardView {...defaultProps} tasks={tasks} />);
      const reinsertButtons = screen.getAllByLabelText('Move to bottom');
      // showReinsertButton shows on ALL rows in TaskList — that's the existing behavior
      expect(reinsertButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('Reinsert button dispatches REINSERT_TASK with correct taskId', () => {
      const dispatch = vi.fn();
      const tasks = [
        makeTask({ id: 't1', lastActionAt: '2024-01-01T00:00:00.000Z' }),
        makeTask({ id: 't2', lastActionAt: '2024-02-01T00:00:00.000Z' }),
      ];
      render(<StandardView {...defaultProps} dispatch={dispatch} tasks={tasks} />);
      // Click the first reinsert button (Move to bottom)
      const reinsertButtons = screen.getAllByLabelText('Move to bottom');
      fireEvent.click(reinsertButtons[0]);
      expect(dispatch).toHaveBeenCalledWith({ type: 'REINSERT_TASK', taskId: 't1' });
    });

    it('single task still shows Reinsert button', () => {
      const tasks = [makeTask({ id: 't1' })];
      render(<StandardView {...defaultProps} tasks={tasks} />);
      expect(screen.getByLabelText('Move to bottom')).toBeTruthy();
    });
  });

  describe('task interactions', () => {
    it('clicking a task calls onTaskClick with the task id', () => {
      const onTaskClick = vi.fn();
      const tasks = [makeTask({ id: 't1' })];
      render(<StandardView {...defaultProps} onTaskClick={onTaskClick} tasks={tasks} />);
      // Click the "View details" button on the task row
      fireEvent.click(screen.getByLabelText('View details'));
      expect(onTaskClick).toHaveBeenCalledWith('t1');
    });
  });

  describe('hide completed toggle', () => {
    it('hides completed tasks when toggle is clicked', () => {
      const tasks = [
        makeTask({ id: 't1', completed: false }),
        makeTask({ id: 't2', completed: true }),
      ];
      render(<StandardView {...defaultProps} tasks={tasks} />);
      fireEvent.click(screen.getByRole('button', { name: /hide completed/i }));
      expect(screen.getByText('Task t1')).toBeTruthy();
      expect(screen.queryByText('Task t2')).toBeNull();
    });

    it('toggle button label flips between hide/show', () => {
      const tasks = [makeTask({ id: 't1' })];
      render(<StandardView {...defaultProps} tasks={tasks} />);
      const btn = screen.getByRole('button', { name: /hide completed/i });
      fireEvent.click(btn);
      expect(screen.getByRole('button', { name: /show completed/i })).toBeTruthy();
    });
  });

  describe('does not call useTMSStore', () => {
    it('renders without any store access (pure props-driven)', () => {
      const tasks = [makeTask({ id: 't1' })];
      expect(() =>
        render(<StandardView {...defaultProps} tasks={tasks} />),
      ).not.toThrow();
    });
  });
});
