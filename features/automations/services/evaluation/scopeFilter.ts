import type { AutomationRule } from '../../types';

/**
 * Determines if a rule is active for a given project based on its scope configuration.
 * 
 * Scope modes:
 * - 'all': Rule applies to all projects except those in excludedProjectIds
 * - 'selected': Rule applies only to projects in selectedProjectIds
 * - 'all_except': Rule applies to all projects except those in excludedProjectIds (same as 'all')
 * - undefined: Defaults to 'all' behavior
 */
export function isRuleActiveForProject(rule: AutomationRule, projectId: string): boolean {
  const scope = rule.scope ?? 'all';

  switch (scope) {
    case 'all':
    case 'all_except':
      // For 'all' and 'all_except', rule is active unless projectId is in excludedProjectIds
      return !rule.excludedProjectIds.includes(projectId);

    case 'selected':
      // For 'selected', rule is active only if projectId is in selectedProjectIds
      return rule.selectedProjectIds.includes(projectId);

    default:
      // Fallback to 'all' behavior for unknown scopes
      return !rule.excludedProjectIds.includes(projectId);
  }
}
