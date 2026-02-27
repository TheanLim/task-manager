/**
 * Tests for useTMSShortcuts hook.
 * Feature: tms-inline-interactions, Properties 5, 6, and 15
 *
 * Strategy: mock react-hotkeys-hook to capture registered callbacks,
 * then invoke them directly to test guard logic without DOM key events.
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from '@/types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Capture registered hotkey callbacks keyed by key string
const registeredCallbacks = new Map<string, () => void>();

vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: (key: string, cb: () => void, _opts: unknown, _deps: unknown) => {
    registeredCallbacks.set(key, cb);
  },
}));

// Default: not in input context
vi.mock('@/features/keyboard/services/inputContext', () => ({
  isInputContext: vi.fn().mockReturnValue(false),
}));

import { isInputContext } from '@/features/keyboard/services/inputContext';
import { useTMSShortcuts } from './useTMSShortcuts';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTask(id = 't1'): Task {
  return {
    id,
    description: `Task ${id}`,
    completed: false,
    projectId: null,
    parentTaskId: null,
    sectionId: null,
    priority: 'none' as const,
    notes: '',
    assignee: '',
    tags: [],
    dueDate: null,
    completedAt: null,
    order: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    lastActionAt: null,
  };
}

function fire(key: string) {
  const cb = registeredCallbacks.get(key);
  cb?.();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useTMSShortcuts', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let onTaskComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registeredCallbacks.clear();
    dispatch = vi.fn();
    onTaskComplete = vi.fn();
    vi.mocked(isInputContext).mockReturnValue(false);
  });

  // ── Property 5: AF4 shortcuts dispatch correct actions ────────────────────

  it('p dispatches MADE_PROGRESS in AF4 mode with candidate', () => {
    const candidate = makeTask();
    renderHook(() => useTMSShortcuts({
      activeSystem: 'af4', candidateTask: candidate, allTasks: [candidate],
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    fire('p');
    expect(dispatch).toHaveBeenCalledWith({ type: 'MADE_PROGRESS' });
  });

  it('s dispatches SKIP_TASK in AF4 mode with candidate', () => {
    const candidate = makeTask();
    renderHook(() => useTMSShortcuts({
      activeSystem: 'af4', candidateTask: candidate, allTasks: [candidate],
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    fire('s');
    expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_TASK' });
  });

  it('f dispatches FLAG_DISMISSED in AF4 mode with candidate', () => {
    const candidate = makeTask();
    renderHook(() => useTMSShortcuts({
      activeSystem: 'af4', candidateTask: candidate, allTasks: [candidate],
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    fire('f');
    expect(dispatch).toHaveBeenCalledWith({ type: 'FLAG_DISMISSED' });
  });

  it('d dispatches MARK_DONE and calls onTaskComplete in AF4 mode with candidate', () => {
    const candidate = makeTask('t1');
    renderHook(() => useTMSShortcuts({
      activeSystem: 'af4', candidateTask: candidate, allTasks: [candidate],
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    fire('d');
    expect(dispatch).toHaveBeenCalledWith({ type: 'MARK_DONE' });
    expect(onTaskComplete).toHaveBeenCalledWith('t1', true);
  });

  it('p does NOT dispatch when candidateTask is null in AF4 mode', () => {
    renderHook(() => useTMSShortcuts({
      activeSystem: 'af4', candidateTask: null, allTasks: [],
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    fire('p');
    expect(dispatch).not.toHaveBeenCalled();
  });

  // ── Property 6: no cross-mode firing ─────────────────────────────────────

  it('AF4 keys do NOT dispatch in FVP mode', () => {
    const candidate = makeTask();
    renderHook(() => useTMSShortcuts({
      activeSystem: 'fvp', candidateTask: candidate, allTasks: [candidate],
      selectionInProgress: true, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    // p, s, f are AF4-only — in FVP mode they should not be registered with AF4 guards
    fire('p');
    fire('s');
    fire('f');
    // dispatch may be called for FVP actions (y/n/b/d) but not AF4 ones
    // Since p/s/f are only enabled when isAF4, their callbacks guard on af4HasCandidate
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'MADE_PROGRESS' });
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'SKIP_TASK' });
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'FLAG_DISMISSED' });
  });

  it('FVP keys do NOT dispatch in AF4 mode', () => {
    const candidate = makeTask();
    renderHook(() => useTMSShortcuts({
      activeSystem: 'af4', candidateTask: candidate, allTasks: [candidate],
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    fire('y');
    fire('n');
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'DOT_TASK' }));
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SKIP_CANDIDATE' }));
  });

  // ── Property 15: FVP shortcuts ────────────────────────────────────────────

  it('y dispatches DOT_TASK in FVP mode when selectionInProgress', () => {
    const candidate = makeTask('c1');
    const tasks = [candidate];
    renderHook(() => useTMSShortcuts({
      activeSystem: 'fvp', candidateTask: candidate, allTasks: tasks,
      selectionInProgress: true, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    fire('y');
    expect(dispatch).toHaveBeenCalledWith({ type: 'DOT_TASK', task: candidate, tasks });
  });

  it('n dispatches SKIP_CANDIDATE in FVP mode when selectionInProgress', () => {
    const candidate = makeTask('c1');
    const tasks = [candidate];
    renderHook(() => useTMSShortcuts({
      activeSystem: 'fvp', candidateTask: candidate, allTasks: tasks,
      selectionInProgress: true, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    fire('n');
    expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_CANDIDATE', task: candidate, tasks });
  });

  it('b dispatches START_PRESELECTION in FVP mode when !selectionInProgress', () => {
    const tasks = [makeTask()];
    renderHook(() => useTMSShortcuts({
      activeSystem: 'fvp', candidateTask: null, allTasks: tasks,
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    fire('b');
    expect(dispatch).toHaveBeenCalledWith({ type: 'START_PRESELECTION', tasks });
  });

  it('y does NOT dispatch when selectionInProgress is false', () => {
    const candidate = makeTask();
    renderHook(() => useTMSShortcuts({
      activeSystem: 'fvp', candidateTask: candidate, allTasks: [candidate],
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    fire('y');
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'DOT_TASK' }));
  });

  // ── Property 15: DIT shortcuts ────────────────────────────────────────────

  it('t dispatches MOVE_TO_TODAY in DIT mode with focused task', () => {
    renderHook(() => useTMSShortcuts({
      activeSystem: 'dit', candidateTask: null, allTasks: [],
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: 'task-x',
      dispatch, onTaskComplete,
    }));
    fire('t');
    expect(dispatch).toHaveBeenCalledWith({ type: 'MOVE_TO_TODAY', taskId: 'task-x' });
  });

  it('w dispatches MOVE_TO_TOMORROW in DIT mode with focused task', () => {
    renderHook(() => useTMSShortcuts({
      activeSystem: 'dit', candidateTask: null, allTasks: [],
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: 'task-x',
      dispatch, onTaskComplete,
    }));
    fire('w');
    expect(dispatch).toHaveBeenCalledWith({ type: 'MOVE_TO_TOMORROW', taskId: 'task-x' });
  });

  it('i dispatches REMOVE_FROM_SCHEDULE in DIT mode with focused task', () => {
    renderHook(() => useTMSShortcuts({
      activeSystem: 'dit', candidateTask: null, allTasks: [],
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: 'task-x',
      dispatch, onTaskComplete,
    }));
    fire('i');
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_FROM_SCHEDULE', taskId: 'task-x' });
  });

  it('DIT keys do NOT dispatch when focusedTaskId is null', () => {
    renderHook(() => useTMSShortcuts({
      activeSystem: 'dit', candidateTask: null, allTasks: [],
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    fire('t');
    fire('w');
    fire('i');
    expect(dispatch).not.toHaveBeenCalled();
  });

  // ── Input context guard ───────────────────────────────────────────────────

  it('does not dispatch when isInputContext returns true', () => {
    vi.mocked(isInputContext).mockReturnValue(true);
    const candidate = makeTask();
    renderHook(() => useTMSShortcuts({
      activeSystem: 'af4', candidateTask: candidate, allTasks: [candidate],
      selectionInProgress: false, hasDottedTasks: false, focusedTaskId: null,
      dispatch, onTaskComplete,
    }));
    fire('p');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
