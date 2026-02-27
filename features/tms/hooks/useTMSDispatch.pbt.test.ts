/**
 * Property-based tests for useTMSDispatch.
 * Feature: tms-inline-interactions, Properties 16 and 17
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ── Mocks ─────────────────────────────────────────────────────────────────────

let mockActiveSystem = 'none';
let mockSystemState: Record<string, unknown> = {};
const mockApplySystemStateDelta = vi.fn();
const mockReduce = vi.fn();

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

vi.mock('@/features/tms/registry', () => ({
  getTMSHandler: (id: string) => {
    if (id === 'af4' || id === 'fvp' || id === 'dit') {
      return { id, reduce: mockReduce };
    }
    throw new Error(`Unknown TMS: "${id}"`);
  },
}));

import { useTMSDispatch } from './useTMSDispatch';

// ── Arbitraries ───────────────────────────────────────────────────────────────

const actionTypeArb = fc.constantFrom('MADE_PROGRESS', 'MARK_DONE', 'SKIP_TASK', 'FLAG_DISMISSED', 'RESET_FVP');
const activeSystemArb = fc.constantFrom('af4', 'fvp', 'dit');
const inactiveSystemArb = fc.constantFrom('none', 'standard');

describe('useTMSDispatch — property-based tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveSystem = 'none';
    mockSystemState = {};
    mockReduce.mockReturnValue({ updated: true });
  });

  // Feature: tms-inline-interactions, Property 17
  it('for any action, dispatch is a no-op when activeSystem is none or standard', () => {
    fc.assert(
      fc.property(inactiveSystemArb, actionTypeArb, (system, actionType) => {
        mockActiveSystem = system;
        const { result } = renderHook(() => useTMSDispatch());
        act(() => result.current({ type: actionType }));
        expect(mockApplySystemStateDelta).not.toHaveBeenCalled();
        vi.clearAllMocks();
      }),
      { numRuns: 50 },
    );
  });

  // Feature: tms-inline-interactions, Property 16
  it('for any active system and action, dispatch calls handler.reduce then applySystemStateDelta', () => {
    fc.assert(
      fc.property(activeSystemArb, actionTypeArb, (system, actionType) => {
        mockActiveSystem = system;
        mockSystemState = { someField: 'value' };
        const delta = { result: actionType };
        mockReduce.mockReturnValue(delta);

        const { result } = renderHook(() => useTMSDispatch());
        const action = { type: actionType };
        act(() => result.current(action));

        expect(mockReduce).toHaveBeenCalledWith(mockSystemState, action);
        expect(mockApplySystemStateDelta).toHaveBeenCalledWith(system, delta);
        vi.clearAllMocks();
      }),
      { numRuns: 50 },
    );
  });
});
