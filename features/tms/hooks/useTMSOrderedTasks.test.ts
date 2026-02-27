/**
 * Tests for useTMSOrderedTasks hook.
 * Ref: tasks.md T-16
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Task } from '@/types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

let mockActiveSystem = 'none';
let mockSystemState: unknown = undefined;

vi.mock('@/features/tms/stores/tmsStore', () => ({
  useTMSStore: (selector: (s: any) => unknown) =>
    selector({
      state: {
        activeSystem: mockActiveSystem,
        systemStates: { [mockActiveSystem]: mockSystemState },
      },
    }),
}));

const mockGetOrderedTasks = vi.fn((tasks: Task[]) => [...tasks].reverse());

vi.mock('@/features/tms/registry', () => ({
  getTMSHandler: vi.fn(() => ({
    getOrderedTasks: mockGetOrderedTasks,
  })),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useTMSOrderedTasks } from './useTMSOrderedTasks';
import { getTMSHandler } from '@/features/tms/registry';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTasks(count: number): Task[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `task-${i + 1}`,
    title: `Task ${i + 1}`,
    completed: false,
    projectId: 'proj-1',
    sectionId: 'sec-1',
    priority: 'none' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: i,
    subtasks: [],
    tags: [],
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useTMSOrderedTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveSystem = 'none';
    mockSystemState = undefined;
  });

  it('activeSystem=none returns input array reference unchanged (strict ===)', () => {
    const tasks = makeTasks(3);
    const { result } = renderHook(() => useTMSOrderedTasks(tasks));
    expect(result.current).toBe(tasks);
  });

  it('activeSystem=none does not call getTMSHandler', () => {
    const tasks = makeTasks(2);
    renderHook(() => useTMSOrderedTasks(tasks));
    expect(getTMSHandler).not.toHaveBeenCalled();
  });

  it('activeSystem=af4 returns handler.getOrderedTasks result', () => {
    mockActiveSystem = 'af4';
    const tasks = makeTasks(3);
    const { result } = renderHook(() => useTMSOrderedTasks(tasks));

    expect(getTMSHandler).toHaveBeenCalledWith('af4');
    expect(mockGetOrderedTasks).toHaveBeenCalledWith(tasks, mockSystemState);
    // Our mock reverses the array
    expect(result.current).toEqual([...tasks].reverse());
  });

  it('handler receives the filtered tasks array (not raw store tasks)', () => {
    mockActiveSystem = 'af4';
    const filtered = makeTasks(2);
    renderHook(() => useTMSOrderedTasks(filtered));
    // First arg must be the filtered array — second arg is the system state (may be undefined)
    expect(mockGetOrderedTasks.mock.calls[0][0]).toBe(filtered);
  });

  it('memoizes: same filteredTasks reference + same activeSystem → same output reference', () => {
    mockActiveSystem = 'af4';
    const tasks = makeTasks(3);
    const { result, rerender } = renderHook(() => useTMSOrderedTasks(tasks));

    const first = result.current;
    rerender();
    const second = result.current;

    expect(second).toBe(first);
    // Handler called only once despite rerender
    expect(mockGetOrderedTasks).toHaveBeenCalledTimes(1);
  });

  it('activeSystem=fvp returns FVP-ordered tasks using current system state', () => {
    mockActiveSystem = 'fvp';
    mockSystemState = { dottedTasks: ['task-1'], scanPosition: 1, snapshotTaskIds: ['task-1', 'task-2'] };
    const tasks = makeTasks(2);

    const { result } = renderHook(() => useTMSOrderedTasks(tasks));

    expect(getTMSHandler).toHaveBeenCalledWith('fvp');
    expect(mockGetOrderedTasks).toHaveBeenCalledWith(tasks, mockSystemState);
    expect(result.current).toBeDefined();
  });

  it('re-runs when filteredTasks reference changes', () => {
    mockActiveSystem = 'af4';
    const tasks1 = makeTasks(2);
    const tasks2 = makeTasks(3);

    const { result, rerender } = renderHook(
      ({ tasks }: { tasks: Task[] }) => useTMSOrderedTasks(tasks),
      { initialProps: { tasks: tasks1 } },
    );

    const first = result.current;
    rerender({ tasks: tasks2 });
    const second = result.current;

    expect(second).not.toBe(first);
    expect(mockGetOrderedTasks).toHaveBeenCalledTimes(2);
  });
});
