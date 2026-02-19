import type { AutomationRule } from '../types';
import { collectSectionReferences } from './sectionReferenceCollector';

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
