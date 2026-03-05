/**
 * Factory for creating automation rule entities with generated metadata.
 * Centralizes id generation, timestamps, and order calculation.
 */

import type { AutomationRule } from '../../types';
import { v4 as uuidv4 } from 'uuid';

/** Input type for creating a new rule — excludes auto-generated fields. */
export type CreateRuleInput = Omit<
  AutomationRule,
  'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'lastExecutedAt' | 'recentExecutions' | 'order'
>;

/**
 * Create a new automation rule with generated id, timestamps, and order.
 *
 * @param data - Rule data without auto-generated fields
 * @param existingRules - Existing rules used to compute the next order value
 * @returns A complete AutomationRule ready for persistence
 */
export function createRuleWithMetadata(
  data: CreateRuleInput,
  existingRules: AutomationRule[]
): AutomationRule {
  const now = new Date().toISOString();
  const maxOrder = existingRules.reduce((max, rule) => Math.max(max, rule.order), -1);

  return {
    ...data,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    order: maxOrder + 1,
  };
}

// ============================================================================
// Promote to Global (TASK-10)
// ============================================================================

export interface PromoteRuleOptions {
  sectionResolution: 'by_name' | 'source_project_only';
  scope?: 'all' | 'selected';
  selectedProjectIds?: string[];
}

/**
 * Creates a global rule from a project-scoped rule.
 * Handles section ID → name resolution and scope configuration.
 */
export function createFromProjectRule(
  sourceRule: AutomationRule,
  options: PromoteRuleOptions,
  existingRules: AutomationRule[],
  allSections: Array<{ id: string; name: string; projectId: string | null }>
): AutomationRule {
  const now = new Date().toISOString();
  const maxOrder = existingRules.reduce((max, rule) => Math.max(max, rule.order), -1);

  // Resolve section names from IDs
  const findSectionName = (sectionId: string | null | undefined): string | undefined => {
    if (!sectionId) return undefined;
    const section = allSections.find((s) => s.id === sectionId);
    return section?.name;
  };

  const triggerSectionId = (sourceRule.trigger as any).sectionId as string | null | undefined;
  const actionSectionId = sourceRule.action.sectionId;

  let trigger = { ...sourceRule.trigger } as any;
  let action = { ...sourceRule.action } as any;

  if (options.sectionResolution === 'by_name') {
    // Clear section IDs, set section names for name-based resolution
    if (triggerSectionId) {
      trigger.sectionName = findSectionName(triggerSectionId) ?? trigger.sectionName;
      trigger.sectionId = null;
    }
    if (actionSectionId) {
      action.sectionName = findSectionName(actionSectionId) ?? action.sectionName;
      action.sectionId = null;
    }
  }

  // Determine scope
  let scope: 'all' | 'selected' = options.scope ?? 'selected';
  let selectedProjectIds = options.selectedProjectIds ?? [];

  if (options.sectionResolution === 'source_project_only') {
    scope = 'selected';
    selectedProjectIds = sourceRule.projectId ? [sourceRule.projectId] : [];
  }

  return {
    ...sourceRule,
    id: uuidv4(),
    projectId: null,
    name: `${sourceRule.name} (Global)`,
    trigger,
    action,
    filters: [...sourceRule.filters],
    scope,
    selectedProjectIds,
    excludedProjectIds: [],
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };
}
