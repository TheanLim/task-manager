import type { TaskRepository, SectionRepository } from '@/lib/repositories/types';
import type { AutomationRuleRepository } from '../../repositories/types';
import type { TaskService } from '@/features/tasks/services/taskService';
import type { RuleAction, DomainEvent, ExecutionLogEntry } from '../../types';
import type { Clock } from '../scheduler/clock';
import { isScheduledTrigger } from '../../types';
import { getActionHandler, type ActionContext } from './actionHandlers';
import { describeSchedule } from '../preview/scheduleDescriptions';

/**
 * RuleExecutor applies actions produced by the rule engine.
 * Delegates to ActionHandler strategies via the handler registry.
 *
 * Responsibilities:
 * - Look up the correct handler for each action type
 * - Skip actions when the handler returns no events
 * - Update rule execution metadata (executionCount, lastExecutedAt)
 * - Return domain events for cascading rule evaluation
 *
 * Validates Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */
export class RuleExecutor {
  private ctx: ActionContext;

  constructor(
    private taskRepo: TaskRepository,
    private sectionRepo: SectionRepository,
    private taskService: TaskService,
    private ruleRepo: AutomationRuleRepository,
    private clock?: Clock
  ) {
    this.ctx = { taskRepo, sectionRepo, taskService, clock };
  }

  /**
   * Execute a list of rule actions and return resulting domain events.
   */
  executeActions(actions: RuleAction[], triggeringEvent: DomainEvent): DomainEvent[] {
    const newEvents: DomainEvent[] = [];
    const isScheduledEvent = triggeringEvent.type === 'schedule.fired';

    // For scheduled events, collect per-rule aggregation data
    const scheduledAgg = new Map<string, { taskNames: string[]; actionDescription: string; triggerDescription: string }>();

    for (const action of actions) {
      try {
        const events = this.executeAction(action, triggeringEvent, isScheduledEvent ? scheduledAgg : undefined);
        newEvents.push(...events);
      } catch (error) {
        console.error(`Failed to execute action ${action.actionType} for rule ${action.ruleId}:`, error);
      }
    }

    // Write aggregated log entries for scheduled rules
    if (isScheduledEvent && scheduledAgg.size > 0) {
      for (const [ruleId, agg] of scheduledAgg) {
        this.pushAggregatedLogEntry(ruleId, agg.triggerDescription, agg.actionDescription, agg.taskNames, 'scheduled');
      }
    }

    return newEvents;
  }

  /**
   * Execute a single rule action by delegating to the appropriate handler.
   */
  private executeAction(
    action: RuleAction,
    triggeringEvent: DomainEvent,
    scheduledAgg?: Map<string, { taskNames: string[]; actionDescription: string; triggerDescription: string }>
  ): DomainEvent[] {
    const handler = getActionHandler(action.actionType);
    const events = handler.execute(action, triggeringEvent, this.ctx);

    if (events.length > 0) {
      this.updateRuleMetadata(action.ruleId);

      // Determine task name for the log entry
      let taskName: string;
      if (action.actionType === 'create_card') {
        const createdEvent = events.find(e => e.type === 'task.created');
        const createdTask = createdEvent ? this.taskRepo.findById(createdEvent.entityId) : null;
        taskName = createdTask?.description ?? action.params.cardTitle ?? 'New card';
      } else {
        taskName = this.taskRepo.findById(action.targetEntityId)?.description ?? 'Unknown task';
      }

      if (scheduledAgg) {
        // Scheduled rule: collect for aggregation, don't write individual entry
        const existing = scheduledAgg.get(action.ruleId);
        if (existing) {
          existing.taskNames.push(taskName);
        } else {
          scheduledAgg.set(action.ruleId, {
            taskNames: [taskName],
            actionDescription: handler.describe(action.params, this.ctx),
            triggerDescription: this.getTriggerDescription(action.ruleId),
          });
        }
      } else {
        // Event-driven rule: write individual entry as before
        this.pushExecutionLogEntry(
          action.ruleId,
          this.getTriggerDescription(action.ruleId),
          handler.describe(action.params, this.ctx),
          taskName
        );
      }
    }

    return events;
  }

  /**
   * Update rule execution metadata (Requirement 5.8)
   */
  private updateRuleMetadata(ruleId: string): void {
    const rule = this.ruleRepo.findById(ruleId);
    if (!rule) return;

    this.ruleRepo.update(ruleId, {
      executionCount: rule.executionCount + 1,
      lastExecutedAt: new Date().toISOString(),
    });
  }

  /**
   * Push an execution log entry to the rule's recentExecutions array.
   * Trims to the 20 most recent entries.
   * (Requirements 4.3, 4.4)
   */
  private pushExecutionLogEntry(
    ruleId: string,
    triggerDescription: string,
    actionDescription: string,
    taskName: string
  ): void {
    const rule = this.ruleRepo.findById(ruleId);
    if (!rule) return;

    const entry: ExecutionLogEntry = {
      timestamp: new Date().toISOString(),
      triggerDescription,
      actionDescription,
      taskName,
    };

    const recentExecutions = [...(rule.recentExecutions ?? []), entry];
    const trimmed = recentExecutions.length > 20
      ? recentExecutions.slice(recentExecutions.length - 20)
      : recentExecutions;

    this.ruleRepo.update(ruleId, { recentExecutions: trimmed });
  }

  /**
   * Push an aggregated execution log entry for scheduled rules.
   * One entry per rule execution with matchCount, details[], and executionType.
   */
  private pushAggregatedLogEntry(
    ruleId: string,
    triggerDescription: string,
    actionDescription: string,
    taskNames: string[],
    executionType: 'scheduled' | 'catch-up' | 'manual'
  ): void {
    const rule = this.ruleRepo.findById(ruleId);
    if (!rule) return;

    const entry: ExecutionLogEntry = {
      timestamp: new Date().toISOString(),
      triggerDescription,
      actionDescription,
      taskName: taskNames[0] ?? '',
      matchCount: taskNames.length,
      details: taskNames.slice(0, 10),
      executionType,
    };

    const recentExecutions = [...(rule.recentExecutions ?? []), entry];
    const trimmed = recentExecutions.length > 20
      ? recentExecutions.slice(recentExecutions.length - 20)
      : recentExecutions;

    this.ruleRepo.update(ruleId, { recentExecutions: trimmed });
  }

  /**
   * Generate a human-readable trigger description from the rule's trigger config.
   */
  private getTriggerDescription(ruleId: string): string {
    const rule = this.ruleRepo.findById(ruleId);
    if (!rule) return 'Unknown trigger';

    const sectionName = rule.trigger.sectionId
      ? this.sectionRepo.findById(rule.trigger.sectionId)?.name ?? 'unknown section'
      : '';

    switch (rule.trigger.type) {
      case 'card_moved_into_section':
        return sectionName ? `Card moved into '${sectionName}'` : 'Card moved into section';
      case 'card_moved_out_of_section':
        return sectionName ? `Card moved out of '${sectionName}'` : 'Card moved out of section';
      case 'card_marked_complete':
        return 'Card marked complete';
      case 'card_marked_incomplete':
        return 'Card marked incomplete';
      case 'card_created_in_section':
        return sectionName ? `Card created in '${sectionName}'` : 'Card created in section';
      case 'section_created':
        return 'Section created';
      case 'section_renamed':
        return 'Section renamed';
      case 'scheduled_interval':
      case 'scheduled_cron':
      case 'scheduled_due_date_relative':
        return `Every ${describeSchedule(rule.trigger)}`;
      case 'scheduled_one_time':
        return describeSchedule(rule.trigger);
      default:
        return 'Unknown trigger';
    }
  }
}
