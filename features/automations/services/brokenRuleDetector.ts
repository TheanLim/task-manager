import type { AutomationRuleRepository } from '../repositories/types';
import { collectSectionReferences } from './sectionReferenceCollector';

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
    if (collectSectionReferences(rule).includes(deletedSectionId)) {
      ruleRepo.update(rule.id, {
        enabled: false,
        brokenReason: 'section_deleted',
      });
    }
  }
}
