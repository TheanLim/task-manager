import { useMemo } from 'react';
import { Task } from '@/types';
import { useFilterStore } from '@/features/tasks/stores/filterStore';
import { useAppStore } from '@/stores/appStore';
import { DependencyResolverImpl } from '@/features/tasks/services/dependencyResolver';
import { useDataStore } from '@/stores/dataStore';

export function useFilteredTasks(tasks: Task[]): Task[] {
  const {
    searchQuery,
    priorityFilter,
    dateRangeFilter,
    completionFilter,
  } = useFilterStore();

  const { settings } = useAppStore();
  const { dependencies } = useDataStore();

  return useMemo(() => {
    let filtered = tasks;

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((task) => {
        const descriptionMatch = task.description.toLowerCase().includes(query);
        const tagsMatch = task.tags.some((tag) =>
          tag.toLowerCase().includes(query)
        );
        const assigneeMatch = task.assignee?.toLowerCase().includes(query);
        return descriptionMatch || tagsMatch || assigneeMatch;
      });
    }

    // Apply priority filter
    if (priorityFilter !== null) {
      filtered = filtered.filter((task) => task.priority === priorityFilter);
    }

    // Apply date range filter
    if (dateRangeFilter && dateRangeFilter.start && dateRangeFilter.end) {
      const startDate = dateRangeFilter.start;
      const endDate = dateRangeFilter.end;
      filtered = filtered.filter((task) => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate >= startDate && dueDate <= endDate;
      });
    }

    // Apply completion status filter
    if (completionFilter !== 'all') {
      filtered = filtered.filter(
        (task) => task.completed === (completionFilter === 'completed')
      );
    }

    // Apply actionable tasks filter
    if (settings.showOnlyActionableTasks) {
      const resolver = new DependencyResolverImpl();
      const actionableTaskIds = new Set(
        resolver.getActionableTasks(filtered, dependencies).map((t) => t.id)
      );
      filtered = filtered.filter((task) => actionableTaskIds.has(task.id));
    }

    return filtered;
  }, [
    tasks,
    searchQuery,
    priorityFilter,
    dateRangeFilter,
    completionFilter,
    settings.showOnlyActionableTasks,
    dependencies,
  ]);
}
