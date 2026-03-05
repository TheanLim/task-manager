import { describe, it, expect } from 'vitest';
import { findDuplicateGlobalRule } from './duplicateDetector';
import type { AutomationRule } from '../../types';

const NOW = '2025-01-01T00:00:00.000Z';

function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule-1',
    projectId: null, // global rule
    name: 'My Rule',
    trigger: { type: 'card_moved_into_section', sectionId: null },
    filters: [],
    action: {
      type: 'mark_card_complete',
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
    executionCount: 5,
    lastExecutedAt: NOW,
    recentExecutions: [
      { timestamp: NOW, triggerDescription: 'test', actionDescription: 'test', taskName: 'task' },
    ],
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('findDuplicateGlobalRule', () => {
  describe('when no global rules exist', () => {
    it('returns null', () => {
      const candidate = makeRule();
      const result = findDuplicateGlobalRule(candidate, []);

      expect(result).toBeNull();
    });
  });

  describe('when trigger types differ', () => {
    it('returns null', () => {
      const candidate = makeRule({
        trigger: { type: 'card_moved_into_section', sectionId: null },
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          trigger: { type: 'card_marked_complete', sectionId: null },
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBeNull();
    });
  });

  describe('when action types differ', () => {
    it('returns null', () => {
      const candidate = makeRule({
        action: { type: 'mark_card_complete', sectionId: null },
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          action: { type: 'move_card_to_top_of_section', sectionId: null },
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBeNull();
    });
  });

  describe('when sectionNames differ (case-sensitive)', () => {
    it('returns null for different names', () => {
      const candidate = makeRule({
        trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'Done' },
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'Review' },
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBeNull();
    });
  });

  describe('when sectionNames match (case-insensitive)', () => {
    it('returns the matching rule', () => {
      const candidate = makeRule({
        trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'Done' },
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'done' },
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBe(existing[0]);
    });
  });

  describe('when filter types differ', () => {
    it('returns null', () => {
      const candidate = makeRule({
        filters: [{ type: 'has_due_date' }],
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          filters: [{ type: 'is_overdue' }],
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBeNull();
    });
  });

  describe('when trigger + action + sectionNames + filters all match', () => {
    it('returns the matching rule', () => {
      const candidate = makeRule({
        trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'Done' },
        filters: [{ type: 'has_due_date' }],
        action: { type: 'mark_card_complete', sectionId: null },
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'done' },
          filters: [{ type: 'has_due_date' }],
          action: { type: 'mark_card_complete', sectionId: null },
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBe(existing[0]);
    });
  });

  describe('ignores disabled rules', () => {
    it('returns null when matching rule is disabled', () => {
      const candidate = makeRule({
        trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'Done' },
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          enabled: false,
          trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'done' },
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBeNull();
    });
  });

  describe('filter comparison is order-insensitive', () => {
    it('returns the matching rule regardless of filter order', () => {
      const candidate = makeRule({
        filters: [
          { type: 'has_due_date' },
          { type: 'is_overdue' },
        ],
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          filters: [
            { type: 'is_overdue' },
            { type: 'has_due_date' },
          ],
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBe(existing[0]);
    });
  });

  describe('returns null when filters differ even if trigger/action match', () => {
    it('returns null when candidate has more filters', () => {
      const candidate = makeRule({
        filters: [
          { type: 'has_due_date' },
          { type: 'is_overdue' },
        ],
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          filters: [{ type: 'has_due_date' }],
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBeNull();
    });

    it('returns null when candidate has fewer filters', () => {
      const candidate = makeRule({
        filters: [{ type: 'has_due_date' }],
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          filters: [
            { type: 'has_due_date' },
            { type: 'is_overdue' },
          ],
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBeNull();
    });

    it('returns null when filter types differ', () => {
      const candidate = makeRule({
        filters: [{ type: 'has_due_date' }],
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          filters: [{ type: 'no_due_date' }],
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBeNull();
    });
  });

  describe('sectionName comparison is case-insensitive', () => {
    it('matches "Done" with "done"', () => {
      const candidate = makeRule({
        trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'Done' },
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'done' },
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBe(existing[0]);
    });

    it('matches "To Do" with "TO DO"', () => {
      const candidate = makeRule({
        trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'To Do' },
      });
      const existing = [
        makeRule({
          id: 'rule-2',
          trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'TO DO' },
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBe(existing[0]);
    });
  });

  describe('multiple existing rules', () => {
    it('returns the first matching rule', () => {
      const candidate = makeRule({
        trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'Done' },
      });
      const existing = [
        makeRule({
          id: 'rule-1',
          trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'todo' },
        }),
        makeRule({
          id: 'rule-2',
          trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'done' },
        }),
        makeRule({
          id: 'rule-3',
          trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'review' },
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBe(existing[1]);
    });

    it('returns null when no rules match', () => {
      const candidate = makeRule({
        trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'Done' },
      });
      const existing = [
        makeRule({
          id: 'rule-1',
          trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'todo' },
        }),
        makeRule({
          id: 'rule-2',
          trigger: { type: 'card_moved_into_section', sectionId: null, sectionName: 'review' },
        }),
      ];

      const result = findDuplicateGlobalRule(candidate, existing);

      expect(result).toBeNull();
    });
  });
});
