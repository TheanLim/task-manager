/**
 * Tests for useTMSDispatch hook.
 * Feature: tms-inline-interactions, Properties 16 and 17
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

let mockActiveSystem = 'none';
let mockSystemState: Record<string, unknown> = {};
const mockApplySystemStateDelta = vi.fn();

vi.mock('@/features/tms/stores/tmsStore', () => ({
  useTMSStore: (selector: (s: any) => unknown) =>
    selector({
      state: {
        activeSystem: mockActiveSystem,
        systemStates: { [mockActiveSystem]: mockSystemState },
      },
      applySystemStateDelta: mockApplySystemStateDelta,
    }),
}));

const mockReduce = vi.fn().mockReturnValue({ someField: 'delta' });
const mockHandler = { id: 'af4', reduce: mockReduce };

vi.mock('@/features/tms/registry', () => ({
  getTMSHandler: (id: string) => {
    if (id === 'af4' || id === 'fvp' || id === 'dit') return mockHandler;
    throw new Error(`Unknown TMS: "${id}"`);
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useTMSDispatch } from './useTMSDispatch';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useTMSDispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveSystem = 'none';
    mockSystemState = {};
    mockReduce.mockReturnValue({ someField: 'delta' });
  });

  // ── Property 17: no-op for none/standard ──────────────────────────────────

  it('returns a no-op when activeSystem is none', () => {
    mockActiveSystem = 'none';
    const { result } = renderHook(() => useTMSDispatch());

    act(() => result.current({ type: 'ANYTHING' }));

    expect(mockApplySystemStateDelta).not.toHaveBeenCalled();
  });

  it('returns a no-op when activeSystem is standard', () => {
    mockActiveSystem = 'standard';
    const { result } = renderHook(() => useTMSDispatch());

    act(() => result.current({ type: 'ANYTHING' }));

    expect(mockApplySystemStateDelta).not.toHaveBeenCalled();
  });

  // ── Property 16: dispatch round-trip ─────────────────────────────────────

  it('calls handler.reduce then applySystemStateDelta with the delta', () => {
    mockActiveSystem = 'af4';
    mockSystemState = { backlogTaskIds: ['t1'], currentPosition: 0 };
    const action = { type: 'SKIP_TASK' };

    const { result } = renderHook(() => useTMSDispatch());

    act(() => result.current(action));

    expect(mockReduce).toHaveBeenCalledWith(mockSystemState, action);
    expect(mockApplySystemStateDelta).toHaveBeenCalledWith('af4', { someField: 'delta' });
  });

  it('passes the correct system state for the active handler', () => {
    mockActiveSystem = 'fvp';
    mockSystemState = { dottedTasks: ['t1'], scanPosition: 2, snapshotTaskIds: ['t1', 't2'] };
    const action = { type: 'RESET_FVP' };

    const { result } = renderHook(() => useTMSDispatch());

    act(() => result.current(action));

    expect(mockReduce).toHaveBeenCalledWith(mockSystemState, action);
  });

  // ── Error resilience ──────────────────────────────────────────────────────

  it('does not throw when handler.reduce throws — logs error instead', () => {
    mockActiveSystem = 'af4';
    mockReduce.mockImplementationOnce(() => { throw new Error('reduce failed'); });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useTMSDispatch());

    expect(() => act(() => result.current({ type: 'ANYTHING' }))).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  // ── Stability ─────────────────────────────────────────────────────────────

  it('returns the same function reference when deps do not change', () => {
    mockActiveSystem = 'af4';
    const { result, rerender } = renderHook(() => useTMSDispatch());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
