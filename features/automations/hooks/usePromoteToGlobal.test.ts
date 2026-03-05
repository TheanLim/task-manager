import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AutomationRule } from '../types';

// ── Hoisted mocks (must be before imports that use them) ─────────────────────
const { mockGlobalRules, mockAllSections, mockCreateRule, mockDeleteOriginal, mockRepo } = vi.hoisted(() => {
  const mockGlobalRules: AutomationRule[] = [];
  const mockAllSections = [
    { id: 'section-1', name: 'To Do', projectId: null },
    { id: 'section-2', name: 'In Progress', projectId: null },
    { id: 'section-3', name: 'Done', projectId: null },
  ];
  const mockCreateRule = vi.fn();
  const mockDeleteOriginal = vi.fn();

  const mockRepo = {
    findGlobal: vi.fn(() => mockGlobalRules.filter((r) => r.projectId === null)),
    findAll: vi.fn(() => [...mockGlobalRules]),
    create: vi.fn((rule: AutomationRule) => {
      mockGlobalRules.push(rule);
    }),
    update: vi.fn((id: string, updates: Partial<AutomationRule>) => {
      const idx = mockGlobalRules.findIndex((r) => r.id === id);
      if (idx !== -1) mockGlobalRules[idx] = { ...mockGlobalRules[idx], ...updates };
    }),
    delete: vi.fn((id: string) => {
      const idx = mockGlobalRules.findIndex((r) => r.id === id);
      if (idx !== -1) mockGlobalRules.splice(idx, 1);
    }),
    subscribe: vi.fn((cb: (rules: AutomationRule[]) => void) => {
      cb([...mockGlobalRules]);
      return () => {};
    }),
  };

  return { mockGlobalRules, mockAllSections, mockCreateRule, mockDeleteOriginal, mockRepo };
});

vi.mock('@/stores/dataStore', () => ({
  automationRuleRepository: mockRepo,
}));

vi.mock('../services/rules/duplicateDetector', () => ({
  findDuplicateGlobalRule: vi.fn((candidate: any, existingRules: any[]) => {
    // Simple duplicate detection: same trigger type, action type, and sectionName
    const activeRules = existingRules.filter((rule) => rule.enabled);
    for (const rule of activeRules) {
      const candidateSectionName = 'sectionName' in candidate.trigger ? (candidate.trigger.sectionName ?? '') : '';
      const ruleSectionName = 'sectionName' in rule.trigger ? (rule.trigger.sectionName ?? '') : '';
      if (
        rule.trigger.type === candidate.trigger.type &&
        rule.action.type === candidate.action.type &&
        ruleSectionName.toLowerCase() === candidateSectionName.toLowerCase()
      ) {
        return rule;
      }
    }
    return null;
  }),
}));

vi.mock('../services/rules/ruleFactory', () => ({
  createFromProjectRule: vi.fn((sourceRule: any, options: any, existingRules: any[], allSections: any[]) => {
    const now = new Date().toISOString();
    const maxOrder = existingRules.reduce((max, rule) => Math.max(max, rule.order), -1);

    // Transform sectionId to sectionName when applicable
    const findSection = (sectionId: string | null) => allSections.find((s) => s.id === sectionId) || null;

    const transformSection = (sectionId: string | null) => {
      if (options.sectionResolution === 'by_name') {
        const section = findSection(sectionId);
        if (section) {
          return { sectionId: null, sectionName: section.name };
        }
        return { sectionId: null };
      }
      return { sectionId: null };
    };

    const triggerSection = transformSection(sourceRule.trigger.sectionId);
    const actionSection = transformSection(sourceRule.action.sectionId);

    let scope: AutomationRule['scope'] = 'all';
    let selectedProjectIds: string[] = [];

    if (options.sectionResolution === 'source_project_only') {
      scope = 'selected';
      selectedProjectIds = sourceRule.projectId ? [sourceRule.projectId] : [];
    } else {
      scope = sourceRule.scope || 'all';
      selectedProjectIds = sourceRule.selectedProjectIds || [];
    }

    return {
      id: 'new-global-rule-id',
      projectId: null,
      name: `${sourceRule.name} (Global)`,
      trigger: {
        ...sourceRule.trigger,
        sectionId: triggerSection.sectionId,
        ...(triggerSection.sectionName && { sectionName: triggerSection.sectionName }),
      },
      action: {
        ...sourceRule.action,
        sectionId: actionSection.sectionId,
        ...(actionSection.sectionName && { sectionName: actionSection.sectionName }),
      },
      filters: sourceRule.filters,
      enabled: sourceRule.enabled,
      brokenReason: sourceRule.brokenReason,
      bulkPausedAt: sourceRule.bulkPausedAt,
      excludedProjectIds: sourceRule.excludedProjectIds,
      scope,
      selectedProjectIds,
      createdAt: now,
      updatedAt: now,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: maxOrder + 1,
    };
  }),
}));

import { usePromoteToGlobal } from './usePromoteToGlobal';

function makeProjectRule(id: string, sectionId: string | null = null): AutomationRule {
  return {
    id,
    projectId: 'proj-1',
    name: `Project Rule ${id}`,
    trigger: { type: 'card_moved', sectionId },
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
    scope: 'all',
  } as any;
}

describe('usePromoteToGlobal', () => {
  beforeEach(() => {
    mockGlobalRules.length = 0;
    mockCreateRule.mockClear();
    mockDeleteOriginal.mockClear();
    vi.clearAllMocks();
  });

  describe('checkDuplicate', () => {
    it('returns null when no matching global rule exists', () => {
      const { result } = renderHook(() => usePromoteToGlobal(mockGlobalRules, mockAllSections, mockCreateRule, mockDeleteOriginal));

      const sourceRule = makeProjectRule('rule-1', 'section-1');
      let duplicate: AutomationRule | null = null;
      act(() => {
        duplicate = result.current.checkDuplicate(sourceRule);
      });

      expect(duplicate).toBeNull();
    });

    it('returns the matching rule when duplicate found', () => {
      const existingRule: AutomationRule = {
        ...makeProjectRule('existing', 'section-1'),
        projectId: null,
        name: 'Project Rule rule-1 (Global)',
        trigger: { ...makeProjectRule('existing', 'section-1').trigger, sectionName: 'To Do' },
      } as any;
      mockGlobalRules.push(existingRule);

      const { result } = renderHook(() => usePromoteToGlobal(mockGlobalRules, mockAllSections, mockCreateRule, mockDeleteOriginal));

      // Source rule with sectionId that will be converted to sectionName for comparison
      const sourceRule = makeProjectRule('rule-1', 'section-1');
      (sourceRule.trigger as any).sectionName = 'To Do';
      let duplicate: AutomationRule | null = null;
      act(() => {
        duplicate = result.current.checkDuplicate(sourceRule);
      });

      expect(duplicate).toBe(existingRule);
    });
  });

  describe('hasSectionRefs', () => {
    it('returns true when trigger has sectionId', () => {
      const { result } = renderHook(() => usePromoteToGlobal(mockGlobalRules, mockAllSections, mockCreateRule, mockDeleteOriginal));

      const sourceRule = makeProjectRule('rule-1', 'section-1');
      let hasRefs: boolean = false;
      act(() => {
        hasRefs = result.current.hasSectionRefs(sourceRule);
      });

      expect(hasRefs).toBe(true);
    });

    it('returns true when action has sectionId', () => {
      const { result } = renderHook(() => usePromoteToGlobal(mockGlobalRules, mockAllSections, mockCreateRule, mockDeleteOriginal));

      const sourceRule = makeProjectRule('rule-1', null);
      sourceRule.action.sectionId = 'section-1';
      let hasRefs: boolean = false;
      act(() => {
        hasRefs = result.current.hasSectionRefs(sourceRule);
      });

      expect(hasRefs).toBe(true);
    });

    it('returns false when neither trigger nor action has sectionId', () => {
      const { result } = renderHook(() => usePromoteToGlobal(mockGlobalRules, mockAllSections, mockCreateRule, mockDeleteOriginal));

      const sourceRule = makeProjectRule('rule-1', null);
      sourceRule.action.sectionId = null;
      let hasRefs: boolean = false;
      act(() => {
        hasRefs = result.current.hasSectionRefs(sourceRule);
      });

      expect(hasRefs).toBe(false);
    });
  });

  describe('promote', () => {
    it('calls createRule with correct global rule shape', () => {
      const { result } = renderHook(() => usePromoteToGlobal(mockGlobalRules, mockAllSections, mockCreateRule, mockDeleteOriginal));

      const sourceRule = makeProjectRule('rule-1', 'section-1');

      act(() => {
        result.current.promote(sourceRule, { sectionResolution: 'by_name' });
      });

      expect(mockCreateRule).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: null,
          name: expect.stringContaining('(Global)'),
          trigger: expect.objectContaining({ sectionId: null, sectionName: 'To Do' }),
          action: expect.objectContaining({ sectionId: null }),
        })
      );
    });

    it('with deleteOriginal: true calls onDeleteOriginal with source rule id', () => {
      const { result } = renderHook(() => usePromoteToGlobal(mockGlobalRules, mockAllSections, mockCreateRule, mockDeleteOriginal));

      const sourceRule = makeProjectRule('rule-1', 'section-1');

      act(() => {
        result.current.promote(sourceRule, { sectionResolution: 'by_name', deleteOriginal: true });
      });

      expect(mockDeleteOriginal).toHaveBeenCalledWith('rule-1');
    });

    it('with deleteOriginal: false does not call onDeleteOriginal', () => {
      const { result } = renderHook(() => usePromoteToGlobal(mockGlobalRules, mockAllSections, mockCreateRule, mockDeleteOriginal));

      const sourceRule = makeProjectRule('rule-1', 'section-1');

      act(() => {
        result.current.promote(sourceRule, { sectionResolution: 'by_name', deleteOriginal: false });
      });

      expect(mockDeleteOriginal).not.toHaveBeenCalled();
    });
  });
});
