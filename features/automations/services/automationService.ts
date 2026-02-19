import type { TaskRepository, SectionRepository } from '@/lib/repositories/types';
import type { AutomationRuleRepository } from '../repositories/types';
import type { TaskService } from '@/features/tasks/services/taskService';
import type { DomainEvent, EvaluationContext, RuleAction, BatchContext } from '../types';
import { evaluateRules } from './ruleEngine';
import { RuleExecutor } from './ruleExecutor';
import {
  clearAllUndoSnapshots,
  pushUndoSnapshot,
  buildUndoSnapshot,
} from './undoService';

// Re-export undo functions for backward compatibility
export {
  UNDO_EXPIRY_MS,
  getUndoSnapshot,
  getUndoSnapshots,
  setUndoSnapshot,
  pushUndoSnapshot,
  clearUndoSnapshot,
  clearAllUndoSnapshots,
  performUndo,
  performUndoById,
  buildUndoSnapshot,
} from './undoService';

/**
 * Callback invoked when an automation rule executes successfully.
 */
export interface RuleExecutionCallback {
  (params: { ruleId: string; ruleName: string; taskDescription: string; batchSize: number }): void;
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
    const byRule = new Map<string, { ruleId: string; ruleName: string; count: number; taskDescription: string }>();
    for (const exec of batch.executions) {
      const existing = byRule.get(exec.ruleId);
      if (existing) {
        existing.count++;
      } else {
        byRule.set(exec.ruleId, {
          ruleId: exec.ruleId,
          ruleName: exec.ruleName,
          count: 1,
          taskDescription: exec.taskName,
        });
      }
    }

    // Emit one aggregated callback per rule (Req 8.3)
    for (const [, entry] of byRule) {
      this.onRuleExecuted({
        ruleId: entry.ruleId,
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
    const preExecutionSubtaskMap = new Map<string, Array<{ taskId: string; previousState: { completed: boolean; completedAt: string | null } }>>();
    if (event.depth === 0 && filteredActions.length > 0) {
      for (const action of filteredActions) {
        if (action.actionType === 'mark_card_complete' || action.actionType === 'mark_card_incomplete') {
          const allTasks = this.taskRepo.findAll();
          const subtasks = allTasks.filter((t) => t.parentTaskId === action.targetEntityId);
          if (subtasks.length > 0) {
            preExecutionSubtaskMap.set(action.ruleId, subtasks.map((sub) => ({
              taskId: sub.id,
              previousState: {
                completed: sub.completed,
                completedAt: sub.completedAt ?? null,
              },
            })));
          }
        }
      }
    }

    // Requirement 6.2: Delegate execution to the rule executor
    const newEvents = this.ruleExecutor.executeActions(filteredActions, event);

    // Capture undo snapshots for ALL actions (depth 0 only).
    // Each action gets its own snapshot so each toast can undo independently.
    if (event.depth === 0 && filteredActions.length > 0 && newEvents.length > 0) {
      // Clear previous snapshots for this new user gesture
      clearAllUndoSnapshots();

      for (const action of filteredActions) {
        const matchingEvent = newEvents.find(
          e => e.triggeredByRule === action.ruleId &&
               (e.entityId === action.targetEntityId || action.actionType === 'create_card')
        );

        if (matchingEvent) {
          const rule = rules.find(r => r.id === action.ruleId);
          if (rule) {
            const snapshot = buildUndoSnapshot(action, rule.name, matchingEvent);
            const subtaskSnaps = preExecutionSubtaskMap.get(action.ruleId);
            if (subtaskSnaps) {
              snapshot.subtaskSnapshots = subtaskSnaps;
            }
            pushUndoSnapshot(snapshot);
          }
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
            ruleId,
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
