import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AutomationRule } from '../types';
import type { Task, Section } from '@/lib/schemas';

// ── Hoisted mocks (must be before imports that use them) ─────────────────────
const { mockDryRun, mockEstimate } = vi.hoisted(() => {
  return {
    mockDryRun: vi.fn(),
    mockEstimate: vi.fn(),
  };
});

vi.mock('../services/preview/rulePreviewService', () => ({
  runGlobalDryRun: mockDryRun,
  estimateDryRunTaskCount: mockEstimate,
}));

// Import after mocks
import { useGlobalDryRun } from './useGlobalDryRun';

function makeProject(id: string, name: string) {
  return { id, name };
}

function makeTask(id: string, projectId: string | null, sectionId: string | null, description: string): Task {
  return {
    id,
    projectId,
    parentTaskId: null,
    sectionId,
    description,
    notes: '',
    assignee: '',
    priority: 'none' as const,
    tags: [],
    dueDate: null,
    completed: false,
    completedAt: null,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeSection(id: string, projectId: string | null, name: string): Section {
  return {
    id,
    projectId,
    name,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeRule(overrides?: Partial<AutomationRule>): AutomationRule {
  return {
    id: 'rule-1',
    projectId: null,
    name: 'Global Rule',
    trigger: { type: 'card_marked_complete', sectionId: null },
    filters: [],
    action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    enabled: true,
    brokenReason: null,
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    excludedProjectIds: [],
    scope: 'all' as const,
    selectedProjectIds: [],
    ...overrides,
  } as any;
}

describe('useGlobalDryRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const rule = makeRule();
  const projects = [makeProject('proj-a', 'Project A'), makeProject('proj-b', 'Project B')];
  const allTasks = [makeTask('task-1', 'proj-a', null, 'Task 1'), makeTask('task-2', 'proj-b', null, 'Task 2')];
  const allSections = [makeSection('section-1', 'proj-a', 'Done')];

  it('initial state: summary null, isRunning false, isStale false', () => {
    const { result } = renderHook(() => useGlobalDryRun(rule, projects, allTasks, allSections));

    expect(result.current.summary).toBeNull();
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isStale).toBe(false);
  });

  it('run() sets isRunning true then false after completion', () => {
    const { result } = renderHook(() => useGlobalDryRun(rule, projects, allTasks, allSections));

    mockDryRun.mockReturnValue({
      projectResults: { 'proj-a': [] },
      totalFire: 0,
      totalSkip: 0,
      runAt: new Date().toISOString(),
    });

    act(() => {
      result.current.run();
    });

    expect(result.current.isRunning).toBe(false);
  });

  it('run() populates summary with GlobalDryRunSummary', () => {
    const { result } = renderHook(() => useGlobalDryRun(rule, projects, allTasks, allSections));

    const summary = {
      projectResults: { 'proj-a': [] },
      totalFire: 1,
      totalSkip: 1,
      runAt: '2026-02-19T12:00:00.000Z',
    };

    mockDryRun.mockReturnValue(summary);

    act(() => {
      result.current.run();
    });

    expect(result.current.summary).toEqual(summary);
  });

  it('showCountWarning is true when estimatedTaskCount > 500', () => {
    const { result } = renderHook(() => useGlobalDryRun(rule, projects, allTasks, allSections));

    mockEstimate.mockReturnValue(501);

    act(() => {
      result.current.run();
    });

    expect(result.current.showCountWarning).toBe(true);
  });

  it('showCountWarning is false when estimatedTaskCount <= 500', () => {
    const { result } = renderHook(() => useGlobalDryRun(rule, projects, allTasks, allSections));

    mockEstimate.mockReturnValue(500);

    act(() => {
      result.current.run();
    });

    expect(result.current.showCountWarning).toBe(false);
  });

  it('isStale becomes true after 60 seconds (use fake timers)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    const { result } = renderHook(() => useGlobalDryRun(rule, projects, allTasks, allSections));

    // Mock returns runAt = current fake time (fresh)
    mockDryRun.mockReturnValue({
      projectResults: {},
      totalFire: 0,
      totalSkip: 0,
      runAt: new Date().toISOString(),
    });

    act(() => {
      result.current.run();
    });

    // Just ran — should not be stale
    expect(result.current.isStale).toBe(false);

    // Advance past the 60s threshold; the hook's 1s interval triggers forceUpdate
    act(() => {
      vi.advanceTimersByTime(61000);
    });

    expect(result.current.isStale).toBe(true);

    vi.useRealTimers();
  });

  it('reset() clears summary and isStale', () => {
    const { result } = renderHook(() => useGlobalDryRun(rule, projects, allTasks, allSections));

    const summary = {
      projectResults: {},
      totalFire: 0,
      totalSkip: 0,
      runAt: new Date().toISOString(),
    };

    mockDryRun.mockReturnValue(summary);

    act(() => {
      result.current.run();
    });

    expect(result.current.summary).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.isStale).toBe(false);
  });

  it('re-run after reset produces fresh summary', () => {
    const { result } = renderHook(() => useGlobalDryRun(rule, projects, allTasks, allSections));

    const summary1 = {
      projectResults: {},
      totalFire: 1,
      totalSkip: 0,
      runAt: '2026-02-19T12:00:00.000Z',
    };

    const summary2 = {
      projectResults: {},
      totalFire: 2,
      totalSkip: 1,
      runAt: '2026-02-19T13:00:00.000Z',
    };

    mockDryRun.mockReturnValueOnce(summary1).mockReturnValueOnce(summary2);

    act(() => {
      result.current.run();
    });

    expect(result.current.summary).toEqual(summary1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.summary).toBeNull();

    act(() => {
      result.current.run();
    });

    expect(result.current.summary).toEqual(summary2);
  });
});
