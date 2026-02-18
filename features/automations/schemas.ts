import { z } from 'zod';

export const TriggerTypeSchema = z.enum([
  'card_moved_into_section',
  'card_moved_out_of_section',
  'card_marked_complete',
  'card_marked_incomplete',
]);

export const ActionTypeSchema = z.enum([
  'move_card_to_top_of_section',
  'move_card_to_bottom_of_section',
  'mark_card_complete',
  'mark_card_incomplete',
  'set_due_date',
  'remove_due_date',
]);

export const RelativeDateOptionSchema = z.enum([
  'today',
  'tomorrow',
  'next_working_day',
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
});

export const AutomationRuleSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1).max(200),
  trigger: TriggerSchema,
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
export type Trigger = z.infer<typeof TriggerSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;
