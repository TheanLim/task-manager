import type { TriggerType, ActionType, RelativeDateOption, CardFilter } from '../types';

// ============================================================================
// Constants
// ============================================================================

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
// Metadata
// ============================================================================

export interface TriggerMeta {
  type: TriggerType;
  category: 'card_move' | 'card_change' | 'section_change';
  label: string;
  needsSection: boolean;
}

export interface ActionMeta {
  type: ActionType;
  category: 'move' | 'status' | 'dates' | 'create';
  label: string;
  needsSection: boolean;
  needsDateOption: boolean;
  needsPosition: boolean;
  needsTitle?: boolean;
  needsCardDateOption?: boolean;
}

export const TRIGGER_META: TriggerMeta[] = [
  {
    type: 'card_moved_into_section',
    category: 'card_move',
    label: 'moved into section',
    needsSection: true,
  },
  {
    type: 'card_moved_out_of_section',
    category: 'card_move',
    label: 'moved out of section',
    needsSection: true,
  },
  {
    type: 'card_created_in_section',
    category: 'card_move',
    label: 'created in section',
    needsSection: true,
  },
  {
    type: 'card_marked_complete',
    category: 'card_change',
    label: 'marked complete',
    needsSection: false,
  },
  {
    type: 'card_marked_incomplete',
    category: 'card_change',
    label: 'marked incomplete',
    needsSection: false,
  },
  {
    type: 'section_created',
    category: 'section_change',
    label: 'created',
    needsSection: false,
  },
  {
    type: 'section_renamed',
    category: 'section_change',
    label: 'renamed',
    needsSection: false,
  },
];

export const ACTION_META: ActionMeta[] = [
  {
    type: 'move_card_to_top_of_section',
    category: 'move',
    label: 'move to top of section',
    needsSection: true,
    needsDateOption: false,
    needsPosition: true,
  },
  {
    type: 'move_card_to_bottom_of_section',
    category: 'move',
    label: 'move to bottom of section',
    needsSection: true,
    needsDateOption: false,
    needsPosition: true,
  },
  {
    type: 'mark_card_complete',
    category: 'status',
    label: 'mark as complete',
    needsSection: false,
    needsDateOption: false,
    needsPosition: false,
  },
  {
    type: 'mark_card_incomplete',
    category: 'status',
    label: 'mark as incomplete',
    needsSection: false,
    needsDateOption: false,
    needsPosition: false,
  },
  {
    type: 'set_due_date',
    category: 'dates',
    label: 'set due date',
    needsSection: false,
    needsDateOption: true,
    needsPosition: false,
  },
  {
    type: 'remove_due_date',
    category: 'dates',
    label: 'remove due date',
    needsSection: false,
    needsDateOption: false,
    needsPosition: false,
  },
  {
    type: 'create_card',
    category: 'create',
    label: 'create new card',
    needsSection: true,
    needsDateOption: false,
    needsPosition: false,
    needsTitle: true,
    needsCardDateOption: true,
  },
];

// ============================================================================
// Preview Generation
// ============================================================================

/**
 * Generates a human-readable description for a filter.
 */
function formatFilterDescription(
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
 * Builds an array of preview parts (text and value segments) for a rule configuration.
 * Incomplete configurations produce underscore placeholders.
 *
 * @param trigger - The trigger configuration
 * @param action - The action configuration
 * @param sectionLookup - Function to resolve section ID to section name
 * @param filters - Optional array of card filters to include in the preview
 * @returns Array of preview parts that can be rendered as text or badges
 */
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

  // Subject
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

