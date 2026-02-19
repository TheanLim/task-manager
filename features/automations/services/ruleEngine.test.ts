import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { evaluateRules, buildRuleIndex } from './ruleEngine';
import type {
  DomainEvent,
  AutomationRule,
  EvaluationContext,
  TriggerType,
  ActionType,
} from '../types';

// Arbitraries for generating test data
const idArb = fc.string({ minLength: 1, maxLength: 50 });
const isoDateTimeArb = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map((d) => d.toISOString());

const triggerTypeArb = fc.constantFrom<TriggerType>(
  'card_moved_into_section',
  'card_moved_out_of_section',
  'card_marked_complete',
  'card_marked_incomplete',
);

const actionTypeArb = fc.constantFrom<ActionType>(
  'move_card_to_top_of_section',
  'move_card_to_bottom_of_section',
  'mark_card_complete',
  'mark_card_incomplete',
  'set_due_date',
  'remove_due_date',
);

const automationRuleArb = fc.record({
  id: idArb,
  projectId: idArb,
  name: fc.string({ minLength: 1, maxLength: 200 }),
  trigger: fc.record({
    type: triggerTypeArb,
    sectionId: fc.oneof(idArb, fc.constant(null)),
  }),
  action: fc.record({
    type: actionTypeArb,
    sectionId: fc.oneof(idArb, fc.constant(null)),
    dateOption: fc.constantFrom('today', 'tomorrow', 'next_working_day', null),
    position: fc.constantFrom('top', 'bottom', null),
  }),
  enabled: fc.boolean(),
  brokenReason: fc.oneof(fc.string({ minLength: 1 }), fc.constant(null)),
  executionCount: fc.nat(),
  lastExecutedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
  order: fc.integer(),
  createdAt: isoDateTimeArb,
  updatedAt: isoDateTimeArb,
});

const evaluationContextArb = fc.record({
  allTasks: fc.constant([]),
  allSections: fc.constant([]),
  maxDepth: fc.constant(5),
  executedSet: fc.constant(new Set<string>()),
});

// Feature: automations-foundation, Property 6: Rule engine trigger matching
// **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
describe('Property 6: Rule engine trigger matching', () => {
  it('for any enabled rule with card_moved_into_section trigger matching event sectionId, returns a RuleAction', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        automationRuleArb,
        evaluationContextArb,
        (entityId, projectId, sectionId, ruleTemplate, context) => {
          // Create an enabled rule with no brokenReason
          const rule = {
            ...ruleTemplate,
            enabled: true,
            brokenReason: null,
            trigger: {
              type: 'card_moved_into_section',
              sectionId,
            },
          } as any;

          // Create a task.updated event with sectionId change matching the rule
          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { sectionId },
            previousValues: { sectionId: 'different-section' },
            depth: 0,
          };

          const actions = evaluateRules(event, [rule], context);

          // Should return exactly one action for this rule
          expect(actions).toHaveLength(1);
          expect(actions[0].ruleId).toBe(rule.id);
          expect(actions[0].targetEntityId).toBe(entityId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any enabled rule with card_moved_out_of_section trigger matching previous sectionId, returns a RuleAction', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        automationRuleArb,
        evaluationContextArb,
        (entityId, projectId, sectionId, ruleTemplate, context) => {
          // Create an enabled rule with no brokenReason
          const rule = {
            ...ruleTemplate,
            enabled: true,
            brokenReason: null,
            trigger: {
              type: 'card_moved_out_of_section',
              sectionId,
            },
          } as any;

          // Create a task.updated event with sectionId change where previous matches the rule
          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { sectionId: 'new-section' },
            previousValues: { sectionId },
            depth: 0,
          };

          const actions = evaluateRules(event, [rule], context);

          // Should return exactly one action for this rule
          expect(actions).toHaveLength(1);
          expect(actions[0].ruleId).toBe(rule.id);
          expect(actions[0].targetEntityId).toBe(entityId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any enabled rule with card_marked_complete trigger matching completed change, returns a RuleAction', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        automationRuleArb,
        evaluationContextArb,
        (entityId, projectId, ruleTemplate, context) => {
          // Create an enabled rule with no brokenReason
          const rule = {
            ...ruleTemplate,
            enabled: true,
            brokenReason: null,
            trigger: {
              type: 'card_marked_complete',
              sectionId: null,
            },
          } as any;

          // Create a task.updated event with completed changing from false to true
          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { completed: true },
            previousValues: { completed: false },
            depth: 0,
          };

          const actions = evaluateRules(event, [rule], context);

          // Should return exactly one action for this rule
          expect(actions).toHaveLength(1);
          expect(actions[0].ruleId).toBe(rule.id);
          expect(actions[0].targetEntityId).toBe(entityId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any enabled rule with card_marked_incomplete trigger matching completed change, returns a RuleAction', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        automationRuleArb,
        evaluationContextArb,
        (entityId, projectId, ruleTemplate, context) => {
          // Create an enabled rule with no brokenReason
          const rule = {
            ...ruleTemplate,
            enabled: true,
            brokenReason: null,
            trigger: {
              type: 'card_marked_incomplete',
              sectionId: null,
            },
          } as any;

          // Create a task.updated event with completed changing from true to false
          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { completed: false },
            previousValues: { completed: true },
            depth: 0,
          };

          const actions = evaluateRules(event, [rule], context);

          // Should return exactly one action for this rule
          expect(actions).toHaveLength(1);
          expect(actions[0].ruleId).toBe(rule.id);
          expect(actions[0].targetEntityId).toBe(entityId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any rule whose trigger does NOT match the event, no RuleAction is returned', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        automationRuleArb,
        evaluationContextArb,
        (entityId, projectId, sectionId, ruleTemplate, context) => {
          // Create an enabled rule with card_moved_into_section trigger
          const rule = {
            ...ruleTemplate,
            enabled: true,
            brokenReason: null,
            trigger: {
              type: 'card_moved_into_section',
              sectionId,
            },
          } as any;

          // Create a task.updated event with sectionId change that does NOT match
          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { sectionId: 'different-section' },
            previousValues: { sectionId: 'another-section' },
            depth: 0,
          };

          const actions = evaluateRules(event, [rule], context);

          // Should return no actions since the trigger doesn't match
          expect(actions).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for task.created or task.deleted events, no RuleActions are returned', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'task.created' | 'task.deleted'>(
          'task.created',
          'task.deleted',
        ),
        idArb,
        idArb,
        fc.array(automationRuleArb, { minLength: 0, maxLength: 10 }),
        evaluationContextArb,
        (eventType, entityId, projectId, rules, context) => {
          // Make all rules enabled with no brokenReason
          const enabledRules = rules.map((r) => ({
            ...r,
            enabled: true,
            brokenReason: null,
          })) as any;

          const event: DomainEvent = {
            type: eventType,
            entityId,
            projectId,
            changes: {},
            previousValues: {},
            depth: 0,
          };

          const actions = evaluateRules(event, enabledRules, context);

          // Should return no actions for task.created or task.deleted
          expect(actions).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any event with no relevant field changes, no RuleActions are returned', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        fc.array(automationRuleArb, { minLength: 1, maxLength: 10 }),
        evaluationContextArb,
        (entityId, projectId, rules, context) => {
          // Make all rules enabled with no brokenReason
          const enabledRules = rules.map((r) => ({
            ...r,
            enabled: true,
            brokenReason: null,
          })) as any;

          // Create an event with changes to fields that don't trigger automations
          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { title: 'New Title', description: 'New Description' },
            previousValues: { title: 'Old Title', description: 'Old Description' },
            depth: 0,
          };

          const actions = evaluateRules(event, enabledRules, context);

          // Should return no actions since no relevant fields changed
          expect(actions).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: automations-foundation, Property 7: Rule engine disabled/broken rule filtering
// **Validates: Requirements 4.6**
describe('Property 7: Rule engine disabled/broken rule filtering', () => {
  it('for any disabled rule (enabled=false), no RuleAction is returned regardless of trigger match', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        automationRuleArb,
        evaluationContextArb,
        (entityId, projectId, sectionId, ruleTemplate, context) => {
          // Create a disabled rule with matching trigger
          const rule = {
            ...ruleTemplate,
            enabled: false,
            brokenReason: null,
            trigger: {
              type: 'card_moved_into_section',
              sectionId,
            },
          } as any;

          // Create a matching event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { sectionId },
            previousValues: { sectionId: 'different-section' },
            depth: 0,
          };

          const actions = evaluateRules(event, [rule], context);

          // Should return no actions because the rule is disabled
          expect(actions).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any broken rule (brokenReason is non-null), no RuleAction is returned regardless of trigger match', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        automationRuleArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        evaluationContextArb,
        (entityId, projectId, sectionId, ruleTemplate, brokenReason, context) => {
          // Create a broken rule with matching trigger
          const rule = {
            ...ruleTemplate,
            enabled: true,
            brokenReason,
            trigger: {
              type: 'card_moved_into_section',
              sectionId,
            },
          } as any;

          // Create a matching event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { sectionId },
            previousValues: { sectionId: 'different-section' },
            depth: 0,
          };

          const actions = evaluateRules(event, [rule], context);

          // Should return no actions because the rule is broken
          expect(actions).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any set of rules with mixed enabled/disabled/broken states, only enabled non-broken rules return actions', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        fc.array(automationRuleArb, { minLength: 3, maxLength: 10 }),
        evaluationContextArb,
        (entityId, projectId, sectionId, rulesTemplate, context) => {
          // Create a mix of rules:
          // - Some enabled with no brokenReason (should match)
          // - Some disabled (should not match)
          // - Some broken (should not match)
          const rules = rulesTemplate.map((r, i) => {
            const state = i % 3;
            return {
              ...r,
              id: `${r.id}-${i}`, // Ensure unique IDs
              enabled: state !== 1, // Every 3rd rule is disabled
              brokenReason: state === 2 ? 'section_deleted' : null, // Every 3rd rule is broken
              trigger: {
                type: 'card_moved_into_section' as const,
                sectionId,
              },
            };
          }) as any;

          // Create a matching event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { sectionId },
            previousValues: { sectionId: 'different-section' },
            depth: 0,
          };

          const actions = evaluateRules(event, rules, context);

          // Count how many rules should match (enabled and not broken)
          const expectedCount = rules.filter(
            (r: any) => r.enabled && r.brokenReason === null,
          ).length;

          // Should return actions only for enabled, non-broken rules
          expect(actions).toHaveLength(expectedCount);

          // All returned actions should be from enabled, non-broken rules
          for (const action of actions) {
            const rule = rules.find((r: any) => r.id === action.ruleId);
            expect(rule).toBeDefined();
            expect(rule!.enabled).toBe(true);
            expect(rule!.brokenReason).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('buildRuleIndex only includes enabled rules with no brokenReason', () => {
    fc.assert(
      fc.property(
        fc.array(automationRuleArb, { minLength: 1, maxLength: 20 }),
        (rulesTemplate) => {
          // Create a mix of enabled/disabled/broken rules
          const rules = rulesTemplate.map((r, i) => {
            const state = i % 3;
            return {
              ...r,
              enabled: state !== 1,
              brokenReason: state === 2 ? 'section_deleted' : null,
            };
          }) as any;

          const index = buildRuleIndex(rules);

          // Count all rules in the index
          let indexedRuleCount = 0;
          for (const ruleList of index.values()) {
            indexedRuleCount += ruleList.length;
          }

          // Count expected rules (enabled and not broken)
          const expectedCount = rules.filter(
            (r: any) => r.enabled && r.brokenReason === null,
          ).length;

          expect(indexedRuleCount).toBe(expectedCount);

          // Verify all indexed rules are enabled and not broken
          for (const ruleList of index.values()) {
            for (const rule of ruleList) {
              expect(rule.enabled).toBe(true);
              expect(rule.brokenReason).toBeNull();
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 16: New triggers match only their corresponding event types
// **Validates: Requirements 7.3, 7.8**
// ============================================================================

describe('Property 16: New triggers match only their corresponding event types', () => {
  it('Feature: automations-filters-dates, Property 16: task.created events match card_created_in_section but NOT card_moved_into_section', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        evaluationContextArb,
        (entityId, projectId, sectionId, context) => {
          // Create two rules: one for card_created_in_section, one for card_moved_into_section
          const createdRule: AutomationRule = {
            id: 'created-rule',
            projectId,
            name: 'Created Rule',
            trigger: {
              type: 'card_created_in_section',
              sectionId,
            },
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
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const movedRule: AutomationRule = {
            ...createdRule,
            id: 'moved-rule',
            name: 'Moved Rule',
            trigger: {
              type: 'card_moved_into_section',
              sectionId,
            },
          };

          // Create a task.created event
          const createdEvent: DomainEvent = {
            type: 'task.created',
            entityId,
            projectId,
            changes: { sectionId },
            previousValues: {},
            depth: 0,
          };

          const actions = evaluateRules(createdEvent, [createdRule, movedRule], context);

          // Should match only the card_created_in_section rule
          expect(actions).toHaveLength(1);
          expect(actions[0].ruleId).toBe('created-rule');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Feature: automations-filters-dates, Property 16: task.updated with sectionId change matches card_moved_into_section but NOT card_created_in_section', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        evaluationContextArb,
        (entityId, projectId, sectionId, context) => {
          // Create two rules: one for card_created_in_section, one for card_moved_into_section
          const createdRule: AutomationRule = {
            id: 'created-rule',
            projectId,
            name: 'Created Rule',
            trigger: {
              type: 'card_created_in_section',
              sectionId,
            },
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
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const movedRule: AutomationRule = {
            ...createdRule,
            id: 'moved-rule',
            name: 'Moved Rule',
            trigger: {
              type: 'card_moved_into_section',
              sectionId,
            },
          };

          // Create a task.updated event with sectionId change
          const updatedEvent: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { sectionId },
            previousValues: { sectionId: 'old-section' },
            depth: 0,
          };

          const actions = evaluateRules(updatedEvent, [createdRule, movedRule], context);

          // Should match only the card_moved_into_section rule
          expect(actions).toHaveLength(1);
          expect(actions[0].ruleId).toBe('moved-rule');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 17: Section triggers match events in the same project
// **Validates: Requirements 7.5, 7.7**
// ============================================================================

describe('Property 17: Section triggers match events in the same project', () => {
  it('Feature: automations-filters-dates, Property 17: section.created events match section_created triggers in the same project', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        evaluationContextArb,
        (entityId, projectId, context) => {
          // Create a section_created rule
          const rule: AutomationRule = {
            id: 'section-created-rule',
            projectId,
            name: 'Section Created Rule',
            trigger: {
              type: 'section_created',
              sectionId: null,
            },
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
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Create a section.created event
          const event: DomainEvent = {
            type: 'section.created',
            entityId,
            projectId,
            changes: {},
            previousValues: {},
            depth: 0,
          };

          const actions = evaluateRules(event, [rule], context);

          // Should match the section_created rule
          expect(actions).toHaveLength(1);
          expect(actions[0].ruleId).toBe('section-created-rule');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Feature: automations-filters-dates, Property 17: section.updated with name change matches section_renamed triggers in the same project', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        evaluationContextArb,
        (entityId, projectId, oldName, newName, context) => {
          // Ensure names are different
          if (oldName === newName) {
            newName = newName + '-modified';
          }

          // Create a section_renamed rule
          const rule: AutomationRule = {
            id: 'section-renamed-rule',
            projectId,
            name: 'Section Renamed Rule',
            trigger: {
              type: 'section_renamed',
              sectionId: null,
            },
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
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Create a section.updated event with name change
          const event: DomainEvent = {
            type: 'section.updated',
            entityId,
            projectId,
            changes: { name: newName },
            previousValues: { name: oldName },
            depth: 0,
          };

          const actions = evaluateRules(event, [rule], context);

          // Should match the section_renamed rule
          expect(actions).toHaveLength(1);
          expect(actions[0].ruleId).toBe('section-renamed-rule');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Feature: automations-filters-dates, Property 17: section.updated without name change does NOT match section_renamed triggers', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        evaluationContextArb,
        (entityId, projectId, context) => {
          // Create a section_renamed rule
          const rule: AutomationRule = {
            id: 'section-renamed-rule',
            projectId,
            name: 'Section Renamed Rule',
            trigger: {
              type: 'section_renamed',
              sectionId: null,
            },
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
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Create a section.updated event without name change
          const event: DomainEvent = {
            type: 'section.updated',
            entityId,
            projectId,
            changes: { order: 5 },
            previousValues: { order: 3 },
            depth: 0,
          };

          const actions = evaluateRules(event, [rule], context);

          // Should NOT match the section_renamed rule
          expect(actions).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Rule ordering tests — Task 10.2
// Validates: Requirements 10.3, 10.4
// ============================================================================

describe('Rule engine evaluates in ascending order', () => {
  const makeRule = (
    id: string,
    sectionId: string,
    order: number,
    createdAt: string,
  ): AutomationRule =>
    ({
      id,
      projectId: 'proj-1',
      name: `Rule ${id}`,
      trigger: { type: 'card_moved_into_section' as const, sectionId },
      filters: [],
      action: {
        type: 'mark_card_complete' as const,
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
      order,
      createdAt,
      updatedAt: createdAt,
      recentExecutions: [],
    }) as AutomationRule;

  const context: EvaluationContext = {
    allTasks: [],
    allSections: [],
    maxDepth: 5,
    executedSet: new Set(),
  };

  it('returns actions sorted by order ascending', () => {
    const sectionId = 'section-1';
    const rules = [
      makeRule('rule-c', sectionId, 3, '2025-01-01T00:00:00.000Z'),
      makeRule('rule-a', sectionId, 1, '2025-01-01T00:00:00.000Z'),
      makeRule('rule-b', sectionId, 2, '2025-01-01T00:00:00.000Z'),
    ];

    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: { sectionId },
      previousValues: { sectionId: 'old-section' },
      depth: 0,
    };

    const actions = evaluateRules(event, rules, context);
    expect(actions.map((a) => a.ruleId)).toEqual(['rule-a', 'rule-b', 'rule-c']);
  });

  it('uses createdAt as tiebreaker when order values are equal', () => {
    const sectionId = 'section-1';
    const rules = [
      makeRule('rule-late', sectionId, 1, '2025-06-01T00:00:00.000Z'),
      makeRule('rule-early', sectionId, 1, '2025-01-01T00:00:00.000Z'),
      makeRule('rule-mid', sectionId, 1, '2025-03-01T00:00:00.000Z'),
    ];

    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: { sectionId },
      previousValues: { sectionId: 'old-section' },
      depth: 0,
    };

    const actions = evaluateRules(event, rules, context);
    expect(actions.map((a) => a.ruleId)).toEqual([
      'rule-early',
      'rule-mid',
      'rule-late',
    ]);
  });

  it('sorts by order first, then createdAt within same order', () => {
    const sectionId = 'section-1';
    const rules = [
      makeRule('rule-2b', sectionId, 2, '2025-06-01T00:00:00.000Z'),
      makeRule('rule-1a', sectionId, 1, '2025-06-01T00:00:00.000Z'),
      makeRule('rule-2a', sectionId, 2, '2025-01-01T00:00:00.000Z'),
      makeRule('rule-1b', sectionId, 1, '2025-01-01T00:00:00.000Z'),
    ];

    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: { sectionId },
      previousValues: { sectionId: 'old-section' },
      depth: 0,
    };

    const actions = evaluateRules(event, rules, context);
    expect(actions.map((a) => a.ruleId)).toEqual([
      'rule-1b', // order 1, earlier createdAt
      'rule-1a', // order 1, later createdAt
      'rule-2a', // order 2, earlier createdAt
      'rule-2b', // order 2, later createdAt
    ]);
  });

  it('buildRuleIndex sorts rules within each trigger group', () => {
    const rules = [
      makeRule('rule-3', 'section-1', 3, '2025-01-01T00:00:00.000Z'),
      makeRule('rule-1', 'section-1', 1, '2025-01-01T00:00:00.000Z'),
      makeRule('rule-2', 'section-1', 2, '2025-01-01T00:00:00.000Z'),
    ];

    const index = buildRuleIndex(rules);
    const indexed = index.get('card_moved_into_section')!;
    expect(indexed.map((r) => r.id)).toEqual(['rule-1', 'rule-2', 'rule-3']);
  });
});

// ============================================================================
// Feature: automations-polish, Property 12: Rule engine evaluates in ascending order
// **Validates: Requirements 10.3, 10.4**
// ============================================================================

describe('Property 12: Rule engine evaluates in ascending order', () => {
  it('for any set of rules matching the same event, actions are returned in ascending order then createdAt', () => {
    fc.assert(
      fc.property(
        // Generate 2-20 rules with varying order and createdAt values
        fc.array(
          fc.record({
            order: fc.integer({ min: 0, max: 100 }),
            createdAt: fc
              .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
              .map((d) => d.toISOString()),
          }),
          { minLength: 2, maxLength: 20 },
        ),
        idArb,
        idArb,
        (ruleSpecs, entityId, sectionId) => {
          // Build rules that all match the same trigger (card_moved_into_section)
          const rules: AutomationRule[] = ruleSpecs.map((spec, i) => ({
            id: `rule-${i}`,
            projectId: 'proj-1',
            name: `Rule ${i}`,
            trigger: { type: 'card_moved_into_section' as const, sectionId },
            filters: [],
            action: {
              type: 'mark_card_complete' as const,
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
            order: spec.order,
            createdAt: spec.createdAt,
            updatedAt: spec.createdAt,
            recentExecutions: [],
          })) as AutomationRule[];

          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId: 'proj-1',
            changes: { sectionId },
            previousValues: { sectionId: 'old-section' },
            depth: 0,
          };

          const context: EvaluationContext = {
            allTasks: [],
            allSections: [],
            maxDepth: 5,
            executedSet: new Set(),
          };

          const actions = evaluateRules(event, rules, context);

          // All enabled rules should produce actions
          expect(actions).toHaveLength(rules.length);

          // Verify actions are sorted by order ascending, then createdAt ascending
          for (let i = 1; i < actions.length; i++) {
            const prevRule = rules.find((r) => r.id === actions[i - 1].ruleId)!;
            const currRule = rules.find((r) => r.id === actions[i].ruleId)!;

            if (prevRule.order !== currRule.order) {
              // Different order values: must be ascending
              expect(prevRule.order).toBeLessThan(currRule.order);
            } else {
              // Same order: createdAt must be ascending (or equal)
              expect(prevRule.createdAt.localeCompare(currRule.createdAt)).toBeLessThanOrEqual(0);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ============================================================================
// Rule engine filter integration tests
// **Validates: Requirements 3.3, 3.4**
// ============================================================================

describe('Rule engine filter integration', () => {
  it('rule with matching trigger but failing filter produces no action (Req 3.3, 3.5)', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        idArb,
        (entityId, projectId, triggerSectionId, filterSectionId) => {
          // Ensure the filter sectionId differs from the task's sectionId
          // so the filter will fail
          const taskSectionId = `task-section-${triggerSectionId}`;
          fc.pre(taskSectionId !== filterSectionId);

          const task = {
            id: entityId,
            projectId,
            parentTaskId: null,
            sectionId: taskSectionId,
            description: 'Test task',
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

          const rule: AutomationRule = {
            id: 'rule-with-filter',
            projectId,
            name: 'Rule with filter',
            trigger: {
              type: 'card_moved_into_section',
              sectionId: triggerSectionId,
            },
            filters: [
              { type: 'in_section', sectionId: filterSectionId } as any,
            ],
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
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { sectionId: triggerSectionId },
            previousValues: { sectionId: 'old-section' },
            depth: 0,
          };

          const context: EvaluationContext = {
            allTasks: [task as any],
            allSections: [],
            maxDepth: 5,
            executedSet: new Set(),
          };

          const actions = evaluateRules(event, [rule], context);

          // Trigger matches but filter fails → no action
          expect(actions).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rule with matching trigger and passing filter produces an action (Req 3.3, 3.4)', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        (entityId, projectId, sectionId) => {
          const task = {
            id: entityId,
            projectId,
            parentTaskId: null,
            sectionId,
            description: 'Test task',
            notes: '',
            assignee: '',
            priority: 'none' as const,
            tags: [],
            dueDate: new Date().toISOString(),
            completed: false,
            completedAt: null,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const rule: AutomationRule = {
            id: 'rule-with-passing-filter',
            projectId,
            name: 'Rule with passing filter',
            trigger: {
              type: 'card_moved_into_section',
              sectionId,
            },
            filters: [
              { type: 'has_due_date' } as any,
            ],
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
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { sectionId },
            previousValues: { sectionId: 'old-section' },
            depth: 0,
          };

          const context: EvaluationContext = {
            allTasks: [task as any],
            allSections: [],
            maxDepth: 5,
            executedSet: new Set(),
          };

          const actions = evaluateRules(event, [rule], context);

          // Trigger matches and filter passes → action produced
          expect(actions).toHaveLength(1);
          expect(actions[0].ruleId).toBe('rule-with-passing-filter');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rule with empty filters still matches (backward compatible) (Req 3.1)', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        (entityId, projectId, sectionId) => {
          const rule: AutomationRule = {
            id: 'rule-no-filters',
            projectId,
            name: 'Rule without filters',
            trigger: {
              type: 'card_moved_into_section',
              sectionId,
            },
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
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { sectionId },
            previousValues: { sectionId: 'old-section' },
            depth: 0,
          };

          const context: EvaluationContext = {
            allTasks: [],
            allSections: [],
            maxDepth: 5,
            executedSet: new Set(),
          };

          const actions = evaluateRules(event, [rule], context);

          // Empty filters → backward compatible, matches all
          expect(actions).toHaveLength(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Section triggers cross-project isolation
// **Validates: Property 17 (events from different projects do not match)**
// Note: Project filtering is handled upstream by the automation service,
// which passes only rules for the relevant project to evaluateRules.
// These tests verify that when rules from a different project are passed,
// the rule engine still matches them (since it doesn't filter by project).
// The actual cross-project isolation is tested at the automationService level.
// ============================================================================

describe('Section triggers — project scoping note', () => {
  it('evaluateRules does not filter by projectId (that is the caller responsibility)', () => {
    // This is a documentation test: evaluateRules matches rules regardless of projectId.
    // The automationService is responsible for passing only rules for the relevant project.
    const rule: AutomationRule = {
      id: 'section-created-rule',
      projectId: 'project-A',
      name: 'Section Created Rule',
      trigger: {
        type: 'section_created',
        sectionId: null,
      },
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
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Event from a DIFFERENT project
    const event: DomainEvent = {
      type: 'section.created',
      entityId: 'section-1',
      projectId: 'project-B',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    const context: EvaluationContext = {
      allTasks: [],
      allSections: [],
      maxDepth: 5,
      executedSet: new Set(),
    };

    // evaluateRules does NOT filter by project — it matches
    const actions = evaluateRules(event, [rule], context);
    expect(actions).toHaveLength(1);
  });
});


// ============================================================================
// Subtask exclusion — automations should NOT fire on subtasks
// ============================================================================

describe('Subtask exclusion', () => {
  it('does not produce actions for events on subtasks (parentTaskId is non-null)', () => {
    const sectionId = 'section-done';
    const subtask = {
      id: 'subtask-1',
      projectId: 'proj-1',
      parentTaskId: 'parent-1', // This is a subtask
      sectionId,
      description: 'Subtask',
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

    const rule: AutomationRule = {
      id: 'rule-1',
      projectId: 'proj-1',
      name: 'Auto-complete on move to Done',
      trigger: { type: 'card_moved_into_section', sectionId },
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
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'subtask-1',
      projectId: 'proj-1',
      changes: { sectionId },
      previousValues: { sectionId: 'old-section' },
      depth: 0,
    };

    const context: EvaluationContext = {
      allTasks: [subtask as any],
      allSections: [],
      maxDepth: 5,
      executedSet: new Set(),
    };

    const actions = evaluateRules(event, [rule], context);

    // Subtask events should NOT produce actions
    expect(actions).toHaveLength(0);
  });

  it('still produces actions for top-level tasks (parentTaskId is null)', () => {
    const sectionId = 'section-done';
    const topLevelTask = {
      id: 'task-1',
      projectId: 'proj-1',
      parentTaskId: null, // Top-level task
      sectionId,
      description: 'Top-level task',
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

    const rule: AutomationRule = {
      id: 'rule-1',
      projectId: 'proj-1',
      name: 'Auto-complete on move to Done',
      trigger: { type: 'card_moved_into_section', sectionId },
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
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: { sectionId },
      previousValues: { sectionId: 'old-section' },
      depth: 0,
    };

    const context: EvaluationContext = {
      allTasks: [topLevelTask as any],
      allSections: [],
      maxDepth: 5,
      executedSet: new Set(),
    };

    const actions = evaluateRules(event, [rule], context);

    // Top-level task events SHOULD produce actions
    expect(actions).toHaveLength(1);
  });

  it('property: for any subtask event, no actions are produced', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        idArb,
        (entityId, projectId, sectionId, parentTaskId) => {
          const subtask = {
            id: entityId,
            projectId,
            parentTaskId, // Non-null = subtask
            sectionId,
            description: 'Subtask',
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

          const rule: AutomationRule = {
            id: 'rule-1',
            projectId,
            name: 'Test Rule',
            trigger: { type: 'card_moved_into_section', sectionId },
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
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const event: DomainEvent = {
            type: 'task.updated',
            entityId,
            projectId,
            changes: { sectionId },
            previousValues: { sectionId: 'old-section' },
            depth: 0,
          };

          const context: EvaluationContext = {
            allTasks: [subtask as any],
            allSections: [],
            maxDepth: 5,
            executedSet: new Set(),
          };

          const actions = evaluateRules(event, [rule], context);
          expect(actions).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── schedule.fired tests ───────────────────────────────────────────────

describe('schedule.fired branch', () => {
  const makeScheduledRule = (id: string, triggerType: string): AutomationRule => ({
    id,
    projectId: 'proj-1',
    name: 'Scheduled Rule',
    trigger: {
      type: triggerType,
      sectionId: null,
      schedule: { kind: 'interval', intervalMinutes: 30 },
      lastEvaluatedAt: null,
    },
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
    createdAt: '2026-02-19T09:00:00.000Z',
    updatedAt: '2026-02-19T09:00:00.000Z',
  } as any);

  const makeTask = (id: string, completed = false) => ({
    id,
    description: `Task ${id}`,
    sectionId: 'sec-1',
    projectId: 'proj-1',
    completed,
    completedAt: null,
    dueDate: null,
    order: 0,
    createdAt: '2026-02-19T09:00:00.000Z',
    updatedAt: '2026-02-19T09:00:00.000Z',
    parentTaskId: null,
  });

  // Feature: scheduled-triggers-phase-5a, Property 15: all matching tasks get actions
  it('P15: interval/cron trigger produces action per matching task', () => {
    const rule = makeScheduledRule('rule-1', 'scheduled_interval');
    const tasks = [makeTask('t1'), makeTask('t2'), makeTask('t3')];

    const event: DomainEvent = {
      type: 'schedule.fired',
      entityId: 'rule-1',
      projectId: 'proj-1',
      changes: { triggerType: 'scheduled_interval' },
      previousValues: {},
      triggeredByRule: 'rule-1',
      depth: 0,
    };

    const context: EvaluationContext = {
      allTasks: tasks as any,
      allSections: [],
      maxDepth: 5,
      executedSet: new Set(),
    };

    const actions = evaluateRules(event, [rule], context);
    expect(actions).toHaveLength(3);
    expect(actions.map((a) => a.targetEntityId).sort()).toEqual(['t1', 't2', 't3']);
  });

  it('P15: due-date-relative trigger applies filters to specific task', () => {
    const rule = makeScheduledRule('rule-1', 'scheduled_due_date_relative');
    const tasks = [makeTask('t1'), makeTask('t2')];

    const event: DomainEvent = {
      type: 'schedule.fired',
      entityId: 't1', // specific task
      projectId: 'proj-1',
      changes: { triggerType: 'scheduled_due_date_relative' },
      previousValues: {},
      triggeredByRule: 'rule-1',
      depth: 0,
    };

    const context: EvaluationContext = {
      allTasks: tasks as any,
      allSections: [],
      maxDepth: 5,
      executedSet: new Set(),
    };

    const actions = evaluateRules(event, [rule], context);
    expect(actions).toHaveLength(1);
    expect(actions[0].targetEntityId).toBe('t1');
  });

  it('skips subtasks for interval/cron triggers', () => {
    const rule = makeScheduledRule('rule-1', 'scheduled_interval');
    const tasks = [
      makeTask('t1'),
      { ...makeTask('t2'), parentTaskId: 't1' }, // subtask
    ];

    const event: DomainEvent = {
      type: 'schedule.fired',
      entityId: 'rule-1',
      projectId: 'proj-1',
      changes: { triggerType: 'scheduled_interval' },
      previousValues: {},
      triggeredByRule: 'rule-1',
      depth: 0,
    };

    const context: EvaluationContext = {
      allTasks: tasks as any,
      allSections: [],
      maxDepth: 5,
      executedSet: new Set(),
    };

    const actions = evaluateRules(event, [rule], context);
    expect(actions).toHaveLength(1);
    expect(actions[0].targetEntityId).toBe('t1');
  });

  it('only matches the specific rule that fired', () => {
    const rule1 = makeScheduledRule('rule-1', 'scheduled_interval');
    const rule2 = makeScheduledRule('rule-2', 'scheduled_interval');
    const tasks = [makeTask('t1')];

    const event: DomainEvent = {
      type: 'schedule.fired',
      entityId: 'rule-1',
      projectId: 'proj-1',
      changes: { triggerType: 'scheduled_interval' },
      previousValues: {},
      triggeredByRule: 'rule-1', // only rule-1 should match
      depth: 0,
    };

    const context: EvaluationContext = {
      allTasks: tasks as any,
      allSections: [],
      maxDepth: 5,
      executedSet: new Set(),
    };

    const actions = evaluateRules(event, [rule1, rule2], context);
    expect(actions).toHaveLength(1);
    expect(actions[0].ruleId).toBe('rule-1');
  });
});
