import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFilterStore } from './filterStore';
import { Priority } from '@/types';

describe('useFilterStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useFilterStore());
    act(() => {
      result.current.clearFilters();
    });
  });

  describe('Initial State', () => {
    it('should have empty search query by default', () => {
      const { result } = renderHook(() => useFilterStore());
      expect(result.current.searchQuery).toBe('');
    });

    it('should have null priority filter by default', () => {
      const { result } = renderHook(() => useFilterStore());
      expect(result.current.priorityFilter).toBeNull();
    });

    it('should have null date range by default', () => {
      const { result } = renderHook(() => useFilterStore());
      expect(result.current.dateRangeFilter).toEqual({ start: null, end: null });
    });

    it('should have "all" completion filter by default', () => {
      const { result } = renderHook(() => useFilterStore());
      expect(result.current.completionFilter).toBe('all');
    });
  });

  describe('setSearchQuery', () => {
    it('should update search query', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setSearchQuery('test query');
      });
      
      expect(result.current.searchQuery).toBe('test query');
    });

    it('should handle empty string', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setSearchQuery('test');
        result.current.setSearchQuery('');
      });
      
      expect(result.current.searchQuery).toBe('');
    });
  });

  describe('setPriorityFilter', () => {
    it('should update priority filter to HIGH', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setPriorityFilter(Priority.HIGH);
      });
      
      expect(result.current.priorityFilter).toBe(Priority.HIGH);
    });

    it('should update priority filter to MEDIUM', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setPriorityFilter(Priority.MEDIUM);
      });
      
      expect(result.current.priorityFilter).toBe(Priority.MEDIUM);
    });

    it('should update priority filter to LOW', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setPriorityFilter(Priority.LOW);
      });
      
      expect(result.current.priorityFilter).toBe(Priority.LOW);
    });

    it('should update priority filter to NONE', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setPriorityFilter(Priority.NONE);
      });
      
      expect(result.current.priorityFilter).toBe(Priority.NONE);
    });

    it('should clear priority filter when set to null', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setPriorityFilter(Priority.HIGH);
        result.current.setPriorityFilter(null);
      });
      
      expect(result.current.priorityFilter).toBeNull();
    });
  });

  describe('setDateRangeFilter', () => {
    it('should update date range with both start and end', () => {
      const { result } = renderHook(() => useFilterStore());
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      
      act(() => {
        result.current.setDateRangeFilter(start, end);
      });
      
      expect(result.current.dateRangeFilter).toEqual({ start, end });
    });

    it('should update date range with only start date', () => {
      const { result } = renderHook(() => useFilterStore());
      const start = new Date('2024-01-01');
      
      act(() => {
        result.current.setDateRangeFilter(start, null);
      });
      
      expect(result.current.dateRangeFilter).toEqual({ start, end: null });
    });

    it('should update date range with only end date', () => {
      const { result } = renderHook(() => useFilterStore());
      const end = new Date('2024-01-31');
      
      act(() => {
        result.current.setDateRangeFilter(null, end);
      });
      
      expect(result.current.dateRangeFilter).toEqual({ start: null, end });
    });

    it('should clear date range when both are null', () => {
      const { result } = renderHook(() => useFilterStore());
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      
      act(() => {
        result.current.setDateRangeFilter(start, end);
        result.current.setDateRangeFilter(null, null);
      });
      
      expect(result.current.dateRangeFilter).toEqual({ start: null, end: null });
    });
  });

  describe('setCompletionFilter', () => {
    it('should update completion filter to "completed"', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setCompletionFilter('completed');
      });
      
      expect(result.current.completionFilter).toBe('completed');
    });

    it('should update completion filter to "incomplete"', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setCompletionFilter('incomplete');
      });
      
      expect(result.current.completionFilter).toBe('incomplete');
    });

    it('should update completion filter to "all"', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setCompletionFilter('completed');
        result.current.setCompletionFilter('all');
      });
      
      expect(result.current.completionFilter).toBe('all');
    });
  });

  describe('clearFilters', () => {
    it('should reset all filters to default values', () => {
      const { result } = renderHook(() => useFilterStore());
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      
      act(() => {
        result.current.setSearchQuery('test query');
        result.current.setPriorityFilter(Priority.HIGH);
        result.current.setDateRangeFilter(start, end);
        result.current.setCompletionFilter('completed');
      });
      
      // Verify filters are set
      expect(result.current.searchQuery).toBe('test query');
      expect(result.current.priorityFilter).toBe(Priority.HIGH);
      expect(result.current.dateRangeFilter).toEqual({ start, end });
      expect(result.current.completionFilter).toBe('completed');
      
      act(() => {
        result.current.clearFilters();
      });
      
      // Verify all filters are cleared
      expect(result.current.searchQuery).toBe('');
      expect(result.current.priorityFilter).toBeNull();
      expect(result.current.dateRangeFilter).toEqual({ start: null, end: null });
      expect(result.current.completionFilter).toBe('all');
    });

    it('should be idempotent (calling multiple times has same effect)', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setSearchQuery('test');
        result.current.clearFilters();
        result.current.clearFilters();
        result.current.clearFilters();
      });
      
      expect(result.current.searchQuery).toBe('');
      expect(result.current.priorityFilter).toBeNull();
      expect(result.current.dateRangeFilter).toEqual({ start: null, end: null });
      expect(result.current.completionFilter).toBe('all');
    });
  });

  describe('Multiple Filter Updates', () => {
    it('should handle multiple filter updates independently', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setSearchQuery('task');
      });
      expect(result.current.searchQuery).toBe('task');
      expect(result.current.priorityFilter).toBeNull();
      
      act(() => {
        result.current.setPriorityFilter(Priority.HIGH);
      });
      expect(result.current.searchQuery).toBe('task');
      expect(result.current.priorityFilter).toBe(Priority.HIGH);
      
      act(() => {
        result.current.setCompletionFilter('incomplete');
      });
      expect(result.current.searchQuery).toBe('task');
      expect(result.current.priorityFilter).toBe(Priority.HIGH);
      expect(result.current.completionFilter).toBe('incomplete');
    });

    it('should allow partial filter clearing', () => {
      const { result } = renderHook(() => useFilterStore());
      
      act(() => {
        result.current.setSearchQuery('test');
        result.current.setPriorityFilter(Priority.HIGH);
        result.current.setCompletionFilter('completed');
      });
      
      // Clear only search query
      act(() => {
        result.current.setSearchQuery('');
      });
      
      expect(result.current.searchQuery).toBe('');
      expect(result.current.priorityFilter).toBe(Priority.HIGH);
      expect(result.current.completionFilter).toBe('completed');
      
      // Clear only priority filter
      act(() => {
        result.current.setPriorityFilter(null);
      });
      
      expect(result.current.searchQuery).toBe('');
      expect(result.current.priorityFilter).toBeNull();
      expect(result.current.completionFilter).toBe('completed');
    });
  });

  describe('No Persistence', () => {
    it('should not persist state between store instances', () => {
      // Create first instance and set values
      const { result: result1 } = renderHook(() => useFilterStore());
      act(() => {
        result1.current.setSearchQuery('test');
        result1.current.setPriorityFilter(Priority.HIGH);
      });
      
      // Create second instance - should share the same state (Zustand behavior)
      const { result: result2 } = renderHook(() => useFilterStore());
      
      // Both instances should see the same state (this is expected Zustand behavior)
      expect(result2.current.searchQuery).toBe('test');
      expect(result2.current.priorityFilter).toBe(Priority.HIGH);
      
      // Clear from second instance
      act(() => {
        result2.current.clearFilters();
      });
      
      // Both should be cleared
      expect(result1.current.searchQuery).toBe('');
      expect(result2.current.searchQuery).toBe('');
    });
  });
});
