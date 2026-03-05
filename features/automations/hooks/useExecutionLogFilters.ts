import { useState, useMemo, useCallback } from 'react';
import {
  applyLogFilters,
  type EnrichedLogEntry,
  type ExecutionLogFilters,
  type OutcomeFilter,
  type DateRangeFilter,
} from '../services/preview/logFilterService';

const DEFAULT_FILTERS: ExecutionLogFilters = {
  ruleIds: [],
  projectIds: [],
  outcome: 'all',
  dateRange: '7d',
};

export interface UseExecutionLogFiltersResult {
  filters: ExecutionLogFilters;
  filteredEntries: EnrichedLogEntry[];
  hasActiveFilters: boolean;
  setRuleIds: (ids: string[]) => void;
  setProjectIds: (ids: string[]) => void;
  setOutcome: (outcome: OutcomeFilter) => void;
  setDateRange: (range: DateRangeFilter) => void;
  clearFilters: () => void;
}

export function useExecutionLogFilters(
  allEntries: EnrichedLogEntry[],
  initialOutcome: OutcomeFilter = 'all'
): UseExecutionLogFiltersResult {
  const [filters, setFilters] = useState<ExecutionLogFilters>({
    ...DEFAULT_FILTERS,
    outcome: initialOutcome,
  });

  const hasActiveFilters = useMemo(
    () =>
      filters.outcome !== 'all' ||
      filters.dateRange !== '7d' ||
      filters.ruleIds.length > 0 ||
      filters.projectIds.length > 0,
    [filters]
  );

  const filteredEntries = useMemo(() => {
    const result = applyLogFilters(allEntries, filters);
    // Preserve reference equality when no entries are filtered out
    return result.length === allEntries.length ? allEntries : result;
  }, [allEntries, filters]);

  const setRuleIds = useCallback((ids: string[]) => {
    setFilters(prev => ({ ...prev, ruleIds: ids }));
  }, []);

  const setProjectIds = useCallback((ids: string[]) => {
    setFilters(prev => ({ ...prev, projectIds: ids }));
  }, []);

  const setOutcome = useCallback((outcome: OutcomeFilter) => {
    setFilters(prev => ({ ...prev, outcome }));
  }, []);

  const setDateRange = useCallback((range: DateRangeFilter) => {
    setFilters(prev => ({ ...prev, dateRange: range }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  return {
    filters,
    filteredEntries,
    hasActiveFilters,
    setRuleIds,
    setProjectIds,
    setOutcome,
    setDateRange,
    clearFilters,
  };
}
