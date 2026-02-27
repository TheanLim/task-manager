/**
 * Property-based tests for useFVPSessionState — selectionInProgress and currentX derivation.
 * Feature: tms-inline-interactions, Property 18
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { Task } from '@/types';
import { getScanCandidate, getCurrentX } from '@/features/tms/handlers/fvp';

// ── Mocks ─────────────────────────────────────────────────────────────────────

let mockActiveSystem = 'fvp';
let mockFvpState: { dottedTasks: string[]; scanPosition: number; snapshotTaskIds: string[] } | undefined;

vi.mock('@/features/tms/stores/tmsStore', () => ({
  useTMSStore: (selector: (s: any) => unknown) =>
    selector({
      state: {
        activeSystem: mockActiveSystem,
        systemStates: { fvp: mockFvpState },
      },
    }),
}));

import { useFVPSessionState } from './useFVPSessionState';

// ── Arbitraries ───────────────────────────────────────────────────────────────

const taskIdArb = fc.string({ minLength: 1, maxLength: 10 });

function makeTask(id: string): Task {
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

// Arbitrary for a valid FVP state
const fvpStateArb = fc.array(taskIdArb, { minLength: 1, maxLength: 8 }).chain((ids) => {
  const uniqueIds = [...new Set(ids)];
  return fc.record({
    dottedTasks: fc.subarray(uniqueIds),
    scanPosition: fc.integer({ min: 1, max: uniqueIds.length + 1 }),
    snapshotTaskIds: fc.constant(uniqueIds),
  });
});

describe('useFVPSessionState — property-based tests', () => {
  beforeEach(() => {
    mockActiveSystem = 'fvp';
  });

  // Feature: tms-inline-interactions, Property 18
  it('selectionInProgress matches getScanCandidate !== null for any FVP state', () => {
    fc.assert(
      fc.property(fvpStateArb, (fvpState) => {
        mockFvpState = fvpState;
        const visibleTasks = fvpState.snapshotTaskIds.map(makeTask);

        const { result } = renderHook(() => useFVPSessionState(visibleTasks));

        const expectedCandidate = getScanCandidate(visibleTasks, fvpState);
        const expectedSelectionInProgress = expectedCandidate !== null;

        expect(result.current.selectionInProgress).toBe(expectedSelectionInProgress);
      }),
      { numRuns: 100 },
    );
  });

  it('currentX matches getCurrentX for any FVP state', () => {
    fc.assert(
      fc.property(fvpStateArb, (fvpState) => {
        mockFvpState = fvpState;
        const visibleTasks = fvpState.snapshotTaskIds.map(makeTask);

        const { result } = renderHook(() => useFVPSessionState(visibleTasks));

        const expectedCurrentX = getCurrentX(visibleTasks, fvpState);

        if (expectedCurrentX === null) {
          expect(result.current.currentX).toBeNull();
        } else {
          expect(result.current.currentX?.id).toBe(expectedCurrentX.id);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('selectionInProgress is always false when activeSystem is not fvp', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('none', 'standard', 'af4', 'dit'),
        fvpStateArb,
        (system, fvpState) => {
          mockActiveSystem = system;
          mockFvpState = fvpState;
          const visibleTasks = fvpState.snapshotTaskIds.map(makeTask);

          const { result } = renderHook(() => useFVPSessionState(visibleTasks));

          expect(result.current.selectionInProgress).toBe(false);
          expect(result.current.currentX).toBeNull();
        },
      ),
      { numRuns: 50 },
    );
  });
});
