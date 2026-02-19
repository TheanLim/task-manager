import type { TriggerType, ActionType, RelativeDateOption, CardFilter } from '../types';

// Re-export metadata from dedicated module for backward compatibility
export { TRIGGER_META, ACTION_META } from './ruleMetadata';
export type { TriggerMeta, ActionMeta } from './ruleMetadata';
import { TRIGGER_META, ACTION_META } from './ruleMetadata';
import type { TriggerMeta } from './ruleMetadata';

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
}

export interface ActionConfig {
  type: ActionType | null;
  sectionId: string | null;
  dateOption: RelativeDateOption | null;
  position: 'top' | 'bottom' | null;
  cardTitle: string | null;
  cardDateOption: RelativeDateOption | null;
  specificMonth: number | null;
  specificDay: number | null;
  monthTarget: 'this_month' | 'next_month' | null;
}

// ============================================================================
// Preview Generation
// ============================================================================

/**
 * Generates a human-readable description for a filter.
 */
export function formatFilterDescription(
  filter: CardFilter,
  sectionLookup: (id: string) => string | undefined
): string {
  switch (filter.type) {
    case 'in_section':
      return `in "${sectionLookup(filter.sectionId) || '___'}"`;
    case 'not_in_section':
      return `not in "${sectionLookup(filter.sectionId) || '___'}"`;
    case 'has_due_date':
      return 'with a due date';
    case 'no_due_date':
      return 'without a due date';
    case 'is_overdue':
      return 'that is overdue';
    case 'due_today':
      return 'due today';
    case 'due_tomorrow':
      return 'due tomorrow';
    case 'due_this_week':
      return 'due this week';
    case 'due_next_week':
      return 'due next week';
    case 'due_this_month':
      return 'due this month';
    case 'due_next_month':
      return 'due next month';
    case 'not_due_today':
      return 'not due today';
    case 'not_due_tomorrow':
      return 'not due tomorrow';
    case 'not_due_this_week':
      return 'not due this week';
    case 'not_due_next_week':
      return 'not due next week';
    case 'not_due_this_month':
      return 'not due this month';
    case 'not_due_next_month':
      return 'not due next month';
    case 'due_in_less_than':
      return `due in less than ${filter.value} ${filter.unit === 'working_days' ? 'working days' : 'days'}`;
    case 'due_in_more_than':
      return `due in more than ${filter.value} ${filter.unit === 'working_days' ? 'working days' : 'days'}`;
    case 'due_in_exactly':
      return `due in exactly ${filter.value} ${filter.unit === 'working_days' ? 'working days' : 'days'}`;
    case 'due_in_between':
      return `due in ${filter.minValue}-${filter.maxValue} ${filter.unit === 'working_days' ? 'working days' : 'days'}`;
    default:
      return '';
  }
}

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
    // Scheduled: "Every [schedule], for cards [filters], [action]"
    parts.push({ type: 'text', content: 'Every ' });
    parts.push(...buildTriggerParts(trigger, triggerMeta, sectionLookup));

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

  // Filters
  if (filters && filters.length > 0) {
    filters.forEach((filter, index) => {
      const description = formatFilterDescription(filter, sectionLookup);
      if (description) {
        parts.push({ type: 'value', content: description });
        parts.push({ type: 'text', content: index < filters.length - 1 ? ' and ' : ' ' });
      }
    });
  }

  // Trigger
  parts.push({ type: 'text', content: 'is ' });
  parts.push(...buildTriggerParts(trigger, triggerMeta, sectionLookup));

  // Separator
  parts.push({ type: 'text', content: ', ' });

  // Action
  parts.push(...buildActionParts(action, sectionLookup));

  return parts;
}

/**
 * Concatenates preview parts into a plain string.
 * Used for auto-generating rule names from the preview sentence.
 *
 * @param parts - Array of preview parts
 * @returns Plain string representation of the preview
 */
export function buildPreviewString(parts: PreviewPart[]): string {
  return parts.map((p) => p.content).join('');
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format an ISO timestamp into a human-readable relative time string.
 * Returns "Just now" for timestamps less than 60 seconds ago,
 * then "Nm ago", "Nh ago", "Nd ago", or a locale date string.
 */
export function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'Just now';

  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return 'Just now';

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(isoTimestamp).toLocaleDateString();
}

function formatDateOption(option: RelativeDateOption): string {
  switch (option) {
    case 'today':
      return 'today';
    case 'tomorrow':
      return 'tomorrow';
    case 'next_working_day':
      return 'next working day';
    default:
      // TODO: Implement remaining date option formatting
      return option.replace(/_/g, ' ');
  }
}

// ============================================================================
// Duplicate Rule Detection
// ============================================================================

/**
 * Checks whether a rule configuration duplicates an existing enabled rule.
 * Two rules are considered duplicates when they share the same trigger type,
 * trigger sectionId, action type, and action sectionId.
 *
 * @param trigger - The trigger configuration being created/edited
 * @param action - The action configuration being created/edited
 * @param existingRules - All existing rules in the same project
 * @param excludeRuleId - Optional rule ID to exclude (for edit mode)
 * @returns true if a duplicate enabled rule exists
 *
 * Validates: Requirements 11.1
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
// Scheduled Trigger Descriptions
// ============================================================================

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Describe a schedule configuration in human-readable form.
 * Used in preview sentences and rule cards.
 */
export function describeSchedule(trigger: { type: string; schedule?: any }): string {
  if (!trigger.schedule) return 'Unknown';

  switch (trigger.type) {
    case 'scheduled_interval': {
      const mins = trigger.schedule.intervalMinutes;
      if (mins >= 1440 && mins % 1440 === 0) return `${mins / 1440} day${mins / 1440 > 1 ? 's' : ''}`;
      if (mins >= 60 && mins % 60 === 0) return `${mins / 60} hour${mins / 60 > 1 ? 's' : ''}`;
      return `${mins} minute${mins > 1 ? 's' : ''}`;
    }

    case 'scheduled_cron': {
      const { hour, minute, daysOfWeek, daysOfMonth } = trigger.schedule;
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      if (daysOfWeek?.length > 0) {
        const days = daysOfWeek.map((d: number) => DAY_NAMES[d]).join(', ');
        return `${days} at ${time}`;
      }
      if (daysOfMonth?.length > 0) {
        const ordinal = (n: number) => {
          const s = ['th', 'st', 'nd', 'rd'];
          const v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };
        const days = daysOfMonth.map(ordinal).join(', ');
        return `${days} of month at ${time}`;
      }
      return `day at ${time}`;
    }

    case 'scheduled_due_date_relative': {
      const { offsetMinutes, displayUnit } = trigger.schedule;
      const abs = Math.abs(offsetMinutes);
      const direction = offsetMinutes < 0 ? 'before' : 'after';
      let value: number;
      let unit: string;

      if (displayUnit === 'days' || (!displayUnit && abs >= 1440)) {
        value = Math.round(abs / 1440);
        unit = value === 1 ? 'day' : 'days';
      } else if (displayUnit === 'hours' || (!displayUnit && abs >= 60)) {
        value = Math.round(abs / 60);
        unit = value === 1 ? 'hour' : 'hours';
      } else {
        value = abs;
        unit = value === 1 ? 'minute' : 'minutes';
      }

      return `${value} ${unit} ${direction} due date`;
    }

    default:
      return 'Unknown';
  }
}

/**
 * Compute a human-readable "next run" description for a scheduled trigger.
 * Used on the Rule Card to show when the rule will fire next.
 */
export function computeNextRunDescription(
  trigger: { type: string; schedule?: any; lastEvaluatedAt?: string | null },
  nowMs: number
): string {
  if (!trigger.schedule) return 'Unknown';

  switch (trigger.type) {
    case 'scheduled_interval': {
      const intervalMs = trigger.schedule.intervalMinutes * 60 * 1000;
      if (!trigger.lastEvaluatedAt) return 'On next tick';
      const lastMs = new Date(trigger.lastEvaluatedAt).getTime();
      const nextMs = lastMs + intervalMs;
      const diffMs = nextMs - nowMs;
      if (diffMs <= 0) return 'On next tick';
      return `in ${formatDuration(diffMs)}`;
    }

    case 'scheduled_cron': {
      return `Next: ${describeSchedule(trigger)}`;
    }

    case 'scheduled_due_date_relative':
      return 'Checks on next tick';

    default:
      return 'Unknown';
  }
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}
