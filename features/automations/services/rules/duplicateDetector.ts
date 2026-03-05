import type { AutomationRule } from '../../types';
import type { CardFilter } from '../../types';

/**
 * Checks if a candidate global rule has a duplicate among existing global rules.
 *
 * Two global rules are considered duplicates if:
 * - They have the same trigger type
 * - They have the same action type
 * - They have the same sectionName (case-insensitive)
 * - They have the same filters (order-insensitive comparison)
 *
 * Disabled rules are ignored (not considered duplicates).
 *
 * @param candidate - The new global rule to check for duplicates
 * @param existingGlobalRules - Array of existing global rules to compare against
 * @returns The matching existing rule if a duplicate is found, otherwise null
 */
export function findDuplicateGlobalRule(
  candidate: AutomationRule,
  existingGlobalRules: AutomationRule[]
): AutomationRule | null {
  // Filter out disabled rules
  const activeRules = existingGlobalRules.filter((rule) => rule.enabled);

  for (const existingRule of activeRules) {
    if (areRulesDuplicates(candidate, existingRule)) {
      return existingRule;
    }
  }

  return null;
}

/**
 * Checks if two rules are duplicates based on trigger, action, sectionName, and filters.
 */
function areRulesDuplicates(rule1: AutomationRule, rule2: AutomationRule): boolean {
  // Check trigger type matches
  if (rule1.trigger.type !== rule2.trigger.type) {
    return false;
  }

  // Check action type matches
  if (rule1.action.type !== rule2.action.type) {
    return false;
  }

  // Check sectionName matches (case-insensitive)
  // sectionName is only present on event triggers, not scheduled triggers
  const sectionName1 = 'sectionName' in rule1.trigger ? (rule1.trigger.sectionName ?? '') : '';
  const sectionName2 = 'sectionName' in rule2.trigger ? (rule2.trigger.sectionName ?? '') : '';
  if (sectionName1.toLowerCase() !== sectionName2.toLowerCase()) {
    return false;
  }

  // Check filters match (order-insensitive)
  if (!areFiltersEqual(rule1.filters, rule2.filters)) {
    return false;
  }

  return true;
}

/**
 * Compares two filter arrays for equality (order-insensitive).
 * Filters are considered equal if they have the same type and same properties.
 */
function areFiltersEqual(filters1: CardFilter[], filters2: CardFilter[]): boolean {
  if (filters1.length !== filters2.length) {
    return false;
  }

  // Create a copy of filters2 to track matched filters
  const unmatchedFilters = [...filters2];

  for (const filter1 of filters1) {
    const matchIndex = unmatchedFilters.findIndex((filter2) => areFiltersEqualSingle(filter1, filter2));
    if (matchIndex === -1) {
      return false;
    }
    unmatchedFilters.splice(matchIndex, 1);
  }

  return unmatchedFilters.length === 0;
}

/**
 * Compares two single filters for equality.
 */
function areFiltersEqualSingle(filter1: CardFilter, filter2: CardFilter): boolean {
  if (filter1.type !== filter2.type) {
    return false;
  }

  // For section-based filters, compare sectionId
  if (filter1.type === 'in_section' || filter1.type === 'not_in_section') {
    return (filter1 as { sectionId: string }).sectionId === (filter2 as { sectionId: string }).sectionId;
  }

  // For other filters, just type match is sufficient
  return true;
}
