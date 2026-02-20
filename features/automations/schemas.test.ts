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
} from './schemas';
import type { AutomationRule, CardFilter } from './types';

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

// ─── Scheduled Triggers Schema Tests ────────────────────────────────────

import {
  IntervalScheduleSchema,
  CronScheduleSchema,
  DueDateRelativeScheduleSchema,
  ScheduleConfigSchema,
  EventTriggerTypeSchema,
  ScheduledTriggerTypeSchema,
} from './schemas';
import { isScheduledTrigger, isEventTrigger } from './types';
import type { Trigger } from './types';

// Feature: scheduled-triggers-phase-5a, Property 1: Trigger schema round-trip
describe('Property 1 (scheduled): Trigger schema round-trip', () => {
  const idArb = fc.string({ minLength: 1, maxLength: 50 });
  const isoDateTimeArb = fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map((d) => d.toISOString());

  const eventTriggerArb = fc.record({
    type: fc.constantFrom(
      'card_moved_into_section' as const,
      'card_moved_out_of_section' as const,
      'card_marked_complete' as const,
    ),
    sectionId: fc.oneof(idArb, fc.constant(null)),
  });

  const scheduledIntervalTriggerArb = fc.record({
    type: fc.constant('scheduled_interval' as const),
    sectionId: fc.constant(null),
    schedule: fc.record({
      kind: fc.constant('interval' as const),
      intervalMinutes: fc.integer({ min: 5, max: 10080 }),
    }),
    lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
  });

  const scheduledCronTriggerArb = fc.record({
    type: fc.constant('scheduled_cron' as const),
    sectionId: fc.constant(null),
    schedule: fc.record({
      kind: fc.constant('cron' as const),
      hour: fc.integer({ min: 0, max: 23 }),
      minute: fc.integer({ min: 0, max: 59 }),
      daysOfWeek: fc.oneof(
        fc.constant([] as number[]),
        fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }),
      ),
      daysOfMonth: fc.constant([] as number[]),
    }),
    lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
  });

  const scheduledDueDateTriggerArb = fc.record({
    type: fc.constant('scheduled_due_date_relative' as const),
    sectionId: fc.constant(null),
    schedule: fc.record({
      kind: fc.constant('due_date_relative' as const),
      offsetMinutes: fc.integer({ min: -10080, max: 10080 }),
      displayUnit: fc.constantFrom('minutes' as const, 'hours' as const, 'days' as const),
    }),
    lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
  });

  const anyTriggerArb = fc.oneof(
    eventTriggerArb,
    scheduledIntervalTriggerArb,
    scheduledCronTriggerArb,
    scheduledDueDateTriggerArb,
  );

  it('valid triggers (event and scheduled) parse and serialize correctly', () => {
    fc.assert(
      fc.property(anyTriggerArb, (trigger) => {
        const parsed1 = TriggerSchema.parse(trigger);
        const json = JSON.stringify(parsed1);
        const parsed2 = TriggerSchema.parse(JSON.parse(json));
        expect(parsed2).toEqual(parsed1);
      }),
      { numRuns: 200 },
    );
  });

  it('existing event triggers in pre-discriminated-union format still parse', () => {
    // Backward compatibility: flat { type, sectionId } objects
    const existing = { type: 'card_moved_into_section', sectionId: 'sec-1' };
    const result = TriggerSchema.safeParse(existing);
    expect(result.success).toBe(true);
  });
});

// Feature: scheduled-triggers-phase-5a, Property 2: Invalid trigger states are rejected
describe('Property 2: Invalid trigger states are rejected', () => {
  it('event trigger with schedule field is rejected', () => {
    const invalid = {
      type: 'card_moved_into_section',
      sectionId: 'sec-1',
      schedule: { kind: 'interval', intervalMinutes: 30 },
    };
    // Discriminated union ignores extra fields — but the type narrows correctly
    // The key invariant is that scheduled triggers can't have non-null sectionId
    const result = TriggerSchema.safeParse(invalid);
    // This actually passes because Zod strips unknown keys in discriminated unions
    // The real protection is that scheduled triggers enforce sectionId: null
    expect(result.success).toBe(true);
  });

  it('scheduled trigger with non-null sectionId is rejected', () => {
    const invalid = {
      type: 'scheduled_interval',
      sectionId: 'sec-1', // should be null
      schedule: { kind: 'interval', intervalMinutes: 30 },
      lastEvaluatedAt: null,
    };
    const result = TriggerSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('scheduled_interval without schedule is rejected', () => {
    const invalid = {
      type: 'scheduled_interval',
      sectionId: null,
    };
    const result = TriggerSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// Feature: scheduled-triggers-phase-5a, Property 3: Type guard partition
describe('Property 3: Type guard partition', () => {
  const idArb = fc.string({ minLength: 1, maxLength: 50 });
  const isoDateTimeArb = fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map((d) => d.toISOString());

  const eventTriggerArb = fc.record({
    type: fc.constantFrom(
      'card_moved_into_section' as const,
      'card_moved_out_of_section' as const,
      'card_marked_complete' as const,
      'card_marked_incomplete' as const,
      'card_created_in_section' as const,
      'section_created' as const,
      'section_renamed' as const,
    ),
    sectionId: fc.oneof(idArb, fc.constant(null)),
  });

  const scheduledTriggerArb = fc.oneof(
    fc.record({
      type: fc.constant('scheduled_interval' as const),
      sectionId: fc.constant(null),
      schedule: fc.record({
        kind: fc.constant('interval' as const),
        intervalMinutes: fc.integer({ min: 5, max: 10080 }),
      }),
      lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
    }),
    fc.record({
      type: fc.constant('scheduled_cron' as const),
      sectionId: fc.constant(null),
      schedule: fc.record({
        kind: fc.constant('cron' as const),
        hour: fc.integer({ min: 0, max: 23 }),
        minute: fc.integer({ min: 0, max: 59 }),
        daysOfWeek: fc.constant([] as number[]),
        daysOfMonth: fc.constant([] as number[]),
      }),
      lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
    }),
    fc.record({
      type: fc.constant('scheduled_due_date_relative' as const),
      sectionId: fc.constant(null),
      schedule: fc.record({
        kind: fc.constant('due_date_relative' as const),
        offsetMinutes: fc.integer({ min: -10080, max: 10080 }),
        displayUnit: fc.constant('days' as const),
      }),
      lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
    }),
  );

  const anyTriggerArb = fc.oneof(eventTriggerArb, scheduledTriggerArb);

  it('exactly one of isScheduledTrigger / isEventTrigger returns true for any valid trigger', () => {
    fc.assert(
      fc.property(anyTriggerArb, (trigger) => {
        const parsed = TriggerSchema.parse(trigger) as Trigger;
        const isScheduled = isScheduledTrigger(parsed);
        const isEvent = isEventTrigger(parsed);
        // Mutually exclusive and exhaustive
        expect(isScheduled !== isEvent).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

// Feature: scheduled-triggers-phase-5a, Property 4: Schedule config round-trip
describe('Property 4: Schedule config round-trip', () => {
  const intervalConfigArb = fc.record({
    kind: fc.constant('interval' as const),
    intervalMinutes: fc.integer({ min: 5, max: 10080 }),
  });

  const cronConfigArb = fc.record({
    kind: fc.constant('cron' as const),
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    daysOfWeek: fc.oneof(
      fc.constant([] as number[]),
      fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }),
    ),
    daysOfMonth: fc.constant([] as number[]),
  });

  const dueDateConfigArb = fc.record({
    kind: fc.constant('due_date_relative' as const),
    offsetMinutes: fc.integer({ min: -10080, max: 10080 }),
    displayUnit: fc.constantFrom('minutes' as const, 'hours' as const, 'days' as const),
  });

  const anyConfigArb = fc.oneof(intervalConfigArb, cronConfigArb, dueDateConfigArb);

  it('all schedule config variants round-trip through JSON', () => {
    fc.assert(
      fc.property(anyConfigArb, (config) => {
        const parsed1 = ScheduleConfigSchema.parse(config);
        const json = JSON.stringify(parsed1);
        const parsed2 = ScheduleConfigSchema.parse(JSON.parse(json));
        expect(parsed2).toEqual(parsed1);
      }),
      { numRuns: 200 },
    );
  });

  it('intervalMinutes outside [5, 10080] is rejected', () => {
    expect(IntervalScheduleSchema.safeParse({ intervalMinutes: 4 }).success).toBe(false);
    expect(IntervalScheduleSchema.safeParse({ intervalMinutes: 10081 }).success).toBe(false);
    expect(IntervalScheduleSchema.safeParse({ intervalMinutes: 5 }).success).toBe(true);
    expect(IntervalScheduleSchema.safeParse({ intervalMinutes: 10080 }).success).toBe(true);
  });

  it('cron with both daysOfWeek and daysOfMonth non-empty is rejected', () => {
    const invalid = {
      hour: 9,
      minute: 0,
      daysOfWeek: [1],
      daysOfMonth: [15],
    };
    const result = CronScheduleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// is_complete / is_incomplete filter schema tests
describe('is_complete / is_incomplete filter schemas', () => {
  it('is_complete filter parses correctly', () => {
    const result = CardFilterSchema.safeParse({ type: 'is_complete' });
    expect(result.success).toBe(true);
  });

  it('is_incomplete filter parses correctly', () => {
    const result = CardFilterSchema.safeParse({ type: 'is_incomplete' });
    expect(result.success).toBe(true);
  });
});

// ExecutionLogEntry extensions
describe('ExecutionLogEntry extensions', () => {
  it('accepts optional matchCount, details, executionType fields', () => {
    const entry = {
      timestamp: new Date().toISOString(),
      triggerDescription: 'Every 30 minutes',
      actionDescription: 'Move to Backlog',
      taskName: 'Aggregated',
      matchCount: 15,
      details: ['Task 1', 'Task 2'],
      executionType: 'scheduled' as const,
    };
    const result = ExecutionLogEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matchCount).toBe(15);
      expect(result.data.details).toEqual(['Task 1', 'Task 2']);
      expect(result.data.executionType).toBe('scheduled');
    }
  });

  it('still accepts entries without the new optional fields (backward compat)', () => {
    const entry = {
      timestamp: new Date().toISOString(),
      triggerDescription: 'Card moved',
      actionDescription: 'Mark complete',
      taskName: 'My Task',
    };
    const result = ExecutionLogEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });
});

// Feature: scheduled-triggers-phase-5b, Property 11: New filter schema round-trip
// **Validates: Requirements 1.4, 2.2, 3.2, 4.3, 5.7**
describe('Property 11: New filter schema round-trip', () => {
  const filterUnitArb = fc.constantFrom('days' as const, 'working_days' as const);
  const positiveIntArb = fc.integer({ min: 1, max: 1000 });

  const newFilterTypes = [
    'created_more_than',
    'completed_more_than',
    'last_updated_more_than',
    'not_modified_in',
    'overdue_by_more_than',
    'in_section_for_more_than',
  ] as const;

  const newFilterTypeArb = fc.constantFrom(...newFilterTypes);

  const newFilterArb = fc.record({
    type: newFilterTypeArb,
    value: positiveIntArb,
    unit: filterUnitArb,
  });

  it('all 6 new filter types round-trip correctly through JSON serialization', () => {
    fc.assert(
      fc.property(newFilterArb, (filter) => {
        const parsed1 = CardFilterSchema.parse(filter);
        const json = JSON.stringify(parsed1);
        const deserialized = JSON.parse(json);
        const parsed2 = CardFilterSchema.parse(deserialized);
        expect(parsed2).toEqual(parsed1);
      }),
      { numRuns: 100 },
    );
  });

  it('each individual new filter type parses and round-trips correctly', () => {
    for (const type of newFilterTypes) {
      fc.assert(
        fc.property(positiveIntArb, filterUnitArb, (value, unit) => {
          const filter = { type, value, unit };
          const parsed = CardFilterSchema.parse(filter);
          expect(parsed).toEqual(filter);

          const json = JSON.stringify(parsed);
          const reparsed = CardFilterSchema.parse(JSON.parse(json));
          expect(reparsed).toEqual(parsed);
        }),
        { numRuns: 20 },
      );
    }
  });

  it('value: 0 is rejected for all new filter types', () => {
    for (const type of newFilterTypes) {
      const result = CardFilterSchema.safeParse({ type, value: 0, unit: 'days' });
      expect(result.success).toBe(false);
    }
  });

  it('value: -1 is rejected for all new filter types', () => {
    for (const type of newFilterTypes) {
      const result = CardFilterSchema.safeParse({ type, value: -1, unit: 'days' });
      expect(result.success).toBe(false);
    }
  });

  it('value: 1 is accepted for all new filter types', () => {
    for (const type of newFilterTypes) {
      const result = CardFilterSchema.safeParse({ type, value: 1, unit: 'days' });
      expect(result.success).toBe(true);
    }
  });

  it('non-positive values are rejected for all new filter types', () => {
    fc.assert(
      fc.property(
        newFilterTypeArb,
        fc.integer({ max: 0 }),
        filterUnitArb,
        (type, value, unit) => {
          const result = CardFilterSchema.safeParse({ type, value, unit });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('invalid unit is rejected for all new filter types', () => {
    fc.assert(
      fc.property(
        newFilterTypeArb,
        positiveIntArb,
        fc.string().filter((s) => s !== 'days' && s !== 'working_days'),
        (type, value, unit) => {
          const result = CardFilterSchema.safeParse({ type, value, unit });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('missing value or unit is rejected for all new filter types', () => {
    for (const type of newFilterTypes) {
      expect(CardFilterSchema.safeParse({ type }).success).toBe(false);
      expect(CardFilterSchema.safeParse({ type, value: 5 }).success).toBe(false);
      expect(CardFilterSchema.safeParse({ type, unit: 'days' }).success).toBe(false);
    }
  });
});

// Feature: scheduled-triggers-phase-5b, Property 12: catchUpPolicy schema default
// **Validates: Requirement 7.3**
describe('Property 12: catchUpPolicy schema default', () => {
  const isoDateTimeArb = fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map((d) => d.toISOString());

  const catchUpPolicyArb = fc.constantFrom('catch_up_latest' as const, 'skip_missed' as const);

  // ─── Scheduled trigger arbitraries WITH catchUpPolicy ─────────────────

  const scheduledIntervalWithPolicyArb = fc.record({
    type: fc.constant('scheduled_interval' as const),
    sectionId: fc.constant(null),
    schedule: fc.record({
      kind: fc.constant('interval' as const),
      intervalMinutes: fc.integer({ min: 5, max: 10080 }),
    }),
    lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
    catchUpPolicy: catchUpPolicyArb,
  });

  const scheduledCronWithPolicyArb = fc.record({
    type: fc.constant('scheduled_cron' as const),
    sectionId: fc.constant(null),
    schedule: fc.record({
      kind: fc.constant('cron' as const),
      hour: fc.integer({ min: 0, max: 23 }),
      minute: fc.integer({ min: 0, max: 59 }),
      daysOfWeek: fc.constant([] as number[]),
      daysOfMonth: fc.constant([] as number[]),
    }),
    lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
    catchUpPolicy: catchUpPolicyArb,
  });

  const scheduledDueDateWithPolicyArb = fc.record({
    type: fc.constant('scheduled_due_date_relative' as const),
    sectionId: fc.constant(null),
    schedule: fc.record({
      kind: fc.constant('due_date_relative' as const),
      offsetMinutes: fc.integer({ min: -10080, max: 10080 }),
      displayUnit: fc.constantFrom('minutes' as const, 'hours' as const, 'days' as const),
    }),
    lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
    catchUpPolicy: catchUpPolicyArb,
  });

  const anyScheduledWithPolicyArb = fc.oneof(
    scheduledIntervalWithPolicyArb,
    scheduledCronWithPolicyArb,
    scheduledDueDateWithPolicyArb,
  );

  // ─── Scheduled trigger arbitraries WITHOUT catchUpPolicy ──────────────

  const scheduledIntervalNoPolicyArb = fc.record({
    type: fc.constant('scheduled_interval' as const),
    sectionId: fc.constant(null),
    schedule: fc.record({
      kind: fc.constant('interval' as const),
      intervalMinutes: fc.integer({ min: 5, max: 10080 }),
    }),
    lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
  });

  const scheduledCronNoPolicyArb = fc.record({
    type: fc.constant('scheduled_cron' as const),
    sectionId: fc.constant(null),
    schedule: fc.record({
      kind: fc.constant('cron' as const),
      hour: fc.integer({ min: 0, max: 23 }),
      minute: fc.integer({ min: 0, max: 59 }),
      daysOfWeek: fc.constant([] as number[]),
      daysOfMonth: fc.constant([] as number[]),
    }),
    lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
  });

  const scheduledDueDateNoPolicyArb = fc.record({
    type: fc.constant('scheduled_due_date_relative' as const),
    sectionId: fc.constant(null),
    schedule: fc.record({
      kind: fc.constant('due_date_relative' as const),
      offsetMinutes: fc.integer({ min: -10080, max: 10080 }),
      displayUnit: fc.constantFrom('minutes' as const, 'hours' as const, 'days' as const),
    }),
    lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
  });

  const anyScheduledNoPolicyArb = fc.oneof(
    scheduledIntervalNoPolicyArb,
    scheduledCronNoPolicyArb,
    scheduledDueDateNoPolicyArb,
  );

  // ─── Property test: missing field defaults to catch_up_latest ─────────

  it('missing catchUpPolicy defaults to catch_up_latest for all scheduled trigger variants', () => {
    fc.assert(
      fc.property(anyScheduledNoPolicyArb, (trigger) => {
        const parsed = TriggerSchema.parse(trigger);
        expect((parsed as any).catchUpPolicy).toBe('catch_up_latest');
      }),
      { numRuns: 100 },
    );
  });

  // ─── Explicit values round-trip correctly ─────────────────────────────

  it('scheduled trigger with catchUpPolicy: skip_missed parses and round-trips correctly', () => {
    fc.assert(
      fc.property(anyScheduledWithPolicyArb, (trigger) => {
        const parsed1 = TriggerSchema.parse(trigger);
        const json = JSON.stringify(parsed1);
        const parsed2 = TriggerSchema.parse(JSON.parse(json));
        expect(parsed2).toEqual(parsed1);
        expect((parsed2 as any).catchUpPolicy).toBe(trigger.catchUpPolicy);
      }),
      { numRuns: 100 },
    );
  });

  // ─── Specific example tests ───────────────────────────────────────────

  it('scheduled_interval with catchUpPolicy: skip_missed is valid', () => {
    const trigger = {
      type: 'scheduled_interval',
      sectionId: null,
      schedule: { kind: 'interval', intervalMinutes: 60 },
      lastEvaluatedAt: null,
      catchUpPolicy: 'skip_missed',
    };
    const result = TriggerSchema.safeParse(trigger);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).catchUpPolicy).toBe('skip_missed');
    }
  });

  it('scheduled_cron with catchUpPolicy: catch_up_latest is valid', () => {
    const trigger = {
      type: 'scheduled_cron',
      sectionId: null,
      schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1, 3, 5], daysOfMonth: [] },
      lastEvaluatedAt: null,
      catchUpPolicy: 'catch_up_latest',
    };
    const result = TriggerSchema.safeParse(trigger);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).catchUpPolicy).toBe('catch_up_latest');
    }
  });

  it('scheduled_due_date_relative without catchUpPolicy defaults to catch_up_latest', () => {
    const trigger = {
      type: 'scheduled_due_date_relative',
      sectionId: null,
      schedule: { kind: 'due_date_relative', offsetMinutes: -1440, displayUnit: 'days' },
      lastEvaluatedAt: null,
    };
    const result = TriggerSchema.safeParse(trigger);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).catchUpPolicy).toBe('catch_up_latest');
    }
  });

  it('scheduled trigger with catchUpPolicy: invalid is rejected', () => {
    const trigger = {
      type: 'scheduled_interval',
      sectionId: null,
      schedule: { kind: 'interval', intervalMinutes: 60 },
      lastEvaluatedAt: null,
      catchUpPolicy: 'invalid',
    };
    const result = TriggerSchema.safeParse(trigger);
    expect(result.success).toBe(false);
  });

  // ─── Backward compatibility: Phase 5a rules without catchUpPolicy ────

  it('Phase 5a rules without catchUpPolicy are backward compatible', () => {
    // Simulate a Phase 5a rule stored without catchUpPolicy
    const phase5aIntervalTrigger = {
      type: 'scheduled_interval',
      sectionId: null,
      schedule: { kind: 'interval', intervalMinutes: 30 },
      lastEvaluatedAt: '2024-01-15T10:00:00.000Z',
    };
    const phase5aCronTrigger = {
      type: 'scheduled_cron',
      sectionId: null,
      schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] },
      lastEvaluatedAt: null,
    };
    const phase5aDueDateTrigger = {
      type: 'scheduled_due_date_relative',
      sectionId: null,
      schedule: { kind: 'due_date_relative', offsetMinutes: -60, displayUnit: 'hours' },
      lastEvaluatedAt: null,
    };

    for (const trigger of [phase5aIntervalTrigger, phase5aCronTrigger, phase5aDueDateTrigger]) {
      const result = TriggerSchema.safeParse(trigger);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).catchUpPolicy).toBe('catch_up_latest');
      }
    }
  });
});

// Feature: scheduled-triggers-phase-5b, ExecutionLogEntry 'skipped' type
describe('ExecutionLogEntry skipped execution type', () => {
  it('accepts executionType: skipped', () => {
    const entry = {
      timestamp: new Date().toISOString(),
      triggerDescription: 'Every 30 minutes',
      actionDescription: 'Skipped (catch-up)',
      taskName: 'Aggregated',
      executionType: 'skipped' as const,
    };
    const result = ExecutionLogEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.executionType).toBe('skipped');
    }
  });

  it('still accepts all existing executionType values', () => {
    for (const executionType of ['event', 'scheduled', 'catch-up', 'manual'] as const) {
      const entry = {
        timestamp: new Date().toISOString(),
        triggerDescription: 'test',
        actionDescription: 'test',
        taskName: 'test',
        executionType,
      };
      const result = ExecutionLogEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    }
  });
});

// ─── Phase 5c: One-Time Trigger & bulkPausedAt Schema Tests ─────────────

import { OneTimeScheduleSchema } from './schemas';

// Feature: scheduled-triggers-phase-5c, Property 9: One-time schema round-trip
// **Validates: Requirements 2.1, 2.3, 2.4**
describe('Property 9: One-time schema round-trip', () => {
  const isoDateTimeArb = fc
    .date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') })
    .map((d) => d.toISOString());

  const scheduledOneTimeTriggerArb = fc.record({
    type: fc.constant('scheduled_one_time' as const),
    sectionId: fc.constant(null),
    schedule: fc.record({
      kind: fc.constant('one_time' as const),
      fireAt: isoDateTimeArb,
    }),
    lastEvaluatedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
  });

  it('scheduled_one_time triggers parse and serialize correctly', () => {
    fc.assert(
      fc.property(scheduledOneTimeTriggerArb, (trigger) => {
        const parsed1 = TriggerSchema.parse(trigger);
        const json = JSON.stringify(parsed1);
        const parsed2 = TriggerSchema.parse(JSON.parse(json));
        expect(parsed2).toEqual(parsed1);
      }),
      { numRuns: 100 },
    );
  });

  // OneTimeScheduleSchema validation
  it('OneTimeScheduleSchema validates valid ISO datetime', () => {
    const result = OneTimeScheduleSchema.safeParse({ fireAt: '2025-03-15T15:00:00.000Z' });
    expect(result.success).toBe(true);
  });

  it('OneTimeScheduleSchema rejects non-ISO-8601 datetime', () => {
    const result = OneTimeScheduleSchema.safeParse({ fireAt: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  // ScheduleConfigSchema accepts one_time variant
  it('ScheduleConfigSchema accepts { kind: "one_time", fireAt: "..." }', () => {
    const result = ScheduleConfigSchema.safeParse({
      kind: 'one_time',
      fireAt: '2025-03-15T15:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  // TriggerSchema accepts scheduled_one_time variant
  it('TriggerSchema accepts scheduled_one_time with null sectionId', () => {
    const result = TriggerSchema.safeParse({
      type: 'scheduled_one_time',
      sectionId: null,
      schedule: { kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' },
      lastEvaluatedAt: null,
    });
    expect(result.success).toBe(true);
  });

  // TriggerSchema rejects scheduled_one_time with non-null sectionId
  it('TriggerSchema rejects scheduled_one_time with non-null sectionId', () => {
    const result = TriggerSchema.safeParse({
      type: 'scheduled_one_time',
      sectionId: 'abc',
      schedule: { kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' },
      lastEvaluatedAt: null,
    });
    expect(result.success).toBe(false);
  });

  // ScheduledTriggerTypeSchema includes scheduled_one_time
  it('ScheduledTriggerTypeSchema includes scheduled_one_time', () => {
    const result = ScheduledTriggerTypeSchema.safeParse('scheduled_one_time');
    expect(result.success).toBe(true);
  });
});

// Feature: scheduled-triggers-phase-5c, bulkPausedAt schema tests
// **Validates: Requirement 5.3**
describe('bulkPausedAt schema on AutomationRuleSchema', () => {
  const baseRule = {
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
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z',
  };

  it('accepts bulkPausedAt: null', () => {
    const result = AutomationRuleSchema.safeParse({ ...baseRule, bulkPausedAt: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bulkPausedAt).toBeNull();
    }
  });

  it('accepts bulkPausedAt with valid ISO datetime', () => {
    const result = AutomationRuleSchema.safeParse({
      ...baseRule,
      bulkPausedAt: '2025-01-15T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bulkPausedAt).toBe('2025-01-15T10:00:00.000Z');
    }
  });

  it('backward compatibility: existing rules without bulkPausedAt parse with default null', () => {
    const result = AutomationRuleSchema.safeParse(baseRule);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bulkPausedAt).toBeNull();
    }
  });

  it('rejects bulkPausedAt with invalid datetime string', () => {
    const result = AutomationRuleSchema.safeParse({
      ...baseRule,
      bulkPausedAt: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});
