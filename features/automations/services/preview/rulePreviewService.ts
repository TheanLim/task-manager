/**
 * Preview sentence builder for automation rules.
 * Builds "WHEN X IF Y THEN Z" preview parts for the rule dialog and rule cards.
 */

import type { TriggerType, ActionType, CardFilter, AutomationRule } from '../../types';
import type { TriggerConfig, ActionConfig } from '../configTypes';
import type { Task, Section } from '@/lib/schemas';
import { isRuleActiveForProject } from '../evaluation/scopeFilter';

// Re-export config types for backward compatibility — new code should import from configTypes
export type { TriggerConfig, ActionConfig } from '../configTypes';

import { TRIGGER_META, ACTION_META } from './ruleMetadata';
import type { TriggerMeta } from './ruleMetadata';

import { formatFilterDescription, formatDateOption } from './formatters';

import { describeSchedule } from './scheduleDescriptions';

/**
 * Sentinel value for action.sectionId that means "use the section from the triggering event."
 * Used when a section-level trigger (e.g. section_created) should target the newly created section.
 */
export const TRIGGER_SECTION_SENTINEL = '__trigger_section__';

// ============================================================================
// Types
// ============================================================================

export interface PreviewPart {
  type: 'text' | 'value';
  content: string;
}

// ============================================================================
// Preview Generation
// ============================================================================

/**
 * Build preview parts for the trigger portion of a rule.
 */
function buildTriggerParts(
  trigger: TriggerConfig,
  triggerMeta: TriggerMeta | null | undefined,
  sectionLookup: (id: string) => string | undefined
): PreviewPart[] {
  const parts: PreviewPart[] = [];

  if (!trigger.type || !triggerMeta) {
    parts.push({ type: 'value', content: '___' });
    return parts;
  }

  if (!triggerMeta.needsSection) {
    parts.push({ type: 'value', content: triggerMeta.label });
    return parts;
  }

  // Resolve section name: prefer sectionId lookup (authoritative), fall back to sectionName (global rules)
  const resolvedName = trigger.sectionId
    ? (sectionLookup(trigger.sectionId) ?? (trigger as any).sectionName ?? null)
    : (trigger as any).sectionName ?? null;

  if (!resolvedName && !trigger.sectionId && !(trigger as any).sectionName) {
    parts.push({ type: 'text', content: triggerMeta.label + ' ' });
    parts.push({ type: 'value', content: '___' });
    return parts;
  }

  if (triggerMeta.type === 'card_moved_into_section') {
    parts.push({ type: 'text', content: 'moved into ' });
  } else if (triggerMeta.type === 'card_moved_out_of_section') {
    parts.push({ type: 'text', content: 'moved out of ' });
  } else if (triggerMeta.type === 'card_created_in_section') {
    parts.push({ type: 'text', content: 'created in ' });
  }
  parts.push({ type: 'value', content: resolvedName || '___' });

  return parts;
}

/**
 * Build preview parts for the action portion of a rule.
 */
function buildActionParts(
  action: ActionConfig,
  sectionLookup: (id: string) => string | undefined
): PreviewPart[] {
  const parts: PreviewPart[] = [];

  if (!action.type) {
    parts.push({ type: 'value', content: '___' });
    return parts;
  }

  const actionMeta = ACTION_META.find((m) => m.type === action.type);
  if (!actionMeta) {
    parts.push({ type: 'value', content: '___' });
    return parts;
  }

  if (actionMeta.type === 'move_card_to_top_of_section' || actionMeta.type === 'move_card_to_bottom_of_section') {
    // Resolve section name: prefer sectionId lookup (authoritative), fall back to sectionName (global rules)
    const resolvedName = action.sectionId
      ? (sectionLookup(action.sectionId) ?? (action as any).sectionName ?? null)
      : (action as any).sectionName ?? null;

    if (!resolvedName && !action.sectionId && !(action as any).sectionName) {
      parts.push({ type: 'text', content: 'move to ' });
      parts.push({ type: 'value', content: '___' });
    } else {
      const position = action.position || 'top';
      parts.push({ type: 'text', content: `move to ${position} of ` });
      parts.push({ type: 'value', content: resolvedName || '___' });
    }
  } else if (actionMeta.type === 'set_due_date') {
    parts.push({ type: 'text', content: 'set due date to ' });
    parts.push({ type: 'value', content: action.dateOption ? formatDateOption(action.dateOption) : '___' });
  } else if (actionMeta.type === 'create_card') {
    if (!action.cardTitle) {
      parts.push({ type: 'text', content: 'create card ' });
      parts.push({ type: 'value', content: '___' });
    } else {
      parts.push({ type: 'text', content: 'create card "' });
      parts.push({ type: 'value', content: action.cardTitle });
      parts.push({ type: 'text', content: '"' });
      if (action.sectionId === TRIGGER_SECTION_SENTINEL) {
        parts.push({ type: 'text', content: ' in ' });
        parts.push({ type: 'value', content: 'the triggering section' });
      } else if (action.sectionId || (action as any).sectionName) {
        const resolvedName = (action as any).sectionName
          ? (action as any).sectionName as string
          : sectionLookup(action.sectionId!);
        parts.push({ type: 'text', content: ' in ' });
        parts.push({ type: 'value', content: resolvedName || '___' });
      }
    }
  } else {
    // Simple actions: mark_card_complete, mark_card_incomplete, remove_due_date
    parts.push({ type: 'value', content: actionMeta.label });
  }

  return parts;
}

/**
 * Builds an array of preview parts (text and value segments) for a rule configuration.
 * Incomplete configurations produce underscore placeholders.
 */
export function buildPreviewParts(
  trigger: TriggerConfig,
  action: ActionConfig,
  sectionLookup: (id: string) => string | undefined,
  filters?: CardFilter[]
): PreviewPart[] {
  const parts: PreviewPart[] = [];

  const triggerMeta = trigger.type ? TRIGGER_META.find((m) => m.type === trigger.type) : null;
  const isSectionTrigger = triggerMeta?.category === 'section_change';
  const isScheduledTrigger = triggerMeta?.category === 'scheduled';

  if (isScheduledTrigger) {
    const isOneTime = trigger.type === 'scheduled_one_time';

    if (isOneTime && trigger.schedule) {
      const desc = describeSchedule({ type: trigger.type!, schedule: trigger.schedule });
      parts.push({ type: 'value', content: desc });
    } else {
      parts.push({ type: 'text', content: 'Every ' });
      parts.push(...buildTriggerParts(trigger, triggerMeta, sectionLookup));
    }

    if (filters && filters.length > 0) {
      parts.push({ type: 'text', content: ', for cards ' });
      filters.forEach((filter, index) => {
        const description = formatFilterDescription(filter, sectionLookup);
        if (description) {
          parts.push({ type: 'value', content: description });
          if (index < filters.length - 1) {
            parts.push({ type: 'text', content: ' and ' });
          }
        }
      });
    }

    parts.push({ type: 'text', content: ', ' });
    parts.push(...buildActionParts(action, sectionLookup));
    return parts;
  }

  // Event triggers: "When a card/section [filters] is [trigger], [action]"
  parts.push({ type: 'text', content: isSectionTrigger ? 'When a section ' : 'When a card ' });

  if (filters && filters.length > 0) {
    filters.forEach((filter, index) => {
      const description = formatFilterDescription(filter, sectionLookup);
      if (description) {
        parts.push({ type: 'value', content: description });
        parts.push({ type: 'text', content: index < filters.length - 1 ? ' and ' : ' ' });
      }
    });
  }

  parts.push({ type: 'text', content: 'is ' });
  parts.push(...buildTriggerParts(trigger, triggerMeta, sectionLookup));
  parts.push({ type: 'text', content: ', ' });
  parts.push(...buildActionParts(action, sectionLookup));

  return parts;
}

/**
 * Concatenates preview parts into a plain string.
 */
export function buildPreviewString(parts: PreviewPart[]): string {
  return parts.map((p) => p.content).join('');
}

// ============================================================================
// Duplicate Rule Detection
// ============================================================================

/**
 * Checks whether a rule configuration duplicates an existing enabled rule.
 */
export function isDuplicateRule(
  trigger: TriggerConfig,
  action: ActionConfig,
  existingRules: Array<{
    id: string;
    enabled: boolean;
    trigger: { type: string; sectionId: string | null };
    action: { type: string; sectionId: string | null };
  }>,
  excludeRuleId?: string
): boolean {
  if (!trigger.type || !action.type) return false;

  return existingRules.some(
    (rule) =>
      rule.enabled &&
      rule.id !== excludeRuleId &&
      rule.trigger.type === trigger.type &&
      rule.trigger.sectionId === trigger.sectionId &&
      rule.action.type === action.type &&
      rule.action.sectionId === action.sectionId
  );
}

// ============================================================================
// Global Dry-Run Types & Functions (TASK-11)
// ============================================================================

export interface GlobalDryRunResult {
  task: { id: string; description: string; projectId: string };
  outcome: 'fire' | 'skip';
  skipReason?: string;
}

export interface GlobalDryRunSummary {
  totalFire: number;
  totalSkip: number;
  runAt: string;
  projectResults: Record<string, GlobalDryRunResult[]>;
}

/**
 * Runs a dry-run of a global rule across all scoped projects.
 * Returns per-project results grouped by project ID.
 */
export function runGlobalDryRun(
  rule: AutomationRule,
  projects: Array<{ id: string; name: string }>,
  allTasks: Task[],
  allSections: Section[]
): GlobalDryRunSummary {
  const scopedProjects = projects.filter((p) => isRuleActiveForProject(rule, p.id));
  const projectResults: Record<string, GlobalDryRunResult[]> = {};
  let totalFire = 0;
  let totalSkip = 0;

  for (const project of scopedProjects) {
    const projectTasks = allTasks.filter((t) => t.projectId === project.id);
    const projectSections = allSections.filter((s) => s.projectId === project.id);
    const results: GlobalDryRunResult[] = [];

    for (const task of projectTasks) {
      // Check if the trigger section exists in this project
      const triggerSectionId = (rule.trigger as any).sectionId as string | null | undefined;
      const triggerSectionName = (rule.trigger as any).sectionName as string | undefined;

      let sectionFound = true;
      let skipReason: string | undefined;

      if (triggerSectionName && !triggerSectionId) {
        // Name-based resolution: find section by name in this project
        const match = projectSections.find(
          (s) => s.name.toLowerCase().trim() === triggerSectionName.toLowerCase().trim()
        );
        if (!match) {
          sectionFound = false;
          skipReason = `Section "${triggerSectionName}" not found in project`;
        }
      } else if (triggerSectionId) {
        const match = projectSections.find((s) => s.id === triggerSectionId);
        if (!match) {
          sectionFound = false;
          skipReason = `Section ID "${triggerSectionId}" not found in project`;
        }
      }

      const outcome = sectionFound ? 'fire' : 'skip';
      if (outcome === 'fire') totalFire++;
      else totalSkip++;

      results.push({
        task: { id: task.id, description: task.description, projectId: project.id },
        outcome,
        skipReason,
      });
    }

    projectResults[project.id] = results;
  }

  return {
    totalFire,
    totalSkip,
    runAt: new Date().toISOString(),
    projectResults,
  };
}

/**
 * Estimates the total number of tasks that would be evaluated in a dry-run.
 */
export function estimateDryRunTaskCount(
  rule: AutomationRule,
  projects: Array<{ id: string; name: string }>,
  allTasks: Task[]
): number {
  const scopedProjects = projects.filter((p) => isRuleActiveForProject(rule, p.id));
  const scopedProjectIds = new Set(scopedProjects.map((p) => p.id));
  return allTasks.filter((t) => t.projectId !== null && scopedProjectIds.has(t.projectId)).length;
}
