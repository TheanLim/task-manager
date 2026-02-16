import type { GridCoord, MoveDirection } from '../types';

/**
 * Descriptor for a visible row in the flattened task grid.
 * Section headers are NOT included as rows — they're separate UI elements.
 */
export interface VisibleRowDescriptor {
  taskId: string;
  parentTaskId: string | null;
  sectionId: string | null;
  isSectionHeader: boolean;
  depth: number;
}

/**
 * Moves the active cell in a direction, clamped to grid bounds.
 * Returns a new GridCoord with taskId set to null (caller resolves from visible row list).
 */
export function moveActiveCell(
  coord: GridCoord,
  direction: MoveDirection,
  bounds: { rows: number; columns: number; pageSize?: number }
): GridCoord {
  const { rows, columns, pageSize = rows } = bounds;
  let { row, column } = coord;

  switch (direction) {
    case 'up':
      row = Math.max(0, row - 1);
      break;
    case 'down':
      row = Math.min(rows - 1, row + 1);
      break;
    case 'left':
      column = Math.max(0, column - 1);
      break;
    case 'right':
      column = Math.min(columns - 1, column + 1);
      break;
    case 'home':
      column = 0;
      break;
    case 'end':
      column = columns - 1;
      break;
    case 'gridHome':
      row = 0;
      column = 0;
      break;
    case 'gridEnd':
      row = rows - 1;
      column = columns - 1;
      break;
    case 'firstRow':
      row = 0;
      break;
    case 'lastRow':
      row = rows - 1;
      break;
    case 'halfPageDown':
      row = Math.min(rows - 1, row + Math.floor(pageSize / 2));
      break;
    case 'halfPageUp':
      row = Math.max(0, row - Math.floor(pageSize / 2));
      break;
  }

  return { row, column, taskId: null };
}

interface TaskInput {
  id: string;
  parentTaskId: string | null;
  sectionId: string | null;
  order: number;
}

interface SectionInput {
  id: string;
  collapsed: boolean;
  order: number;
}

/**
 * Computes the flat list of visible rows from the task tree.
 *
 * Logic:
 * 1. Sort sections by order
 * 2. Group tasks by sectionId (null sectionId = "no section" group, processed first)
 * 3. For each section: skip all tasks if collapsed, otherwise add top-level tasks sorted by order
 * 4. For each top-level task: if expanded, recursively add subtasks (depth + 1)
 * 5. Section headers are NOT included as rows
 */
export function computeVisibleRows(
  tasks: TaskInput[],
  sections: SectionInput[],
  expandedTaskIds: Set<string>
): VisibleRowDescriptor[] {
  const result: VisibleRowDescriptor[] = [];

  // Index tasks by parentTaskId for fast child lookup
  const childrenByParent = new Map<string | null, TaskInput[]>();
  for (const task of tasks) {
    const parentKey = task.parentTaskId;
    const list = childrenByParent.get(parentKey) ?? [];
    list.push(task);
    childrenByParent.set(parentKey, list);
  }

  // Sort each child list by order
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.order - b.order);
  }

  // Get top-level tasks (parentTaskId === null) grouped by sectionId
  const topLevelTasks = childrenByParent.get(null) ?? [];
  const tasksBySectionId = new Map<string | null, TaskInput[]>();
  for (const task of topLevelTasks) {
    const key = task.sectionId;
    const list = tasksBySectionId.get(key) ?? [];
    list.push(task);
    tasksBySectionId.set(key, list);
  }

  // Recursively add a task and its expanded subtasks
  const addTaskAndChildren = (task: TaskInput, depth: number, sectionId: string | null): void => {
    result.push({
      taskId: task.id,
      parentTaskId: task.parentTaskId,
      sectionId,
      isSectionHeader: false,
      depth,
    });

    if (expandedTaskIds.has(task.id)) {
      const children = childrenByParent.get(task.id) ?? [];
      for (const child of children) {
        addTaskAndChildren(child, depth + 1, sectionId);
      }
    }
  };

  // Process "no section" group first (tasks with null sectionId)
  const noSectionTasks = tasksBySectionId.get(null) ?? [];
  for (const task of noSectionTasks) {
    addTaskAndChildren(task, 0, null);
  }

  // Process sections sorted by order
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  for (const section of sortedSections) {
    if (section.collapsed) continue;

    const sectionTasks = tasksBySectionId.get(section.id) ?? [];
    for (const task of sectionTasks) {
      addTaskAndChildren(task, 0, section.id);
    }
  }

  return result;
}
