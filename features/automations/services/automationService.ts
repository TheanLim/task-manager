import type { TaskRepository, SectionRepository } from '@/lib/repositories/types';
import type { AutomationRuleRepository } from '../repositories/types';
import type { TaskService } from '@/features/tasks/services/taskService';
import type { DomainEvent, EvaluationContext } from '../types';
import { evaluateRules } from './ruleEngine';
import { RuleExecutor } from './ruleExecutor';

/**
 * AutomationService orchestrates event handling, rule evaluation, and action execution.
 * 
 * Responsibilities:
 * - Subscribe to domain events and invoke the rule engine
 * - Delegate action execution to the rule executor
 * - Manage loop protection via depth limits and deduplication
 * - Handle cascading rule evaluation up to configurable max depth
 * 
 * Validates Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */
export class AutomationService {
  private maxDepth: number;
  private ruleExecutor: RuleExecutor;

  constructor(
    private ruleRepo: AutomationRuleRepository,
    private taskRepo: TaskRepository,
    private sectionRepo: SectionRepository,
    private taskService: TaskService,
    ruleExecutor: RuleExecutor,
    maxDepth = 5
  ) {
    this.ruleExecutor = ruleExecutor;
    this.maxDepth = maxDepth;
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

    // Requirement 6.3: Allow cascading evaluation up to maximum depth
    for (const newEvent of newEvents) {
      this.handleEvent(newEvent, currentDedupSet);
    }
  }
}
