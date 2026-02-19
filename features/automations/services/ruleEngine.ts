import type {
  DomainEvent,
  RuleAction,
  EvaluationContext,
  AutomationRule,
  TriggerType,
} from '../types';
import { evaluateFilters, type FilterContext } from './filterPredicates';

/**
 * Builds an index of automation rules grouped by trigger type for O(1) lookup.
 * Only includes enabled rules with no brokenReason.
 * Rules within each group are sorted by `order` ascending, then `createdAt` ascending as tiebreaker.
 *
 * @param rules - Array of automation rules to index
 * @returns Map of trigger types to arrays of matching rules (sorted by order, then createdAt)
 */
export function buildRuleIndex(
  rules: AutomationRule[]
): Map<TriggerType, AutomationRule[]> {
  const index = new Map<TriggerType, AutomationRule[]>();

  // Filter to enabled rules with no brokenReason
  const activeRules = rules.filter(
    (rule) => rule.enabled && rule.brokenReason === null
  );

  // Group by trigger type
  for (const rule of activeRules) {
    const triggerType = rule.trigger.type;
    const existing = index.get(triggerType) ?? [];
    existing.push(rule);
    index.set(triggerType, existing);
  }

  // Sort each group by order ascending, then createdAt ascending as tiebreaker
  for (const ruleList of index.values()) {
    ruleList.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  return index;
}

/**
 * Evaluates a domain event against automation rules and returns matching actions.
 * This is a pure function with no side effects.
 *
 * @param event - The domain event to evaluate
 * @param rules - Array of automation rules to evaluate against
 * @param context - Read-only evaluation context containing tasks and sections
 * @returns Array of actions to execute
 */
export function evaluateRules(
  event: DomainEvent,
  rules: AutomationRule[],
  context: EvaluationContext
): RuleAction[] {
  const actions: RuleAction[] = [];

  // Skip subtask events — automations only apply to top-level tasks
  if (event.type === 'task.created' || event.type === 'task.updated' || event.type === 'task.deleted') {
    const task = context.allTasks.find((t) => t.id === event.entityId);
    if (task && task.parentTaskId !== null) {
      return actions; // Subtask — skip all rule evaluation
    }
  }

  // Build index for efficient lookup
  const ruleIndex = buildRuleIndex(rules);

  // Create filter context for date-based filter evaluation
  const filterContext: FilterContext = {
    now: new Date(),
  };

  // Helper function to check if a rule's filters match the task
  const passesFilters = (rule: AutomationRule, taskId: string): boolean => {
    // Empty filters array matches all tasks (backward compatible)
    if (!rule.filters || rule.filters.length === 0) {
      return true;
    }

    // Find the task in the context
    const task = context.allTasks.find((t) => t.id === taskId);
    if (!task) {
      return false; // Task not found, skip rule
    }

    // Evaluate all filters with AND logic
    return evaluateFilters(rule.filters, task, filterContext);
  };

  // Handle schedule.fired events (scheduled triggers)
  if (event.type === 'schedule.fired') {
    const triggerType = event.changes.triggerType as string;
    const firedRuleId = event.triggeredByRule;

    const matchingRules = ruleIndex.get(triggerType as TriggerType) ?? [];

    for (const rule of matchingRules) {
      // Only match the specific rule that the scheduler determined should fire
      if (rule.id !== firedRuleId) continue;

      if (triggerType === 'scheduled_due_date_relative') {
        // entityId is the task ID — apply filters to that specific task
        if (passesFilters(rule, event.entityId)) {
          actions.push(createRuleAction(rule, event.entityId));
        }
      } else {
        // For interval/cron: apply action to ALL tasks matching filters
        const matchingTasks = context.allTasks.filter((task) => {
          if (task.parentTaskId !== null) return false; // skip subtasks
          return passesFilters(rule, task.id);
        });

        for (const task of matchingTasks) {
          actions.push(createRuleAction(rule, task.id));
        }
      }
    }

    return actions;
  }

  // Handle task.created events
  if (event.type === 'task.created') {
    const sectionId = event.changes.sectionId as string | undefined;
    
    // Match card_created_in_section triggers
    const createdInSectionRules = ruleIndex.get('card_created_in_section') ?? [];
    for (const rule of createdInSectionRules) {
      if (rule.trigger.sectionId === sectionId && passesFilters(rule, event.entityId)) {
        actions.push(createRuleAction(rule, event.entityId));
      }
    }
    
    return actions;
  }

  // Handle section.created events
  if (event.type === 'section.created') {
    // Match section_created triggers (no filter evaluation for section events)
    const sectionCreatedRules = ruleIndex.get('section_created') ?? [];
    for (const rule of sectionCreatedRules) {
      // Section events don't have filters, so we just match the trigger
      // Note: createRuleAction expects a targetEntityId, which for section events is the section ID
      actions.push(createRuleAction(rule, event.entityId));
    }
    
    return actions;
  }

  // Handle section.updated events
  if (event.type === 'section.updated') {
    // Check for name change (section renamed)
    if (
      'name' in event.changes &&
      event.changes.name !== event.previousValues.name
    ) {
      // Match section_renamed triggers (no filter evaluation for section events)
      const sectionRenamedRules = ruleIndex.get('section_renamed') ?? [];
      for (const rule of sectionRenamedRules) {
        actions.push(createRuleAction(rule, event.entityId));
      }
    }
    
    return actions;
  }

  // Handle task.updated events
  if (event.type === 'task.updated') {
    // Check for section change (card moved)
    if (
      'sectionId' in event.changes &&
      event.changes.sectionId !== event.previousValues.sectionId
    ) {
      const newSectionId = event.changes.sectionId as string | undefined;
      const oldSectionId = event.previousValues.sectionId as string | undefined;

      // Match card_moved_into_section triggers
      const movedIntoRules = ruleIndex.get('card_moved_into_section') ?? [];
      for (const rule of movedIntoRules) {
        if (rule.trigger.sectionId === newSectionId && passesFilters(rule, event.entityId)) {
          actions.push(createRuleAction(rule, event.entityId));
        }
      }

      // Match card_moved_out_of_section triggers
      const movedOutOfRules = ruleIndex.get('card_moved_out_of_section') ?? [];
      for (const rule of movedOutOfRules) {
        if (rule.trigger.sectionId === oldSectionId && passesFilters(rule, event.entityId)) {
          actions.push(createRuleAction(rule, event.entityId));
        }
      }
    }

    // Check for completed status change
    if (
      'completed' in event.changes &&
      event.changes.completed !== event.previousValues.completed
    ) {
      const newCompleted = event.changes.completed as boolean;
      const oldCompleted = event.previousValues.completed as boolean;

      // Match card_marked_complete triggers
      if (newCompleted === true && oldCompleted === false) {
        const markedCompleteRules = ruleIndex.get('card_marked_complete') ?? [];
        for (const rule of markedCompleteRules) {
          if (passesFilters(rule, event.entityId)) {
            actions.push(createRuleAction(rule, event.entityId));
          }
        }
      }

      // Match card_marked_incomplete triggers
      if (newCompleted === false && oldCompleted === true) {
        const markedIncompleteRules =
          ruleIndex.get('card_marked_incomplete') ?? [];
        for (const rule of markedIncompleteRules) {
          if (passesFilters(rule, event.entityId)) {
            actions.push(createRuleAction(rule, event.entityId));
          }
        }
      }
    }
  }

  return actions;
}

/**
 * Creates a RuleAction from an AutomationRule and target entity ID.
 *
 * @param rule - The automation rule that matched
 * @param targetEntityId - The ID of the entity to apply the action to
 * @returns A RuleAction ready for execution
 */
function createRuleAction(
  rule: AutomationRule,
  targetEntityId: string
): RuleAction {
  const { type, sectionId, position, dateOption, specificMonth, specificDay, monthTarget, cardTitle, cardDateOption } = rule.action;

  return {
    ruleId: rule.id,
    actionType: type,
    targetEntityId,
    params: {
      sectionId: sectionId ?? undefined,
      position: position ?? undefined,
      dateOption: dateOption ?? undefined,
      completed:
        type === 'mark_card_complete'
          ? true
          : type === 'mark_card_incomplete'
            ? false
            : undefined,
      specificMonth: specificMonth ?? undefined,
      specificDay: specificDay ?? undefined,
      monthTarget: monthTarget ?? undefined,
      cardTitle: cardTitle ?? undefined,
      cardDateOption: cardDateOption ?? undefined,
    },
  };
}
