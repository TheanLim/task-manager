import type { ExecutionLogEntry } from '../../types';

// ============================================================================
// Types
// ============================================================================

export type OutcomeFilter = 'all' | 'fired' | 'skipped' | 'error';
export type DateRangeFilter = '24h' | '7d' | 'all';
export type ExecutionLogFilters = {
  ruleIds: string[];
  projectIds: string[];
  outcome: OutcomeFilter;
  dateRange: DateRangeFilter;
};

export interface EnrichedLogEntry extends ExecutionLogEntry {
  id: string;
}

// ============================================================================
// Filter Logic
// ============================================================================

/**
 * Checks if an entry falls within the date range.
 */
function isWithinDateRange(timestamp: string, dateRange: DateRangeFilter): boolean {
  if (dateRange === 'all') {
    return true;
  }

  const now = Date.now();
  const entryTime = new Date(timestamp).getTime();
  const msAgo = now - entryTime;

  if (dateRange === '24h') {
    const oneDayMs = 24 * 60 * 60 * 1000;
    return msAgo <= oneDayMs;
  }

  if (dateRange === '7d') {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return msAgo <= sevenDaysMs;
  }

  return true;
}

/**
 * Checks if an entry matches the outcome filter.
 */
function matchesOutcome(entry: EnrichedLogEntry, outcome: OutcomeFilter): boolean {
  if (outcome === 'all') {
    return true;
  }
  if (outcome === 'fired') {
    return entry.executionType !== 'skipped';
  }
  if (outcome === 'skipped') {
    return entry.executionType === 'skipped';
  }
  if (outcome === 'error') {
    return entry.executionType === 'warning';
  }
  return true;
}

/**
 * Checks if an entry matches the ruleIds filter.
 */
function matchesRuleIds(entry: EnrichedLogEntry, ruleIds: string[]): boolean {
  if (ruleIds.length === 0) {
    return true;
  }
  return ruleIds.includes(entry.ruleId || '');
}

/**
 * Checks if an entry matches the projectIds filter.
 */
function matchesProjectIds(entry: EnrichedLogEntry, projectIds: string[]): boolean {
  if (projectIds.length === 0) {
    return true;
  }
  return projectIds.includes(entry.firingProjectId || '');
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Filters execution log entries based on the provided filters.
 * All filters are ANDed together.
 *
 * @param entries - The log entries to filter
 * @param filters - The filter criteria
 * @returns Filtered log entries
 */
export function applyLogFilters(
  entries: EnrichedLogEntry[],
  filters: ExecutionLogFilters
): EnrichedLogEntry[] {
  return entries.filter(entry => {
    if (!matchesRuleIds(entry, filters.ruleIds)) {
      return false;
    }
    if (!matchesProjectIds(entry, filters.projectIds)) {
      return false;
    }
    if (!matchesOutcome(entry, filters.outcome)) {
      return false;
    }
    if (!isWithinDateRange(entry.timestamp, filters.dateRange)) {
      return false;
    }
    return true;
  });
}
