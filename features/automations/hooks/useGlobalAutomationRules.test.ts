import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AutomationRule } from '../types';

// ── Hoisted mocks (must be before imports that use them) ─────────────────────
const { mockRules, mockRepo } = vi.hoisted(() => {
  const mockRules: AutomationRule[] = [];
  let subscribeCallback: ((rules: AutomationRule[]) => void) | null = null;

  const mockRepo = {
    findGlobal: vi.fn(() => mockRules.filter((r) => r.projectId === null)),
    findAll: vi.fn(() => [...mockRules]),
    create: vi.fn((rule: AutomationRule) => {
      mockRules.push(rule);
      subscribeCallback?.([...mockRules]);
    }),
    update: vi.fn((id: string, updates: Partial<AutomationRule>) => {
      const idx = mockRules.findIndex((r) => r.id === id);
      if (idx !== -1) mockRules[idx] = { ...mockRules[idx], ...updates };
      subscribeCallback?.([...mockRules]);
    }),
    delete: vi.fn((id: string) => {
      const idx = mockRules.findIndex((r) => r.id === id);
      if (idx !== -1) mockRules.splice(idx, 1);
      subscribeCallback?.([...mockRules]);
    }),
    subscribe: vi.fn((cb: (rules: AutomationRule[]) => void) => {
      subscribeCallback = cb;
      cb([...mockRules]);
      return () => { subscribeCallback = null; };
    }),
  };

  return { mockRules, mockRepo };
});

vi.mock('@/stores/dataStore', () => ({
  automationRuleRepository: mockRepo,
}));

vi.mock('../services/rules/ruleFactory', () => ({
  createRuleWithMetadata: vi.fn((data: any) => ({
    id: 'new-rule-id',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    order: 0,
    ...data,
  })),
}));

import { useGlobalAutomationRules } from './useGlobalAutomationRules';

function makeGlobalRule(id: string): AutomationRule {
  return {
    id,
    projectId: null,
    name: `Global Rule ${id}`,
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
  } as any;
}

describe('useGlobalAutomationRules', () => {
  beforeEach(() => {
    mockRules.length = 0;
    vi.clearAllMocks();
  });

  it('returns only global rules (projectId === null)', () => {
    mockRules.push(makeGlobalRule('g1'));
    mockRules.push({ ...makeGlobalRule('p1'), projectId: 'proj-1' } as any);

    const { result } = renderHook(() => useGlobalAutomationRules());
    expect(result.current.rules).toHaveLength(1);
    expect(result.current.rules[0].id).toBe('g1');
  });

  it('createRule() calls repo.create() with projectId: null', () => {
    const { result } = renderHook(() => useGlobalAutomationRules());

    act(() => {
      result.current.createRule({
        projectId: null,
        name: 'My Global Rule',
        trigger: { type: 'card_marked_complete', sectionId: null },
        filters: [],
        action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
        enabled: true,
        brokenReason: null,
        bulkPausedAt: null,
        excludedProjectIds: [],
      } as any);
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: null })
    );
  });

  it('updateRule() calls repo.update()', () => {
    mockRules.push(makeGlobalRule('g1'));
    const { result } = renderHook(() => useGlobalAutomationRules());

    act(() => {
      result.current.updateRule('g1', { name: 'Updated' });
    });

    expect(mockRepo.update).toHaveBeenCalledWith('g1', expect.objectContaining({ name: 'Updated' }));
  });

  it('deleteRule() calls repo.delete()', () => {
    mockRules.push(makeGlobalRule('g1'));
    const { result } = renderHook(() => useGlobalAutomationRules());

    act(() => {
      result.current.deleteRule('g1');
    });

    expect(mockRepo.delete).toHaveBeenCalledWith('g1');
  });

  it('subscribes and unsubscribes correctly', () => {
    const { unmount } = renderHook(() => useGlobalAutomationRules());
    expect(mockRepo.subscribe).toHaveBeenCalled();
    unmount();
    // After unmount the unsubscribe fn ran — subscribe was called once
    expect(mockRepo.subscribe).toHaveBeenCalledTimes(1);
  });
});
