import type { Task, AutoHideThreshold } from '@/lib/schemas';

export interface AutoHideFilterOptions {
  threshold: AutoHideThreshold;
  displayMode: 'nested' | 'flat';
  now?: number;
}

export interface AutoHideFilterResult {
  visible: Task[];
  autoHidden: Task[];
}

const THRESHOLD_MS: Record<AutoHideThreshold, number | null> = {
  '24h': 86_400_000,
  '48h': 172_800_000,
  '1w': 604_800_000,
  never: null,
};

export function getThresholdMs(threshold: AutoHideThreshold): number | null {
  return THRESHOLD_MS[threshold];
}

export function isTaskAutoHidden(task: Task, thresholdMs: number, now: number): boolean {
  if (!task.completed) return false;
  if (task.completedAt == null) return false;
  return now - Date.parse(task.completedAt) >= thresholdMs;
}

export function filterAutoHiddenTasks(
  tasks: Task[],
  allTasks: Task[],
  options: AutoHideFilterOptions,
): AutoHideFilterResult {
  const { threshold, displayMode, now = Date.now() } = options;
  const thresholdMs = getThresholdMs(threshold);

  if (thresholdMs == null) {
    return { visible: [...tasks], autoHidden: [] };
  }

  const allTasksMap = new Map(allTasks.map((t) => [t.id, t]));
  const visible: Task[] = [];
  const autoHidden: Task[] = [];

  if (displayMode === 'nested') {
    // Build a set of auto-hidden parent IDs for quick lookup
    const autoHiddenParentIds = new Set<string>();
    for (const task of tasks) {
      if (task.parentTaskId == null && isTaskAutoHidden(task, thresholdMs, now)) {
        autoHiddenParentIds.add(task.id);
      }
    }

    for (const task of tasks) {
      if (task.parentTaskId == null) {
        // Parent task: evaluate directly
        if (autoHiddenParentIds.has(task.id)) {
          autoHidden.push(task);
        } else {
          visible.push(task);
        }
      } else {
        // Subtask: visibility follows parent
        const parent = allTasksMap.get(task.parentTaskId);
        if (parent == null) {
          // Defensive: parent not found, evaluate independently
          if (isTaskAutoHidden(task, thresholdMs, now)) {
            autoHidden.push(task);
          } else {
            visible.push(task);
          }
        } else if (!parent.completed) {
          // Active parent → subtask stays visible
          visible.push(task);
        } else if (isTaskAutoHidden(parent, thresholdMs, now)) {
          // Parent is auto-hidden → subtask is auto-hidden
          autoHidden.push(task);
        } else {
          // Parent is completed but not yet past threshold → subtask visible
          visible.push(task);
        }
      }
    }
  } else {
    // Flat mode: independent evaluation with active-parent exception
    for (const task of tasks) {
      if (task.parentTaskId != null) {
        const parent = allTasksMap.get(task.parentTaskId);
        if (parent != null && !parent.completed) {
          // Active parent → subtask stays visible regardless of age
          visible.push(task);
          continue;
        }
        if (parent != null && parent.completed && isTaskAutoHidden(parent, thresholdMs, now)) {
          // Parent is completed and auto-hidden → subtask is auto-hidden
          autoHidden.push(task);
          continue;
        }
      }
      // Parent task, orphan subtask, or subtask with non-auto-hidden completed parent
      if (isTaskAutoHidden(task, thresholdMs, now)) {
        autoHidden.push(task);
      } else {
        visible.push(task);
      }
    }
  }

  return { visible, autoHidden };
}
