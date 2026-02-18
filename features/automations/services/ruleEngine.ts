import type {
  DomainEvent,
  RuleAction,
  EvaluationContext,
  AutomationRule,
  TriggerType,
} from '../types';

/**
 * Builds an index of automation rules grouped by trigger type for O(1) lookup.
 * Only includes enabled rules with no brokenReason.
 *
 * @param rules - Array of automation rules to index
 * @returns Map of trigger types to arrays of matching rules
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

  return index;
}

/**
 * Evaluates a domain event against automation rules and returns matching actions.
 * This is a pure function with no side effects.
 *
 * @param event - The domain event to evaluate
 * @param rules - Array of automation rules to evaluate against
 * @param context - Read-only evaluation context (not used in current implementation but required for interface)
 * @returns Array of actions to execute
 */
export function evaluateRules(
  event: DomainEvent,
  rules: AutomationRule[],
  context: EvaluationContext
): RuleAction[] {
  const actions: RuleAction[] = [];

  // Build index for efficient lookup
  const ruleIndex = buildRuleIndex(rules);

  // Only process task.updated events (task.created and task.deleted don't trigger automations)
  if (event.type !== 'task.updated') {
    return actions;
  }

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
      if (rule.trigger.sectionId === newSectionId) {
        actions.push(createRuleAction(rule, event.entityId));
      }
    }

    // Match card_moved_out_of_section triggers
    const movedOutOfRules = ruleIndex.get('card_moved_out_of_section') ?? [];
    for (const rule of movedOutOfRules) {
      if (rule.trigger.sectionId === oldSectionId) {
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
        actions.push(createRuleAction(rule, event.entityId));
      }
    }

    // Match card_marked_incomplete triggers
    if (newCompleted === false && oldCompleted === true) {
      const markedIncompleteRules =
        ruleIndex.get('card_marked_incomplete') ?? [];
      for (const rule of markedIncompleteRules) {
        actions.push(createRuleAction(rule, event.entityId));
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
  const action = rule.action;

  return {
    ruleId: rule.id,
    actionType: action.type,
    targetEntityId,
    params: {
      sectionId: action.sectionId ?? undefined,
      position: action.position ?? undefined,
      dateOption: action.dateOption ?? undefined,
      completed:
        action.type === 'mark_card_complete'
          ? true
          : action.type === 'mark_card_incomplete'
            ? false
            : undefined,
    },
  };
}
