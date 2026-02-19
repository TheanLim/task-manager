import type { TaskRepository, SectionRepository } from '@/lib/repositories/types';
import type { AutomationRuleRepository } from '../repositories/types';
import type { TaskService } from '@/features/tasks/services/taskService';
import type { DomainEvent, EvaluationContext, UndoSnapshot, RuleAction, ActionType, BatchContext } from '../types';
import { evaluateRules } from './ruleEngine';
import { RuleExecutor } from './ruleExecutor';

// --- Undo Snapshot (module-level, in-memory only) ---
// Requirements 6.8: Store only the most recent UndoSnapshot in memory, not in localStorage
// Requirements 6.9: New executions replace the previous snapshot

/** Undo window duration in milliseconds */
export const UNDO_EXPIRY_MS = 10_000;

let currentUndoSnapshot: UndoSnapshot | null = null;

/** Get the current undo snapshot, or null if none or expired (Req 6.7) */
export function getUndoSnapshot(): UndoSnapshot | null {
  if (!currentUndoSnapshot) return null;
  if (Date.now() - currentUndoSnapshot.timestamp > UNDO_EXPIRY_MS) {
    currentUndoSnapshot = null;
    return null;
  }
  return currentUndoSnapshot;
}

/** Set the current undo snapshot (replaces any previous — Req 6.9) */
export function setUndoSnapshot(snapshot: UndoSnapshot | null): void {
  currentUndoSnapshot = snapshot;
}

/** Clear the current undo snapshot */
export function clearUndoSnapshot(): void {
  currentUndoSnapshot = null;
}

/**
 * Perform undo of the last rule execution by reverting the affected task to its previous state.
 * Returns true if undo was performed, false if no valid snapshot exists.
 *
 * Validates Requirements: 6.2, 6.3, 6.4, 6.5, 6.6
 *
 * @param taskRepo - Task repository for reading/updating/deleting tasks
 */
export function performUndo(taskRepo: TaskRepository): boolean {
  const snapshot = getUndoSnapshot();
  if (!snapshot) return false;

  const { actionType, targetEntityId, previousState, createdEntityId } = snapshot;

  switch (actionType) {
    // Req 6.3: Move undo — move task back to previous section with previous order
    case 'move_card_to_top_of_section':
    case 'move_card_to_bottom_of_section': {
      const task = taskRepo.findById(targetEntityId);
      if (!task) break;
      const updates: Partial<{ sectionId: string | null; order: number }> = {};
      if (previousState.sectionId !== undefined) updates.sectionId = previousState.sectionId;
      if (previousState.order !== undefined) updates.order = previousState.order;
      taskRepo.update(targetEntityId, updates);
      break;
    }

    // Req 6.4: Mark complete/incomplete undo — revert completed and completedAt
    case 'mark_card_complete':
    case 'mark_card_incomplete': {
      const task = taskRepo.findById(targetEntityId);
      if (!task) break;
      const updates: Partial<{ completed: boolean; completedAt: string | null }> = {};
      if (previousState.completed !== undefined) updates.completed = previousState.completed;
      if (previousState.completedAt !== undefined) updates.completedAt = previousState.completedAt;
      taskRepo.update(targetEntityId, updates);

      // Also revert subtasks that were cascade-completed/incompleted
      if (snapshot.subtaskSnapshots) {
        for (const sub of snapshot.subtaskSnapshots) {
          const subtask = taskRepo.findById(sub.taskId);
          if (!subtask) continue;
          taskRepo.update(sub.taskId, {
            completed: sub.previousState.completed,
            completedAt: sub.previousState.completedAt,
          });
        }
      }
      break;
    }

    // Req 6.5: Set/remove due date undo — revert dueDate
    case 'set_due_date':
    case 'remove_due_date': {
      const task = taskRepo.findById(targetEntityId);
      if (!task) break;
      if (previousState.dueDate !== undefined) {
        taskRepo.update(targetEntityId, { dueDate: previousState.dueDate });
      }
      break;
    }

    // Req 6.6: Create card undo — delete the created task
    case 'create_card': {
      const entityToDelete = createdEntityId ?? targetEntityId;
      taskRepo.delete(entityToDelete);
      break;
    }

    default:
      break;
  }

  clearUndoSnapshot();
  return true;
}


/**
 * Map a RuleAction's actionType to the ActionType used in UndoSnapshot.
 * Move actions (top/bottom) both map to the same actionType for undo purposes.
 */
function mapActionTypeForUndo(actionType: ActionType): ActionType {
  return actionType;
}

/**
 * Build an UndoSnapshot from a rule action and the domain event produced by its execution.
 * The domain event's previousValues contain the state before the action was applied.
 */
function buildUndoSnapshot(
  action: RuleAction,
  ruleName: string,
  resultEvent: DomainEvent
): UndoSnapshot {
  const prev = resultEvent.previousValues;
  const snapshot: UndoSnapshot = {
    ruleId: action.ruleId,
    ruleName,
    actionType: mapActionTypeForUndo(action.actionType),
    targetEntityId: action.targetEntityId,
    previousState: {
      sectionId: prev.sectionId as string | undefined,
      order: prev.order as number | undefined,
      completed: prev.completed as boolean | undefined,
      completedAt: prev.completedAt !== undefined ? (prev.completedAt as string | null) : undefined,
      dueDate: prev.dueDate !== undefined ? (prev.dueDate as string | null) : undefined,
    },
    timestamp: Date.now(),
  };

  // For create_card actions, the created entity is the event's entityId
  if (action.actionType === 'create_card') {
    snapshot.createdEntityId = resultEvent.entityId;
    snapshot.targetEntityId = resultEvent.entityId;
  }

  return snapshot;
}

/**
 * Callback invoked when an automation rule executes successfully.
 */
export interface RuleExecutionCallback {
  (params: { ruleName: string; taskDescription: string; batchSize: number }): void;
}

/**
 * AutomationService orchestrates event handling, rule evaluation, and action execution.
 * 
 * Responsibilities:
 * - Subscribe to domain events and invoke the rule engine
 * - Delegate action execution to the rule executor
 * - Manage loop protection via depth limits and deduplication
 * - Handle cascading rule evaluation up to configurable max depth
 * - Notify external systems (e.g., toast notifications) when rules execute
 * 
 * Validates Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 11.1, 11.2
 */
export class AutomationService {
  private maxDepth: number;
  private ruleExecutor: RuleExecutor;
  private onRuleExecuted?: RuleExecutionCallback;
  private batchContext: BatchContext | null = null;

  constructor(
    private ruleRepo: AutomationRuleRepository,
    private taskRepo: TaskRepository,
    private sectionRepo: SectionRepository,
    private taskService: TaskService,
    ruleExecutor: RuleExecutor,
    maxDepth = 5,
    onRuleExecuted?: RuleExecutionCallback
  ) {
    this.ruleExecutor = ruleExecutor;
    this.maxDepth = maxDepth;
    this.onRuleExecuted = onRuleExecuted;
  }

  /**
   * Set the callback to be invoked when rules execute.
   * This allows the UI layer to wire up toast notifications after service instantiation.
   */
  setRuleExecutionCallback(callback: RuleExecutionCallback | undefined): void {
    this.onRuleExecuted = callback;
  }

  /**
   * Begin batch mode. During batch mode, execution notifications are collected
   * into a BatchContext instead of being emitted individually.
   * Call endBatch() after the user action completes to emit aggregated toasts.
   *
   * Validates Requirements: 8.1, 8.4
   */
  beginBatch(): void {
    this.batchContext = { executions: [] };
  }

  /**
   * End batch mode. Groups collected executions by ruleId and emits one
   * aggregated toast per rule: "⚡ Automation: [rule name] ran on N tasks".
   *
   * Validates Requirements: 8.1, 8.2, 8.3, 8.4
   */
  endBatch(): void {
    const batch = this.batchContext;
    this.batchContext = null;

    if (!batch || batch.executions.length === 0 || !this.onRuleExecuted) return;

    // Group executions by ruleId
    const byRule = new Map<string, { ruleName: string; count: number; taskDescription: string }>();
    for (const exec of batch.executions) {
      const existing = byRule.get(exec.ruleId);
      if (existing) {
        existing.count++;
      } else {
        byRule.set(exec.ruleId, {
          ruleName: exec.ruleName,
          count: 1,
          taskDescription: exec.taskName,
        });
      }
    }

    // Emit one aggregated callback per rule (Req 8.3)
    for (const [, entry] of byRule) {
      this.onRuleExecuted({
        ruleName: entry.ruleName,
        taskDescription: entry.count === 1 ? entry.taskDescription : '',
        batchSize: entry.count,
      });
    }
  }

  /**
   * Handle a domain event by evaluating rules and executing actions.
   * Supports cascading evaluation with loop protection.
   * 
   * @param event - The domain event to handle
   * @param dedupSet - Optional deduplication set (created on first call, passed through recursion)
   */
  handleEvent(event: DomainEvent, dedupSet?: Set<string>): void {
    // Requirement 6.4: Halt if cascade depth exceeds maximum
    if (event.depth >= this.maxDepth) {
      return;
    }

    // Requirement 6.7: Reset depth counter and clear dedup set for new user-initiated actions
    // (dedupSet is undefined for user-initiated events, created here)
    const currentDedupSet = dedupSet ?? new Set<string>();

    // Requirement 6.1: Subscribe to domain events and invoke the rule engine
    const rules = this.ruleRepo.findByProjectId(event.projectId);
    
    const context: EvaluationContext = {
      allTasks: this.taskRepo.findAll(),
      allSections: this.sectionRepo.findAll(),
      maxDepth: this.maxDepth,
      executedSet: currentDedupSet,
    };

    const actions = evaluateRules(event, rules, context);

    // Requirement 6.5: Maintain a dedup set of "ruleId:entityId:actionType" entries
    // Requirement 6.6: Skip duplicate actions to break cycles
    const filteredActions = actions.filter(action => {
      const key = `${action.ruleId}:${action.targetEntityId}:${action.actionType}`;
      
      if (currentDedupSet.has(key)) {
        return false; // Skip duplicate
      }
      
      currentDedupSet.add(key);
      return true;
    });

    // Capture subtask state BEFORE execution for undo (mark_complete/incomplete cascade)
    let preExecutionSubtaskSnapshots: Array<{ taskId: string; previousState: { completed: boolean; completedAt: string | null } }> | undefined;
    if (event.depth === 0 && filteredActions.length > 0) {
      const lastAction = filteredActions[filteredActions.length - 1];
      if (lastAction.actionType === 'mark_card_complete' || lastAction.actionType === 'mark_card_incomplete') {
        const allTasks = this.taskRepo.findAll();
        const subtasks = allTasks.filter((t) => t.parentTaskId === lastAction.targetEntityId);
        if (subtasks.length > 0) {
          preExecutionSubtaskSnapshots = subtasks.map((sub) => ({
            taskId: sub.id,
            previousState: {
              completed: sub.completed,
              completedAt: sub.completedAt ?? null,
            },
          }));
        }
      }
    }

    // Requirement 6.2: Delegate execution to the rule executor
    const newEvents = this.ruleExecutor.executeActions(filteredActions, event);

    // Requirements 6.8, 6.9: Capture undo snapshot for user-initiated (depth 0) executions only.
    // The last executed action's snapshot replaces any previous one.
    if (event.depth === 0 && filteredActions.length > 0 && newEvents.length > 0) {
      // Find the last action that produced a domain event (i.e., succeeded)
      // Match actions to their result events via triggeredByRule
      const lastAction = filteredActions[filteredActions.length - 1];
      const matchingEvent = newEvents.find(
        e => e.triggeredByRule === lastAction.ruleId &&
             (e.entityId === lastAction.targetEntityId || lastAction.actionType === 'create_card')
      );

      if (matchingEvent) {
        const rule = rules.find(r => r.id === lastAction.ruleId);
        if (rule) {
          const snapshot = buildUndoSnapshot(lastAction, rule.name, matchingEvent);
          // Attach pre-captured subtask snapshots
          if (preExecutionSubtaskSnapshots) {
            snapshot.subtaskSnapshots = preExecutionSubtaskSnapshots;
          }
          setUndoSnapshot(snapshot);
        }
      }
    }

    // Requirements 8.1–8.4, 11.1, 11.2: Notify about rule executions (only for top-level, user-initiated events)
    if (event.depth === 0 && filteredActions.length > 0) {
      // Group actions by rule ID to generate notifications
      const actionsByRule = new Map<string, typeof filteredActions>();
      
      for (const action of filteredActions) {
        const existing = actionsByRule.get(action.ruleId) || [];
        existing.push(action);
        actionsByRule.set(action.ruleId, existing);
      }

      // Generate a notification for each rule that executed
      for (const [ruleId, ruleActions] of actionsByRule) {
        const rule = rules.find(r => r.id === ruleId);
        if (!rule) continue;

        if (this.batchContext) {
          // Batch mode: collect executions for aggregated toast later (Req 8.4)
          for (const action of ruleActions) {
            const task = this.taskRepo.findById(action.targetEntityId);
            this.batchContext.executions.push({
              ruleId: rule.id,
              ruleName: rule.name,
              taskName: task?.description || 'Unknown task',
              actionDescription: action.actionType,
            });
          }
        } else if (this.onRuleExecuted) {
          // Non-batch mode: emit individual toast per rule immediately
          const batchSize = ruleActions.length;
          let taskDescription = '';
          if (batchSize === 1) {
            const task = this.taskRepo.findById(ruleActions[0].targetEntityId);
            taskDescription = task?.description || 'Unknown task';
          }

          this.onRuleExecuted({
            ruleName: rule.name,
            taskDescription,
            batchSize,
          });
        }
      }
    }

    // Requirement 6.3: Allow cascading evaluation up to maximum depth
    for (const newEvent of newEvents) {
      this.handleEvent(newEvent, currentDedupSet);
    }
  }
}
