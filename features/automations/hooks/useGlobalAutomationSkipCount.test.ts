import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { AutomationRule } from '../types';

const { mockRules, mockRepo } = vi.hoisted(() => {
  const mockRules: AutomationRule[] = [];
  let subscribeCallback: ((rules: AutomationRule[]) => void) | null = null;

  const mockRepo = {
    findGlobal: vi.fn(() => mockRules.filter((r) => r.projectId === null)),
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

const mockCount = vi.hoisted(() => vi.fn(() => 0));
vi.mock('../services/rules/skipSelectors', () => ({
  countGlobalRulesWithActiveSkips: (...args: any[]) => mockCount(...args),
}));

import { useGlobalAutomationSkipCount } from './useGlobalAutomationSkipCount';

describe('useGlobalAutomationSkipCount', () => {
  beforeEach(() => {
    mockRules.length = 0;
    vi.clearAllMocks();
    mockCount.mockReturnValue(0);
  });

  it('returns 0 when no skips exist', () => {
    const { result } = renderHook(() => useGlobalAutomationSkipCount());
    expect(result.current).toBe(0);
  });

  it('returns correct count from countGlobalRulesWithActiveSkips selector', () => {
    mockCount.mockReturnValue(3);
    const { result } = renderHook(() => useGlobalAutomationSkipCount());
    expect(result.current).toBe(3);
  });
});
