import { AutomationRule } from '../../types';

/**
 * Cleans up excludedProjectIds when scope changes.
 * When scope becomes 'selected', excludedProjectIds should only contain
 * projects that are in selectedProjectIds (projects to exclude from the selected ones).
 * When scope changes to other values, excludedProjectIds is returned unchanged.
 */
export function cleanExcludedProjectIds(
  updates: Partial<AutomationRule>,
  currentRule: AutomationRule
): Partial<AutomationRule> {
  const newScope = updates.scope;
  const currentScope = currentRule.scope;
  const selectedProjectIds = updates.selectedProjectIds ?? currentRule.selectedProjectIds ?? [];
  const excludedProjectIds = currentRule.excludedProjectIds ?? [];

  // If scope is not changing, return original excludedProjectIds
  if (!newScope || newScope === currentScope) {
    return { excludedProjectIds };
  }

  // When scope becomes 'selected', keep only projects that are in selectedProjectIds
  if (newScope === 'selected') {
    return {
      excludedProjectIds: excludedProjectIds.filter((id) =>
        selectedProjectIds.includes(id)
      ),
    };
  }

  // For other scope changes ('all', 'all_except'), return original excludedProjectIds
  return { excludedProjectIds };
}
