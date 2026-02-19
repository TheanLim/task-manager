import type { AutomationRule } from '../types';
import type { AutomationRuleRepository } from '../repositories/types';

/**
 * Checks whether a rule references the given section ID in its trigger,
 * action, or any filter that carries a sectionId.
 */
function referencesSection(rule: AutomationRule, sectionId: string): boolean {
  if (rule.trigger.sectionId === sectionId) return true;
  if (rule.action.sectionId === sectionId) return true;

  for (const filter of rule.filters) {
    if (
      (filter.type === 'in_section' || filter.type === 'not_in_section') &&
      filter.sectionId === sectionId
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Scans all automation rules for a project and disables any that reference
 * the deleted section in their trigger, action, or filters.
 *
 * Validates: Requirements 2.1, 2.2
 *
 * @param deletedSectionId - The ID of the section that was deleted
 * @param projectId - The project to scan rules for
 * @param ruleRepo - The automation rule repository
 */
export function detectBrokenRules(
  deletedSectionId: string,
  projectId: string,
  ruleRepo: AutomationRuleRepository
): void {
  const rules = ruleRepo.findByProjectId(projectId);

  for (const rule of rules) {
    if (referencesSection(rule, deletedSectionId)) {
      ruleRepo.update(rule.id, {
        enabled: false,
        brokenReason: 'section_deleted',
      });
    }
  }
}
