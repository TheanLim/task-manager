import { describe, it, expect } from 'vitest';
import { validateImportedRules } from './ruleImportExport';
import type { AutomationRule } from '../types';

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

describe('validateImportedRules', () => {
  it('preserves a rule with no section references', () => {
    const rule = makeRule();
    const result = validateImportedRules([rule], new Set());

    expect(result).toHaveLength(1);
    expect(result[0].enabled).toBe(true);
    expect(result[0].brokenReason).toBeNull();
  });

  it('preserves a rule whose trigger sectionId exists', () => {
    const rule = makeRule({
      trigger: { type: 'card_moved_into_section', sectionId: 'sec-1' },
    });
    const result = validateImportedRules([rule], new Set(['sec-1']));

    expect(result[0].enabled).toBe(true);
    expect(result[0].brokenReason).toBeNull();
  });

  it('marks a rule broken when trigger sectionId is missing', () => {
    const rule = makeRule({
      trigger: { type: 'card_moved_into_section', sectionId: 'sec-missing' },
    });
    const result = validateImportedRules([rule], new Set(['sec-1']));

    expect(result[0].enabled).toBe(false);
    expect(result[0].brokenReason).toBe('section_deleted');
  });

  it('marks a rule broken when action sectionId is missing', () => {
    const rule = makeRule({
      action: {
        type: 'move_card_to_top_of_section',
        sectionId: 'sec-missing',
        dateOption: null,
        position: 'top',
        cardTitle: null,
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
    });
    const result = validateImportedRules([rule], new Set(['sec-1']));

    expect(result[0].enabled).toBe(false);
    expect(result[0].brokenReason).toBe('section_deleted');
  });

  it('marks a rule broken when in_section filter sectionId is missing', () => {
    const rule = makeRule({
      filters: [{ type: 'in_section', sectionId: 'sec-missing' }],
    });
    const result = validateImportedRules([rule], new Set(['sec-1']));

    expect(result[0].enabled).toBe(false);
    expect(result[0].brokenReason).toBe('section_deleted');
  });

  it('marks a rule broken when not_in_section filter sectionId is missing', () => {
    const rule = makeRule({
      filters: [{ type: 'not_in_section', sectionId: 'sec-missing' }],
    });
    const result = validateImportedRules([rule], new Set(['sec-1']));

    expect(result[0].enabled).toBe(false);
    expect(result[0].brokenReason).toBe('section_deleted');
  });

  it('preserves a rule with valid filter sectionIds', () => {
    const rule = makeRule({
      filters: [
        { type: 'in_section', sectionId: 'sec-1' },
        { type: 'not_in_section', sectionId: 'sec-2' },
      ],
    });
    const result = validateImportedRules([rule], new Set(['sec-1', 'sec-2']));

    expect(result[0].enabled).toBe(true);
    expect(result[0].brokenReason).toBeNull();
  });

  it('ignores non-section filters (e.g., has_due_date)', () => {
    const rule = makeRule({
      filters: [{ type: 'has_due_date' }],
    });
    const result = validateImportedRules([rule], new Set());

    expect(result[0].enabled).toBe(true);
    expect(result[0].brokenReason).toBeNull();
  });

  it('marks broken if ANY section reference is invalid even if others are valid', () => {
    const rule = makeRule({
      trigger: { type: 'card_moved_into_section', sectionId: 'sec-1' },
      action: {
        type: 'move_card_to_top_of_section',
        sectionId: 'sec-missing',
        dateOption: null,
        position: 'top',
        cardTitle: null,
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
    });
    const result = validateImportedRules([rule], new Set(['sec-1']));

    expect(result[0].enabled).toBe(false);
    expect(result[0].brokenReason).toBe('section_deleted');
  });

  it('handles multiple rules — only marks invalid ones as broken', () => {
    const validRule = makeRule({
      id: 'rule-valid',
      trigger: { type: 'card_moved_into_section', sectionId: 'sec-1' },
    });
    const brokenRule = makeRule({
      id: 'rule-broken',
      trigger: { type: 'card_moved_into_section', sectionId: 'sec-missing' },
    });
    const result = validateImportedRules(
      [validRule, brokenRule],
      new Set(['sec-1']),
    );

    expect(result[0].enabled).toBe(true);
    expect(result[0].brokenReason).toBeNull();
    expect(result[1].enabled).toBe(false);
    expect(result[1].brokenReason).toBe('section_deleted');
  });

  it('handles empty rules array', () => {
    const result = validateImportedRules([], new Set(['sec-1']));
    expect(result).toHaveLength(0);
  });

  it('preserves original enabled and brokenReason when all refs are valid', () => {
    const rule = makeRule({
      enabled: false,
      brokenReason: 'some_other_reason',
      trigger: { type: 'card_moved_into_section', sectionId: 'sec-1' },
    });
    const result = validateImportedRules([rule], new Set(['sec-1']));

    expect(result[0].enabled).toBe(false);
    expect(result[0].brokenReason).toBe('some_other_reason');
  });
});


// --- Property-based tests ---

import * as fc from 'fast-check';

// --- Arbitraries ---

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

/**
 * Helper: collects all non-null section IDs referenced by a rule.
 */
function collectSectionRefs(rule: AutomationRule): string[] {
  const refs: string[] = [];
  if (rule.trigger.sectionId !== null) refs.push(rule.trigger.sectionId);
  if (rule.action.sectionId !== null) refs.push(rule.action.sectionId);
  for (const f of rule.filters) {
    if ((f.type === 'in_section' || f.type === 'not_in_section') && f.sectionId) {
      refs.push(f.sectionId);
    }
  }
  return refs;
}

describe('Property 5: Import/export round-trip', () => {
  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any set of automation rules, exporting the application data and then
   * importing it SHALL result in the same set of rules being present in the
   * repository (assuming all referenced sections exist in the imported data).
   */
  it('Feature: automations-polish, Property 5: Import/export round-trip', () => {
    fc.assert(
      fc.property(
        fc.array(sectionIdArb, { minLength: 1, maxLength: 6 }).chain((rawSectionIds) => {
          const sectionIds = [...new Set(rawSectionIds)];
          if (sectionIds.length === 0) return fc.constant(null);

          return fc.tuple(
            fc.constant(sectionIds),
            fc.array(
              fc.integer({ min: 0, max: 99 }).chain((idx) =>
                ruleArb(idx, 'proj-1', sectionIds),
              ),
              { minLength: 1, maxLength: 10 },
            ),
          );
        }),
        (input) => {
          if (input === null) return;

          const [sectionIds, rules] = input;

          // All section IDs referenced by the rules are in the available set
          const availableSectionIds = new Set(sectionIds);

          // Simulate round-trip: validate imported rules with all sections available
          const result = validateImportedRules(rules, availableSectionIds);

          // Every rule should come back unchanged (same length, same values)
          expect(result).toHaveLength(rules.length);
          for (let i = 0; i < rules.length; i++) {
            expect(result[i].id).toBe(rules[i].id);
            expect(result[i].enabled).toBe(rules[i].enabled);
            expect(result[i].brokenReason).toBe(rules[i].brokenReason);
            expect(result[i].trigger).toEqual(rules[i].trigger);
            expect(result[i].action).toEqual(rules[i].action);
            expect(result[i].filters).toEqual(rules[i].filters);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 6: Import section reference validation', () => {
  /**
   * **Validates: Requirements 5.3, 5.4**
   *
   * For any set of imported automation rules and for any set of available
   * section IDs, every imported rule whose section references are NOT in the
   * available set SHALL have enabled=false and brokenReason='section_deleted'.
   * Rules whose section references are all valid SHALL be preserved with their
   * original enabled and brokenReason values.
   */
  it('Feature: automations-polish, Property 6: Import section reference validation', () => {
    fc.assert(
      fc.property(
        // Generate two disjoint pools: "available" sections and "missing" sections
        fc.tuple(
          fc.array(sectionIdArb, { minLength: 1, maxLength: 6 }),
          fc.array(sectionIdArb, { minLength: 1, maxLength: 6 }),
        ).chain(([availableRaw, missingRaw]) => {
          const available = [...new Set(availableRaw)];
          const missing = [...new Set(missingRaw)].filter((id) => !available.includes(id));

          // Need at least 1 available section to build rules
          if (available.length === 0) return fc.constant(null);

          // All section IDs that rules can reference (both valid and invalid)
          const allSectionIds = [...available, ...missing];
          if (allSectionIds.length === 0) return fc.constant(null);

          return fc.tuple(
            fc.constant(available),
            fc.constant(missing),
            fc.array(
              fc.integer({ min: 0, max: 99 }).chain((idx) =>
                fc.tuple(
                  triggerArb(allSectionIds),
                  actionArb(allSectionIds),
                  filtersArb(allSectionIds),
                  fc.boolean(), // original enabled state
                  fc.oneof(fc.constant(null), fc.constant('some_other_reason')), // original brokenReason
                ).map(([trigger, action, filters, enabled, brokenReason]) =>
                  makeRule({
                    id: `rule-${idx}`,
                    projectId: 'proj-1',
                    trigger,
                    action,
                    filters,
                    enabled,
                    brokenReason,
                  }),
                ),
              ),
              { minLength: 1, maxLength: 10 },
            ),
          );
        }),
        (input) => {
          if (input === null) return;

          const [available, _missing, rules] = input;
          const availableSet = new Set(available);

          const result = validateImportedRules(rules, availableSet);

          expect(result).toHaveLength(rules.length);
          for (let i = 0; i < rules.length; i++) {
            const refs = collectSectionRefs(rules[i]);
            const hasInvalidRef = refs.some((id) => !availableSet.has(id));

            if (hasInvalidRef) {
              // Rule with invalid refs SHALL be marked broken
              expect(result[i].enabled).toBe(false);
              expect(result[i].brokenReason).toBe('section_deleted');
            } else {
              // Rule with all valid refs SHALL preserve original values
              expect(result[i].enabled).toBe(rules[i].enabled);
              expect(result[i].brokenReason).toBe(rules[i].brokenReason);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
