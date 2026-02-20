import type { AutomationRule } from '../../types';

/**
 * Collects all non-null section IDs referenced by a rule's trigger, action, and filters.
 * Single source of truth for "which sections does this rule depend on?"
 *
 * Used by:
 * - brokenRuleDetector (to check if a deleted section breaks a rule)
 * - ruleImportExport (to validate imported rules against available sections)
 */
export function collectSectionReferences(rule: AutomationRule): string[] {
  const refs: string[] = [];

  if (rule.trigger.sectionId !== null) {
    refs.push(rule.trigger.sectionId);
  }

  if (rule.action.sectionId !== null) {
    refs.push(rule.action.sectionId);
  }

  for (const filter of rule.filters) {
    if (
      (filter.type === 'in_section' || filter.type === 'not_in_section') &&
      filter.sectionId
    ) {
      refs.push(filter.sectionId);
    }
  }

  return refs;
}
