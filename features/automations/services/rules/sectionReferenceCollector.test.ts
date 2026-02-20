import { describe, it, expect } from 'vitest';
import { collectSectionReferences } from './sectionReferenceCollector';
import type { AutomationRule } from '../../types';

function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule-1',
    projectId: 'proj-1',
    name: 'Test Rule',
    trigger: { type: 'card_moved_into_section', sectionId: null },
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
    ...overrides,
  };
}

describe('collectSectionReferences', () => {
  it('returns empty array when no section references exist', () => {
    const rule = makeRule();
    expect(collectSectionReferences(rule)).toEqual([]);
  });

  it('collects trigger sectionId', () => {
    const rule = makeRule({ trigger: { type: 'card_moved_into_section', sectionId: 'sec-1' } });
    expect(collectSectionReferences(rule)).toContain('sec-1');
  });

  it('collects action sectionId', () => {
    const rule = makeRule({
      action: { type: 'move_card_to_top_of_section', sectionId: 'sec-2', dateOption: null, position: 'top', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    });
    expect(collectSectionReferences(rule)).toContain('sec-2');
  });

  it('collects in_section filter sectionId', () => {
    const rule = makeRule({
      filters: [{ type: 'in_section', sectionId: 'sec-3' }],
    });
    expect(collectSectionReferences(rule)).toContain('sec-3');
  });

  it('collects not_in_section filter sectionId', () => {
    const rule = makeRule({
      filters: [{ type: 'not_in_section', sectionId: 'sec-4' }],
    });
    expect(collectSectionReferences(rule)).toContain('sec-4');
  });

  it('ignores non-section filters', () => {
    const rule = makeRule({
      filters: [{ type: 'has_due_date' }, { type: 'is_overdue' }],
    });
    expect(collectSectionReferences(rule)).toEqual([]);
  });

  it('collects all section references from trigger, action, and filters', () => {
    const rule = makeRule({
      trigger: { type: 'card_moved_into_section', sectionId: 'sec-a' },
      action: { type: 'move_card_to_top_of_section', sectionId: 'sec-b', dateOption: null, position: 'top', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
      filters: [
        { type: 'in_section', sectionId: 'sec-c' },
        { type: 'not_in_section', sectionId: 'sec-d' },
        { type: 'has_due_date' },
      ],
    });
    const refs = collectSectionReferences(rule);
    expect(refs).toEqual(['sec-a', 'sec-b', 'sec-c', 'sec-d']);
  });
});
