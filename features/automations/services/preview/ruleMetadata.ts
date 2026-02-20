import type { TriggerType, ActionType, CardFilterType } from '../../types';

// ============================================================================
// Metadata types
// ============================================================================

export interface TriggerMeta {
  type: TriggerType;
  category: 'card_move' | 'card_change' | 'section_change' | 'scheduled';
  label: string;
  needsSection: boolean;
  needsSchedule?: boolean;
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

export interface FilterMeta {
  type: CardFilterType;
  category: 'age' | 'section_duration' | 'overdue';
  label: string;
  /** Produces a human-readable description, e.g. "created more than 5 days ago" */
  descriptionFormatter: (value: number, unit: string) => string;
}

// ============================================================================
// Metadata constants
// ============================================================================

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
  // Scheduled triggers
  {
    type: 'scheduled_interval',
    category: 'scheduled',
    label: 'on a recurring interval',
    needsSection: false,
    needsSchedule: true,
  },
  {
    type: 'scheduled_cron',
    category: 'scheduled',
    label: 'at a specific time',
    needsSection: false,
    needsSchedule: true,
  },
  {
    type: 'scheduled_due_date_relative',
    category: 'scheduled',
    label: 'relative to due date',
    needsSection: false,
    needsSchedule: true,
  },
  {
    type: 'scheduled_one_time',
    category: 'scheduled',
    label: 'at a specific date and time',
    needsSection: false,
    needsSchedule: true,
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
// Filter metadata — Phase 5b age-based and section duration filters
// ============================================================================

export const FILTER_META: FilterMeta[] = [
  {
    type: 'created_more_than',
    category: 'age',
    label: 'Created more than...',
    descriptionFormatter: (value, unit) => `created more than ${value} ${unit} ago`,
  },
  {
    type: 'completed_more_than',
    category: 'age',
    label: 'Completed more than...',
    descriptionFormatter: (value, unit) => `completed more than ${value} ${unit} ago`,
  },
  {
    type: 'last_updated_more_than',
    category: 'age',
    label: 'Not updated in...',
    descriptionFormatter: (value, unit) => `not updated in ${value} ${unit}`,
  },
  {
    type: 'not_modified_in',
    category: 'age',
    label: 'Not modified in...',
    descriptionFormatter: (value, unit) => `not modified in ${value} ${unit}`,
  },
  {
    type: 'overdue_by_more_than',
    category: 'overdue',
    label: 'Overdue by more than...',
    descriptionFormatter: (value, unit) => `overdue by more than ${value} ${unit}`,
  },
  {
    type: 'in_section_for_more_than',
    category: 'section_duration',
    label: 'In current section for more than...',
    descriptionFormatter: (value, unit) => `in current section for more than ${value} ${unit}`,
  },
];

/**
 * Look up the dropdown label for a filter type.
 * Returns empty string if the filter type has no metadata entry.
 */
export function formatFilterLabel(filterType: CardFilterType): string {
  return FILTER_META.find((m) => m.type === filterType)?.label ?? '';
}
