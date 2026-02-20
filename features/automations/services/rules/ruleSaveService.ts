/**
 * Service for building rule data objects from wizard state.
 * Extracts entity construction logic from RuleDialog's handleSave callback
 * so the component doesn't do inline object building with `as any` casts.
 */

import type { AutomationRule, CardFilter, Trigger, Action } from '../../types';
import {
  buildPreviewParts,
  buildPreviewString,
  type TriggerConfig,
  type ActionConfig,
} from '../preview/rulePreviewService';
import type { Section } from '@/lib/schemas';

// ─── Params ─────────────────────────────────────────────────────────────

export interface RuleSaveParams {
  trigger: TriggerConfig;
  filters: CardFilter[];
  action: ActionConfig;
  ruleName: string;
  sections: Section[];
}

export interface RuleUpdateParams extends RuleSaveParams {
  editingRule: AutomationRule;
}

export interface NewRuleParams extends RuleSaveParams {
  projectId: string;
}

// ─── Internals ──────────────────────────────────────────────────────────

function buildTriggerObject(trigger: TriggerConfig, existingLastEvaluatedAt?: string | null): Trigger {
  const base = {
    type: trigger.type!,
    sectionId: trigger.sectionId,
  };

  if (trigger.schedule) {
    return {
      ...base,
      schedule: trigger.schedule,
      lastEvaluatedAt: existingLastEvaluatedAt ?? null,
      catchUpPolicy: trigger.catchUpPolicy ?? 'catch_up_latest',
    } as Trigger;
  }

  return base as Trigger;
}

function buildActionObject(action: ActionConfig): Action {
  return {
    type: action.type!,
    sectionId: action.sectionId,
    dateOption: action.dateOption,
    position: action.position,
    cardTitle: action.cardTitle,
    cardDateOption: action.cardDateOption,
    specificMonth: action.specificMonth,
    specificDay: action.specificDay,
    monthTarget: action.monthTarget,
  };
}

function resolveRuleName(
  ruleName: string,
  trigger: TriggerConfig,
  action: ActionConfig,
  sections: Section[],
): string {
  if (ruleName.trim()) return ruleName.trim();
  const sectionLookup = (id: string) => sections.find((s) => s.id === id)?.name;
  return buildPreviewString(buildPreviewParts(trigger, action, sectionLookup));
}

function allSectionRefsValid(
  trigger: TriggerConfig,
  action: ActionConfig,
  filters: CardFilter[],
  sections: Section[],
): boolean {
  const sectionIds = new Set(sections.map((s) => s.id));
  return [
    trigger.sectionId,
    action.sectionId,
    ...filters
      .filter((f): f is CardFilter & { sectionId: string } => 'sectionId' in f)
      .map((f) => f.sectionId),
  ]
    .filter(Boolean)
    .every((id) => sectionIds.has(id!));
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Build a `Partial<AutomationRule>` updates object for an existing rule.
 * Clears `brokenReason` and re-enables the rule when all section refs are valid.
 */
export function buildRuleUpdates({ trigger, filters, action, ruleName, sections, editingRule }: RuleUpdateParams): Partial<AutomationRule> {
  const finalName = resolveRuleName(ruleName, trigger, action, sections);

  const updates: Partial<AutomationRule> = {
    name: finalName,
    trigger: buildTriggerObject(trigger, (editingRule.trigger as Trigger & { lastEvaluatedAt?: string | null }).lastEvaluatedAt ?? null),
    filters,
    action: buildActionObject(action),
  };

  if (editingRule.brokenReason && allSectionRefsValid(trigger, action, filters, sections)) {
    updates.brokenReason = null;
    updates.enabled = true;
  }

  return updates;
}

/**
 * Build the data object for creating a brand-new rule.
 * Returns everything except auto-generated fields (id, timestamps, order, counters).
 */
export function buildNewRuleData({ trigger, filters, action, ruleName, sections, projectId }: NewRuleParams): Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'lastExecutedAt' | 'recentExecutions' | 'order'> {
  const finalName = resolveRuleName(ruleName, trigger, action, sections);

  return {
    projectId,
    name: finalName,
    trigger: buildTriggerObject(trigger),
    filters,
    action: buildActionObject(action),
    enabled: true,
    brokenReason: null,
    bulkPausedAt: null,
  };
}
