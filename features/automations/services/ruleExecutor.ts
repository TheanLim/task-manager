import type { TaskRepository, SectionRepository } from '@/lib/repositories/types';
import type { AutomationRuleRepository } from '../repositories/types';
import type { TaskService } from '@/features/tasks/services/taskService';
import type { RuleAction, DomainEvent } from '../types';
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
    }

    return events;
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
    const targetSectionId = action.params.sectionId;
    if (!targetSectionId) return;

    // Verify target section exists
    const targetSection = this.sectionRepo.findById(targetSectionId);
    if (!targetSection) return;

    // Find all tasks in target section
    const tasksInSection = this.taskRepo
      .findAll()
      .filter(t => t.sectionId === targetSectionId && t.id !== task.id);

    // Calculate new order: one less than minimum order
    const minOrder = tasksInSection.length > 0
      ? Math.min(...tasksInSection.map(t => t.order))
      : 0;
    const newOrder = minOrder - 1;

    // Update task
    this.taskRepo.update(task.id, {
      sectionId: targetSectionId,
      order: newOrder,
    });

    // Emit domain event
    events.push({
      type: 'task.updated',
      entityId: task.id,
      projectId: task.projectId,
      changes: {
        sectionId: targetSectionId,
        order: newOrder,
      },
      previousValues: {
        sectionId: previousValues.sectionId,
        order: previousValues.order,
      },
      triggeredByRule: action.ruleId,
      depth: triggeringEvent.depth + 1,
    });
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
    const targetSectionId = action.params.sectionId;
    if (!targetSectionId) return;

    // Verify target section exists
    const targetSection = this.sectionRepo.findById(targetSectionId);
    if (!targetSection) return;

    // Find all tasks in target section
    const tasksInSection = this.taskRepo
      .findAll()
      .filter(t => t.sectionId === targetSectionId && t.id !== task.id);

    // Calculate new order: one more than maximum order
    const maxOrder = tasksInSection.length > 0
      ? Math.max(...tasksInSection.map(t => t.order))
      : 0;
    const newOrder = maxOrder + 1;

    // Update task
    this.taskRepo.update(task.id, {
      sectionId: targetSectionId,
      order: newOrder,
    });

    // Emit domain event
    events.push({
      type: 'task.updated',
      entityId: task.id,
      projectId: task.projectId,
      changes: {
        sectionId: targetSectionId,
        order: newOrder,
      },
      previousValues: {
        sectionId: previousValues.sectionId,
        order: previousValues.order,
      },
      triggeredByRule: action.ruleId,
      depth: triggeringEvent.depth + 1,
    });
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
    // TaskService.cascadeComplete will emit events internally
    this.taskService.cascadeComplete(task.id, true);
    
    // We still need to emit an event for this action to track it was triggered by a rule
    events.push({
      type: 'task.updated',
      entityId: task.id,
      projectId: task.projectId,
      changes: {
        completed: true,
      },
      previousValues: {
        completed: task.completed,
      },
      triggeredByRule: action.ruleId,
      depth: triggeringEvent.depth + 1,
    });
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
    // TaskService.cascadeComplete will emit events internally
    this.taskService.cascadeComplete(task.id, false);
    
    // We still need to emit an event for this action to track it was triggered by a rule
    events.push({
      type: 'task.updated',
      entityId: task.id,
      projectId: task.projectId,
      changes: {
        completed: false,
      },
      previousValues: {
        completed: task.completed,
      },
      triggeredByRule: action.ruleId,
      depth: triggeringEvent.depth + 1,
    });
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

    // Calculate target date with optional parameters
    const targetDate = calculateRelativeDate(dateOption, undefined, {
      specificMonth: action.params.specificMonth,
      specificDay: action.params.specificDay,
      monthTarget: action.params.monthTarget,
    });
    const dueDateString = targetDate.toISOString();

    // Update task
    this.taskRepo.update(task.id, {
      dueDate: dueDateString,
    });

    // Emit domain event
    events.push({
      type: 'task.updated',
      entityId: task.id,
      projectId: task.projectId,
      changes: {
        dueDate: dueDateString,
      },
      previousValues: {
        dueDate: previousValues.dueDate,
      },
      triggeredByRule: action.ruleId,
      depth: triggeringEvent.depth + 1,
    });
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
    // Update task
    this.taskRepo.update(task.id, {
      dueDate: null,
    });

    // Emit domain event
    events.push({
      type: 'task.updated',
      entityId: task.id,
      projectId: task.projectId,
      changes: {
        dueDate: null,
      },
      previousValues: {
        dueDate: previousValues.dueDate,
      },
      triggeredByRule: action.ruleId,
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
}
