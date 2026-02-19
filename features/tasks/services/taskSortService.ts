import type { Task } from '@/lib/schemas';
import type { SortableColumnId, SortDirection } from '@/stores/appStore';
import { Priority } from '@/types';
import { getEffectiveLastActionTime } from './taskService';

/** Priority sort weights: higher priority = lower number (sorts first in ascending) */
const PRIORITY_WEIGHT: Record<string, number> = {
  [Priority.HIGH]: 0,
  [Priority.MEDIUM]: 1,
  [Priority.LOW]: 2,
  [Priority.NONE]: 3,
};

/**
 * Sort tasks by the given column and direction.
 * Returns a new array — does not mutate the input.
 *
 * @param getProjectName - lookup function for project names (avoids store dependency)
 */
export function sortTasks(
  taskList: Task[],
  sortColumn: SortableColumnId | null,
  sortDirection: SortDirection,
  getProjectName: (task: Task) => string,
): Task[] {
  if (!sortColumn) return taskList;

  const dir = sortDirection === 'asc' ? 1 : -1;

  return [...taskList].sort((a, b) => {
    let cmp = 0;
    switch (sortColumn) {
      case 'name':
        cmp = a.description.localeCompare(b.description);
        break;
      case 'dueDate': {
        if (!a.dueDate && !b.dueDate) cmp = 0;
        else if (!a.dueDate) return 1;
        else if (!b.dueDate) return -1;
        else cmp = a.dueDate.localeCompare(b.dueDate);
        break;
      }
      case 'priority':
        cmp = (PRIORITY_WEIGHT[a.priority] ?? 3) - (PRIORITY_WEIGHT[b.priority] ?? 3);
        break;
      case 'assignee': {
        const aEmpty = !a.assignee.trim();
        const bEmpty = !b.assignee.trim();
        if (aEmpty && bEmpty) cmp = 0;
        else if (aEmpty) return 1;
        else if (bEmpty) return -1;
        else cmp = a.assignee.localeCompare(b.assignee);
        break;
      }
      case 'tags': {
        cmp = a.tags.length - b.tags.length;
        if (cmp === 0) {
          cmp = [...a.tags].sort().join(',').localeCompare([...b.tags].sort().join(','));
        }
        break;
      }
      case 'project': {
        const nameA = getProjectName(a);
        const nameB = getProjectName(b);
        const aNoProject = nameA === 'No Project';
        const bNoProject = nameB === 'No Project';
        if (aNoProject && bNoProject) cmp = 0;
        else if (aNoProject) return 1;
        else if (bNoProject) return -1;
        else cmp = nameA.localeCompare(nameB);
        break;
      }
      case 'lastAction': {
        const aTime = getEffectiveLastActionTime(a);
        const bTime = getEffectiveLastActionTime(b);
        cmp = aTime.localeCompare(bTime);
        break;
      }
    }
    return cmp * dir;
  });
}

/**
 * Sort tasks by effective last action time ascending (for "Needs Attention" mode).
 */
export function sortByLastAction(taskList: Task[]): Task[] {
  return [...taskList].sort((a, b) =>
    getEffectiveLastActionTime(a).localeCompare(getEffectiveLastActionTime(b))
  );
}
