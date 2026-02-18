import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  AutomationRuleSchema,
  TriggerTypeSchema,
  ActionTypeSchema,
  RelativeDateOptionSchema,
  TriggerSchema,
  ActionSchema,
  type AutomationRule,
} from './schemas';

// Feature: automations-foundation, Property 1: AutomationRule schema round-trip
// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
describe('Property 1: AutomationRule schema round-trip', () => {
  // Arbitraries for generating valid schema values
  const triggerTypeArb = fc.constantFrom(
    'card_moved_into_section',
    'card_moved_out_of_section',
    'card_marked_complete',
    'card_marked_incomplete',
  );

  const actionTypeArb = fc.constantFrom(
    'move_card_to_top_of_section',
    'move_card_to_bottom_of_section',
    'mark_card_complete',
    'mark_card_incomplete',
    'set_due_date',
    'remove_due_date',
  );

  const relativeDateOptionArb = fc.constantFrom(
    'today',
    'tomorrow',
    'next_working_day',
  );

  const positionArb = fc.constantFrom('top', 'bottom');

  const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 100 });
  const idArb = fc.string({ minLength: 1, maxLength: 50 });
  const isoDateTimeArb = fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map((d) => d.toISOString());

  const triggerArb = fc.record({
    type: triggerTypeArb,
    sectionId: fc.oneof(idArb, fc.constant(null)),
  });

  const actionArb = fc.record({
    type: actionTypeArb,
    sectionId: fc.oneof(idArb, fc.constant(null)),
    dateOption: fc.oneof(relativeDateOptionArb, fc.constant(null)),
    position: fc.oneof(positionArb, fc.constant(null)),
  });

  const automationRuleArb = fc.record({
    id: idArb,
    projectId: idArb,
    name: fc.string({ minLength: 1, maxLength: 200 }),
    trigger: triggerArb,
    action: actionArb,
    enabled: fc.boolean(),
    brokenReason: fc.oneof(nonEmptyStringArb, fc.constant(null)),
    executionCount: fc.nat(),
    lastExecutedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
    order: fc.integer(),
    createdAt: isoDateTimeArb,
    updatedAt: isoDateTimeArb,
  });

  it('for any valid AutomationRule object, parsing and re-parsing produces an equivalent object', () => {
    fc.assert(
      fc.property(automationRuleArb, (rule) => {
        // Parse the generated rule
        const parsed1 = AutomationRuleSchema.parse(rule);

        // Serialize to JSON and parse again
        const json = JSON.stringify(parsed1);
        const deserialized = JSON.parse(json);
        const parsed2 = AutomationRuleSchema.parse(deserialized);

        // Both parsed objects should be equivalent
        expect(parsed2).toEqual(parsed1);
      }),
      { numRuns: 100 },
    );
  });

  it('for any object with empty ID fields, the schema rejects it with a validation error', () => {
    fc.assert(
      fc.property(
        automationRuleArb,
        fc.constantFrom('id', 'projectId'),
        (rule, fieldToEmpty) => {
          const invalidRule = { ...rule, [fieldToEmpty]: '' };
          const result = AutomationRuleSchema.safeParse(invalidRule);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any object with invalid trigger type, the schema rejects it', () => {
    fc.assert(
      fc.property(
        automationRuleArb,
        fc.string().filter((s) => !['card_moved_into_section', 'card_moved_out_of_section', 'card_marked_complete', 'card_marked_incomplete'].includes(s)),
        (rule, invalidType) => {
          const invalidRule = {
            ...rule,
            trigger: { ...rule.trigger, type: invalidType },
          };
          const result = AutomationRuleSchema.safeParse(invalidRule);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any object with invalid action type, the schema rejects it', () => {
    fc.assert(
      fc.property(
        automationRuleArb,
        fc.string().filter((s) => !['move_card_to_top_of_section', 'move_card_to_bottom_of_section', 'mark_card_complete', 'mark_card_incomplete', 'set_due_date', 'remove_due_date'].includes(s)),
        (rule, invalidType) => {
          const invalidRule = {
            ...rule,
            action: { ...rule.action, type: invalidType },
          };
          const result = AutomationRuleSchema.safeParse(invalidRule);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any object with invalid RelativeDateOption, the schema rejects it', () => {
    fc.assert(
      fc.property(
        automationRuleArb,
        fc.string().filter((s) => !['today', 'tomorrow', 'next_working_day'].includes(s)),
        (rule, invalidOption) => {
          const invalidRule = {
            ...rule,
            action: { ...rule.action, dateOption: invalidOption },
          };
          const result = AutomationRuleSchema.safeParse(invalidRule);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any object with wrong type for enabled field, the schema rejects it', () => {
    fc.assert(
      fc.property(
        automationRuleArb,
        fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
        (rule, invalidEnabled) => {
          const invalidRule = { ...rule, enabled: invalidEnabled };
          const result = AutomationRuleSchema.safeParse(invalidRule);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any object with name exceeding 200 characters, the schema rejects it', () => {
    fc.assert(
      fc.property(
        automationRuleArb,
        fc.string({ minLength: 201, maxLength: 300 }),
        (rule, longName) => {
          const invalidRule = { ...rule, name: longName };
          const result = AutomationRuleSchema.safeParse(invalidRule);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any object with invalid datetime format, the schema rejects it', () => {
    fc.assert(
      fc.property(
        automationRuleArb,
        fc.constantFrom('createdAt', 'updatedAt', 'lastExecutedAt'),
        fc.string().filter((s) => {
          // Filter out valid ISO datetime strings
          try {
            const date = new Date(s);
            return isNaN(date.getTime()) || date.toISOString() !== s;
          } catch {
            return true;
          }
        }),
        (rule, field, invalidDate) => {
          const invalidRule = { ...rule, [field]: invalidDate };
          const result = AutomationRuleSchema.safeParse(invalidRule);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
