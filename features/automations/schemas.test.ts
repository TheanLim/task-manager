import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  AutomationRuleSchema,
  ExecutionLogEntrySchema,
  TriggerTypeSchema,
  ActionTypeSchema,
  RelativeDateOptionSchema,
  TriggerSchema,
  ActionSchema,
  CardFilterSchema,
  CardFilterTypeSchema,
  FilterUnitSchema,
  type AutomationRule,
  type CardFilter,
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
    cardTitle: fc.oneof(fc.string({ minLength: 1, maxLength: 200 }), fc.constant(null)),
    cardDateOption: fc.oneof(relativeDateOptionArb, fc.constant(null)),
    specificMonth: fc.oneof(fc.integer({ min: 1, max: 12 }), fc.constant(null)),
    specificDay: fc.oneof(fc.integer({ min: 1, max: 31 }), fc.constant(null)),
    monthTarget: fc.oneof(fc.constantFrom('this_month', 'next_month'), fc.constant(null)),
  });

  // Simple filter arbitrary for AutomationRule tests
  const simpleFilterArb = fc.oneof(
    fc.record({
      type: fc.constant('has_due_date' as const),
    }),
    fc.record({
      type: fc.constant('in_section' as const),
      sectionId: idArb,
    }),
  );

  const automationRuleArb = fc.record({
    id: idArb,
    projectId: idArb,
    name: fc.string({ minLength: 1, maxLength: 200 }),
    trigger: triggerArb,
    filters: fc.array(simpleFilterArb, { maxLength: 3 }),
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

  it('for any object with cardTitle exceeding 200 characters, the schema rejects it', () => {
    fc.assert(
      fc.property(
        automationRuleArb,
        fc.string({ minLength: 201, maxLength: 300 }),
        (rule, longTitle) => {
          const invalidRule = {
            ...rule,
            action: { ...rule.action, cardTitle: longTitle },
          };
          const result = AutomationRuleSchema.safeParse(invalidRule);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any object with empty cardTitle, the schema rejects it', () => {
    fc.assert(
      fc.property(automationRuleArb, (rule) => {
        const invalidRule = {
          ...rule,
          action: { ...rule.action, cardTitle: '' },
        };
        const result = AutomationRuleSchema.safeParse(invalidRule);
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('for any object with specificMonth outside 1-12 range, the schema rejects it', () => {
    fc.assert(
      fc.property(
        automationRuleArb,
        fc.integer().filter((n) => n < 1 || n > 12),
        (rule, invalidMonth) => {
          const invalidRule = {
            ...rule,
            action: { ...rule.action, specificMonth: invalidMonth },
          };
          const result = AutomationRuleSchema.safeParse(invalidRule);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any object with specificDay outside 1-31 range, the schema rejects it', () => {
    fc.assert(
      fc.property(
        automationRuleArb,
        fc.integer().filter((n) => n < 1 || n > 31),
        (rule, invalidDay) => {
          const invalidRule = {
            ...rule,
            action: { ...rule.action, specificDay: invalidDay },
          };
          const result = AutomationRuleSchema.safeParse(invalidRule);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any object with invalid monthTarget, the schema rejects it', () => {
    fc.assert(
      fc.property(
        automationRuleArb,
        fc.string().filter((s) => s !== 'this_month' && s !== 'next_month'),
        (rule, invalidTarget) => {
          const invalidRule = {
            ...rule,
            action: { ...rule.action, monthTarget: invalidTarget },
          };
          const result = AutomationRuleSchema.safeParse(invalidRule);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any object with valid filters array, the schema accepts it', () => {
    fc.assert(
      fc.property(automationRuleArb, (rule) => {
        const result = AutomationRuleSchema.safeParse(rule);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(Array.isArray(result.data.filters)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('for any object without filters field, the schema adds empty array as default', () => {
    fc.assert(
      fc.property(automationRuleArb, (rule) => {
        const { filters, ...ruleWithoutFilters } = rule;
        const result = AutomationRuleSchema.safeParse(ruleWithoutFilters);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.filters).toEqual([]);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: automations-filters-dates, Property 1: CardFilter schema round-trip validation
// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6**
describe('Property 1: CardFilter schema round-trip validation', () => {
  const idArb = fc.string({ minLength: 1, maxLength: 50 });
  const filterUnitArb = fc.constantFrom('days', 'working_days');
  const positiveIntArb = fc.integer({ min: 1, max: 1000 });

  // Arbitraries for each filter type
  const sectionFilterArb = fc.oneof(
    fc.record({
      type: fc.constant('in_section' as const),
      sectionId: idArb,
    }),
    fc.record({
      type: fc.constant('not_in_section' as const),
      sectionId: idArb,
    }),
  );

  const simpleDateFilterArb = fc.constantFrom(
    'has_due_date',
    'no_due_date',
    'is_overdue',
    'due_today',
    'due_tomorrow',
    'due_this_week',
    'due_next_week',
    'due_this_month',
    'due_next_month',
    'not_due_today',
    'not_due_tomorrow',
    'not_due_this_week',
    'not_due_next_week',
    'not_due_this_month',
    'not_due_next_month',
  ).map((type) => ({ type }));

  const comparisonFilterArb = fc.oneof(
    fc.record({
      type: fc.constant('due_in_less_than' as const),
      value: positiveIntArb,
      unit: filterUnitArb,
    }),
    fc.record({
      type: fc.constant('due_in_more_than' as const),
      value: positiveIntArb,
      unit: filterUnitArb,
    }),
    fc.record({
      type: fc.constant('due_in_exactly' as const),
      value: positiveIntArb,
      unit: filterUnitArb,
    }),
  );

  const betweenFilterArb = fc
    .tuple(positiveIntArb, positiveIntArb)
    .map(([a, b]) => {
      const minValue = Math.min(a, b);
      const maxValue = Math.max(a, b);
      return { minValue, maxValue };
    })
    .chain(({ minValue, maxValue }) =>
      fc.record({
        type: fc.constant('due_in_between' as const),
        minValue: fc.constant(minValue),
        maxValue: fc.constant(maxValue),
        unit: filterUnitArb,
      }),
    );

  const cardFilterArb = fc.oneof(
    sectionFilterArb,
    simpleDateFilterArb,
    comparisonFilterArb,
    betweenFilterArb,
  );

  it('for any valid CardFilter object, parsing and re-parsing produces an equivalent object', () => {
    fc.assert(
      fc.property(cardFilterArb, (filter) => {
        // Parse the generated filter
        const parsed1 = CardFilterSchema.parse(filter);

        // Serialize to JSON and parse again
        const json = JSON.stringify(parsed1);
        const deserialized = JSON.parse(json);
        const parsed2 = CardFilterSchema.parse(deserialized);

        // Both parsed objects should be equivalent
        expect(parsed2).toEqual(parsed1);
      }),
      { numRuns: 100 },
    );
  });

  it('for any section filter without sectionId, the schema rejects it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('in_section', 'not_in_section'),
        (type) => {
          const invalidFilter = { type };
          const result = CardFilterSchema.safeParse(invalidFilter);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any section filter with empty sectionId, the schema rejects it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('in_section', 'not_in_section'),
        (type) => {
          const invalidFilter = { type, sectionId: '' };
          const result = CardFilterSchema.safeParse(invalidFilter);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any comparison filter without value or unit, the schema rejects it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('due_in_less_than', 'due_in_more_than', 'due_in_exactly'),
        (type) => {
          const invalidFilter1 = { type };
          const invalidFilter2 = { type, value: 5 };
          const invalidFilter3 = { type, unit: 'days' };

          expect(CardFilterSchema.safeParse(invalidFilter1).success).toBe(false);
          expect(CardFilterSchema.safeParse(invalidFilter2).success).toBe(false);
          expect(CardFilterSchema.safeParse(invalidFilter3).success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any comparison filter with non-positive value, the schema rejects it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('due_in_less_than', 'due_in_more_than', 'due_in_exactly'),
        fc.integer({ max: 0 }),
        filterUnitArb,
        (type, value, unit) => {
          const invalidFilter = { type, value, unit };
          const result = CardFilterSchema.safeParse(invalidFilter);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any comparison filter with invalid unit, the schema rejects it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('due_in_less_than', 'due_in_more_than', 'due_in_exactly'),
        positiveIntArb,
        fc.string().filter((s) => s !== 'days' && s !== 'working_days'),
        (type, value, unit) => {
          const invalidFilter = { type, value, unit };
          const result = CardFilterSchema.safeParse(invalidFilter);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any between filter without minValue, maxValue, or unit, the schema rejects it', () => {
    const invalidFilter1 = { type: 'due_in_between' };
    const invalidFilter2 = { type: 'due_in_between', minValue: 1, maxValue: 5 };
    const invalidFilter3 = { type: 'due_in_between', minValue: 1, unit: 'days' };
    const invalidFilter4 = { type: 'due_in_between', maxValue: 5, unit: 'days' };

    expect(CardFilterSchema.safeParse(invalidFilter1).success).toBe(false);
    expect(CardFilterSchema.safeParse(invalidFilter2).success).toBe(false);
    expect(CardFilterSchema.safeParse(invalidFilter3).success).toBe(false);
    expect(CardFilterSchema.safeParse(invalidFilter4).success).toBe(false);
  });

  it('for any between filter with minValue > maxValue, the schema rejects it', () => {
    fc.assert(
      fc.property(
        positiveIntArb,
        positiveIntArb,
        filterUnitArb,
        (a, b, unit) => {
          // Ensure minValue > maxValue
          const minValue = Math.max(a, b);
          const maxValue = Math.min(a, b);
          
          // Skip if they're equal (valid case)
          fc.pre(minValue > maxValue);

          const invalidFilter = {
            type: 'due_in_between' as const,
            minValue,
            maxValue,
            unit,
          };
          const result = CardFilterSchema.safeParse(invalidFilter);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any between filter with minValue <= maxValue, the schema accepts it', () => {
    fc.assert(
      fc.property(betweenFilterArb, (filter) => {
        const result = CardFilterSchema.safeParse(filter);
        expect(result.success).toBe(true);
        if (result.success && result.data.type === 'due_in_between') {
          expect(result.data.minValue).toBeLessThanOrEqual(result.data.maxValue);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('for any filter with invalid type, the schema rejects it', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !CardFilterTypeSchema.safeParse(s).success),
        (invalidType) => {
          const invalidFilter = { type: invalidType };
          const result = CardFilterSchema.safeParse(invalidFilter);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: automations-polish, Property 3: Execution log entry schema round-trip
// **Validates: Requirements 4.1, 4.2**
describe('Property 3: Execution log entry schema round-trip', () => {
  const idArb = fc.string({ minLength: 1, maxLength: 50 });
  const isoDateTimeArb = fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map((d) => d.toISOString());

  const executionLogEntryArb = fc.record({
    timestamp: isoDateTimeArb,
    triggerDescription: fc.string({ minLength: 0, maxLength: 300 }),
    actionDescription: fc.string({ minLength: 0, maxLength: 300 }),
    taskName: fc.string({ minLength: 0, maxLength: 300 }),
  });

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

  const relativeDateOptionArb = fc.constantFrom('today', 'tomorrow', 'next_working_day');
  const positionArb = fc.constantFrom('top', 'bottom');

  const triggerArb = fc.record({
    type: triggerTypeArb,
    sectionId: fc.oneof(idArb, fc.constant(null)),
  });

  const actionArb = fc.record({
    type: actionTypeArb,
    sectionId: fc.oneof(idArb, fc.constant(null)),
    dateOption: fc.oneof(relativeDateOptionArb, fc.constant(null)),
    position: fc.oneof(positionArb, fc.constant(null)),
    cardTitle: fc.oneof(fc.string({ minLength: 1, maxLength: 200 }), fc.constant(null)),
    cardDateOption: fc.oneof(relativeDateOptionArb, fc.constant(null)),
    specificMonth: fc.oneof(fc.integer({ min: 1, max: 12 }), fc.constant(null)),
    specificDay: fc.oneof(fc.integer({ min: 1, max: 31 }), fc.constant(null)),
    monthTarget: fc.oneof(fc.constantFrom('this_month', 'next_month'), fc.constant(null)),
  });

  const simpleFilterArb = fc.oneof(
    fc.record({ type: fc.constant('has_due_date' as const) }),
    fc.record({ type: fc.constant('in_section' as const), sectionId: idArb }),
  );

  const automationRuleWithExecutionsArb = fc.record({
    id: idArb,
    projectId: idArb,
    name: fc.string({ minLength: 1, maxLength: 200 }),
    trigger: triggerArb,
    filters: fc.array(simpleFilterArb, { maxLength: 3 }),
    action: actionArb,
    enabled: fc.boolean(),
    brokenReason: fc.oneof(fc.string({ minLength: 1, maxLength: 100 }), fc.constant(null)),
    executionCount: fc.nat(),
    lastExecutedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
    recentExecutions: fc.array(executionLogEntryArb, { minLength: 1, maxLength: 20 }),
    order: fc.integer(),
    createdAt: isoDateTimeArb,
    updatedAt: isoDateTimeArb,
  });

  it('for any valid ExecutionLogEntry, parsing, serializing to JSON, and parsing again produces an equivalent object', () => {
    fc.assert(
      fc.property(executionLogEntryArb, (entry) => {
        const parsed1 = ExecutionLogEntrySchema.parse(entry);
        const json = JSON.stringify(parsed1);
        const deserialized = JSON.parse(json);
        const parsed2 = ExecutionLogEntrySchema.parse(deserialized);

        expect(parsed2).toEqual(parsed1);
      }),
      { numRuns: 100 },
    );
  });

  it('for any AutomationRule with recentExecutions, the full AutomationRuleSchema round-trip preserves all entries', () => {
    fc.assert(
      fc.property(automationRuleWithExecutionsArb, (rule) => {
        const parsed1 = AutomationRuleSchema.parse(rule);
        const json = JSON.stringify(parsed1);
        const deserialized = JSON.parse(json);
        const parsed2 = AutomationRuleSchema.parse(deserialized);

        expect(parsed2).toEqual(parsed1);
        expect(parsed2.recentExecutions).toEqual(parsed1.recentExecutions);
        expect(parsed2.recentExecutions.length).toBe(rule.recentExecutions.length);
      }),
      { numRuns: 100 },
    );
  });
});
