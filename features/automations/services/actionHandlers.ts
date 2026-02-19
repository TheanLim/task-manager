import type { TaskRepository, SectionRepository } from '@/lib/repositories/types';
import type { TaskService } from '@/features/tasks/services/taskService';
import type { RuleAction, DomainEvent, ActionType, UndoSnapshot } from '../types';
import type { Task } from '@/lib/schemas';
import { calculateRelativeDate } from './dateCalculations';
import { TRIGGER_SECTION_SENTINEL } from './rulePreviewService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Context provided to action handlers for execution.
 */
export interface ActionContext {
  taskRepo: TaskRepository;
  sectionRepo: SectionRepository;
  taskService: TaskService;
}

/**
 * Strategy interface for automation action execution.
 * Each action type implements execute(), describe(), and undo().
 */
export interface ActionHandler {
  /** Execute the action and return resulting domain events. */
  execute(action: RuleAction, triggeringEvent: DomainEvent, ctx: ActionContext): DomainEvent[];
  /** Generate a human-readable description of the action. */
  describe(params: RuleAction['params'], ctx: ActionContext): string;
  /** Revert the action using a previously captured undo snapshot. */
  undo(snapshot: UndoSnapshot, ctx: ActionContext): void;
}

/** Helper: emit a task.updated domain event. */
function emitTaskUpdatedEvent(
  task: Task,
  changes: Record<string, unknown>,
  previousValues: Record<string, unknown>,
  ruleId: string,
  triggeringEvent: DomainEvent
): DomainEvent {
  return {
    type: 'task.updated',
    entityId: task.id,
    projectId: task.projectId || '',
    changes,
    previousValues,
    triggeredByRule: ruleId,
    depth: triggeringEvent.depth + 1,
  };
}

// ---------------------------------------------------------------------------
// Move handlers (top / bottom share logic via a position parameter)
// ---------------------------------------------------------------------------

function executeMoveToSection(
  action: RuleAction,
  triggeringEvent: DomainEvent,
  ctx: ActionContext,
  position: 'top' | 'bottom'
): DomainEvent[] {
  const task = ctx.taskRepo.findById(action.targetEntityId);
  if (!task) return [];

  const targetSectionId = action.params.sectionId;
  if (!targetSectionId) return [];

  const targetSection = ctx.sectionRepo.findById(targetSectionId);
  if (!targetSection) return [];

  const tasksInSection = ctx.taskRepo
    .findAll()
    .filter(t => t.sectionId === targetSectionId && t.id !== task.id);

  const newOrder = position === 'top'
    ? (tasksInSection.length > 0 ? Math.min(...tasksInSection.map(t => t.order)) - 1 : -1)
    : (tasksInSection.length > 0 ? Math.max(...tasksInSection.map(t => t.order)) + 1 : 1);

  const previousValues = { sectionId: task.sectionId, order: task.order };
  ctx.taskRepo.update(task.id, { sectionId: targetSectionId, order: newOrder });

  return [emitTaskUpdatedEvent(
    task,
    { sectionId: targetSectionId, order: newOrder },
    previousValues,
    action.ruleId,
    triggeringEvent
  )];
}

function undoMove(snapshot: UndoSnapshot, ctx: ActionContext): void {
  const task = ctx.taskRepo.findById(snapshot.targetEntityId);
  if (!task) return;
  const updates: Partial<{ sectionId: string | null; order: number }> = {};
  if (snapshot.previousState.sectionId !== undefined) updates.sectionId = snapshot.previousState.sectionId;
  if (snapshot.previousState.order !== undefined) updates.order = snapshot.previousState.order;
  ctx.taskRepo.update(snapshot.targetEntityId, updates);
}

function describeMoveAction(params: RuleAction['params'], ctx: ActionContext, position: 'top' | 'bottom'): string {
  const sectionName = params.sectionId
    ? ctx.sectionRepo.findById(params.sectionId)?.name ?? 'unknown section'
    : '';
  return sectionName ? `Moved to ${position} of '${sectionName}'` : `Moved to ${position} of section`;
}

const moveToTopHandler: ActionHandler = {
  execute: (action, event, ctx) => executeMoveToSection(action, event, ctx, 'top'),
  describe: (params, ctx) => describeMoveAction(params, ctx, 'top'),
  undo: undoMove,
};

const moveToBottomHandler: ActionHandler = {
  execute: (action, event, ctx) => executeMoveToSection(action, event, ctx, 'bottom'),
  describe: (params, ctx) => describeMoveAction(params, ctx, 'bottom'),
  undo: undoMove,
};

// ---------------------------------------------------------------------------
// Mark complete / incomplete handlers
// ---------------------------------------------------------------------------

function executeMarkCompletion(
  action: RuleAction,
  triggeringEvent: DomainEvent,
  ctx: ActionContext,
  completed: boolean
): DomainEvent[] {
  const task = ctx.taskRepo.findById(action.targetEntityId);
  if (!task) return [];

  ctx.taskService.cascadeComplete(task.id, completed);
  return [emitTaskUpdatedEvent(
    task,
    { completed },
    { completed: task.completed, completedAt: task.completedAt ?? null },
    action.ruleId,
    triggeringEvent
  )];
}

function undoMarkCompletion(snapshot: UndoSnapshot, ctx: ActionContext): void {
  const task = ctx.taskRepo.findById(snapshot.targetEntityId);
  if (!task) return;
  const updates: Partial<{ completed: boolean; completedAt: string | null }> = {};
  if (snapshot.previousState.completed !== undefined) updates.completed = snapshot.previousState.completed;
  if (snapshot.previousState.completedAt !== undefined) updates.completedAt = snapshot.previousState.completedAt;
  ctx.taskRepo.update(snapshot.targetEntityId, updates);
  if (snapshot.subtaskSnapshots) {
    for (const sub of snapshot.subtaskSnapshots) {
      const subtask = ctx.taskRepo.findById(sub.taskId);
      if (!subtask) continue;
      ctx.taskRepo.update(sub.taskId, {
        completed: sub.previousState.completed,
        completedAt: sub.previousState.completedAt,
      });
    }
  }
}

const markCompleteHandler: ActionHandler = {
  execute: (action, event, ctx) => executeMarkCompletion(action, event, ctx, true),
  describe: () => 'Marked as complete',
  undo: undoMarkCompletion,
};

const markIncompleteHandler: ActionHandler = {
  execute: (action, event, ctx) => executeMarkCompletion(action, event, ctx, false),
  describe: () => 'Marked as incomplete',
  undo: undoMarkCompletion,
};

// ---------------------------------------------------------------------------
// Due date handlers
// ---------------------------------------------------------------------------

const setDueDateHandler: ActionHandler = {
  execute(action, triggeringEvent, ctx) {
    const task = ctx.taskRepo.findById(action.targetEntityId);
    if (!task) return [];

    const dateOption = action.params.dateOption;
    if (!dateOption) return [];

    const targetDate = calculateRelativeDate(dateOption, undefined, {
      specificMonth: action.params.specificMonth,
      specificDay: action.params.specificDay,
      monthTarget: action.params.monthTarget,
    });
    const dueDateString = targetDate.toISOString();

    ctx.taskRepo.update(task.id, { dueDate: dueDateString });
    return [emitTaskUpdatedEvent(
      task,
      { dueDate: dueDateString },
      { dueDate: task.dueDate },
      action.ruleId,
      triggeringEvent
    )];
  },
  describe: () => 'Set due date',
  undo(snapshot, ctx) {
    const task = ctx.taskRepo.findById(snapshot.targetEntityId);
    if (!task) return;
    if (snapshot.previousState.dueDate !== undefined) {
      ctx.taskRepo.update(snapshot.targetEntityId, { dueDate: snapshot.previousState.dueDate });
    }
  },
};

const removeDueDateHandler: ActionHandler = {
  execute(action, triggeringEvent, ctx) {
    const task = ctx.taskRepo.findById(action.targetEntityId);
    if (!task) return [];

    ctx.taskRepo.update(task.id, { dueDate: null });
    return [emitTaskUpdatedEvent(
      task,
      { dueDate: null },
      { dueDate: task.dueDate },
      action.ruleId,
      triggeringEvent
    )];
  },
  describe: () => 'Removed due date',
  undo(snapshot, ctx) {
    const task = ctx.taskRepo.findById(snapshot.targetEntityId);
    if (!task) return;
    if (snapshot.previousState.dueDate !== undefined) {
      ctx.taskRepo.update(snapshot.targetEntityId, { dueDate: snapshot.previousState.dueDate });
    }
  },
};

// ---------------------------------------------------------------------------
// Create card handler
// ---------------------------------------------------------------------------

const createCardHandler: ActionHandler = {
  execute(action, triggeringEvent, ctx) {
    let targetSectionId = action.params.sectionId;
    if (targetSectionId === TRIGGER_SECTION_SENTINEL) {
      targetSectionId = triggeringEvent.entityId;
    }
    if (!targetSectionId) return [];

    const targetSection = ctx.sectionRepo.findById(targetSectionId);
    if (!targetSection) return [];

    const cardTitle = action.params.cardTitle;
    if (!cardTitle) return [];

    const tasksInSection = ctx.taskRepo
      .findAll()
      .filter(t => t.sectionId === targetSectionId);

    const maxOrder = tasksInSection.length > 0
      ? Math.max(...tasksInSection.map(t => t.order))
      : 0;

    let dueDate: string | null = null;
    if (action.params.cardDateOption) {
      const targetDate = calculateRelativeDate(action.params.cardDateOption, undefined, {
        specificMonth: action.params.specificMonth,
        specificDay: action.params.specificDay,
        monthTarget: action.params.monthTarget,
      });
      dueDate = targetDate.toISOString();
    }

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
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      lastActionAt: null,
    };

    ctx.taskRepo.create(newTask);

    return [{
      type: 'task.created' as const,
      entityId: newTask.id,
      projectId: newTask.projectId || '',
      changes: { sectionId: targetSectionId },
      previousValues: {},
      triggeredByRule: action.ruleId,
      depth: triggeringEvent.depth + 1,
    }];
  },
  describe(params) {
    return params.cardTitle ? `Created card '${params.cardTitle}'` : 'Created card';
  },
  undo(snapshot, ctx) {
    const entityToDelete = snapshot.createdEntityId ?? snapshot.targetEntityId;
    ctx.taskRepo.delete(entityToDelete);
  },
};

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

/** Registry mapping action types to their Strategy handler. */
export const ACTION_HANDLER_REGISTRY: Record<ActionType, ActionHandler> = {
  move_card_to_top_of_section: moveToTopHandler,
  move_card_to_bottom_of_section: moveToBottomHandler,
  mark_card_complete: markCompleteHandler,
  mark_card_incomplete: markIncompleteHandler,
  set_due_date: setDueDateHandler,
  remove_due_date: removeDueDateHandler,
  create_card: createCardHandler,
};

/**
 * Look up the handler for an action type.
 * Throws if the action type is unknown (should never happen with typed enums).
 */
export function getActionHandler(actionType: ActionType): ActionHandler {
  const handler = ACTION_HANDLER_REGISTRY[actionType];
  if (!handler) {
    throw new Error(`Unknown action type: ${actionType}`);
  }
  return handler;
}
