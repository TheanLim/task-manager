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
