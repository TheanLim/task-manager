import type { TaskRepository, SectionRepository } from '@/lib/repositories/types';
import type { AutomationRuleRepository } from '../repositories/types';
import type { TaskService } from '@/features/tasks/services/taskService';
import type { AutomationRule, DomainEvent, EvaluationContext, RuleAction, BatchContext } from '../types';
import { evaluateRules } from './evaluation/ruleEngine';
import { RuleExecutor } from './execution/ruleExecutor';
import {
  clearAllUndoSnapshots,
  pushUndoSnapshot,
  buildUndoSnapshot,
} from './execution/undoService';

/**
 * Callback invoked when an automation rule executes successfully or is skipped.
 */
export interface RuleExecutionCallback {
  (params: {
    ruleId: string;
    ruleName: string;
    taskDescription: string;
    batchSize: number;
    /** True when the rule fired but was skipped (e.g. section not found) */
    skipped?: boolean;
    /** Human-readable reason for the skip */
    skipReason?: string;
  }): void;
}

/** Subtask state captured before execution for undo support. */
type SubtaskSnapshotMap = Map<string, Array<{ taskId: string; previousState: { completed: boolean; completedAt: string | null } }>>;

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
   */
  handleEvent(event: DomainEvent, dedupSet?: Set<string>): void {
    // Requirement 6.4: Halt if cascade depth exceeds maximum
    if (event.depth >= this.maxDepth) return;

    const currentDedupSet = dedupSet ?? new Set<string>();

    // Execution order: global rules fire first (baseline), project rules fire second (override).
    // Project rules have the last word when both rules act on the same entity.
    // This is hardcoded in Phase 1. Phase 2 adds a user-configurable order setting.
    const globalRules = this.ruleRepo.findGlobal().filter(
      (rule) => !rule.excludedProjectIds.includes(event.projectId)
    );
    const projectRules = this.ruleRepo.findByProjectId(event.projectId);
    const rules = [...globalRules, ...projectRules];

    const context: EvaluationContext = {
      allTasks: this.taskRepo.findAll(),
      allSections: this.sectionRepo.findAll(),
      maxDepth: this.maxDepth,
      executedSet: currentDedupSet,
    };

    const actions = evaluateRules(event, rules, context);
    const filteredActions = this.filterDuplicateActions(actions, currentDedupSet);

    // Capture subtask state BEFORE execution for undo
    const subtaskMap = this.capturePreExecutionSubtasks(event, filteredActions);

    // Execute actions
    const executedRuleIds = new Set<string>();
    const skippedEntries: Array<{ ruleId: string; ruleName: string; skipReason: string }> = [];
    const newEvents = this.ruleExecutor.executeActions(filteredActions, event, executedRuleIds, skippedEntries);

    // Undo + notifications only for top-level user-initiated events
    // Skip notifications for schedule.fired events — the scheduler/UI handles its own toasts
    if (event.depth === 0 && event.type !== 'schedule.fired') {
      if (executedRuleIds.size > 0) {
        const executedActions = filteredActions.filter((a) => executedRuleIds.has(a.ruleId));
        this.buildUndoSnapshots(executedActions, newEvents, rules, subtaskMap);
        this.notifyRuleExecutions(executedActions, rules);
      }
      // Fire warning callbacks for skipped rules (section not found)
      if (skippedEntries.length > 0 && this.onRuleExecuted) {
        for (const entry of skippedEntries) {
          this.onRuleExecuted({
            ruleId: entry.ruleId,
            ruleName: entry.ruleName,
            taskDescription: '',
            batchSize: 0,
            skipped: true,
            skipReason: entry.skipReason,
          });
        }
      }
    }

    // Requirement 6.3: Cascade
    for (const newEvent of newEvents) {
      this.handleEvent(newEvent, currentDedupSet);
    }
  }

  /**
   * Filter out duplicate actions using the dedup set.
   * Requirements 6.5, 6.6: Maintain "ruleId:entityId:actionType" entries to break cycles.
   */
  private filterDuplicateActions(actions: RuleAction[], dedupSet: Set<string>): RuleAction[] {
    return actions.filter(action => {
      const key = `${action.ruleId}:${action.targetEntityId}:${action.actionType}`;
      if (dedupSet.has(key)) return false;
      dedupSet.add(key);
      return true;
    });
  }

  /**
   * Capture subtask state before mark_complete/incomplete execution for undo support.
   * Only captures at depth 0 (user-initiated events).
   */
  private capturePreExecutionSubtasks(event: DomainEvent, actions: RuleAction[]): SubtaskSnapshotMap {
    const map: SubtaskSnapshotMap = new Map();
    if (event.depth !== 0 || actions.length === 0) return map;

    for (const action of actions) {
      if (action.actionType !== 'mark_card_complete' && action.actionType !== 'mark_card_incomplete') continue;

      const allTasks = this.taskRepo.findAll();
      const subtasks = allTasks.filter((t) => t.parentTaskId === action.targetEntityId);
      if (subtasks.length > 0) {
        map.set(action.ruleId, subtasks.map((sub) => ({
          taskId: sub.id,
          previousState: {
            completed: sub.completed,
            completedAt: sub.completedAt ?? null,
          },
        })));
      }
    }

    return map;
  }

  /**
   * Build undo snapshots for all executed actions (depth 0 only).
   * Each action gets its own snapshot so each toast can undo independently.
   *
   * For conflicting move actions on the same entity, only one snapshot is kept —
   * using the FIRST rule's previousValues (the true original state) but associated
   * with the LAST rule's ID (so the undo button on the final toast works correctly).
   */
  private buildUndoSnapshots(
    actions: RuleAction[],
    newEvents: DomainEvent[],
    rules: AutomationRule[],
    subtaskMap: SubtaskSnapshotMap
  ): void {
    if (newEvents.length === 0) return;

    clearAllUndoSnapshots();

    // For move actions on the same entity, track the first event's previousValues
    // (original state) and the last rule's ID (for undo button wiring).
    const MOVE_ACTION_TYPES = new Set([
      'move_card_to_top_of_section',
      'move_card_to_bottom_of_section',
    ]);

    // First pass: find the original previousValues for each entity's move chain
    const originalMoveState = new Map<string, { previousValues: DomainEvent['previousValues']; lastRuleId: string; lastRuleName: string }>();
    for (const action of actions) {
      if (!MOVE_ACTION_TYPES.has(action.actionType)) continue;
      const matchingEvent = newEvents.find(
        e => e.triggeredByRule === action.ruleId && e.entityId === action.targetEntityId
      );
      if (!matchingEvent) continue;
      const rule = rules.find(r => r.id === action.ruleId);
      if (!rule) continue;

      const key = action.targetEntityId;
      if (!originalMoveState.has(key)) {
        // First move on this entity — capture original previousValues
        originalMoveState.set(key, {
          previousValues: matchingEvent.previousValues,
          lastRuleId: action.ruleId,
          lastRuleName: rule.name,
        });
      } else {
        // Subsequent move — update lastRuleId to this rule (last writer)
        originalMoveState.get(key)!.lastRuleId = action.ruleId;
        originalMoveState.get(key)!.lastRuleName = rule.name;
      }
    }

    // Second pass: build snapshots
    const processedMoveEntities = new Set<string>();

    for (const action of actions) {
      const matchingEvent = newEvents.find(
        e => e.triggeredByRule === action.ruleId &&
             (e.entityId === action.targetEntityId || action.actionType === 'create_card')
      );
      if (!matchingEvent) continue;

      const rule = rules.find(r => r.id === action.ruleId);
      if (!rule) continue;

      if (MOVE_ACTION_TYPES.has(action.actionType)) {
        const key = action.targetEntityId;
        const moveInfo = originalMoveState.get(key);
        if (!moveInfo) continue;

        // Only emit one snapshot per entity's move chain — for the last rule
        if (action.ruleId !== moveInfo.lastRuleId) continue;
        if (processedMoveEntities.has(key)) continue;
        processedMoveEntities.add(key);

        // Build snapshot using original previousValues (not the intermediate state)
        const syntheticEvent: DomainEvent = {
          ...matchingEvent,
          previousValues: moveInfo.previousValues,
        };
        const snapshot = buildUndoSnapshot(action, moveInfo.lastRuleName, syntheticEvent);
        const subtaskSnaps = subtaskMap.get(action.ruleId);
        if (subtaskSnaps) snapshot.subtaskSnapshots = subtaskSnaps;
        pushUndoSnapshot(snapshot);
      } else {
        // Non-move actions: snapshot as normal
        const snapshot = buildUndoSnapshot(action, rule.name, matchingEvent);
        const subtaskSnaps = subtaskMap.get(action.ruleId);
        if (subtaskSnaps) snapshot.subtaskSnapshots = subtaskSnaps;
        pushUndoSnapshot(snapshot);
      }
    }
  }

  /**
   * Notify about rule executions via callback or batch context.
   * Requirements 8.1–8.4, 11.1, 11.2.
   */
  private notifyRuleExecutions(actions: RuleAction[], rules: AutomationRule[]): void {
    // For move actions on the same entity, only the LAST one determines final state.
    // Suppress toasts for earlier moves — the user only cares where the card ended up.
    const MOVE_ACTION_TYPES = new Set([
      'move_card_to_top_of_section',
      'move_card_to_bottom_of_section',
    ]);

    // Build a set of (entityId + actionType) keys for move actions that are
    // superseded by a later move on the same entity.
    const movesByEntity = new Map<string, string>(); // entityId → last ruleId
    for (const action of actions) {
      if (MOVE_ACTION_TYPES.has(action.actionType)) {
        // Later entries overwrite earlier ones — last writer wins
        movesByEntity.set(action.targetEntityId, action.ruleId);
      }
    }

    // Group actions by rule ID
    const actionsByRule = new Map<string, RuleAction[]>();
    for (const action of actions) {
      const existing = actionsByRule.get(action.ruleId) || [];
      existing.push(action);
      actionsByRule.set(action.ruleId, existing);
    }

    for (const [ruleId, ruleActions] of actionsByRule) {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) continue;

      // Filter out move actions that were superseded by a later move on the same entity
      const toastActions = ruleActions.filter(action => {
        if (!MOVE_ACTION_TYPES.has(action.actionType)) return true;
        return movesByEntity.get(action.targetEntityId) === ruleId;
      });

      if (toastActions.length === 0) continue; // all actions superseded — no toast

      if (this.batchContext) {
        // Batch mode: collect for aggregated toast later (Req 8.4)
        for (const action of toastActions) {
          const task = this.taskRepo.findById(action.targetEntityId);
          this.batchContext.executions.push({
            ruleId: rule.id,
            ruleName: rule.name,
            taskName: task?.description || 'Unknown task',
            actionDescription: action.actionType,
          });
        }
      } else if (this.onRuleExecuted) {
        // Non-batch mode: emit individual toast per rule
        const batchSize = toastActions.length;
        let taskDescription = '';
        if (batchSize === 1) {
          const task = this.taskRepo.findById(toastActions[0].targetEntityId);
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
}
