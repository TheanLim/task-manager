import { z } from 'zod';

export const TriggerTypeSchema = z.enum([
  'card_moved_into_section',
  'card_moved_out_of_section',
  'card_marked_complete',
  'card_marked_incomplete',
  'card_created_in_section',
  'section_created',
  'section_renamed',
]);

export const ActionTypeSchema = z.enum([
  'move_card_to_top_of_section',
  'move_card_to_bottom_of_section',
  'mark_card_complete',
  'mark_card_incomplete',
  'set_due_date',
  'remove_due_date',
  'create_card',
]);

export const RelativeDateOptionSchema = z.enum([
  // Phase 1 (existing)
  'today',
  'tomorrow',
  'next_working_day',
  // Next weekday (7 options)
  'next_monday',
  'next_tuesday',
  'next_wednesday',
  'next_thursday',
  'next_friday',
  'next_saturday',
  'next_sunday',
  // Next week on X (7 options)
  'next_week_monday',
  'next_week_tuesday',
  'next_week_wednesday',
  'next_week_thursday',
  'next_week_friday',
  'next_week_saturday',
  'next_week_sunday',
  // Day of month (31 + 2 special options)
  'day_of_month_1',
  'day_of_month_2',
  'day_of_month_3',
  'day_of_month_4',
  'day_of_month_5',
  'day_of_month_6',
  'day_of_month_7',
  'day_of_month_8',
  'day_of_month_9',
  'day_of_month_10',
  'day_of_month_11',
  'day_of_month_12',
  'day_of_month_13',
  'day_of_month_14',
  'day_of_month_15',
  'day_of_month_16',
  'day_of_month_17',
  'day_of_month_18',
  'day_of_month_19',
  'day_of_month_20',
  'day_of_month_21',
  'day_of_month_22',
  'day_of_month_23',
  'day_of_month_24',
  'day_of_month_25',
  'day_of_month_26',
  'day_of_month_27',
  'day_of_month_28',
  'day_of_month_29',
  'day_of_month_30',
  'day_of_month_31',
  'last_day_of_month',
  'last_working_day_of_month',
  // Nth weekday of month (5 ordinals × 7 weekdays = 35 options)
  'first_monday_of_month',
  'first_tuesday_of_month',
  'first_wednesday_of_month',
  'first_thursday_of_month',
  'first_friday_of_month',
  'first_saturday_of_month',
  'first_sunday_of_month',
  'second_monday_of_month',
  'second_tuesday_of_month',
  'second_wednesday_of_month',
  'second_thursday_of_month',
  'second_friday_of_month',
  'second_saturday_of_month',
  'second_sunday_of_month',
  'third_monday_of_month',
  'third_tuesday_of_month',
  'third_wednesday_of_month',
  'third_thursday_of_month',
  'third_friday_of_month',
  'third_saturday_of_month',
  'third_sunday_of_month',
  'fourth_monday_of_month',
  'fourth_tuesday_of_month',
  'fourth_wednesday_of_month',
  'fourth_thursday_of_month',
  'fourth_friday_of_month',
  'fourth_saturday_of_month',
  'fourth_sunday_of_month',
  'last_monday_of_month',
  'last_tuesday_of_month',
  'last_wednesday_of_month',
  'last_thursday_of_month',
  'last_friday_of_month',
  'last_saturday_of_month',
  'last_sunday_of_month',
  // Specific date
  'specific_date',
]);

// Card filter schemas
export const CardFilterTypeSchema = z.enum([
  'in_section',
  'not_in_section',
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
  'due_in_less_than',
  'due_in_more_than',
  'due_in_exactly',
  'due_in_between',
]);

export const FilterUnitSchema = z.enum(['days', 'working_days']);

export const MonthTargetSchema = z.enum(['this_month', 'next_month']);

export const CardFilterSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('in_section'), sectionId: z.string().min(1) }),
  z.object({ type: z.literal('not_in_section'), sectionId: z.string().min(1) }),
  z.object({ type: z.literal('has_due_date') }),
  z.object({ type: z.literal('no_due_date') }),
  z.object({ type: z.literal('is_overdue') }),
  z.object({ type: z.literal('due_today') }),
  z.object({ type: z.literal('due_tomorrow') }),
  z.object({ type: z.literal('due_this_week') }),
  z.object({ type: z.literal('due_next_week') }),
  z.object({ type: z.literal('due_this_month') }),
  z.object({ type: z.literal('due_next_month') }),
  z.object({ type: z.literal('not_due_today') }),
  z.object({ type: z.literal('not_due_tomorrow') }),
  z.object({ type: z.literal('not_due_this_week') }),
  z.object({ type: z.literal('not_due_next_week') }),
  z.object({ type: z.literal('not_due_this_month') }),
  z.object({ type: z.literal('not_due_next_month') }),
  z.object({
    type: z.literal('due_in_less_than'),
    value: z.number().int().positive(),
    unit: FilterUnitSchema,
  }),
  z.object({
    type: z.literal('due_in_more_than'),
    value: z.number().int().positive(),
    unit: FilterUnitSchema,
  }),
  z.object({
    type: z.literal('due_in_exactly'),
    value: z.number().int().positive(),
    unit: FilterUnitSchema,
  }),
  z.object({
    type: z.literal('due_in_between'),
    minValue: z.number().int().positive(),
    maxValue: z.number().int().positive(),
    unit: FilterUnitSchema,
  }).refine(
    (data) => data.minValue <= data.maxValue,
    { message: 'minValue must be less than or equal to maxValue' }
  ),
]);

export const TriggerSchema = z.object({
  type: TriggerTypeSchema,
  sectionId: z.string().min(1).nullable(),
});

export const ActionSchema = z.object({
  type: ActionTypeSchema,
  sectionId: z.string().min(1).nullable(),
  dateOption: RelativeDateOptionSchema.nullable(),
  position: z.enum(['top', 'bottom']).nullable(),
  cardTitle: z.string().min(1).max(200).nullable().default(null),
  cardDateOption: RelativeDateOptionSchema.nullable().default(null),
  specificMonth: z.number().int().min(1).max(12).nullable().default(null),
  specificDay: z.number().int().min(1).max(31).nullable().default(null),
  monthTarget: MonthTargetSchema.nullable().default(null),
});

export const AutomationRuleSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1).max(200),
  trigger: TriggerSchema,
  filters: z.array(CardFilterSchema).default([]),
  action: ActionSchema,
  enabled: z.boolean().default(true),
  brokenReason: z.string().nullable().default(null),
  executionCount: z.number().default(0),
  lastExecutedAt: z.string().datetime().nullable().default(null),
  order: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Export inferred types
export type TriggerType = z.infer<typeof TriggerTypeSchema>;
export type ActionType = z.infer<typeof ActionTypeSchema>;
export type RelativeDateOption = z.infer<typeof RelativeDateOptionSchema>;
export type CardFilterType = z.infer<typeof CardFilterTypeSchema>;
export type FilterUnit = z.infer<typeof FilterUnitSchema>;
export type MonthTarget = z.infer<typeof MonthTargetSchema>;
export type CardFilter = z.infer<typeof CardFilterSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;
