/**
 * TaskList TMS integration — TDD tests
 *
 * Tests for the new `tmsTaskProps` callback that lets TMS views
 * inject per-task visual customization (tmsVariant, leadingSlot, actionsSlot)
 * into the shared TaskList without duplicating the table infrastructure.
 *
 * Written BEFORE implementation — these must FAIL first.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TaskList } from './TaskList';
import { Task, Priority, Section } from '@/types';
import { useDataStore } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/stores/dataStore', () => ({
  useDataStore: vi.fn(),
  sectionService: { createWithDefaults: vi.fn() },
}));

vi.mock('@/stores/appStore', () => {
  const DEFAULT_COLUMN_ORDER = ['dueDate', 'priority', 'assignee', 'tags'];
  return {
    useAppStore: vi.fn(),
    DEFAULT_COLUMN_ORDER,
    TaskColumnId: {},
  };
});

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
    sectionId: 'section-1',
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

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'section-1',
    projectId: null,
    name: 'Test Section',
    order: 0,
    collapsed: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const baseProps = {
  onTaskClick: vi.fn(),
  onTaskComplete: vi.fn(),
  onAddTask: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (useDataStore as any).mockReturnValue({
    getSubtasks: vi.fn(() => []),
    updateTask: vi.fn(),
    updateSection: vi.fn(),
    deleteSection: vi.fn(),
    projects: [],
  });
  (useAppStore as any).mockImplementation((selector?: any) => {
    const state = {
      columnOrder: ['dueDate', 'priority'],
      setColumnOrder: vi.fn(),
      sortColumn: null,
      sortDirection: 'asc' as const,
      toggleSort: vi.fn(),
      keyboardShortcuts: {},
      globalTasksDisplayMode: 'nested',
      hideCompletedTasks: false,
      autoHideThreshold: 'never',
      showRecentlyCompleted: false,
    };
    if (typeof selector === 'function') return selector(state);
    return state;
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TaskList tmsTaskProps callback', () => {
  it('calls tmsTaskProps for each rendered task and applies tmsVariant', () => {
    const tasks = [
      makeTask({ id: 't1', order: 0 }),
      makeTask({ id: 't2', order: 1 }),
    ];
    const section = makeSection();

    const { container } = render(
      <TaskList
        tasks={tasks}
        sections={[section]}
        {...baseProps}
        tmsTaskProps={(task) => ({
          tmsVariant: task.id === 't1' ? 'current' : 'default',
        })}
      />,
    );

    const t1Row = container.querySelector('tr[data-task-id="t1"]')!;
    const t2Row = container.querySelector('tr[data-task-id="t2"]')!;
    expect(t1Row.className).toContain('tms-af4-current');
    expect(t2Row.className).not.toContain('tms-');
  });

  it('passes leadingSlot from tmsTaskProps to TaskRow', () => {
    const tasks = [makeTask({ id: 't1', order: 0 })];
    const section = makeSection();

    render(
      <TaskList
        tasks={tasks}
        sections={[section]}
        {...baseProps}
        tmsTaskProps={() => ({
          leadingSlot: <span data-testid="fvp-dot" />,
        })}
      />,
    );

    expect(screen.getByTestId('fvp-dot')).toBeInTheDocument();
  });

  it('passes actionsSlot from tmsTaskProps to TaskRow', () => {
    const tasks = [makeTask({ id: 't1', order: 0 })];
    const section = makeSection();

    render(
      <TaskList
        tasks={tasks}
        sections={[section]}
        {...baseProps}
        tmsTaskProps={() => ({
          actionsSlot: <button>Made progress</button>,
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Made progress' })).toBeInTheDocument();
  });

  it('does not affect TaskRow when tmsTaskProps is not provided', () => {
    const tasks = [makeTask({ id: 't1', order: 0 })];
    const section = makeSection();

    const { container } = render(
      <TaskList
        tasks={tasks}
        sections={[section]}
        {...baseProps}
      />,
    );

    const row = container.querySelector('tr[data-task-id="t1"]')!;
    expect(row.className).not.toContain('tms-');
  });

  it('tmsTaskProps receives the task object for conditional logic', () => {
    const tmsTaskProps = vi.fn(() => ({}));
    const tasks = [makeTask({ id: 't1', order: 0 })];
    const section = makeSection();

    render(
      <TaskList
        tasks={tasks}
        sections={[section]}
        {...baseProps}
        tmsTaskProps={tmsTaskProps}
      />,
    );

    expect(tmsTaskProps).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1' }),
    );
  });
});
