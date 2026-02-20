import type { AutomationRule, DomainEvent, EvaluationContext, RuleAction } from '../../types';
import type { Task, Section } from '@/lib/schemas';
import { isScheduledTrigger } from '../../types';
import { ACTION_META } from '../preview/ruleMetadata';

/**
 * Result of a dry-run evaluation of a scheduled rule.
 * Contains the list of tasks that would be affected without executing any actions.
 */
export interface DryRunResult {
  matchingTasks: Array<{ id: string; name: string }>;
  actionDescription: string;
  totalCount: number;
}

const EMPTY_RESULT: DryRunResult = {
  matchingTasks: [],
  actionDescription: '',
  totalCount: 0,
};

/**
 * Preview what a scheduled rule would do if it ran right now, without executing any actions.
 *
 * Pure evaluation — no repository writes, no domain events, no toasts, no undo snapshots.
 * Accepts tasks and sections as arrays (not repositories) to guarantee zero side effects.
 *
 * @param rule - The automation rule to preview
 * @param nowMs - Current time in milliseconds
 * @param tasks - All tasks in the application
 * @param sections - All sections in the application
 * @param ruleEngine - The rule evaluation function (evaluateRules signature)
 * @returns DryRunResult with matching tasks and action description
 */
export function dryRunScheduledRule(
  rule: AutomationRule,
  nowMs: number,
  tasks: Task[],
  sections: Section[],
  ruleEngine: (event: DomainEvent, context: EvaluationContext) => RuleAction[]
): DryRunResult {
  // Disabled or broken rules produce empty result
  if (!rule.enabled || rule.brokenReason !== null) {
    return EMPTY_RESULT;
  }

  if (!isScheduledTrigger(rule.trigger)) {
    return EMPTY_RESULT;
  }

  // Build a synthetic schedule.fired event for the rule engine
  const syntheticEvent: DomainEvent = {
    type: 'schedule.fired',
    entityId: '',
    projectId: rule.projectId,
    changes: { triggerType: rule.trigger.type },
    previousValues: {},
    triggeredByRule: rule.id,
    depth: 0,
  };

  // Build evaluation context from the provided arrays
  const context: EvaluationContext = {
    allTasks: tasks,
    allSections: sections,
    maxDepth: 5,
    executedSet: new Set(),
  };

  // Evaluate what actions the rule engine would produce
  const actions = ruleEngine(syntheticEvent, context);

  // Map actions to task names using the tasks array
  // For create_card actions, show the card title instead of looking up an existing task
  const taskMap = new Map(tasks.map(t => [t.id, t.description]));
  const matchingTasks = actions.map(action => {
    if (action.actionType === 'create_card') {
      const title = action.params.cardTitle ?? rule.action.cardTitle ?? 'New card';
      return { id: action.targetEntityId, name: `📝 ${title}` };
    }
    return {
      id: action.targetEntityId,
      name: taskMap.get(action.targetEntityId) ?? 'Unknown task',
    };
  });

  // Generate human-readable action description from metadata
  const actionMeta = ACTION_META.find(m => m.type === rule.action.type);
  const actionDescription = actionMeta?.label ?? rule.action.type;

  return {
    matchingTasks,
    actionDescription,
    totalCount: matchingTasks.length,
  };
}
