import type { AutomationRule } from '../../types';
import { isScheduledTrigger } from '../../types';

/**
 * Result of evaluating whether a scheduled rule should fire.
 */
export interface ScheduleEvaluation {
  shouldFire: boolean;
  /** ISO timestamp to write back as the new lastEvaluatedAt */
  newLastEvaluatedAt: string;
  /** For due_date_relative: IDs of tasks whose due dates triggered the rule */
  matchingTaskIds?: string[];
}

/**
 * Determine if an interval-based rule should fire.
 * Pure function. At-most-once-per-window semantics for catch-up.
 */
export function evaluateIntervalSchedule(
  nowMs: number,
  lastEvaluatedAt: string | null,
  intervalMinutes: number
): ScheduleEvaluation {
  const intervalMs = intervalMinutes * 60 * 1000;
  const nowIso = new Date(nowMs).toISOString();

  if (lastEvaluatedAt === null) {
    return { shouldFire: true, newLastEvaluatedAt: nowIso };
  }

  const lastMs = new Date(lastEvaluatedAt).getTime();
  const elapsed = nowMs - lastMs;

  if (elapsed >= intervalMs) {
    return { shouldFire: true, newLastEvaluatedAt: nowIso };
  }

  return { shouldFire: false, newLastEvaluatedAt: lastEvaluatedAt };
}

/**
 * Determine if a cron-based rule should fire.
 * Searches backward up to 7 days for the most recent matching window.
 * Catch-up: fires once for the most recent missed window, not for every missed window.
 */
export function evaluateCronSchedule(
  nowMs: number,
  lastEvaluatedAt: string | null,
  schedule: {
    hour: number;
    minute: number;
    daysOfWeek: number[];
    daysOfMonth: number[];
  }
): ScheduleEvaluation {
  const now = new Date(nowMs);
  const nowIso = now.toISOString();

  const mostRecentMatch = findMostRecentCronMatch(now, schedule);
  if (!mostRecentMatch) {
    return {
      shouldFire: false,
      newLastEvaluatedAt: lastEvaluatedAt ?? nowIso,
    };
  }

  if (lastEvaluatedAt === null) {
    // First evaluation — fire only if we're currently in the matching minute
    const isCurrentWindow = isSameMinute(now, mostRecentMatch);
    return { shouldFire: isCurrentWindow, newLastEvaluatedAt: nowIso };
  }

  const lastMs = new Date(lastEvaluatedAt).getTime();

  // Fire if the most recent match is after our last evaluation
  if (mostRecentMatch.getTime() > lastMs) {
    return { shouldFire: true, newLastEvaluatedAt: nowIso };
  }

  return { shouldFire: false, newLastEvaluatedAt: lastEvaluatedAt };
}

/**
 * Determine if a due-date-relative rule should fire for any tasks.
 * Returns matching task IDs whose trigger time falls in (lastEvaluatedAt, now].
 * Skips completed tasks and subtasks.
 */
export function evaluateDueDateRelativeSchedule(
  nowMs: number,
  lastEvaluatedAt: string | null,
  offsetMinutes: number,
  tasks: Array<{
    id: string;
    dueDate: string | null;
    completed: boolean;
    parentTaskId: string | null;
  }>
): ScheduleEvaluation {
  const nowIso = new Date(nowMs).toISOString();
  const windowStart = lastEvaluatedAt
    ? new Date(lastEvaluatedAt).getTime()
    : nowMs - 60_000; // 1 min lookback on first eval
  const offsetMs = offsetMinutes * 60 * 1000;

  const matchingTaskIds: string[] = [];

  for (const task of tasks) {
    if (!task.dueDate || task.completed || task.parentTaskId !== null) continue;

    const triggerTime = new Date(task.dueDate).getTime() + offsetMs;

    // Fire if trigger time falls within (lastEvaluatedAt, now]
    if (triggerTime > windowStart && triggerTime <= nowMs) {
      matchingTaskIds.push(task.id);
    }
  }

  return {
    shouldFire: matchingTaskIds.length > 0,
    newLastEvaluatedAt: nowIso,
    matchingTaskIds,
  };
}

/**
 * Determine if a one-time scheduled rule should fire.
 * Pure function. Fires once when nowMs >= fireAtMs and hasn't already been evaluated past fireAt.
 * Auto-disable is handled by SchedulerService (Layer 3), not here.
 */
export function evaluateOneTimeSchedule(
  nowMs: number,
  lastEvaluatedAt: string | null,
  fireAt: string
): ScheduleEvaluation {
  const nowIso = new Date(nowMs).toISOString();
  const fireAtMs = new Date(fireAt).getTime();

  // Not yet time to fire
  if (nowMs < fireAtMs) {
    return { shouldFire: false, newLastEvaluatedAt: lastEvaluatedAt ?? nowIso };
  }

  // Already evaluated past the fireAt time — don't fire again
  if (lastEvaluatedAt !== null && new Date(lastEvaluatedAt).getTime() >= fireAtMs) {
    return { shouldFire: false, newLastEvaluatedAt: lastEvaluatedAt };
  }

  // Time to fire: nowMs >= fireAtMs AND (never evaluated OR last evaluated before fireAt)
  return { shouldFire: true, newLastEvaluatedAt: nowIso };
}

/**
 * Evaluate all scheduled rules and return those that should fire.
 * Pure function — no side effects.
 */
export function evaluateScheduledRules(
  nowMs: number,
  rules: AutomationRule[],
  tasks: Array<{
    id: string;
    projectId: string | null;
    dueDate: string | null;
    completed: boolean;
    parentTaskId: string | null;
  }>
): Array<{ rule: AutomationRule; evaluation: ScheduleEvaluation }> {
  const results: Array<{
    rule: AutomationRule;
    evaluation: ScheduleEvaluation;
  }> = [];

  for (const rule of rules) {
    if (!rule.enabled || rule.brokenReason !== null) continue;
    if (!isScheduledTrigger(rule.trigger)) continue;

    const trigger = rule.trigger as any;
    let evaluation: ScheduleEvaluation;

    switch (trigger.type as string) {
      case 'scheduled_interval':
        evaluation = evaluateIntervalSchedule(
          nowMs,
          trigger.lastEvaluatedAt,
          trigger.schedule.intervalMinutes
        );
        break;

      case 'scheduled_cron':
        evaluation = evaluateCronSchedule(
          nowMs,
          trigger.lastEvaluatedAt,
          trigger.schedule
        );
        break;

      case 'scheduled_due_date_relative':
        evaluation = evaluateDueDateRelativeSchedule(
          nowMs,
          trigger.lastEvaluatedAt,
          trigger.schedule.offsetMinutes,
          tasks.filter(t => t.projectId === rule.projectId)
        );
        break;

      case 'scheduled_one_time':
        evaluation = evaluateOneTimeSchedule(
          nowMs,
          trigger.lastEvaluatedAt,
          trigger.schedule.fireAt
        );
        break;

      default:
        continue;
    }

    if (evaluation.shouldFire) {
      results.push({ rule, evaluation });
    }
  }

  return results;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function isSameMinute(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

/**
 * Walk backward from `now` to find the most recent time that matches
 * the cron schedule. Searches up to 7 days back.
 * Last-day-of-month handling: values > last day of month are clamped.
 */
export function findMostRecentCronMatch(
  now: Date,
  schedule: {
    hour: number;
    minute: number;
    daysOfWeek: number[];
    daysOfMonth: number[];
  }
): Date | null {
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() - dayOffset);
    candidate.setHours(schedule.hour, schedule.minute, 0, 0);

    // Don't return future times
    if (candidate.getTime() > now.getTime()) continue;

    // Check day-of-week constraint
    if (
      schedule.daysOfWeek.length > 0 &&
      !schedule.daysOfWeek.includes(candidate.getDay())
    ) {
      continue;
    }

    // Check day-of-month constraint (with last-day-of-month normalization)
    if (schedule.daysOfMonth.length > 0) {
      const lastDayOfMonth = new Date(
        candidate.getFullYear(),
        candidate.getMonth() + 1,
        0
      ).getDate();
      const adjustedDays = schedule.daysOfMonth.map((d) =>
        Math.min(d, lastDayOfMonth)
      );
      if (!adjustedDays.includes(candidate.getDate())) {
        continue;
      }
    }

    return candidate;
  }

  return null;
}
