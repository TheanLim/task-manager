import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  evaluateIntervalSchedule,
  evaluateCronSchedule,
  evaluateDueDateRelativeSchedule,
  evaluateOneTimeSchedule,
  evaluateScheduledRules,
  findMostRecentCronMatch,
} from './scheduleEvaluator';
import type { AutomationRule } from '../../types';

// ─── Generators ─────────────────────────────────────────────────────────

/** Generates a valid intervalMinutes in [5, 10080] */
const arbIntervalMinutes = fc.integer({ min: 5, max: 10080 });

/** Generates a timestamp in a reasonable range (2020–2030) */
const arbTimestamp = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime(),
});

/** Generates a valid ISO datetime string from a timestamp */
const arbIsoString = arbTimestamp.map((ms) => new Date(ms).toISOString());

/** Generates a nullable ISO string (null = first evaluation) */
const arbLastEvaluatedAt = fc.option(arbIsoString, { nil: null });

/** Generates a valid cron schedule */
const arbCronSchedule = fc.record({
  hour: fc.integer({ min: 0, max: 23 }),
  minute: fc.integer({ min: 0, max: 59 }),
  daysOfWeek: fc.oneof(
    fc.constant([] as number[]),
    fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 })
  ),
  daysOfMonth: fc.constant([] as number[]), // mutually exclusive with daysOfWeek
});

/** Generates a cron schedule with daysOfMonth instead */
const arbCronScheduleMonthly = fc.record({
  hour: fc.integer({ min: 0, max: 23 }),
  minute: fc.integer({ min: 0, max: 59 }),
  daysOfWeek: fc.constant([] as number[]),
  daysOfMonth: fc.uniqueArray(fc.integer({ min: 1, max: 31 }), {
    minLength: 1,
    maxLength: 5,
  }),
});

/** Generates a task with a due date */
const arbTask = fc.record({
  id: fc.uuid(),
  dueDate: fc.option(arbIsoString, { nil: null }),
  completed: fc.boolean(),
  parentTaskId: fc.option(fc.uuid(), { nil: null }),
});

// ─── Property Tests ─────────────────────────────────────────────────────

describe('scheduleEvaluator property tests', () => {
  // Feature: scheduled-triggers-phase-5a, Property 5: Interval at-most-once-per-window
  it('P5: interval — fire then re-evaluate with updated lastEvaluatedAt must NOT fire again', () => {
    fc.assert(
      fc.property(
        arbIntervalMinutes,
        arbTimestamp,
        arbLastEvaluatedAt,
        (intervalMinutes, nowMs, lastEvaluatedAt) => {
          const result = evaluateIntervalSchedule(nowMs, lastEvaluatedAt, intervalMinutes);
          if (result.shouldFire) {
            const result2 = evaluateIntervalSchedule(
              nowMs,
              result.newLastEvaluatedAt,
              intervalMinutes
            );
            expect(result2.shouldFire).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: scheduled-triggers-phase-5a, Property 6: Interval monotonicity
  it('P6: interval — if fires at t1, fires at any later t2 (same lastEvaluatedAt)', () => {
    fc.assert(
      fc.property(
        arbIntervalMinutes,
        arbTimestamp,
        fc.nat({ max: 100_000_000 }), // delta
        arbLastEvaluatedAt,
        (intervalMinutes, t1, delta, lastEvaluatedAt) => {
          const t2 = t1 + delta;
          const r1 = evaluateIntervalSchedule(t1, lastEvaluatedAt, intervalMinutes);
          if (r1.shouldFire) {
            const r2 = evaluateIntervalSchedule(t2, lastEvaluatedAt, intervalMinutes);
            expect(r2.shouldFire).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: scheduled-triggers-phase-5a, Property 7: Schedule evaluation determinism
  it('P7: same inputs always produce same outputs (interval)', () => {
    fc.assert(
      fc.property(
        arbIntervalMinutes,
        arbTimestamp,
        arbLastEvaluatedAt,
        (intervalMinutes, nowMs, lastEvaluatedAt) => {
          const r1 = evaluateIntervalSchedule(nowMs, lastEvaluatedAt, intervalMinutes);
          const r2 = evaluateIntervalSchedule(nowMs, lastEvaluatedAt, intervalMinutes);
          expect(r1).toEqual(r2);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('P7: same inputs always produce same outputs (cron)', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        arbLastEvaluatedAt,
        arbCronSchedule,
        (nowMs, lastEvaluatedAt, schedule) => {
          const r1 = evaluateCronSchedule(nowMs, lastEvaluatedAt, schedule);
          const r2 = evaluateCronSchedule(nowMs, lastEvaluatedAt, schedule);
          expect(r1).toEqual(r2);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('P7: same inputs always produce same outputs (due-date-relative)', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        arbLastEvaluatedAt,
        fc.integer({ min: -10080, max: 10080 }),
        fc.array(arbTask, { maxLength: 10 }),
        (nowMs, lastEvaluatedAt, offsetMinutes, tasks) => {
          const r1 = evaluateDueDateRelativeSchedule(nowMs, lastEvaluatedAt, offsetMinutes, tasks);
          const r2 = evaluateDueDateRelativeSchedule(nowMs, lastEvaluatedAt, offsetMinutes, tasks);
          expect(r1).toEqual(r2);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: scheduled-triggers-phase-5a, Property 8: Cron day-of-week filtering
  it('P8: cron rules only fire on configured days of week', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        arbIsoString, // non-null lastEvaluatedAt so we can check the match
        arbCronSchedule.filter((s) => s.daysOfWeek.length > 0),
        (nowMs, lastEvaluatedAt, schedule) => {
          // Set lastEvaluatedAt to well before now so the rule would fire if day matches
          const oldLast = new Date(nowMs - 8 * 24 * 60 * 60 * 1000).toISOString();
          const result = evaluateCronSchedule(nowMs, oldLast, schedule);
          if (result.shouldFire) {
            // Verify the most recent match is on a configured day
            const match = findMostRecentCronMatch(new Date(nowMs), schedule);
            expect(match).not.toBeNull();
            expect(schedule.daysOfWeek).toContain(match!.getDay());
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: scheduled-triggers-phase-5a, Property 9: Due-date-relative window correctness
  it('P9: matching tasks have trigger time in (lastEvaluatedAt, now]', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        arbIsoString,
        fc.integer({ min: -10080, max: 10080 }),
        fc.array(
          fc.record({
            id: fc.uuid(),
            dueDate: fc.option(arbIsoString, { nil: null }),
            completed: fc.constant(false),
            parentTaskId: fc.constant(null as string | null),
          }),
          { maxLength: 20 }
        ),
        (nowMs, lastEvaluatedAt, offsetMinutes, tasks) => {
          const result = evaluateDueDateRelativeSchedule(
            nowMs,
            lastEvaluatedAt,
            offsetMinutes,
            tasks
          );
          const windowStart = new Date(lastEvaluatedAt).getTime();
          const offsetMs = offsetMinutes * 60 * 1000;

          for (const taskId of result.matchingTaskIds ?? []) {
            const task = tasks.find((t) => t.id === taskId)!;
            expect(task).toBeDefined();
            expect(task.dueDate).not.toBeNull();
            expect(task.completed).toBe(false);
            expect(task.parentTaskId).toBeNull();

            const triggerTime = new Date(task.dueDate!).getTime() + offsetMs;
            expect(triggerTime).toBeGreaterThan(windowStart);
            expect(triggerTime).toBeLessThanOrEqual(nowMs);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: scheduled-triggers-phase-5a, Property 9 (supplement): completed tasks and subtasks excluded
  it('P9: completed tasks and subtasks never appear in matchingTaskIds', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        arbLastEvaluatedAt,
        fc.integer({ min: -10080, max: 10080 }),
        fc.array(arbTask, { maxLength: 20 }),
        (nowMs, lastEvaluatedAt, offsetMinutes, tasks) => {
          const result = evaluateDueDateRelativeSchedule(
            nowMs,
            lastEvaluatedAt,
            offsetMinutes,
            tasks
          );
          for (const taskId of result.matchingTaskIds ?? []) {
            const task = tasks.find((t) => t.id === taskId)!;
            expect(task.completed).toBe(false);
            expect(task.parentTaskId).toBeNull();
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: scheduled-triggers-phase-5a, Property 10: Catch-up fires at most once
  it('P10: any absence duration produces at most one fire (interval)', () => {
    fc.assert(
      fc.property(
        arbIntervalMinutes,
        arbTimestamp,
        arbLastEvaluatedAt,
        (intervalMinutes, nowMs, lastEvaluatedAt) => {
          const result = evaluateIntervalSchedule(nowMs, lastEvaluatedAt, intervalMinutes);
          // shouldFire is a boolean — at most one fire, not a count
          expect(typeof result.shouldFire).toBe('boolean');
          if (result.shouldFire) {
            // After firing, re-evaluate must not fire
            const r2 = evaluateIntervalSchedule(
              nowMs,
              result.newLastEvaluatedAt,
              intervalMinutes
            );
            expect(r2.shouldFire).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('P10: any absence duration produces at most one fire (cron)', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        arbLastEvaluatedAt,
        arbCronSchedule,
        (nowMs, lastEvaluatedAt, schedule) => {
          const result = evaluateCronSchedule(nowMs, lastEvaluatedAt, schedule);
          if (result.shouldFire) {
            const r2 = evaluateCronSchedule(
              nowMs,
              result.newLastEvaluatedAt,
              schedule
            );
            expect(r2.shouldFire).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  // Feature: scheduled-triggers-phase-5b, Property: project-scoped due-date-relative evaluation
  it('P11: evaluateScheduledRules only matches due-date-relative tasks in the rule\'s project', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        fc.integer({ min: -10080, max: 10080 }),
        (nowMs, offsetMinutes) => {
          const ruleProjectId = 'proj-A';
          const otherProjectId = 'proj-B';
          const lastEval = new Date(nowMs - 120_000).toISOString(); // 2 min ago

          // Create a due-date-relative rule in project A
          const rule: AutomationRule = {
            id: 'rule-duerel',
            projectId: ruleProjectId,
            name: 'Due-date test',
            trigger: {
              type: 'scheduled_due_date_relative' as any,
              sectionId: null,
              schedule: { kind: 'due_date_relative' as any, offsetMinutes, displayUnit: 'days' },
              lastEvaluatedAt: lastEval,
              catchUpPolicy: 'catch_up_latest',
            },
            filters: [],
            action: {
              type: 'mark_card_complete',
              sectionId: null,
              dateOption: null,
              position: null,
              cardTitle: null,
              cardDateOption: null,
              specificMonth: null,
              specificDay: null,
              monthTarget: null,
            },
            enabled: true,
            brokenReason: null,
            executionCount: 0,
            lastExecutedAt: null,
            recentExecutions: [],
            order: 0,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            bulkPausedAt: null,
          };

          // Task in the WRONG project — should never be matched
          const crossProjectTask = {
            id: 'task-other',
            projectId: otherProjectId,
            dueDate: new Date(nowMs - offsetMinutes * 60 * 1000).toISOString(),
            completed: false,
            parentTaskId: null,
          };

          const results = evaluateScheduledRules(nowMs, [rule], [crossProjectTask]);
          for (const { evaluation } of results) {
            // If the rule fires, no cross-project task IDs should appear
            for (const taskId of evaluation.matchingTaskIds ?? []) {
              expect(taskId).not.toBe('task-other');
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});


// ─── One-Time Schedule Generators ───────────────────────────────────────

/** Generates a valid fireAt ISO datetime string (2024–2030 range) */
const fireAtArb = fc.date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') })
  .map(d => d.toISOString());

/** Generates a nowMs epoch timestamp (reasonable range) */
const nowMsArb = fc.integer({ min: 1_700_000_000_000, max: 1_900_000_000_000 });

/** Generates a nullable ISO datetime for lastEvaluatedAt */
const lastEvaluatedAtArb = fc.option(
  fc.date({ min: new Date('2023-01-01'), max: new Date('2030-12-31') })
    .map(d => d.toISOString()),
  { nil: null }
);

// ─── One-Time Schedule Property Tests ───────────────────────────────────

describe('evaluateOneTimeSchedule property tests', () => {
  // Feature: scheduled-triggers-phase-5c, Property 1: One-time fire-and-disable invariant
  // **Validates: Requirements 1.1, 1.2, 1.3, 1.6**
  it('P1: one-time fire-and-disable — for any nowMs >= fireAt, shouldFire: true; after auto-disable, re-evaluation returns empty', () => {
    fc.assert(
      fc.property(
        fireAtArb,
        lastEvaluatedAtArb,
        (fireAt, lastEvaluatedAt) => {
          const fireAtMs = new Date(fireAt).getTime();
          // Generate nowMs >= fireAtMs (at or after fire time)
          const nowMs = fireAtMs + Math.floor(Math.random() * 1_000_000);

          // Ensure lastEvaluatedAt is before fireAt (or null) so the rule hasn't already fired
          const effectiveLastEval = lastEvaluatedAt !== null &&
            new Date(lastEvaluatedAt).getTime() >= new Date(fireAt).getTime()
            ? null
            : lastEvaluatedAt;

          const result = evaluateOneTimeSchedule(nowMs, effectiveLastEval, fireAt);
          expect(result.shouldFire).toBe(true);

          // Simulate auto-disable: create a rule with enabled: false after firing
          const disabledRule: AutomationRule = {
            id: 'test-rule',
            projectId: 'proj-1',
            name: 'One-time test',
            trigger: {
              type: 'scheduled_one_time' as any,
              sectionId: null,
              schedule: { kind: 'one_time' as any, fireAt },
              lastEvaluatedAt: result.newLastEvaluatedAt,
            },
            filters: [],
            action: {
              type: 'mark_card_complete',
              sectionId: null,
              dateOption: null,
              position: null,
              cardTitle: null,
              cardDateOption: null,
              specificMonth: null,
              specificDay: null,
              monthTarget: null,
            },
            enabled: false, // auto-disabled after firing
            brokenReason: null,
            executionCount: 1,
            lastExecutedAt: result.newLastEvaluatedAt,
            recentExecutions: [],
            order: 0,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: result.newLastEvaluatedAt,
            bulkPausedAt: null,
          };

          // Re-evaluation via evaluateScheduledRules should return empty (disabled rules filtered out)
          const reEvalResults = evaluateScheduledRules(nowMs, [disabledRule], []);
          expect(reEvalResults).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: scheduled-triggers-phase-5c, Property 2: One-time catch-up fires once then disables
  // **Validates: Requirement 1.4**
  it('P2: one-time catch-up — for any absence duration where fireAt passed, fires exactly once', () => {
    fc.assert(
      fc.property(
        fireAtArb,
        fc.integer({ min: 1, max: 30 * 24 * 60 * 60 * 1000 }), // absence up to 30 days
        (fireAt, absenceDuration) => {
          const fireAtMs = new Date(fireAt).getTime();
          // lastEvaluatedAt is before fireAt (app was open before the fire time)
          const lastEvaluatedAt = new Date(fireAtMs - 60_000).toISOString(); // 1 min before fireAt
          // nowMs is well after fireAt (app reopened after absence)
          const nowMs = fireAtMs + absenceDuration;

          // First evaluation: should fire (catch-up)
          const result = evaluateOneTimeSchedule(nowMs, lastEvaluatedAt, fireAt);
          expect(result.shouldFire).toBe(true);

          // Second evaluation with updated lastEvaluatedAt: should NOT fire
          const result2 = evaluateOneTimeSchedule(nowMs, result.newLastEvaluatedAt, fireAt);
          expect(result2.shouldFire).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: scheduled-triggers-phase-5c, Property 3: One-time does not fire before fireAt
  // **Validates: Requirement 1.1**
  it('P3: one-time does not fire before fireAt — for any nowMs < fireAt, shouldFire: false', () => {
    fc.assert(
      fc.property(
        fireAtArb,
        fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }), // up to 1 year before
        lastEvaluatedAtArb,
        (fireAt, beforeDelta, lastEvaluatedAt) => {
          const fireAtMs = new Date(fireAt).getTime();
          const nowMs = fireAtMs - beforeDelta; // strictly before fireAt

          const result = evaluateOneTimeSchedule(nowMs, lastEvaluatedAt, fireAt);
          expect(result.shouldFire).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
