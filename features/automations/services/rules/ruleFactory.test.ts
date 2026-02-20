import { describe, it, expect, vi } from 'vitest';
import { createRuleWithMetadata, type CreateRuleInput } from './ruleFactory';
import type { AutomationRule } from '../../types';

vi.mock('uuid', () => ({ v4: () => 'mock-uuid-1234' }));

function makeInput(overrides: Partial<CreateRuleInput> = {}): CreateRuleInput {
  return {
    projectId: 'proj-1',
    name: 'Test Rule',
    trigger: { type: 'card_marked_complete', sectionId: null } as any,
    filters: [],
    action: {
      type: 'mark_card_incomplete',
      sectionId: null,
      dateOption: null,
      position: null,
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    },
    enabled: true,
    brokenReason: null,
    bulkPausedAt: null,
    ...overrides,
  };
}

function makeRule(order: number): AutomationRule {
  return {
    ...makeInput(),
    id: `rule-${order}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    order,
  } as AutomationRule;
}

describe('createRuleWithMetadata', () => {
  it('generates id, timestamps, and order from empty list', () => {
    const result = createRuleWithMetadata(makeInput(), []);
    expect(result.id).toBe('mock-uuid-1234');
    expect(result.executionCount).toBe(0);
    expect(result.lastExecutedAt).toBeNull();
    expect(result.recentExecutions).toEqual([]);
    expect(result.order).toBe(0); // maxOrder(-1) + 1
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('computes order as max + 1 from existing rules', () => {
    const existing = [makeRule(0), makeRule(3), makeRule(1)];
    const result = createRuleWithMetadata(makeInput(), existing);
    expect(result.order).toBe(4); // max(0,3,1) + 1
  });

  it('preserves input fields', () => {
    const input = makeInput({ name: 'Custom Name', enabled: false });
    const result = createRuleWithMetadata(input, []);
    expect(result.name).toBe('Custom Name');
    expect(result.enabled).toBe(false);
    expect(result.projectId).toBe('proj-1');
  });
});
