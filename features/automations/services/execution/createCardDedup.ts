/**
 * Heuristic dedup for create_card actions in scheduled rules.
 * Prevents duplicate task creation on catch-up, crash recovery, or multi-tab race.
 *
 * Checks if a task with the same title already exists in the target section
 * and was created within the lookback window.
 */

interface TaskForDedup {
  description: string;
  sectionId: string;
  createdAt: string;
}

/**
 * Returns true if the create_card action should be SKIPPED (duplicate detected).
 *
 * @param title - The card title to check
 * @param targetSectionId - The section the card would be created in
 * @param tasks - All tasks to check against
 * @param lookbackMs - How far back to check for duplicates (ms)
 * @param nowMs - Current time in epoch ms (injectable for testing)
 */
export function shouldSkipCreateCard(
  title: string,
  targetSectionId: string,
  tasks: TaskForDedup[],
  lookbackMs: number,
  nowMs: number = Date.now()
): boolean {
  return tasks.some(
    (task) =>
      task.description === title &&
      task.sectionId === targetSectionId &&
      task.createdAt &&
      nowMs - new Date(task.createdAt).getTime() < lookbackMs
  );
}

/**
 * Compute the lookback window for a given trigger type.
 * - interval: one interval period
 * - cron / due_date_relative: 24 hours
 */
export function getLookbackMs(
  triggerType: string,
  intervalMinutes?: number
): number {
  if (triggerType === 'scheduled_interval') {
    if (intervalMinutes != null) {
      // Subtract one tick (60s) to avoid blocking the next legitimate fire
      // due to timing jitter between the scheduler tick and task creation
      return Math.max((intervalMinutes - 1) * 60 * 1000, 60 * 1000);
    }
    // Fallback when intervalMinutes not available: 4 minutes (minimum interval is 5min)
    return 4 * 60 * 1000;
  }
  // cron and due_date_relative: 24 hours
  return 24 * 60 * 60 * 1000;
}
