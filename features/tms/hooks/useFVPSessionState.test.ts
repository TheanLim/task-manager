/**
 * Tests for useFVPSessionState hook.
 * Ref: tasks.md T-17
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Task } from '@/types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

let mockActiveSystem = 'none';
let mockFvpState: { dottedTasks: string[]; scanPosition: number; snapshotTaskIds: string[] } | undefined =
  undefined;

vi.mock('@/features/tms/stores/tmsStore', () => ({
  useTMSStore: (selector: (s: any) => unknown) =>
    selector({
      state: {
        activeSystem: mockActiveSystem,
        systemStates: { fvp: mockFvpState },
      },
    }),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useFVPSessionState } from './useFVPSessionState';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTask(id: string, completed = false): Task {
  return {
    id,
    description: `Task ${id}`,
    completed,
    projectId: 'proj-1',
    parentTaskId: null,
    sectionId: 'sec-1',
    priority: 'none' as const,
    notes: '',
    assignee: '',
    tags: [],
    dueDate: null,
    completedAt: null,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActionAt: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useFVPSessionState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveSystem = 'none';
    mockFvpState = undefined;
  });

  // ── Non-FVP mode ───────────────────────────────────────────────────────────

  it('returns all-zero/false state when activeSystem !== fvp', () => {
    mockActiveSystem = 'af4';
    const { result } = renderHook(() => useFVPSessionState([]));

    expect(result.current.progress).toBe(0);
    expect(result.current.total).toBe(0);
    expect(result.current.isFiltered).toBe(false);
    expect(result.current.isInSnapshot('any-id')).toBe(false);
    expect(result.current.isOutsideFilter('any-id')).toBe(false);
  });

  it('returns all-zero/false state when activeSystem is none', () => {
    mockActiveSystem = 'none';
    const { result } = renderHook(() => useFVPSessionState([]));

    expect(result.current.progress).toBe(0);
    expect(result.current.total).toBe(0);
    expect(result.current.isFiltered).toBe(false);
  });

  // ── isInSnapshot ───────────────────────────────────────────────────────────

  it('isInSnapshot returns true for id in snapshotTaskIds', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = { dottedTasks: [], scanPosition: 0, snapshotTaskIds: ['id-in-snap', 'id-2'] };

    const { result } = renderHook(() => useFVPSessionState([]));

    expect(result.current.isInSnapshot('id-in-snap')).toBe(true);
  });

  it('isInSnapshot returns false for id not in snapshotTaskIds', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = { dottedTasks: [], scanPosition: 0, snapshotTaskIds: ['id-in-snap'] };

    const { result } = renderHook(() => useFVPSessionState([]));

    expect(result.current.isInSnapshot('id-not-in-snap')).toBe(false);
  });

  // ── isOutsideFilter ────────────────────────────────────────────────────────

  it('isOutsideFilter returns true when task is in snapshot but not in visibleTasks', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = { dottedTasks: [], scanPosition: 0, snapshotTaskIds: ['id-in-snap'] };
    const visibleTasks: Task[] = []; // id-in-snap is NOT visible

    const { result } = renderHook(() => useFVPSessionState(visibleTasks));

    expect(result.current.isOutsideFilter('id-in-snap')).toBe(true);
  });

  it('isOutsideFilter returns false when task is in snapshot AND in visibleTasks', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = { dottedTasks: [], scanPosition: 0, snapshotTaskIds: ['id-in-snap'] };
    const visibleTasks = [makeTask('id-in-snap')];

    const { result } = renderHook(() => useFVPSessionState(visibleTasks));

    expect(result.current.isOutsideFilter('id-in-snap')).toBe(false);
  });

  it('isOutsideFilter returns false for id not in snapshot at all', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = { dottedTasks: [], scanPosition: 0, snapshotTaskIds: ['other-id'] };
    const visibleTasks = [makeTask('id-not-in-snap')];

    const { result } = renderHook(() => useFVPSessionState(visibleTasks));

    expect(result.current.isOutsideFilter('id-not-in-snap')).toBe(false);
  });

  // ── progress ──────────────────────────────────────────────────────────────

  it('progress counts snapshot IDs present in visibleTasks and not completed', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = {
      dottedTasks: [],
      scanPosition: 0,
      snapshotTaskIds: ['t1', 't2', 't3', 't4'],
    };
    const visibleTasks = [
      makeTask('t1', false),  // in snapshot, visible, not completed → counts
      makeTask('t2', true),   // in snapshot, visible, completed → does NOT count
      makeTask('t3', false),  // in snapshot, visible, not completed → counts
      // t4 not in visibleTasks → does NOT count
      makeTask('t5', false),  // not in snapshot → does NOT count
    ];

    const { result } = renderHook(() => useFVPSessionState(visibleTasks));

    expect(result.current.progress).toBe(2);
  });

  it('progress is 0 when all snapshot tasks are completed', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = { dottedTasks: [], scanPosition: 0, snapshotTaskIds: ['t1', 't2'] };
    const visibleTasks = [makeTask('t1', true), makeTask('t2', true)];

    const { result } = renderHook(() => useFVPSessionState(visibleTasks));

    expect(result.current.progress).toBe(0);
  });

  // ── total ─────────────────────────────────────────────────────────────────

  it('total equals snapshotTaskIds.length', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = { dottedTasks: [], scanPosition: 0, snapshotTaskIds: ['t1', 't2', 't3'] };

    const { result } = renderHook(() => useFVPSessionState([]));

    expect(result.current.total).toBe(3);
  });

  it('total is 0 when snapshotTaskIds is empty', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = { dottedTasks: [], scanPosition: 0, snapshotTaskIds: [] };

    const { result } = renderHook(() => useFVPSessionState([]));

    expect(result.current.total).toBe(0);
  });

  // ── isFiltered ────────────────────────────────────────────────────────────

  it('isFiltered is true when snapshotTaskIds.length !== visibleTasks.length', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = { dottedTasks: [], scanPosition: 0, snapshotTaskIds: ['t1', 't2', 't3'] };
    const visibleTasks = [makeTask('t1'), makeTask('t2')]; // 2 visible, 3 in snapshot

    const { result } = renderHook(() => useFVPSessionState(visibleTasks));

    expect(result.current.isFiltered).toBe(true);
  });

  it('isFiltered is false when snapshotTaskIds.length === visibleTasks.length', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = { dottedTasks: [], scanPosition: 0, snapshotTaskIds: ['t1', 't2'] };
    const visibleTasks = [makeTask('t1'), makeTask('t2')];

    const { result } = renderHook(() => useFVPSessionState(visibleTasks));

    expect(result.current.isFiltered).toBe(false);
  });

  // ── missing fvpState ──────────────────────────────────────────────────────

  it('handles missing fvpState gracefully (defaults snapshotTaskIds to [])', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = undefined;

    const { result } = renderHook(() => useFVPSessionState([]));

    expect(result.current.total).toBe(0);
    expect(result.current.progress).toBe(0);
    expect(result.current.isFiltered).toBe(false);
    expect(result.current.isInSnapshot('any')).toBe(false);
  });

  // ── selectionInProgress ───────────────────────────────────────────────────

  it('selectionInProgress is false when activeSystem is not fvp', () => {
    mockActiveSystem = 'af4';
    const { result } = renderHook(() => useFVPSessionState([]));
    expect(result.current.selectionInProgress).toBe(false);
  });

  it('selectionInProgress is true when a scan candidate exists', () => {
    mockActiveSystem = 'fvp';
    // scanPosition=1, tasks=[t1,t2], dottedTasks=[] → getScanCandidate returns t2 (index >= scanPosition)
    mockFvpState = { dottedTasks: [], scanPosition: 1, snapshotTaskIds: ['t1', 't2'] };
    const visibleTasks = [makeTask('t1'), makeTask('t2')];

    const { result } = renderHook(() => useFVPSessionState(visibleTasks));

    expect(result.current.selectionInProgress).toBe(true);
  });

  it('selectionInProgress is false when no scan candidate exists (all tasks dotted)', () => {
    mockActiveSystem = 'fvp';
    // All tasks are dotted → getScanCandidate returns null
    mockFvpState = { dottedTasks: ['t1', 't2'], scanPosition: 1, snapshotTaskIds: ['t1', 't2'] };
    const visibleTasks = [makeTask('t1'), makeTask('t2')];

    const { result } = renderHook(() => useFVPSessionState(visibleTasks));

    expect(result.current.selectionInProgress).toBe(false);
  });

  it('selectionInProgress is false when fvpState is undefined', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = undefined;

    const { result } = renderHook(() => useFVPSessionState([]));

    expect(result.current.selectionInProgress).toBe(false);
  });

  // ── currentX ──────────────────────────────────────────────────────────────

  it('currentX is null when activeSystem is not fvp', () => {
    mockActiveSystem = 'none';
    const { result } = renderHook(() => useFVPSessionState([makeTask('t1')]));
    expect(result.current.currentX).toBeNull();
  });

  it('currentX is the last dotted task when dottedTasks is non-empty', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = { dottedTasks: ['t1', 't2'], scanPosition: 3, snapshotTaskIds: ['t1', 't2', 't3'] };
    const visibleTasks = [makeTask('t1'), makeTask('t2'), makeTask('t3')];

    const { result } = renderHook(() => useFVPSessionState(visibleTasks));

    // getCurrentX returns the last dotted task
    expect(result.current.currentX?.id).toBe('t2');
  });

  it('currentX is the first incomplete task when dottedTasks is empty', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = { dottedTasks: [], scanPosition: 1, snapshotTaskIds: ['t1', 't2'] };
    const visibleTasks = [makeTask('t1'), makeTask('t2')];

    const { result } = renderHook(() => useFVPSessionState(visibleTasks));

    // getCurrentX with no dots returns first incomplete task
    expect(result.current.currentX?.id).toBe('t1');
  });

  it('currentX is null when fvpState is undefined', () => {
    mockActiveSystem = 'fvp';
    mockFvpState = undefined;

    const { result } = renderHook(() => useFVPSessionState([]));

    expect(result.current.currentX).toBeNull();
  });
});
