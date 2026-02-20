/**
 * General-purpose formatting utilities for the automations feature.
 * Pure functions — no side effects, no repository access.
 */

import type { RelativeDateOption, CardFilter } from '../../types';
import { FILTER_META } from './ruleMetadata';

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

/**
 * Format a RelativeDateOption enum value into a human-readable string.
 */
export function formatDateOption(option: RelativeDateOption): string {
  switch (option) {
    case 'today':
      return 'today';
    case 'tomorrow':
      return 'tomorrow';
    case 'next_working_day':
      return 'next working day';
    default:
      return option.replace(/_/g, ' ');
  }
}

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
    case 'created_more_than':
    case 'completed_more_than':
    case 'last_updated_more_than':
    case 'not_modified_in':
    case 'overdue_by_more_than':
    case 'in_section_for_more_than': {
      const meta = FILTER_META.find((m) => m.type === filter.type);
      if (meta) {
        return meta.descriptionFormatter(filter.value, filter.unit === 'working_days' ? 'working days' : 'days');
      }
      return '';
    }
    default:
      return '';
  }
}
