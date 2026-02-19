import type { AutomationRule } from '../types';

/**
 * Collects all section IDs referenced by a rule's trigger, action, and filters.
 * Returns only non-null section IDs.
 */
function collectSectionReferences(rule: AutomationRule): string[] {
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

/**
 * Validates imported automation rules against available section IDs.
 * Rules referencing sections not in the available set are marked as broken
 * (enabled=false, brokenReason='section_deleted'). Rules with all valid
 * references are preserved as-is.
 *
 * Validates: Requirements 5.3, 5.4
 *
 * @param rules - The imported automation rules to validate
 * @param availableSectionIds - Set of section IDs that exist in the imported data
 * @returns A new array of rules with invalid ones marked as broken
 */
export function validateImportedRules(
  rules: AutomationRule[],
  availableSectionIds: Set<string>,
): AutomationRule[] {
  return rules.map((rule) => {
    const refs = collectSectionReferences(rule);
    const hasInvalidRef = refs.some((id) => !availableSectionIds.has(id));

    if (hasInvalidRef) {
      return {
        ...rule,
        enabled: false,
        brokenReason: 'section_deleted',
      };
    }

    return rule;
  });
}
