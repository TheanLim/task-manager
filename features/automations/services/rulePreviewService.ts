import type { TriggerType, ActionType, RelativeDateOption } from '../schemas';

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
}

// ============================================================================
// Metadata
// ============================================================================

export interface TriggerMeta {
  type: TriggerType;
  category: 'card_move' | 'card_change';
  label: string;
  needsSection: boolean;
}

export interface ActionMeta {
  type: ActionType;
  category: 'move' | 'status' | 'dates';
  label: string;
  needsSection: boolean;
  needsDateOption: boolean;
  needsPosition: boolean;
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
];

// ============================================================================
// Preview Generation
// ============================================================================

/**
 * Builds an array of preview parts (text and value segments) for a rule configuration.
 * Incomplete configurations produce underscore placeholders.
 *
 * @param trigger - The trigger configuration
 * @param action - The action configuration
 * @param sectionLookup - Function to resolve section ID to section name
 * @returns Array of preview parts that can be rendered as text or badges
 */
export function buildPreviewParts(
  trigger: TriggerConfig,
  action: ActionConfig,
  sectionLookup: (id: string) => string | undefined
): PreviewPart[] {
  const parts: PreviewPart[] = [];

  // Build trigger part
  parts.push({ type: 'text', content: 'When a card is ' });

  if (!trigger.type) {
    parts.push({ type: 'value', content: '___' });
  } else {
    const triggerMeta = TRIGGER_META.find((m) => m.type === trigger.type);
    if (!triggerMeta) {
      parts.push({ type: 'value', content: '___' });
    } else {
      if (triggerMeta.needsSection) {
        if (!trigger.sectionId) {
          parts.push({ type: 'text', content: triggerMeta.label + ' ' });
          parts.push({ type: 'value', content: '___' });
        } else {
          const sectionName = sectionLookup(trigger.sectionId);
          if (triggerMeta.type === 'card_moved_into_section') {
            parts.push({ type: 'text', content: 'moved into ' });
            parts.push({ type: 'value', content: sectionName || '___' });
          } else if (triggerMeta.type === 'card_moved_out_of_section') {
            parts.push({ type: 'text', content: 'moved out of ' });
            parts.push({ type: 'value', content: sectionName || '___' });
          }
        }
      } else {
        parts.push({ type: 'value', content: triggerMeta.label });
      }
    }
  }

  // Separator
  parts.push({ type: 'text', content: ', ' });

  // Build action part
  if (!action.type) {
    parts.push({ type: 'value', content: '___' });
  } else {
    const actionMeta = ACTION_META.find((m) => m.type === action.type);
    if (!actionMeta) {
      parts.push({ type: 'value', content: '___' });
    } else {
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
        if (!action.dateOption) {
          parts.push({ type: 'text', content: 'set due date to ' });
          parts.push({ type: 'value', content: '___' });
        } else {
          parts.push({ type: 'text', content: 'set due date to ' });
          const dateLabel = formatDateOption(action.dateOption);
          parts.push({ type: 'value', content: dateLabel });
        }
      } else {
        // Simple actions: mark_card_complete, mark_card_incomplete, remove_due_date
        parts.push({ type: 'value', content: actionMeta.label });
      }
    }
  }

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
  }
}
