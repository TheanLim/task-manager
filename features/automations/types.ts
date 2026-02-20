import type { z } from 'zod';
import type {
  AutomationRuleSchema,
  TriggerTypeSchema,
  ActionTypeSchema,
  RelativeDateOptionSchema,
  TriggerSchema,
  ActionSchema,
  CardFilterSchema,
  CardFilterTypeSchema,
  ExecutionLogEntrySchema,
  EventTriggerTypeSchema,
  ScheduledTriggerTypeSchema,
  ScheduleConfigSchema,
  IntervalScheduleSchema,
  CronScheduleSchema,
  DueDateRelativeScheduleSchema,
  OneTimeScheduleSchema,
} from './schemas';
import type { Task, Section } from '@/lib/schemas';

// Re-export DomainEvent from the shared events module
export type { DomainEvent } from '@/lib/events/types';

// Re-export schema-inferred types
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;
export type TriggerType = z.infer<typeof TriggerTypeSchema>;
export type ActionType = z.infer<typeof ActionTypeSchema>;
export type RelativeDateOption = z.infer<typeof RelativeDateOptionSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type CardFilter = z.infer<typeof CardFilterSchema>;
export type CardFilterType = z.infer<typeof CardFilterTypeSchema>;
export type ExecutionLogEntry = z.infer<typeof ExecutionLogEntrySchema>;

// New scheduled trigger types
export type EventTriggerType = z.infer<typeof EventTriggerTypeSchema>;
export type ScheduledTriggerType = z.infer<typeof ScheduledTriggerTypeSchema>;
export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>;
export type IntervalSchedule = z.infer<typeof IntervalScheduleSchema>;
export type CronSchedule = z.infer<typeof CronScheduleSchema>;
export type DueDateRelativeSchedule = z.infer<typeof DueDateRelativeScheduleSchema>;
export type OneTimeSchedule = z.infer<typeof OneTimeScheduleSchema>;

// ─── Type Guards ────────────────────────────────────────────────────────

const SCHEDULED_TRIGGER_TYPES: Set<string> = new Set([
  'scheduled_interval',
  'scheduled_cron',
  'scheduled_due_date_relative',
  'scheduled_one_time',
]);

/** Type guard: returns true for scheduled triggers (interval, cron, due-date-relative) */
export function isScheduledTrigger(
  trigger: Trigger
): trigger is Trigger & { schedule: ScheduleConfig; lastEvaluatedAt: string | null } {
  return SCHEDULED_TRIGGER_TYPES.has(trigger.type);
}

/** Type guard: returns true for event triggers (card_moved, card_marked, etc.) */
export function isEventTrigger(
  trigger: Trigger
): trigger is Trigger & { sectionId: string | null } {
  return !SCHEDULED_TRIGGER_TYPES.has(trigger.type);
}

/**
 * In-memory snapshot of the previous state of an entity affected by a rule execution.
 * Enables single-level undo within a 10-second window.
 */
export interface UndoSnapshot {
  ruleId: string;
  ruleName: string;
  actionType: ActionType;
  targetEntityId: string;
  previousState: {
    sectionId?: string;
    order?: number;
    completed?: boolean;
    completedAt?: string | null;
    dueDate?: string | null;
  };
  /** ID of the created card (for create_card undo — delete the created card) */
  createdEntityId?: string;
  /** Previous state of subtasks affected by cascade complete/incomplete */
  subtaskSnapshots?: Array<{
    taskId: string;
    previousState: {
      completed: boolean;
      completedAt: string | null;
    };
  }>;
  /** Date.now() for 10-second expiry check */
  timestamp: number;
}

/**
 * Collects execution results during a synchronous batch of domain events.
 * Used to emit a single aggregated toast per rule instead of individual toasts.
 */
export interface BatchContext {
  executions: Array<{
    ruleId: string;
    ruleName: string;
    taskName: string;
    actionDescription: string;
  }>;
}

/**
 * Action to be executed by the rule executor.
 * Produced by the rule engine when a rule's trigger matches an event.
 */
export interface RuleAction {
  /** ID of the rule that produced this action */
  ruleId: string;
  /** Type of action to execute */
  actionType: ActionType;
  /** ID of the entity to apply the action to */
  targetEntityId: string;
  /** Action-specific parameters */
  params: {
    /** Target section ID for move actions */
    sectionId?: string;
    /** Position for move actions */
    position?: 'top' | 'bottom';
    /** Date option for set_due_date action */
    dateOption?: RelativeDateOption;
    /** Completed state for mark_complete/incomplete actions */
    completed?: boolean;
    /** Specific month (1-12) for specific_date option */
    specificMonth?: number;
    /** Specific day (1-31) for specific_date option */
    specificDay?: number;
    /** Month target for day-of-month and nth-weekday-of-month options */
    monthTarget?: 'this_month' | 'next_month';
    /** Card title for create_card action */
    cardTitle?: string;
    /** Date option for create_card action */
    cardDateOption?: RelativeDateOption;
  };
}

/**
 * Read-only snapshot of application state provided to the rule engine.
 * Used for evaluating trigger conditions and filtering rules.
 */
export interface EvaluationContext {
  /** All tasks in the application */
  allTasks: Task[];
  /** All sections in the application */
  allSections: Section[];
  /** Maximum cascade depth allowed */
  maxDepth: number;
  /** Set of "ruleId:entityId:actionType" strings to prevent duplicate executions */
  executedSet: Set<string>;
}
