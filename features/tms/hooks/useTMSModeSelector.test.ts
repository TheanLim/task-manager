/**
 * Tests for useTMSModeSelector hook.
 * Ref: tasks.md T-08
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSetActiveSystem = vi.fn();
const mockApplySystemStateDelta = vi.fn();
const mockSetSystemState = vi.fn();

let mockTMSState = {
  activeSystem: 'none' as string,
  systemStates: {} as Record<string, unknown>,
  systemStateVersions: {} as Record<string, number>,
};

vi.mock('@/features/tms/stores/tmsStore', () => ({
  useTMSStore: () => ({
    state: mockTMSState,
    setActiveSystem: mockSetActiveSystem,
    applySystemStateDelta: mockApplySystemStateDelta,
    setSystemState: mockSetSystemState,
  }),
}));

const mockTasks = [
  { id: 'task-1', completed: false, title: 'Task 1' },
  { id: 'task-2', completed: false, title: 'Task 2' },
  { id: 'task-3', completed: true,  title: 'Task 3' },
];

vi.mock('@/stores/dataStore', () => ({
  useDataStore: (selector: (s: { tasks: typeof mockTasks }) => unknown) =>
    selector({ tasks: mockTasks as any }),
}));

vi.mock('@/features/tms/services/tmsSwitchService', () => ({
  executeTMSSwitch: vi.fn((_from, toId) => ({
    newActiveSystem: toId,
    systemStateUpdates: {},
  })),
}));

vi.mock('@/features/tms/registry', () => ({
  getTMSHandler: vi.fn(),
}));

vi.mock('@/features/tms/services/fvpSnapshotService', () => ({
  buildFvpSnapshot: vi.fn((tasks: Array<{ id: string }>) => tasks.map((t) => t.id)),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useTMSModeSelector } from './useTMSModeSelector';
import { executeTMSSwitch } from '@/features/tms/services/tmsSwitchService';
import { buildFvpSnapshot } from '@/features/tms/services/fvpSnapshotService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeScrollRef(scrollTop = 0): React.RefObject<HTMLElement> {
  return { current: { scrollTop } as unknown as HTMLElement };
}

function renderSelector(scrollRef = makeScrollRef()) {
  return renderHook(() => useTMSModeSelector(scrollRef));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useTMSModeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTMSState = {
      activeSystem: 'none',
      systemStates: {},
      systemStateVersions: {},
    };
  });

  // ── openModeSelector / isPopoverOpen ───────────────────────────────────────

  it('openModeSelector sets isPopoverOpen to true', () => {
    const { result } = renderSelector();
    expect(result.current.isPopoverOpen).toBe(false);

    act(() => result.current.openModeSelector());

    expect(result.current.isPopoverOpen).toBe(true);
  });

  it('closePopover sets isPopoverOpen to false', () => {
    const { result } = renderSelector();
    act(() => result.current.openModeSelector());
    act(() => result.current.closePopover());

    expect(result.current.isPopoverOpen).toBe(false);
  });

  // ── Immediate switch from 'none' ───────────────────────────────────────────

  it('switching from none to af4 calls setActiveSystem immediately (no dialog)', () => {
    const { result } = renderSelector();

    act(() => result.current.selectMode('af4'));

    expect(result.current.isConfirmDialogOpen).toBe(false);
    expect(mockSetActiveSystem).toHaveBeenCalledWith('af4');
  });

  it('switching from none to fvp calls applySystemStateDelta with snapshotTaskIds', () => {
    const { result } = renderSelector();

    act(() => result.current.selectMode('fvp'));

    expect(mockApplySystemStateDelta).toHaveBeenCalledWith('fvp', {
      snapshotTaskIds: ['task-1', 'task-2'], // only non-completed tasks (task-3 is completed)
    });
    expect(mockSetActiveSystem).toHaveBeenCalledWith('fvp');
  });

  it('switching to fvp uses filteredTasks when provided', () => {
    const { result } = renderSelector();
    const filtered = [{ id: 'task-1', completed: false, title: 'Task 1' }] as any;

    act(() => result.current.selectMode('fvp', filtered));

    expect(buildFvpSnapshot).toHaveBeenCalledWith(filtered);
    expect(mockApplySystemStateDelta).toHaveBeenCalledWith('fvp', {
      snapshotTaskIds: ['task-1'],
    });
  });

  // ── Switching to 'none' is always immediate ────────────────────────────────

  it('switching to none never opens dialog even from in-progress FVP', () => {
    mockTMSState = {
      activeSystem: 'fvp',
      systemStates: { fvp: { dottedTasks: ['task-1'], scanPosition: 1, snapshotTaskIds: [] } },
      systemStateVersions: {},
    };
    const { result } = renderSelector();

    act(() => result.current.selectMode('none'));

    expect(result.current.isConfirmDialogOpen).toBe(false);
    expect(mockSetActiveSystem).toHaveBeenCalledWith('none');
  });

  // ── FVP confirmation ───────────────────────────────────────────────────────

  it('switching from in-progress FVP (dottedTasks > 0) to af4 opens confirm dialog', () => {
    mockTMSState = {
      activeSystem: 'fvp',
      systemStates: { fvp: { dottedTasks: ['task-1'], scanPosition: 1, snapshotTaskIds: [] } },
      systemStateVersions: {},
    };
    const { result } = renderSelector();

    act(() => result.current.selectMode('af4'));

    expect(result.current.isConfirmDialogOpen).toBe(true);
    expect(result.current.pendingSystemId).toBe('af4');
    expect(mockSetActiveSystem).not.toHaveBeenCalled();
  });

  it('switching from FVP with empty dottedTasks switches immediately', () => {
    mockTMSState = {
      activeSystem: 'fvp',
      systemStates: { fvp: { dottedTasks: [], scanPosition: 1, snapshotTaskIds: [] } },
      systemStateVersions: {},
    };
    const { result } = renderSelector();

    act(() => result.current.selectMode('af4'));

    expect(result.current.isConfirmDialogOpen).toBe(false);
    expect(mockSetActiveSystem).toHaveBeenCalledWith('af4');
  });

  // ── AF4 confirmation ───────────────────────────────────────────────────────

  it('switching from AF4 with non-empty backlogTaskIds to DIT opens dialog', () => {
    mockTMSState = {
      activeSystem: 'af4',
      systemStates: {
        af4: {
          backlogTaskIds: ['task-1'],
          activeListTaskIds: [],
          currentPosition: 0,
          lastPassHadWork: false,
          dismissedTaskIds: [],
          phase: 'backlog',
        },
      },
      systemStateVersions: {},
    };
    const { result } = renderSelector();

    act(() => result.current.selectMode('dit'));

    expect(result.current.isConfirmDialogOpen).toBe(true);
    expect(result.current.pendingSystemId).toBe('dit');
  });

  it('switching from AF4 with empty lists to DIT switches immediately', () => {
    mockTMSState = {
      activeSystem: 'af4',
      systemStates: {
        af4: {
          backlogTaskIds: [],
          activeListTaskIds: [],
          currentPosition: 0,
          lastPassHadWork: false,
          dismissedTaskIds: [],
          phase: 'backlog',
        },
      },
      systemStateVersions: {},
    };
    const { result } = renderSelector();

    act(() => result.current.selectMode('dit'));

    expect(result.current.isConfirmDialogOpen).toBe(false);
    expect(mockSetActiveSystem).toHaveBeenCalledWith('dit');
  });

  // ── Standard — always immediate ────────────────────────────────────────────

  it('switching from Standard to any mode switches immediately (no dialog)', () => {
    mockTMSState = {
      activeSystem: 'standard',
      systemStates: { standard: {} },
      systemStateVersions: {},
    };
    const { result } = renderSelector();

    act(() => result.current.selectMode('af4'));

    expect(result.current.isConfirmDialogOpen).toBe(false);
    expect(mockSetActiveSystem).toHaveBeenCalledWith('af4');
  });

  // ── confirmSwitch / cancelSwitch ───────────────────────────────────────────

  it('confirmSwitch completes the pending switch and closes dialog', () => {
    mockTMSState = {
      activeSystem: 'fvp',
      systemStates: { fvp: { dottedTasks: ['task-1'], scanPosition: 1, snapshotTaskIds: [] } },
      systemStateVersions: {},
    };
    const { result } = renderSelector();

    act(() => result.current.selectMode('af4'));
    expect(result.current.isConfirmDialogOpen).toBe(true);

    act(() => result.current.confirmSwitch());

    expect(result.current.isConfirmDialogOpen).toBe(false);
    expect(result.current.pendingSystemId).toBeNull();
    expect(mockSetActiveSystem).toHaveBeenCalledWith('af4');
  });

  it('cancelSwitch leaves activeSystem unchanged and closes dialog', () => {
    mockTMSState = {
      activeSystem: 'fvp',
      systemStates: { fvp: { dottedTasks: ['task-1'], scanPosition: 1, snapshotTaskIds: [] } },
      systemStateVersions: {},
    };
    const { result } = renderSelector();

    act(() => result.current.selectMode('af4'));
    act(() => result.current.cancelSwitch());

    expect(result.current.isConfirmDialogOpen).toBe(false);
    expect(result.current.pendingSystemId).toBeNull();
    expect(mockSetActiveSystem).not.toHaveBeenCalled();
  });

  // ── DIT confirmation ───────────────────────────────────────────────────────

  it('switching from DIT with todayTasks > 0 opens dialog', () => {
    mockTMSState = {
      activeSystem: 'dit',
      systemStates: {
        dit: { todayTasks: ['task-1'], tomorrowTasks: [], lastDayChange: new Date().toISOString() },
      },
      systemStateVersions: {},
    };
    const { result } = renderSelector();

    act(() => result.current.selectMode('af4'));

    expect(result.current.isConfirmDialogOpen).toBe(true);
  });

  it('switching from DIT with empty lists switches immediately', () => {
    mockTMSState = {
      activeSystem: 'dit',
      systemStates: {
        dit: { todayTasks: [], tomorrowTasks: [], lastDayChange: new Date().toISOString() },
      },
      systemStateVersions: {},
    };
    const { result } = renderSelector();

    act(() => result.current.selectMode('af4'));

    expect(result.current.isConfirmDialogOpen).toBe(false);
    expect(mockSetActiveSystem).toHaveBeenCalledWith('af4');
  });

  // ── executeTMSSwitch integration ───────────────────────────────────────────

  it('selectMode calls executeTMSSwitch with correct arguments', () => {
    const { result } = renderSelector();

    act(() => result.current.selectMode('af4'));

    expect(executeTMSSwitch).toHaveBeenCalledWith(
      'none',
      'af4',
      mockTasks,
      {},
      expect.any(Function),
    );
  });

  // ── Scroll position ────────────────────────────────────────────────────────

  it('saves scroll position on mode activation and restores on switch to none', () => {
    // Start with activeSystem = 'none' and scrollTop = 200
    const scrollRef = makeScrollRef(200);
    mockTMSState = { activeSystem: 'none', systemStates: {}, systemStateVersions: {} };
    const { result, rerender } = renderHook(() => useTMSModeSelector(scrollRef));

    // Activate af4 — hook saves scrollTop=200 into its internal ref
    act(() => result.current.selectMode('af4'));

    // Simulate user scrolling while in af4 mode
    scrollRef.current!.scrollTop = 500;

    // Update the mock state so the hook sees activeSystem='af4' on next render
    mockTMSState = { activeSystem: 'af4', systemStates: {}, systemStateVersions: {} };
    rerender();

    // Switch back to none — hook should restore scrollTop to 200
    act(() => result.current.selectMode('none'));

    expect(scrollRef.current!.scrollTop).toBe(200);
  });

  // ── activeSystem exposed ───────────────────────────────────────────────────

  it('exposes activeSystem from the store', () => {
    mockTMSState = { activeSystem: 'fvp', systemStates: {}, systemStateVersions: {} };
    const { result } = renderSelector();
    expect(result.current.activeSystem).toBe('fvp');
  });
});
