/**
 * Preview sentence builder for automation rules.
 * Builds "WHEN X IF Y THEN Z" preview parts for the rule dialog and rule cards.
 */

import type { TriggerType, ActionType, CardFilter } from '../../types';

// Re-exports consumed by co-located test files (cannot be removed without modifying tests)
export { TRIGGER_META, ACTION_META } from './ruleMetadata';
export { formatFilterDescription } from './formatters';
export { describeSchedule, computeNextRunDescription } from './scheduleDescriptions';

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

export interface TriggerConfig {
  type: TriggerType | null;
  sectionId: string | null;
  schedule?: Record<string, unknown>;
  lastEvaluatedAt?: string | null;
  catchUpPolicy?: 'catch_up_latest' | 'skip_missed';
}

export interface ActionConfig {
  type: ActionType | null;
  sectionId: string | null;
  dateOption: import('../../types').RelativeDateOption | null;
  position: 'top' | 'bottom' | null;
  cardTitle: string | null;
  cardDateOption: import('../../types').RelativeDateOption | null;
  specificMonth: number | null;
  specificDay: number | null;
  monthTarget: 'this_month' | 'next_month' | null;
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

  if (!trigger.sectionId) {
    parts.push({ type: 'text', content: triggerMeta.label + ' ' });
    parts.push({ type: 'value', content: '___' });
    return parts;
  }

  const sectionName = sectionLookup(trigger.sectionId);
  if (triggerMeta.type === 'card_moved_into_section') {
    parts.push({ type: 'text', content: 'moved into ' });
  } else if (triggerMeta.type === 'card_moved_out_of_section') {
    parts.push({ type: 'text', content: 'moved out of ' });
  } else if (triggerMeta.type === 'card_created_in_section') {
    parts.push({ type: 'text', content: 'created in ' });
  }
  parts.push({ type: 'value', content: sectionName || '___' });

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
    if (!action.sectionId) {
      parts.push({ type: 'text', content: 'move to ' });
      parts.push({ type: 'value', content: '___' });
    } else {
      const sectionName = sectionLookup(action.sectionId);
      const position = action.position || 'top';
      parts.push({ type: 'text', content: `move to ${position} of ` });
      parts.push({ type: 'value', content: sectionName || '___' });
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
      } else if (action.sectionId) {
        const sectionName = sectionLookup(action.sectionId);
        parts.push({ type: 'text', content: ' in ' });
        parts.push({ type: 'value', content: sectionName || '___' });
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
