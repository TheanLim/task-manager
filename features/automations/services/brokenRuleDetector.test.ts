import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { detectBrokenRules } from './brokenRuleDetector';
import type { AutomationRule } from '../types';
import type { AutomationRuleRepository } from '../repositories/types';

function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule-1',
    projectId: 'proj-1',
    name: 'Test Rule',
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
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    order: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createMockRepo(rules: AutomationRule[]): AutomationRuleRepository {
  const store = new Map<string, AutomationRule>();
  for (const r of rules) store.set(r.id, { ...r });

  return {
    findByProjectId: (projectId: string) =>
      [...store.values()].filter((r) => r.projectId === projectId),
    update: (id: string, updates: Partial<AutomationRule>) => {
      const existing = store.get(id);
      if (existing) store.set(id, { ...existing, ...updates });
    },
    findById: (id: string) => store.get(id),
    findAll: () => [...store.values()],
    create: (item: AutomationRule) => store.set(item.id, item),
    delete: (id: string) => store.delete(id),
    replaceAll: (items: AutomationRule[]) => {
      store.clear();
      for (const item of items) store.set(item.id, item);
    },
    subscribe: () => () => {},
  } as AutomationRuleRepository;
}

describe('detectBrokenRules', () => {
  const deletedSectionId = 'section-deleted';
  const projectId = 'proj-1';

  it('disables a rule whose trigger references the deleted section', () => {
    const rule = makeRule({
      trigger: { type: 'card_moved_into_section', sectionId: deletedSectionId },
    });
    const repo = createMockRepo([rule]);

    detectBrokenRules(deletedSectionId, projectId, repo);

    const updated = repo.findById('rule-1')!;
    expect(updated.enabled).toBe(false);
    expect(updated.brokenReason).toBe('section_deleted');
  });

  it('disables a rule whose action references the deleted section', () => {
    const rule = makeRule({
      action: {
        type: 'move_card_to_top_of_section',
        sectionId: deletedSectionId,
        dateOption: null,
        position: 'top',
        cardTitle: null,
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
    });
    const repo = createMockRepo([rule]);

    detectBrokenRules(deletedSectionId, projectId, repo);

    const updated = repo.findById('rule-1')!;
    expect(updated.enabled).toBe(false);
    expect(updated.brokenReason).toBe('section_deleted');
  });

  it('disables a rule whose filter references the deleted section', () => {
    const rule = makeRule({
      filters: [{ type: 'in_section', sectionId: deletedSectionId }],
    });
    const repo = createMockRepo([rule]);

    detectBrokenRules(deletedSectionId, projectId, repo);

    const updated = repo.findById('rule-1')!;
    expect(updated.enabled).toBe(false);
    expect(updated.brokenReason).toBe('section_deleted');
  });

  it('disables a rule with not_in_section filter referencing the deleted section', () => {
    const rule = makeRule({
      filters: [{ type: 'not_in_section', sectionId: deletedSectionId }],
    });
    const repo = createMockRepo([rule]);

    detectBrokenRules(deletedSectionId, projectId, repo);

    const updated = repo.findById('rule-1')!;
    expect(updated.enabled).toBe(false);
    expect(updated.brokenReason).toBe('section_deleted');
  });

  it('leaves rules that do not reference the deleted section unchanged', () => {
    const rule = makeRule({
      trigger: { type: 'card_moved_into_section', sectionId: 'other-section' },
    });
    const repo = createMockRepo([rule]);

    detectBrokenRules(deletedSectionId, projectId, repo);

    const unchanged = repo.findById('rule-1')!;
    expect(unchanged.enabled).toBe(true);
    expect(unchanged.brokenReason).toBeNull();
  });

  it('handles multiple rules — only disables matching ones', () => {
    const matching = makeRule({
      id: 'rule-match',
      trigger: { type: 'card_moved_into_section', sectionId: deletedSectionId },
    });
    const nonMatching = makeRule({
      id: 'rule-safe',
      trigger: { type: 'card_marked_complete', sectionId: null },
    });
    const repo = createMockRepo([matching, nonMatching]);

    detectBrokenRules(deletedSectionId, projectId, repo);

    expect(repo.findById('rule-match')!.enabled).toBe(false);
    expect(repo.findById('rule-match')!.brokenReason).toBe('section_deleted');
    expect(repo.findById('rule-safe')!.enabled).toBe(true);
    expect(repo.findById('rule-safe')!.brokenReason).toBeNull();
  });

  it('handles a rule with the deleted section in multiple places', () => {
    const rule = makeRule({
      trigger: { type: 'card_moved_into_section', sectionId: deletedSectionId },
      action: {
        type: 'move_card_to_bottom_of_section',
        sectionId: deletedSectionId,
        dateOption: null,
        position: 'bottom',
        cardTitle: null,
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
      filters: [{ type: 'in_section', sectionId: deletedSectionId }],
    });
    const repo = createMockRepo([rule]);

    detectBrokenRules(deletedSectionId, projectId, repo);

    const updated = repo.findById('rule-1')!;
    expect(updated.enabled).toBe(false);
    expect(updated.brokenReason).toBe('section_deleted');
  });

  it('does not affect rules from other projects', () => {
    const otherProjectRule = makeRule({
      id: 'rule-other',
      projectId: 'other-project',
      trigger: { type: 'card_moved_into_section', sectionId: deletedSectionId },
    });
    const repo = createMockRepo([otherProjectRule]);

    detectBrokenRules(deletedSectionId, projectId, repo);

    const unchanged = repo.findById('rule-other')!;
    expect(unchanged.enabled).toBe(true);
    expect(unchanged.brokenReason).toBeNull();
  });

  it('handles empty rule set without errors', () => {
    const repo = createMockRepo([]);

    expect(() =>
      detectBrokenRules(deletedSectionId, projectId, repo)
    ).not.toThrow();
  });

  it('handles filters that do not carry sectionId (e.g., has_due_date)', () => {
    const rule = makeRule({
      filters: [{ type: 'has_due_date' }],
    });
    const repo = createMockRepo([rule]);

    detectBrokenRules(deletedSectionId, projectId, repo);

    const unchanged = repo.findById('rule-1')!;
    expect(unchanged.enabled).toBe(true);
    expect(unchanged.brokenReason).toBeNull();
  });
});


// --- Arbitraries for property-based tests ---

const sectionIdArb = fc.stringMatching(/^[a-z0-9-]{1,20}$/);

const triggerArb = (sectionIds: string[]) =>
  fc.record({
    type: fc.constantFrom(
      'card_moved_into_section' as const,
      'card_moved_out_of_section' as const,
      'card_marked_complete' as const,
      'card_marked_incomplete' as const,
      'card_created_in_section' as const,
      'section_created' as const,
      'section_renamed' as const,
    ),
    sectionId: fc.oneof(
      fc.constant(null),
      fc.constantFrom(...sectionIds),
    ),
  });

const actionArb = (sectionIds: string[]) =>
  fc.record({
    type: fc.constantFrom(
      'move_card_to_top_of_section' as const,
      'move_card_to_bottom_of_section' as const,
      'mark_card_complete' as const,
      'mark_card_incomplete' as const,
      'set_due_date' as const,
      'remove_due_date' as const,
      'create_card' as const,
    ),
    sectionId: fc.oneof(
      fc.constant(null),
      fc.constantFrom(...sectionIds),
    ),
    dateOption: fc.constant(null),
    position: fc.constant(null),
    cardTitle: fc.constant(null),
    cardDateOption: fc.constant(null),
    specificMonth: fc.constant(null),
    specificDay: fc.constant(null),
    monthTarget: fc.constant(null),
  });

const sectionFilterArb = (sectionIds: string[]) =>
  fc.oneof(
    fc.record({
      type: fc.constant('in_section' as const),
      sectionId: fc.constantFrom(...sectionIds),
    }),
    fc.record({
      type: fc.constant('not_in_section' as const),
      sectionId: fc.constantFrom(...sectionIds),
    }),
  );

const nonSectionFilterArb = fc.constantFrom(
  { type: 'has_due_date' as const },
  { type: 'no_due_date' as const },
  { type: 'is_overdue' as const },
  { type: 'due_today' as const },
  { type: 'due_tomorrow' as const },
);

const filtersArb = (sectionIds: string[]) =>
  fc.array(
    fc.oneof(sectionFilterArb(sectionIds), nonSectionFilterArb),
    { minLength: 0, maxLength: 5 },
  );

const ruleArb = (index: number, projectId: string, sectionIds: string[]) =>
  fc.tuple(triggerArb(sectionIds), actionArb(sectionIds), filtersArb(sectionIds)).map(
    ([trigger, action, filters]) =>
      makeRule({
        id: `rule-${index}`,
        projectId,
        trigger,
        action,
        filters,
        enabled: true,
        brokenReason: null,
      }),
  );

function ruleReferencesSection(rule: AutomationRule, sectionId: string): boolean {
  if (rule.trigger.sectionId === sectionId) return true;
  if (rule.action.sectionId === sectionId) return true;
  for (const f of rule.filters) {
    if ((f.type === 'in_section' || f.type === 'not_in_section') && f.sectionId === sectionId) {
      return true;
    }
  }
  return false;
}

describe('Property 1: Broken rule detection on section delete', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any project with any set of automation rules, and for any section
   * that is deleted, every rule whose trigger.sectionId, action.sectionId,
   * or any filter sectionId matches the deleted section's ID SHALL have
   * enabled set to false and brokenReason set to 'section_deleted'.
   * Rules that do not reference the deleted section SHALL remain unchanged.
   */
  it('matching rules are disabled and non-matching rules remain unchanged', () => {
    const projectId = 'proj-1';

    fc.assert(
      fc.property(
        // Generate 2-6 section IDs, then pick one as the deleted section
        fc.array(sectionIdArb, { minLength: 2, maxLength: 6 }).chain((sectionIds) => {
          const uniqueSections = [...new Set(sectionIds)];
          if (uniqueSections.length < 2) return fc.constant(null);

          return fc.tuple(
            // Pick one section to delete
            fc.constantFrom(...uniqueSections),
            // Generate 1-10 rules referencing these sections
            fc.tuple(
              ...Array.from({ length: 5 }, (_, i) =>
                ruleArb(i, projectId, uniqueSections),
              ),
            ),
          ).map(([deletedId, rules]) => ({ deletedId, rules: [...rules] }));
        }),
        (input) => {
          if (input === null) return; // degenerate case, skip

          const { deletedId, rules } = input;

          // Snapshot original state
          const originalStates = new Map(
            rules.map((r) => [r.id, { enabled: r.enabled, brokenReason: r.brokenReason }]),
          );

          const repo = createMockRepo(rules);
          detectBrokenRules(deletedId, projectId, repo);

          for (const rule of rules) {
            const updated = repo.findById(rule.id)!;
            const references = ruleReferencesSection(rule, deletedId);

            if (references) {
              // Matching rules SHALL be disabled with brokenReason
              expect(updated.enabled).toBe(false);
              expect(updated.brokenReason).toBe('section_deleted');
            } else {
              // Non-matching rules SHALL remain unchanged
              const original = originalStates.get(rule.id)!;
              expect(updated.enabled).toBe(original.enabled);
              expect(updated.brokenReason).toBe(original.brokenReason);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
