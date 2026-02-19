import type { TriggerType, ActionType } from '../types';

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
