/**
 * fvpSnapshotService — pure helpers for FVP candidate-list snapshots.
 *
 * No store imports. Completion is intentionally NOT checked here —
 * completed tasks are included in the snapshot and filtered at render time.
 *
 * Ref: tasks.md T-04
 */

import { Task } from '@/types';

/**
 * Builds a snapshot of task IDs from the current task list.
 * All tasks (including completed ones) are captured — completion is
 * evaluated at render time, not snapshot time.
 */
export function buildFvpSnapshot(tasks: Task[]): string[] {
  return tasks.map((t) => t.id);
}

/**
 * Returns true if the given task ID is present in the snapshot.
 */
export function isTaskInSnapshot(id: string, snapshot: string[]): boolean {
  return snapshot.includes(id);
}
