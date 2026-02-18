import type { TaskRepository, SectionRepository } from '@/lib/repositories/types';
import type { AutomationRuleRepository } from '../repositories/types';
import type { TaskService } from '@/features/tasks/services/taskService';
import type { DomainEvent, EvaluationContext } from '../types';
import { evaluateRules } from './ruleEngine';
import { RuleExecutor } from './ruleExecutor';

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

    // Requirement 6.2: Delegate execution to the rule executor
    const newEvents = this.ruleExecutor.executeActions(filteredActions, event);

    // Requirements 11.1, 11.2: Notify about rule executions (only for top-level, user-initiated events)
    if (this.onRuleExecuted && event.depth === 0 && filteredActions.length > 0) {
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

        const batchSize = ruleActions.length;
        
        // Get task description for single execution
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

    // Requirement 6.3: Allow cascading evaluation up to maximum depth
    for (const newEvent of newEvents) {
      this.handleEvent(newEvent, currentDedupSet);
    }
  }
}
