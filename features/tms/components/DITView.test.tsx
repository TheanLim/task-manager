/**
 * DITView unit tests (Task 5.1 — TDD, written before DITView migration)
 *
 * Validates: Requirements 5.1, 5.4
 *
 * These tests MUST FAIL before task 5.2 is implemented.
 * They verify the migrated DITView accepts TMSViewProps<DITState> and
 * does NOT call useTMSStore().
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Task, Priority } from '@/types';
import type { DITState } from '../handlers/DITHandler';

// ── Mock useTMSStore to detect if it's called ─────────────────────────────────
// If DITView still imports useTMSStore, this mock will record the call.
// The "does NOT call useTMSStore" test asserts the mock was never invoked.
// vi.mock is hoisted, so we use vi.hoisted() to create the spy first.

const { useTMSStoreMock } = vi.hoisted(() => ({
  useTMSStoreMock: vi.fn(),
}));

vi.mock('../stores/tmsStore', () => ({
  useTMSStore: useTMSStoreMock,
}));

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

// Import AFTER mocking
import { DITView } from './DITView';

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

function makeDITState(overrides: Partial<DITState> = {}): DITState {
  return {
    todayTasks: [],
    tomorrowTasks: [],
    lastDayChange: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const defaultDispatch = vi.fn();
const defaultOnTaskClick = vi.fn();
const defaultOnTaskComplete = vi.fn();

function renderDITView(
  tasks: Task[],
  systemState: DITState,
  dispatch = defaultDispatch,
) {
  return render(
    <DITView
      tasks={tasks}
      systemState={systemState}
      dispatch={dispatch}
      onTaskClick={defaultOnTaskClick}
      onTaskComplete={defaultOnTaskComplete}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DITView', () => {
  // ── Zone border colors ─────────────────────────────────────────────────────

  describe('zone border colors', () => {
    it('Today section is rendered', () => {
      const task = makeTask({ id: 'today-1' });
      const state = makeDITState({ todayTasks: ['today-1'] });
      renderDITView([task], state);
      // The section header "Today" should be present
      expect(screen.getByText('Today')).not.toBeNull();
    });

    it('Tomorrow section is rendered', () => {
      const task = makeTask({ id: 'tomorrow-1' });
      const state = makeDITState({ tomorrowTasks: ['tomorrow-1'] });
      renderDITView([task], state);
      expect(screen.getByText('Tomorrow')).not.toBeNull();
    });

    it('Inbox section is rendered when tasks are present', () => {
      const task = makeTask({ id: 'inbox-1' });
      const state = makeDITState({ todayTasks: [], tomorrowTasks: [] });
      renderDITView([task], state);
      expect(screen.getByText('Inbox')).not.toBeNull();
    });

    it('All three sections are rendered even when some are empty', () => {
      const task = makeTask({ id: 'today-1' });
      const state = makeDITState({ todayTasks: ['today-1'] });
      renderDITView([task], state);
      expect(screen.getByText('Today')).not.toBeNull();
      expect(screen.getByText('Tomorrow')).not.toBeNull();
      expect(screen.getByText('Inbox')).not.toBeNull();
    });
  });

  // ── Today zone actions ─────────────────────────────────────────────────────

  describe('Today zone task actions', () => {
    it('"→ Tomorrow" button dispatches { type: MOVE_TO_TOMORROW, taskId }', () => {
      const dispatch = vi.fn();
      const task = makeTask({ id: 'today-1' });
      const state = makeDITState({ todayTasks: ['today-1'] });

      renderDITView([task], state, dispatch);

      const btn = screen.getByRole('button', { name: /→ Tomorrow/i });
      fireEvent.click(btn);

      expect(dispatch).toHaveBeenCalledWith({ type: 'MOVE_TO_TOMORROW', taskId: 'today-1' });
    });
  });

  // ── Tomorrow zone actions ──────────────────────────────────────────────────

  describe('Tomorrow zone task actions', () => {
    it('"← Today" button dispatches { type: MOVE_TO_TODAY, taskId }', () => {
      const dispatch = vi.fn();
      const task = makeTask({ id: 'tomorrow-1' });
      const state = makeDITState({ tomorrowTasks: ['tomorrow-1'] });

      renderDITView([task], state, dispatch);

      const btn = screen.getByRole('button', { name: /← Today/i });
      fireEvent.click(btn);

      expect(dispatch).toHaveBeenCalledWith({ type: 'MOVE_TO_TODAY', taskId: 'tomorrow-1' });
    });
  });

  // ── Inbox zone actions ─────────────────────────────────────────────────────

  describe('Inbox zone task actions', () => {
    it('Inbox tasks show both "→ Today" and "→ Tomorrow" buttons', () => {
      const task = makeTask({ id: 'inbox-1' });
      // Not in today or tomorrow → inbox
      const state = makeDITState({ todayTasks: [], tomorrowTasks: [] });

      renderDITView([task], state);

      expect(screen.getByRole('button', { name: /→ Today/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /→ Tomorrow/i })).toBeTruthy();
    });

    it('"→ Today" in Inbox dispatches MOVE_TO_TODAY', () => {
      const dispatch = vi.fn();
      const task = makeTask({ id: 'inbox-1' });
      const state = makeDITState({ todayTasks: [], tomorrowTasks: [] });

      renderDITView([task], state, dispatch);

      fireEvent.click(screen.getByRole('button', { name: /→ Today/i }));
      expect(dispatch).toHaveBeenCalledWith({ type: 'MOVE_TO_TODAY', taskId: 'inbox-1' });
    });

    it('"→ Tomorrow" in Inbox dispatches MOVE_TO_TOMORROW', () => {
      const dispatch = vi.fn();
      const task = makeTask({ id: 'inbox-1' });
      const state = makeDITState({ todayTasks: [], tomorrowTasks: [] });

      renderDITView([task], state, dispatch);

      fireEvent.click(screen.getByRole('button', { name: /→ Tomorrow/i }));
      expect(dispatch).toHaveBeenCalledWith({ type: 'MOVE_TO_TOMORROW', taskId: 'inbox-1' });
    });
  });

  // ── No store access ────────────────────────────────────────────────────────

  describe('does NOT call useTMSStore', () => {
    it('renders without calling useTMSStore (pure props-driven)', () => {
      useTMSStoreMock.mockClear();

      const task = makeTask({ id: 't1' });
      const state = makeDITState({ todayTasks: ['t1'] });

      renderDITView([task], state);

      expect(useTMSStoreMock).not.toHaveBeenCalled();
    });
  });
});
