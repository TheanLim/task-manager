import type { z } from 'zod';
import type {
  AutomationRuleSchema,
  TriggerTypeSchema,
  ActionTypeSchema,
  RelativeDateOptionSchema,
  TriggerSchema,
  ActionSchema,
} from './schemas';
import type { Task, Section } from '@/lib/schemas';

// Re-export schema-inferred types
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;
export type TriggerType = z.infer<typeof TriggerTypeSchema>;
export type ActionType = z.infer<typeof ActionTypeSchema>;
export type RelativeDateOption = z.infer<typeof RelativeDateOptionSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type Action = z.infer<typeof ActionSchema>;

/**
 * Domain event emitted by the service layer after a mutation occurs.
 * Used by the automation engine to trigger rule evaluation.
 */
export interface DomainEvent {
  /** Event type: task.created, task.updated, or task.deleted */
  type: 'task.created' | 'task.updated' | 'task.deleted';
  /** ID of the affected entity */
  entityId: string;
  /** Project scope */
  projectId: string;
  /** New field values after the mutation */
  changes: Record<string, unknown>;
  /** Old field values before the mutation */
  previousValues: Record<string, unknown>;
  /** Rule ID if this event was triggered by an automation (undefined for user-initiated) */
  triggeredByRule?: string;
  /** Cascade depth (0 = user-initiated, increments with each automation-triggered event) */
  depth: number;
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
