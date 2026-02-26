/**
 * AF4View unit tests (Task 5.5 — TDD, written before AF4View migration)
 *
 * Validates: Requirements 5.1, 5.3
 *
 * These tests MUST FAIL before task 5.6 is implemented.
 * They verify the migrated AF4View accepts TMSViewProps<AF4State> and
 * does NOT call useTMSStore().
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Task, Priority } from '@/types';
import type { AF4State } from '../handlers/af4';

// ── Mock useTMSStore to detect if it's called ─────────────────────────────────
const { useTMSStoreMock } = vi.hoisted(() => ({
  useTMSStoreMock: vi.fn(),
}));

vi.mock('../stores/tmsStore', () => ({
  useTMSStore: useTMSStoreMock,
}));

// Import AFTER mocking
import { AF4View } from './AF4View';

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

function makeAF4State(overrides: Partial<AF4State> = {}): AF4State {
  return {
    backlogTaskIds: [],
    activeListTaskIds: [],
    currentPosition: 0,
    lastPassHadWork: false,
    dismissedTaskIds: [],
    phase: 'backlog',
    ...overrides,
  };
}

const defaultDispatch = vi.fn();
const defaultOnTaskClick = vi.fn();
const defaultOnTaskComplete = vi.fn();

function renderAF4View(
  tasks: Task[],
  systemState: AF4State,
  dispatch = defaultDispatch,
  onTaskComplete = defaultOnTaskComplete,
) {
  return render(
    <AF4View
      tasks={tasks}
      systemState={systemState}
      dispatch={dispatch}
      onTaskClick={defaultOnTaskClick}
      onTaskComplete={onTaskComplete}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AF4View', () => {
  // ── Phase badge — only ONE at a time ──────────────────────────────────────

  describe('phase indicator bar', () => {
    it('shows only the Working Backlog badge when phase is backlog and pass is not complete', () => {
      const task = makeTask({ id: 't1' });
      const state = makeAF4State({
        backlogTaskIds: ['t1'],
        phase: 'backlog',
        lastPassHadWork: false,
        currentPosition: 0,
      });

      renderAF4View([task], state);

      expect(screen.getByText(/working backlog/i)).toBeTruthy();
      expect(screen.queryByText(/active list pass/i)).toBeNull();
      expect(screen.queryByText(/pass complete/i)).toBeNull();
    });

    it('shows only the Active List Pass badge when phase is active', () => {
      const task = makeTask({ id: 't1' });
      const state = makeAF4State({
        activeListTaskIds: ['t1'],
        phase: 'active',
        currentPosition: 0,
      });

      renderAF4View([task], state);

      expect(screen.getByText(/active list pass/i)).toBeTruthy();
      expect(screen.queryByText(/working backlog/i)).toBeNull();
      expect(screen.queryByText(/pass complete/i)).toBeNull();
    });

    it('never shows both Working Backlog and Active List Pass badges simultaneously', () => {
      const task = makeTask({ id: 't1' });
      const state = makeAF4State({
        backlogTaskIds: ['t1'],
        phase: 'backlog',
        currentPosition: 0,
      });

      renderAF4View([task], state);

      const backlogBadges = screen.queryAllByText(/working backlog/i);
      const activeBadges = screen.queryAllByText(/active list pass/i);
      // At most one of each, and not both present
      expect(backlogBadges.length + activeBadges.length).toBeLessThanOrEqual(1);
    });

    it('shows pass-complete amber badge (not phase badge) when pass is complete with no work', () => {
      // Pass complete: currentPosition >= list.length AND !lastPassHadWork
      const state = makeAF4State({
        backlogTaskIds: [],
        activeListTaskIds: [],
        phase: 'backlog',
        currentPosition: 0,
        lastPassHadWork: false,
      });

      renderAF4View([], state);

      // Pass complete badge should be present
      expect(screen.getByText(/pass complete/i)).toBeTruthy();
      // Phase badge should NOT be present
      expect(screen.queryByText(/working backlog/i)).toBeNull();
      expect(screen.queryByText(/active list pass/i)).toBeNull();
    });

    it('pass-complete badge does NOT appear alongside the phase badge', () => {
      const task = makeTask({ id: 't1' });
      const state = makeAF4State({
        backlogTaskIds: ['t1'],
        phase: 'backlog',
        currentPosition: 0,
        lastPassHadWork: false,
      });

      renderAF4View([task], state);

      // Not at end of list → pass not complete → no amber badge
      expect(screen.queryByText(/pass complete/i)).toBeNull();
      expect(screen.getByText(/working backlog/i)).toBeTruthy();
    });
  });

  // ── Action buttons — visual distinction ───────────────────────────────────

  describe('current task action buttons', () => {
    function renderWithCurrentTask() {
      const task = makeTask({ id: 't1', description: 'Current task' });
      const state = makeAF4State({
        backlogTaskIds: ['t1'],
        phase: 'backlog',
        currentPosition: 0,
      });
      const dispatch = vi.fn();
      const onTaskComplete = vi.fn();
      renderAF4View([task], state, dispatch, onTaskComplete);
      return { dispatch, onTaskComplete };
    }

    it('"↺ Made progress" button has flex-1 class (teal outline, full weight)', () => {
      renderWithCurrentTask();
      const btn = screen.getByRole('button', { name: /made progress/i });
      expect(btn).toBeTruthy();
      expect(btn.className).toContain('flex-1');
    });

    it('"✓ Done" button does NOT have flex-1 (ghost, size="sm", secondary weight)', () => {
      renderWithCurrentTask();
      const doneBtn = screen.getByRole('button', { name: /done/i });
      expect(doneBtn).toBeTruthy();
      // Must not be flex-1 — it's the secondary action
      expect(doneBtn.className).not.toContain('flex-1');
    });

    it('"↺ Made progress" and "✓ Done" are not visually equal (different classes)', () => {
      renderWithCurrentTask();
      const progressBtn = screen.getByRole('button', { name: /made progress/i });
      const doneBtn = screen.getByRole('button', { name: /done/i });
      // They must have different class strings (different visual weight)
      expect(progressBtn.className).not.toEqual(doneBtn.className);
    });
  });

  // ── "↺ Made progress" dispatches MADE_PROGRESS, does NOT call onTaskComplete ──

  describe('"↺ Made progress" action', () => {
    it('dispatches MADE_PROGRESS action', () => {
      const task = makeTask({ id: 't1' });
      const state = makeAF4State({
        backlogTaskIds: ['t1'],
        phase: 'backlog',
        currentPosition: 0,
      });
      const dispatch = vi.fn();
      const onTaskComplete = vi.fn();

      renderAF4View([task], state, dispatch, onTaskComplete);

      fireEvent.click(screen.getByRole('button', { name: /made progress/i }));

      expect(dispatch).toHaveBeenCalledWith({ type: 'MADE_PROGRESS' });
    });

    it('does NOT call onTaskComplete when "↺ Made progress" is clicked', () => {
      const task = makeTask({ id: 't1' });
      const state = makeAF4State({
        backlogTaskIds: ['t1'],
        phase: 'backlog',
        currentPosition: 0,
      });
      const dispatch = vi.fn();
      const onTaskComplete = vi.fn();

      renderAF4View([task], state, dispatch, onTaskComplete);

      fireEvent.click(screen.getByRole('button', { name: /made progress/i }));

      expect(onTaskComplete).not.toHaveBeenCalled();
    });
  });

  // ── "✓ Done" calls onTaskComplete AND dispatches MARK_DONE ────────────────

  describe('"✓ Done" action', () => {
    it('calls onTaskComplete(taskId, true) when "✓ Done" is clicked', () => {
      const task = makeTask({ id: 't1' });
      const state = makeAF4State({
        backlogTaskIds: ['t1'],
        phase: 'backlog',
        currentPosition: 0,
      });
      const dispatch = vi.fn();
      const onTaskComplete = vi.fn();

      renderAF4View([task], state, dispatch, onTaskComplete);

      fireEvent.click(screen.getByRole('button', { name: /done/i }));

      expect(onTaskComplete).toHaveBeenCalledWith('t1', true);
    });

    it('dispatches MARK_DONE when "✓ Done" is clicked', () => {
      const task = makeTask({ id: 't1' });
      const state = makeAF4State({
        backlogTaskIds: ['t1'],
        phase: 'backlog',
        currentPosition: 0,
      });
      const dispatch = vi.fn();
      const onTaskComplete = vi.fn();

      renderAF4View([task], state, dispatch, onTaskComplete);

      fireEvent.click(screen.getByRole('button', { name: /done/i }));

      expect(dispatch).toHaveBeenCalledWith({ type: 'MARK_DONE' });
    });
  });

  // ── Line divider uses border-t-2 (solid, not dashed) ─────────────────────

  describe('line divider', () => {
    it('uses border-t-2 class (solid, not dashed)', () => {
      const { container } = renderAF4View([], makeAF4State());

      // The divider line element should have border-t-2
      const dividerLine = container.querySelector('.border-t-2');
      expect(dividerLine).not.toBeNull();
    });

    it('does NOT use border-dashed class on the divider', () => {
      const { container } = renderAF4View([], makeAF4State());

      const dashedElements = container.querySelectorAll('.border-dashed');
      expect(dashedElements.length).toBe(0);
    });
  });

  // ── Dismissed task ⚠ icon toggles inline resolution panel ────────────────

  describe('dismissed task resolution panel', () => {
    function renderWithDismissedTask() {
      const task = makeTask({ id: 'dismissed-1', description: 'Stubborn task' });
      const state = makeAF4State({
        backlogTaskIds: ['dismissed-1'],
        dismissedTaskIds: ['dismissed-1'],
        phase: 'backlog',
        currentPosition: 0,
      });
      const dispatch = vi.fn();
      return { dispatch, task, state };
    }

    it('renders ⚠ icon for dismissed tasks', () => {
      const { task, state, dispatch } = renderWithDismissedTask();
      renderAF4View([task], state, dispatch);

      // AlertTriangle icon should be present (aria-label)
      const icon = screen.getByLabelText(/resolve flagged task/i);
      expect(icon).toBeTruthy();
    });

    it('clicking ⚠ icon opens the inline resolution panel', () => {
      const { task, state, dispatch } = renderWithDismissedTask();
      renderAF4View([task], state, dispatch);

      // Panel should not be visible initially
      expect(screen.queryByText(/abandon/i)).toBeNull();

      // Click the ⚠ icon
      fireEvent.click(screen.getByLabelText(/resolve flagged task/i));

      // Resolution panel should now be visible
      expect(screen.getByRole('button', { name: /abandon/i })).toBeTruthy();
    });

    it('clicking ⚠ icon again closes the inline resolution panel (toggle)', () => {
      const { task, state, dispatch } = renderWithDismissedTask();
      renderAF4View([task], state, dispatch);

      const icon = screen.getByLabelText(/resolve flagged task/i);

      // Open
      fireEvent.click(icon);
      expect(screen.getByRole('button', { name: /abandon/i })).toBeTruthy();

      // Close
      fireEvent.click(icon);
      expect(screen.queryByRole('button', { name: /abandon/i })).toBeNull();
    });

    it('resolution panel shows Abandon, Re-enter, and Defer options', () => {
      const { task, state, dispatch } = renderWithDismissedTask();
      renderAF4View([task], state, dispatch);

      fireEvent.click(screen.getByLabelText(/resolve flagged task/i));

      expect(screen.getByRole('button', { name: /abandon/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /re-enter/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /defer/i })).toBeTruthy();
    });
  });

  // ── Does NOT call useTMSStore ─────────────────────────────────────────────

  describe('does NOT call useTMSStore', () => {
    it('renders without calling useTMSStore (pure props-driven)', () => {
      useTMSStoreMock.mockClear();

      const task = makeTask({ id: 't1' });
      const state = makeAF4State({ backlogTaskIds: ['t1'] });

      renderAF4View([task], state);

      expect(useTMSStoreMock).not.toHaveBeenCalled();
    });
  });
});
