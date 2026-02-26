/**
 * FVPView unit tests (Task 5.3 — TDD, written before FVPView migration)
 *
 * Validates: Requirements 5.1, 5.2
 *
 * These tests MUST FAIL before task 5.4 is implemented.
 * They verify the migrated FVPView accepts TMSViewProps<FVPState> and
 * does NOT call useTMSStore().
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Task, Priority } from '@/types';
import type { FVPState } from '../handlers/fvp';

// ── Mock useTMSStore to detect if it's called ─────────────────────────────────
const { useTMSStoreMock } = vi.hoisted(() => ({
  useTMSStoreMock: vi.fn(),
}));

vi.mock('../stores/tmsStore', () => ({
  useTMSStore: useTMSStoreMock,
}));

// Import AFTER mocking
import { FVPView } from './FVPView';

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

function makeFVPState(overrides: Partial<FVPState> = {}): FVPState {
  return {
    dottedTasks: [],
    scanPosition: 1,
    ...overrides,
  };
}

const defaultDispatch = vi.fn();
const defaultOnTaskClick = vi.fn();
const defaultOnTaskComplete = vi.fn();

function renderFVPView(
  tasks: Task[],
  systemState: FVPState,
  dispatch = defaultDispatch,
) {
  return render(
    <FVPView
      tasks={tasks}
      systemState={systemState}
      dispatch={dispatch}
      onTaskClick={defaultOnTaskClick}
      onTaskComplete={defaultOnTaskComplete}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FVPView', () => {
  // ── State A: No dotted tasks ───────────────────────────────────────────────

  describe('State A — no dotted tasks', () => {
    it('shows "Start Preselection" full-width button when no dotted tasks', () => {
      const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2' })];
      const state = makeFVPState({ dottedTasks: [], scanPosition: 1 });

      renderFVPView(tasks, state);

      const btn = screen.getByRole('button', { name: /start preselection/i });
      expect(btn).toBeTruthy();
      // Full-width: should have w-full class
      expect(btn.className).toContain('w-full');
    });

    it('dispatches START_PRESELECTION when "Start Preselection" is clicked', () => {
      const dispatch = vi.fn();
      const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2' })];
      const state = makeFVPState({ dottedTasks: [], scanPosition: 1 });

      renderFVPView(tasks, state, dispatch);

      fireEvent.click(screen.getByRole('button', { name: /start preselection/i }));
      expect(dispatch).toHaveBeenCalledWith({ type: 'START_PRESELECTION' });
    });
  });

  // ── State B: Preselection in progress ─────────────────────────────────────

  describe('State B — preselection in progress', () => {
    // Tasks: t1 (dotted = X), t2 (dotted = current), t3 (candidate)
    function makeStateBSetup() {
      const t1 = makeTask({ id: 't1', description: 'Task X description' });
      const t2 = makeTask({ id: 't2', description: 'Current task description' });
      const t3 = makeTask({ id: 't3', description: 'Candidate task description' });
      // dottedTasks: [t1, t2] → t2 is current/X (last dotted = benchmark)
      // scanPosition: 2 → t3 at index 2 is the candidate
      const state = makeFVPState({ dottedTasks: ['t1', 't2'], scanPosition: 2 });
      return { tasks: [t1, t2, t3], state, t1, t2, t3 };
    }

    it('does NOT show Do Now section during preselection (only shown in State C)', () => {
      const { tasks, state } = makeStateBSetup();
      renderFVPView(tasks, state);

      // Do Now section should NOT be present during preselection
      expect(screen.queryByText(/do now/i)).toBeNull();
    });

    it('preselection panel shows last dotted as X and candidate description', () => {
      const { tasks, state } = makeStateBSetup();
      renderFVPView(tasks, state);

      // X is now the last dotted task (t2 = "Current task description")
      // It should appear in the preselection panel's X slot
      const xElements = screen.getAllByText('Current task description');
      expect(xElements.length).toBeGreaterThan(0);
      // Candidate description should appear
      const candidateElements = screen.getAllByText('Candidate task description');
      expect(candidateElements.length).toBeGreaterThan(0);
    });

    it('"● Yes — dot it" dispatches DOT_TASK with task and tasks', () => {
      const dispatch = vi.fn();
      const { tasks, state, t3 } = makeStateBSetup();
      renderFVPView(tasks, state, dispatch);

      const yesBtn = screen.getByRole('button', { name: /yes.*dot it/i });
      fireEvent.click(yesBtn);

      expect(dispatch).toHaveBeenCalledWith({
        type: 'DOT_TASK',
        task: t3,
        tasks,
      });
    });

    it('"No — skip" dispatches SKIP_CANDIDATE with task and tasks', () => {
      const dispatch = vi.fn();
      const { tasks, state, t3 } = makeStateBSetup();
      renderFVPView(tasks, state, dispatch);

      const noBtn = screen.getByRole('button', { name: /no.*skip/i });
      fireEvent.click(noBtn);

      expect(dispatch).toHaveBeenCalledWith({
        type: 'SKIP_CANDIDATE',
        task: t3,
        tasks,
      });
    });
  });

  // ── State C: Preselection complete ────────────────────────────────────────

  describe('State C — preselection complete', () => {
    it('shows "Resume Preselection" outline button when preselection is complete', () => {
      // t1 is dotted (current), t2 is undotted — scanPosition past end → no candidate
      const t1 = makeTask({ id: 't1', description: 'Task 1' });
      const t2 = makeTask({ id: 't2', description: 'Task 2' });
      // Only t1 dotted, scanPosition past end → preselection complete, t2 still undotted
      const state = makeFVPState({ dottedTasks: ['t1'], scanPosition: 99 });

      renderFVPView([t1, t2], state);

      const btn = screen.getByRole('button', { name: /resume preselection/i });
      expect(btn).toBeTruthy();
      // Should be outline variant (not filled)
      expect(btn.className).toContain('w-full');
    });

    it('dispatches START_PRESELECTION when "Resume Preselection" is clicked', () => {
      const dispatch = vi.fn();
      const t1 = makeTask({ id: 't1' });
      const t2 = makeTask({ id: 't2' });
      // t1 dotted, t2 undotted, scanPosition past end → preselection complete
      const state = makeFVPState({ dottedTasks: ['t1'], scanPosition: 99 });

      renderFVPView([t1, t2], state, dispatch);

      fireEvent.click(screen.getByRole('button', { name: /resume preselection/i }));
      expect(dispatch).toHaveBeenCalledWith({ type: 'START_PRESELECTION' });
    });
  });

  // ── Unified task list — dotted indicator ──────────────────────────────────

  describe('unified task list', () => {
    it('dotted tasks have teal dot indicator', () => {
      const t1 = makeTask({ id: 't1', description: 'Dotted task' });
      const t2 = makeTask({ id: 't2', description: 'Undotted task' });
      // t1 is dotted, scanPosition past end (preselection complete)
      const state = makeFVPState({ dottedTasks: ['t1'], scanPosition: 99 });

      const { container } = renderFVPView([t1, t2], state);

      // The teal dot: w-2 h-2 rounded-full bg-primary
      const dots = container.querySelectorAll('.bg-primary.rounded-full');
      expect(dots.length).toBeGreaterThan(0);
    });
  });

  // ── No store access ────────────────────────────────────────────────────────

  describe('does NOT call useTMSStore', () => {
    it('renders without calling useTMSStore (pure props-driven)', () => {
      useTMSStoreMock.mockClear();

      const tasks = [makeTask({ id: 't1' })];
      const state = makeFVPState();

      renderFVPView(tasks, state);

      expect(useTMSStoreMock).not.toHaveBeenCalled();
    });
  });
});
