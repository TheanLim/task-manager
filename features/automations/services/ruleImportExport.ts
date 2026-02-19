import type { AutomationRule } from '../types';
import { isScheduledTrigger } from '../types';
import { TriggerTypeSchema } from '../schemas';
import { collectSectionReferences } from './sectionReferenceCollector';

/** Current schema version for export format */
export const SCHEMA_VERSION = 1;

/**
 * Validates imported automation rules against available section IDs.
 * Also handles:
 * - Unsupported trigger types → marked broken with 'unsupported_trigger'
 * - Scheduled rules → lastEvaluatedAt reset to null
 * - Schema version checking (caller handles warning display)
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
    // Check for unsupported trigger types
    const triggerTypeResult = TriggerTypeSchema.safeParse(rule.trigger?.type);
    if (!triggerTypeResult.success) {
      return {
        ...rule,
        enabled: false,
        brokenReason: 'unsupported_trigger',
      };
    }

    // Reset lastEvaluatedAt for scheduled rules (fresh evaluation in new environment)
    if (isScheduledTrigger(rule.trigger)) {
      rule = {
        ...rule,
        trigger: { ...rule.trigger, lastEvaluatedAt: null },
      } as AutomationRule;
    }

    // Check section references
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
