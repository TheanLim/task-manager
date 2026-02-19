import type { TaskRepository, SectionRepository } from '@/lib/repositories/types';
import type { AutomationRuleRepository } from '../repositories/types';
import type { TaskService } from '@/features/tasks/services/taskService';
import type { RuleAction, DomainEvent, ExecutionLogEntry } from '../types';
import { calculateRelativeDate } from './dateCalculations';
import { TRIGGER_SECTION_SENTINEL } from './rulePreviewService';
import { v4 as uuidv4 } from 'uuid';

/**
 * RuleExecutor applies actions produced by the rule engine.
 * 
 * Responsibilities:
 * - Execute all 6 action types via existing repositories and services
 * - Skip actions when target entities don't exist
 * - Update rule execution metadata (executionCount, lastExecutedAt)
 * - Return domain events for cascading rule evaluation
 * 
 * Validates Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */
export class RuleExecutor {
  constructor(
    private taskRepo: TaskRepository,
    private sectionRepo: SectionRepository,
    private taskService: TaskService,
    private ruleRepo: AutomationRuleRepository
  ) {}

  /**
   * Execute a list of rule actions and return resulting domain events.
   * 
   * @param actions - Actions to execute
   * @param triggeringEvent - The event that triggered these actions
   * @returns Array of domain events produced by the actions (for cascading)
   */
  executeActions(actions: RuleAction[], triggeringEvent: DomainEvent): DomainEvent[] {
    const newEvents: DomainEvent[] = [];

    for (const action of actions) {
      try {
        const events = this.executeAction(action, triggeringEvent);
        newEvents.push(...events);
      } catch (error) {
        // Skip failed actions, continue with remaining actions
        console.error(`Failed to execute action ${action.actionType} for rule ${action.ruleId}:`, error);
      }
    }

    return newEvents;
  }

  /**
   * Execute a single rule action.
   * 
   * @param action - The action to execute
   * @param triggeringEvent - The event that triggered this action
   * @returns Array of domain events produced by this action
   */
  private executeAction(action: RuleAction, triggeringEvent: DomainEvent): DomainEvent[] {
    const events: DomainEvent[] = [];

    // Special case: create_card doesn't need an existing task
    if (action.actionType === 'create_card') {
      this.executeCreateCard(action, triggeringEvent, events);
      
      // Update rule execution metadata (Requirement 5.8)
      if (events.length > 0) {
        this.updateRuleMetadata(action.ruleId);
        // Push execution log entry (Requirements 4.3, 4.4)
        this.pushExecutionLogEntry(
          action.ruleId,
          this.getTriggerDescription(action.ruleId),
          this.getActionDescription(action.actionType, action.params),
          action.params.cardTitle ?? 'New card'
        );
      }
      
      return events;
    }

    // For all other actions, we need an existing task
    const task = this.taskRepo.findById(action.targetEntityId);
    
    // Skip if target entity doesn't exist (Requirement 5.7)
    if (!task) {
      return [];
    }

    const previousValues = { ...task };

    switch (action.actionType) {
      case 'move_card_to_top_of_section':
        this.executeMoveToTop(action, task, previousValues, triggeringEvent, events);
        break;

      case 'move_card_to_bottom_of_section':
        this.executeMoveToBottom(action, task, previousValues, triggeringEvent, events);
        break;

      case 'mark_card_complete':
        this.executeMarkComplete(action, task, triggeringEvent, events);
        break;

      case 'mark_card_incomplete':
        this.executeMarkIncomplete(action, task, triggeringEvent, events);
        break;

      case 'set_due_date':
        this.executeSetDueDate(action, task, previousValues, triggeringEvent, events);
        break;

      case 'remove_due_date':
        this.executeRemoveDueDate(action, task, previousValues, triggeringEvent, events);
        break;
    }

    // Update rule execution metadata (Requirement 5.8)
    if (events.length > 0) {
      this.updateRuleMetadata(action.ruleId);
      // Push execution log entry (Requirements 4.3, 4.4)
      this.pushExecutionLogEntry(
        action.ruleId,
        this.getTriggerDescription(action.ruleId),
        this.getActionDescription(action.actionType, action.params),
        task.description
      );
    }

    return events;
  }

  /**
   * Shared logic for move-to-top and move-to-bottom actions.
   */
  private executeMoveToSection(
    action: RuleAction,
    task: any,
    previousValues: any,
    triggeringEvent: DomainEvent,
    events: DomainEvent[],
    position: 'top' | 'bottom'
  ): void {
    const targetSectionId = action.params.sectionId;
    if (!targetSectionId) return;

    const targetSection = this.sectionRepo.findById(targetSectionId);
    if (!targetSection) return;

    const tasksInSection = this.taskRepo
      .findAll()
      .filter(t => t.sectionId === targetSectionId && t.id !== task.id);

    const newOrder = position === 'top'
      ? (tasksInSection.length > 0 ? Math.min(...tasksInSection.map(t => t.order)) - 1 : -1)
      : (tasksInSection.length > 0 ? Math.max(...tasksInSection.map(t => t.order)) + 1 : 1);

    this.taskRepo.update(task.id, { sectionId: targetSectionId, order: newOrder });

    events.push({
      type: 'task.updated',
      entityId: task.id,
      projectId: task.projectId,
      changes: { sectionId: targetSectionId, order: newOrder },
      previousValues: { sectionId: previousValues.sectionId, order: previousValues.order },
      triggeredByRule: action.ruleId,
      depth: triggeringEvent.depth + 1,
    });
  }

  /**
   * Move card to top of section (Requirement 5.1)
   */
  private executeMoveToTop(
    action: RuleAction,
    task: any,
    previousValues: any,
    triggeringEvent: DomainEvent,
    events: DomainEvent[]
  ): void {
    this.executeMoveToSection(action, task, previousValues, triggeringEvent, events, 'top');
  }

  /**
   * Move card to bottom of section (Requirement 5.2)
   */
  private executeMoveToBottom(
    action: RuleAction,
    task: any,
    previousValues: any,
    triggeringEvent: DomainEvent,
    events: DomainEvent[]
  ): void {
    this.executeMoveToSection(action, task, previousValues, triggeringEvent, events, 'bottom');
  }

  /**
   * Mark card complete (Requirement 5.3)
   * 
   * Note: TaskService.cascadeComplete emits its own events with depth 0.
   * We don't capture those here since the service handles event emission.
   */
  private executeMarkComplete(
    action: RuleAction,
    task: any,
    triggeringEvent: DomainEvent,
    events: DomainEvent[]
  ): void {
    this.taskService.cascadeComplete(task.id, true);
    this.emitTaskUpdatedEvent(
      task,
      { completed: true },
      { completed: task.completed, completedAt: task.completedAt ?? null },
      action.ruleId, triggeringEvent, events
    );
  }

  /**
   * Mark card incomplete (Requirement 5.4)
   */
  private executeMarkIncomplete(
    action: RuleAction,
    task: any,
    triggeringEvent: DomainEvent,
    events: DomainEvent[]
  ): void {
    this.taskService.cascadeComplete(task.id, false);
    this.emitTaskUpdatedEvent(
      task,
      { completed: false },
      { completed: task.completed, completedAt: task.completedAt ?? null },
      action.ruleId, triggeringEvent, events
    );
  }

  /**
   * Set due date (Requirement 5.5)
   */
  private executeSetDueDate(
    action: RuleAction,
    task: any,
    previousValues: any,
    triggeringEvent: DomainEvent,
    events: DomainEvent[]
  ): void {
    const dateOption = action.params.dateOption;
    if (!dateOption) return;

    const targetDate = calculateRelativeDate(dateOption, undefined, {
      specificMonth: action.params.specificMonth,
      specificDay: action.params.specificDay,
      monthTarget: action.params.monthTarget,
    });
    const dueDateString = targetDate.toISOString();

    this.taskRepo.update(task.id, { dueDate: dueDateString });
    this.emitTaskUpdatedEvent(task, { dueDate: dueDateString }, { dueDate: previousValues.dueDate }, action.ruleId, triggeringEvent, events);
  }

  /**
   * Remove due date (Requirement 5.6)
   */
  private executeRemoveDueDate(
    action: RuleAction,
    task: any,
    previousValues: any,
    triggeringEvent: DomainEvent,
    events: DomainEvent[]
  ): void {
    this.taskRepo.update(task.id, { dueDate: null });
    this.emitTaskUpdatedEvent(task, { dueDate: null }, { dueDate: previousValues.dueDate }, action.ruleId, triggeringEvent, events);
  }

  /**
   * Helper: emit a task.updated domain event.
   */
  private emitTaskUpdatedEvent(
    task: any,
    changes: Record<string, unknown>,
    previousValues: Record<string, unknown>,
    ruleId: string,
    triggeringEvent: DomainEvent,
    events: DomainEvent[]
  ): void {
    events.push({
      type: 'task.updated',
      entityId: task.id,
      projectId: task.projectId,
      changes,
      previousValues,
      triggeredByRule: ruleId,
      depth: triggeringEvent.depth + 1,
    });
  }

  /**
   * Create card (Requirement 8.4, 8.5, 8.6)
   */
  private executeCreateCard(
    action: RuleAction,
    triggeringEvent: DomainEvent,
    events: DomainEvent[]
  ): void {
    // Resolve target section: sentinel means "use the section from the triggering event"
    let targetSectionId = action.params.sectionId;
    if (targetSectionId === TRIGGER_SECTION_SENTINEL) {
      targetSectionId = triggeringEvent.entityId;
    }
    if (!targetSectionId) return;

    // Verify target section exists (Requirement 8.6)
    const targetSection = this.sectionRepo.findById(targetSectionId);
    if (!targetSection) return; // Skip silently

    // Get card title from params
    const cardTitle = action.params.cardTitle;
    if (!cardTitle) return;

    // Find all tasks in target section to calculate order
    const tasksInSection = this.taskRepo
      .findAll()
      .filter(t => t.sectionId === targetSectionId);

    // Calculate new order: one more than maximum order (bottom of section)
    const maxOrder = tasksInSection.length > 0
      ? Math.max(...tasksInSection.map(t => t.order))
      : 0;
    const newOrder = maxOrder + 1;

    // Calculate due date if cardDateOption is provided (Requirement 8.5)
    let dueDate: string | null = null;
    if (action.params.cardDateOption) {
      const targetDate = calculateRelativeDate(action.params.cardDateOption, undefined, {
        specificMonth: action.params.specificMonth,
        specificDay: action.params.specificDay,
        monthTarget: action.params.monthTarget,
      });
      dueDate = targetDate.toISOString();
    }

    // Create new task (Requirement 8.4)
    const now = new Date().toISOString();
    const newTask = {
      id: uuidv4(),
      projectId: targetSection.projectId,
      parentTaskId: null,
      sectionId: targetSectionId,
      description: cardTitle,
      notes: '',
      assignee: '',
      priority: 'none' as const,
      tags: [],
      dueDate,
      completed: false,
      completedAt: null,
      order: newOrder,
      createdAt: now,
      updatedAt: now,
      lastActionAt: null,
    };

    this.taskRepo.create(newTask);

    // Emit task.created domain event
    events.push({
      type: 'task.created',
      entityId: newTask.id,
      projectId: newTask.projectId || '',
      changes: {
        sectionId: targetSectionId,
      },
      previousValues: {},
      triggeredByRule: action.ruleId,
      depth: triggeringEvent.depth + 1,
    });
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
   * Trims to the 20 most recent entries if the array exceeds 20.
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
    // Trim to last 20 entries
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
      default:
        return 'Unknown trigger';
    }
  }

  /**
   * Generate a human-readable action description from the action type.
   */
  private getActionDescription(actionType: string, params: RuleAction['params']): string {
    const sectionName = params.sectionId
      ? this.sectionRepo.findById(params.sectionId)?.name ?? 'unknown section'
      : '';

    switch (actionType) {
      case 'move_card_to_top_of_section':
        return sectionName ? `Moved to top of '${sectionName}'` : 'Moved to top of section';
      case 'move_card_to_bottom_of_section':
        return sectionName ? `Moved to bottom of '${sectionName}'` : 'Moved to bottom of section';
      case 'mark_card_complete':
        return 'Marked as complete';
      case 'mark_card_incomplete':
        return 'Marked as incomplete';
      case 'set_due_date':
        return 'Set due date';
      case 'remove_due_date':
        return 'Removed due date';
      case 'create_card':
        return params.cardTitle ? `Created card '${params.cardTitle}'` : 'Created card';
      default:
        return 'Unknown action';
    }
  }

}
