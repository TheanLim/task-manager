import { create } from 'zustand';
import { Priority } from '@/types';

interface FilterStore {
  searchQuery: string;
  priorityFilter: Priority | null;
  dateRangeFilter: { start: Date | null; end: Date | null };
  completionFilter: 'all' | 'completed' | 'incomplete';
  
  setSearchQuery: (query: string) => void;
  setPriorityFilter: (priority: Priority | null) => void;
  setDateRangeFilter: (start: Date | null, end: Date | null) => void;
  setCompletionFilter: (filter: 'all' | 'completed' | 'incomplete') => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  searchQuery: '',
  priorityFilter: null,
  dateRangeFilter: { start: null, end: null },
  completionFilter: 'all',
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  setPriorityFilter: (priority) => set({ priorityFilter: priority }),
  setDateRangeFilter: (start, end) => set({ dateRangeFilter: { start, end } }),
  setCompletionFilter: (filter) => set({ completionFilter: filter }),
  clearFilters: () => set({
    searchQuery: '',
    priorityFilter: null,
    dateRangeFilter: { start: null, end: null },
    completionFilter: 'all'
  })
}));
