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
