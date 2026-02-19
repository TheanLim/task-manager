# Scheduled/Timer-Based Triggers — Technical Architecture Proposal

**Author**: Lead SDE / Software Architect
**Status**: Decisions Finalized — all open questions resolved (see §14)
**Scope**: Extend the automation engine with time-based rule triggers in a client-side-only environment

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Schema Design](#2-schema-design)
3. [Scheduler Engine Design](#3-scheduler-engine-design)
4. [Integration with Existing Architecture](#4-integration-with-existing-architecture)
5. [Batch Execution Optimization](#5-batch-execution-optimization)
6. [Persistence & State Management](#6-persistence--state-management)
7. [Client-Side Constraints & Mitigations](#7-client-side-constraints--mitigations)
8. [Notification Strategy](#8-notification-strategy)
9. [Crash Recovery & Idempotency](#9-crash-recovery--idempotency)
10. [TDD Strategy & Correctness Properties](#10-tdd-strategy--correctness-properties)
11. [Proposed File Structure](#11-proposed-file-structure)
12. [Migration Strategy](#12-migration-strategy)
13. [Disagreements with PM/QA](#13-disagreements-with-pmqa)
14. [Design Decisions — All Resolved](#14-design-decisions--all-resolved)

---

## 1. Executive Summary

This proposal adds three scheduled trigger types to the automation engine:

| Trigger | Use Case | PM Story |
|---------|----------|----------|
| `scheduled_interval` | "Every 30 minutes, move overdue cards to Backlog" | US-6 |
| `scheduled_cron` | "Every Monday at 9am, create a standup card" | US-1, US-3, US-4, US-7 |
| `scheduled_due_date_relative` | "1 day before due date, move card to Urgent" | US-2 |

### Key Design Decisions Up Front

1. **Discriminated union for TriggerSchema** — scheduled triggers carry fundamentally different config than event triggers. A flat optional `schedule` field would leave the schema permissive and validation weak.
2. **`setInterval` with 60-second tick** — simplest correct approach for a client-side app. Web Workers add complexity without meaningful benefit given browser throttling realities.
3. **Synthetic `DomainEvent` emission** — scheduled triggers emit a new `schedule.fired` event type, flowing through the existing `AutomationService.handleEvent()` pipeline. No special execution path.
4. **`lastEvaluatedAt` stored on the rule entity** — co-located with the rule, persisted to localStorage, enables catch-up on app reopen.
5. **At-most-once-per-window semantics** — catch-up fires at most once per missed interval, not N times for N missed intervals (PM US-10, QA §2.1).
6. **One dedup set per `tick()` call** — shared across all rules and their cascaded events within a single scheduled evaluation pass (resolves QA §2.1, §3.1).
7. **Summary toast for scheduled passes** — a single aggregated toast replaces per-rule toasts when multiple scheduled rules fire simultaneously (resolves QA §2.7).
8. **`lastEvaluatedAt` updated BEFORE execution** — prevents re-execution on crash recovery; `create_card` uses heuristic dedup as a safety net (resolves QA §4.2).

---

## 2. Schema Design

### 2.1 New Trigger Types

Add three values to `TriggerTypeSchema`:

```typescript
// schemas.ts
export const TriggerTypeSchema = z.enum([
  // Existing event-based triggers
  'card_moved_into_section',
  'card_moved_out_of_section',
  'card_marked_complete',
  'card_marked_incomplete',
  'card_created_in_section',
  'section_created',
  'section_renamed',
  // New scheduled triggers
  'scheduled_interval',
  'scheduled_cron',
  'scheduled_due_date_relative',
]);
```

### 2.2 Schedule Configuration Schemas

```typescript
// schemas.ts — new schedule config schemas

/**
 * Interval schedule: fires every N minutes/hours.
 * intervalMinutes is the canonical unit — UI can present hours but stores as minutes.
 */
export const IntervalScheduleSchema = z.object({
  intervalMinutes: z.number().int().min(5).max(10080), // 5 min to 7 days
});

/**
 * Cron schedule: fires at specific times on specific days.
 * NOT a full cron expression — structured fields for UI-friendliness and validation.
 * 
 * Design rationale: A raw cron string (e.g., "0 9 * * 1") is powerful but hostile
 * to non-technical users and hard to validate at the schema level. Structured fields
 * let us build a picker UI and validate each dimension independently.
 */
export const CronScheduleSchema = z.object({
  /** Hour of day (0-23) in user's local time */
  hour: z.number().int().min(0).max(23),
  /** Minute of hour (0-59) */
  minute: z.number().int().min(0).max(59),
  /** Days of week to fire on. Empty array = every day. 0=Sunday, 6=Saturday. */
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  /** Days of month to fire on. Empty = every day. Mutually exclusive with daysOfWeek. */
  daysOfMonth: z.array(z.number().int().min(1).max(31)).default([]),
}).refine(
  (data) => !(data.daysOfWeek.length > 0 && data.daysOfMonth.length > 0),
  { message: 'Cannot specify both daysOfWeek and daysOfMonth' }
);

/**
 * Due-date-relative schedule: fires N days/hours before or after a task's due date.
 * This trigger type iterates over tasks with due dates, not a single point in time.
 */
export const DueDateRelativeScheduleSchema = z.object({
  /** Offset in minutes from the due date. Negative = before, positive = after. */
  offsetMinutes: z.number().int(),
  /** Human-readable unit for UI display. Canonical value is always offsetMinutes. */
  displayUnit: z.enum(['minutes', 'hours', 'days']).default('days'),
});

/**
 * Union of all schedule configuration types.
 */
export const ScheduleConfigSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('interval'), ...IntervalScheduleSchema.shape }),
  z.object({ kind: z.literal('cron'), ...CronScheduleSchema.shape }),
  z.object({ kind: z.literal('due_date_relative'), ...DueDateRelativeScheduleSchema.shape }),
]);
```

### 2.3 TriggerSchema — Discriminated Union

Replace the flat `TriggerSchema` with a discriminated union. This is the most significant schema change.

```typescript
// schemas.ts — replace existing TriggerSchema

/** Event-based triggers (existing behavior) */
export const EventTriggerTypeSchema = z.enum([
  'card_moved_into_section',
  'card_moved_out_of_section',
  'card_marked_complete',
  'card_marked_incomplete',
  'card_created_in_section',
  'section_created',
  'section_renamed',
]);

/** Schedule-based triggers (new) */
export const ScheduledTriggerTypeSchema = z.enum([
  'scheduled_interval',
  'scheduled_cron',
  'scheduled_due_date_relative',
]);

/** Combined trigger type (superset — used for type-level checks) */
export const TriggerTypeSchema = z.enum([
  ...EventTriggerTypeSchema.options,
  ...ScheduledTriggerTypeSchema.options,
]);

/**
 * Discriminated union trigger schema.
 * 
 * Event triggers carry an optional sectionId.
 * Scheduled triggers carry a schedule config and lastEvaluatedAt.
 */
export const TriggerSchema = z.discriminatedUnion('type', [
  // Event triggers — each gets its own entry for type narrowing
  z.object({
    type: z.literal('card_moved_into_section'),
    sectionId: z.string().min(1).nullable(),
  }),
  z.object({
    type: z.literal('card_moved_out_of_section'),
    sectionId: z.string().min(1).nullable(),
  }),
  z.object({
    type: z.literal('card_marked_complete'),
    sectionId: z.string().min(1).nullable(),
  }),
  z.object({
    type: z.literal('card_marked_incomplete'),
    sectionId: z.string().min(1).nullable(),
  }),
  z.object({
    type: z.literal('card_created_in_section'),
    sectionId: z.string().min(1).nullable(),
  }),
  z.object({
    type: z.literal('section_created'),
    sectionId: z.string().min(1).nullable(),
  }),
  z.object({
    type: z.literal('section_renamed'),
    sectionId: z.string().min(1).nullable(),
  }),
  // Scheduled triggers
  z.object({
    type: z.literal('scheduled_interval'),
    sectionId: z.null().default(null), // not used, kept for structural compat
    schedule: z.object({ kind: z.literal('interval'), intervalMinutes: z.number().int().min(5).max(10080) }),
    lastEvaluatedAt: z.string().datetime().nullable().default(null),
  }),
  z.object({
    type: z.literal('scheduled_cron'),
    sectionId: z.null().default(null),
    schedule: z.object({
      kind: z.literal('cron'),
      hour: z.number().int().min(0).max(23),
      minute: z.number().int().min(0).max(59),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
      daysOfMonth: z.array(z.number().int().min(1).max(31)).default([]),
    }),
    lastEvaluatedAt: z.string().datetime().nullable().default(null),
  }),
  z.object({
    type: z.literal('scheduled_due_date_relative'),
    sectionId: z.null().default(null),
    schedule: z.object({
      kind: z.literal('due_date_relative'),
      offsetMinutes: z.number().int(),
      displayUnit: z.enum(['minutes', 'hours', 'days']).default('days'),
    }),
    lastEvaluatedAt: z.string().datetime().nullable().default(null),
  }),
]);
```

### 2.4 Why Discriminated Union Over Flat Extension

**Option A (flat)** was considered:
```typescript
// ❌ Rejected: permissive, allows invalid states
TriggerSchema = z.object({
  type: TriggerTypeSchema,
  sectionId: z.string().nullable(),
  schedule: ScheduleConfigSchema.nullable(), // new
  lastEvaluatedAt: z.string().datetime().nullable(), // new
})
```

Problems with Option A:
1. Nothing prevents `{ type: 'card_moved_into_section', schedule: { kind: 'interval', ... } }` — an event trigger with a schedule config attached. The schema validates but the data is nonsensical.
2. `sectionId` is meaningless for scheduled triggers but the schema allows it.
3. `lastEvaluatedAt` is meaningless for event triggers but the schema allows it.
4. TypeScript can't narrow the type — you always get the full union of all optional fields.

**Option B (discriminated union)** enforces:
- Event triggers have `sectionId`, no `schedule`, no `lastEvaluatedAt`
- Scheduled triggers have `schedule` + `lastEvaluatedAt`, `sectionId` is always `null`
- TypeScript narrows correctly: `if (trigger.type === 'scheduled_interval') { trigger.schedule.intervalMinutes }` — no casts needed

**Migration cost**: The discriminated union is structurally compatible with existing data. Every existing trigger `{ type: 'card_moved_into_section', sectionId: 'abc' }` validates against the new schema because each event trigger variant has the same shape. No data migration needed.

**Alignment with EXTENDING.md**: Step 1 of "Adding a New Trigger Type" says to add the value to `TriggerTypeSchema`. The discriminated union extends this — new scheduled trigger types are added to both `ScheduledTriggerTypeSchema` and as new variants in the `TriggerSchema` union. The `EXTENDING.md` guide should be updated to document this two-step process for scheduled triggers.

### 2.5 Type Inference

```typescript
// types.ts — new type exports
export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>;
export type IntervalSchedule = z.infer<typeof IntervalScheduleSchema>;
export type CronSchedule = z.infer<typeof CronScheduleSchema>;
export type DueDateRelativeSchedule = z.infer<typeof DueDateRelativeScheduleSchema>;
export type EventTriggerType = z.infer<typeof EventTriggerTypeSchema>;
export type ScheduledTriggerType = z.infer<typeof ScheduledTriggerTypeSchema>;
```

### 2.6 Type Guard Utilities

```typescript
// types.ts — type guards for trigger discrimination

const SCHEDULED_TRIGGER_TYPES: Set<string> = new Set([
  'scheduled_interval',
  'scheduled_cron',
  'scheduled_due_date_relative',
]);

export function isScheduledTrigger(
  trigger: Trigger
): trigger is Trigger & { schedule: ScheduleConfig; lastEvaluatedAt: string | null } {
  return SCHEDULED_TRIGGER_TYPES.has(trigger.type);
}

export function isEventTrigger(
  trigger: Trigger
): trigger is Trigger & { sectionId: string | null } {
  return !SCHEDULED_TRIGGER_TYPES.has(trigger.type);
}
```

### 2.7 `in_section_for_more_than` Filter Gap

QA Scenario 2 identifies that scheduled triggers expose a filter gap: there's no way to check how long a task has been in its current section. The existing filter system only has due-date-based comparisons.

**Proposed approach: Defer to Phase 5b with a clear schema change note.**

Adding `movedToSectionAt` to the Task entity requires:
1. A new `z.string().datetime().nullable()` field on `TaskSchema`
2. Updating `dataStore.updateTask` to set `movedToSectionAt = new Date().toISOString()` whenever `sectionId` changes
3. Backfilling existing tasks (set to `updatedAt` or `createdAt` as a best-effort approximation)
4. A new `in_section_for_more_than` filter type in `CardFilterSchema` + `filterPredicates.ts`

This is a meaningful schema change to the core Task entity, not just the automation feature. It should be a separate RFC. For Phase 5a, users can approximate with `is_overdue` or `due_in_more_than` filters. Document this limitation in the scheduled trigger UI tooltip.

**Decision**: Defer `movedToSectionAt` and `in_section_for_more_than` to Phase 5b. Track as a dependency.

---

## 3. Scheduler Engine Design

### 3.1 Core Abstraction: Clock Interface

Every time-dependent operation goes through an injectable `Clock`. No `Date.now()` or `new Date()` calls in scheduler logic.

```typescript
// services/clock.ts

/**
 * Injectable clock abstraction for deterministic testing.
 * Production uses SystemClock. Tests inject FakeClock.
 */
export interface Clock {
  now(): number;       // epoch millis, equivalent to Date.now()
  toDate(): Date;      // equivalent to new Date()
}

export class SystemClock implements Clock {
  now(): number { return Date.now(); }
  toDate(): Date { return new Date(); }
}

/**
 * Fake clock for testing. Advances manually.
 * Supports auto-advance to simulate time passing between calls.
 */
export class FakeClock implements Clock {
  private currentTime: number;

  constructor(initialTime: number | Date = 0) {
    this.currentTime = typeof initialTime === 'number' ? initialTime : initialTime.getTime();
  }

  now(): number { return this.currentTime; }
  toDate(): Date { return new Date(this.currentTime); }

  /** Advance time by N milliseconds */
  advance(ms: number): void { this.currentTime += ms; }

  /** Set time to a specific point */
  set(time: number | Date): void {
    this.currentTime = typeof time === 'number' ? time : time.getTime();
  }
}
```

### 3.2 Pure Schedule Evaluation Functions

The core scheduling logic is a set of pure functions. No side effects, no I/O, no DOM APIs. This is the most testable layer.

```typescript
// services/scheduleEvaluator.ts

import type { Clock } from './clock';
import type { Trigger, AutomationRule } from '../types';
import { isScheduledTrigger } from '../types';

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
 * 
 * Pure function. Given (now, lastEvaluatedAt, intervalMinutes), returns whether
 * enough time has elapsed.
 * 
 * Catch-up semantics (PM US-10): If the app was closed for 3 intervals, this
 * returns shouldFire=true ONCE (not 3 times). The caller fires the rule once
 * and updates lastEvaluatedAt to now. This is "at-most-once-per-window" semantics.
 */
export function evaluateIntervalSchedule(
  nowMs: number,
  lastEvaluatedAt: string | null,
  intervalMinutes: number
): ScheduleEvaluation {
  const intervalMs = intervalMinutes * 60 * 1000;
  const nowIso = new Date(nowMs).toISOString();

  if (lastEvaluatedAt === null) {
    // First evaluation ever — fire immediately, set baseline
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
 * 
 * Checks if the current time falls within a matching window that hasn't
 * been evaluated yet. The "window" is the current minute — cron resolution
 * is 1 minute.
 * 
 * Catch-up semantics (PM US-10): If the app was closed and a cron window
 * was missed, we fire once on reopen if the MOST RECENT matching window
 * was missed. We do NOT fire for every missed window (e.g., if the rule
 * fires daily at 9am and the app was closed for 3 days, we fire once,
 * not 3 times).
 */
export function evaluateCronSchedule(
  nowMs: number,
  lastEvaluatedAt: string | null,
  schedule: { hour: number; minute: number; daysOfWeek: number[]; daysOfMonth: number[] }
): ScheduleEvaluation {
  const now = new Date(nowMs);
  const nowIso = now.toISOString();

  // Find the most recent matching cron window at or before now
  const mostRecentMatch = findMostRecentCronMatch(now, schedule);
  if (!mostRecentMatch) {
    return { shouldFire: false, newLastEvaluatedAt: lastEvaluatedAt ?? nowIso };
  }

  if (lastEvaluatedAt === null) {
    // First evaluation — fire if we're currently in a matching window
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
 * 
 * Iterates all tasks with due dates. For each task, checks if
 * (dueDate + offsetMinutes) falls between lastEvaluatedAt and now.
 * 
 * Returns the list of matching task IDs so the scheduler can emit
 * one event per task.
 * 
 * Catch-up (PM US-10): If the app was closed and a task's trigger
 * window passed, it fires once on reopen (the window check catches it).
 */
export function evaluateDueDateRelativeSchedule(
  nowMs: number,
  lastEvaluatedAt: string | null,
  offsetMinutes: number,
  tasks: Array<{ id: string; dueDate: string | null; completed: boolean; parentTaskId: string | null }>
): ScheduleEvaluation {
  const nowIso = new Date(nowMs).toISOString();
  const windowStart = lastEvaluatedAt ? new Date(lastEvaluatedAt).getTime() : nowMs - 60_000; // 1 min lookback on first eval
  const offsetMs = offsetMinutes * 60 * 1000;

  const matchingTaskIds: string[] = [];

  for (const task of tasks) {
    // Skip completed tasks, subtasks, and tasks without due dates
    if (!task.dueDate || task.completed || task.parentTaskId !== null) continue;

    const triggerTime = new Date(task.dueDate).getTime() + offsetMs;

    // Fire if the trigger time falls within (lastEvaluatedAt, now]
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
 * Evaluate all scheduled rules and return those that should fire.
 * Pure function — no side effects.
 */
export function evaluateScheduledRules(
  nowMs: number,
  rules: AutomationRule[],
  tasks: Array<{ id: string; dueDate: string | null; completed: boolean; parentTaskId: string | null }>
): Array<{ rule: AutomationRule; evaluation: ScheduleEvaluation }> {
  const results: Array<{ rule: AutomationRule; evaluation: ScheduleEvaluation }> = [];

  for (const rule of rules) {
    if (!rule.enabled || rule.brokenReason !== null) continue;
    if (!isScheduledTrigger(rule.trigger)) continue;

    const trigger = rule.trigger;
    let evaluation: ScheduleEvaluation;

    switch (trigger.type) {
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
          tasks
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
 * the cron schedule. Searches up to 7 days back (covers weekly schedules).
 * Returns null if no match found.
 * 
 * Last-day-of-month handling: if daysOfMonth contains a value > the last
 * day of the candidate month, it's treated as the last day. This ensures
 * a rule set for "the 31st" fires on Feb 28, Apr 30, etc.
 */
function findMostRecentCronMatch(
  now: Date,
  schedule: { hour: number; minute: number; daysOfWeek: number[]; daysOfMonth: number[] }
): Date | null {
  // Start from the current day's scheduled time, walk backward day by day
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() - dayOffset);
    candidate.setHours(schedule.hour, schedule.minute, 0, 0);

    // Don't return future times
    if (candidate.getTime() > now.getTime()) continue;

    // Check day-of-week constraint
    if (schedule.daysOfWeek.length > 0 && !schedule.daysOfWeek.includes(candidate.getDay())) {
      continue;
    }

    // Check day-of-month constraint (with last-day-of-month normalization)
    if (schedule.daysOfMonth.length > 0) {
      const lastDayOfMonth = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
      const adjustedDays = schedule.daysOfMonth.map(d => Math.min(d, lastDayOfMonth));
      if (!adjustedDays.includes(candidate.getDate())) {
        continue;
      }
    }

    return candidate;
  }

  return null;
}
```


### 3.3 SchedulerService Class

The `SchedulerService` owns the timer lifecycle and bridges pure evaluation to side-effectful execution.

```typescript
// services/schedulerService.ts

import type { Clock } from './clock';
import type { AutomationRuleRepository } from '../repositories/types';
import type { TaskRepository } from '@/lib/repositories/types';
import type { AutomationRule } from '../types';
import { evaluateScheduledRules, type ScheduleEvaluation } from './scheduleEvaluator';
import { isScheduledTrigger } from '../types';

/**
 * Callback invoked when a scheduled rule fires.
 * The caller (integration layer) is responsible for routing this
 * into AutomationService.handleEvent().
 */
export interface ScheduledRuleCallback {
  (params: {
    rule: AutomationRule;
    evaluation: ScheduleEvaluation;
  }): void;
}

/**
 * Callback invoked after a complete tick() pass finishes.
 * Used for summary notifications (§8).
 */
export interface TickCompleteCallback {
  (params: {
    rulesEvaluated: number;
    rulesFired: number;
    totalTasksAffected: number;
    isCatchUp: boolean;
  }): void;
}

/**
 * SchedulerService manages the tick loop for scheduled automation rules.
 * 
 * Responsibilities:
 * - Start/stop the tick interval
 * - On each tick: evaluate all scheduled rules via pure functions
 * - For rules that should fire: invoke the callback and update lastEvaluatedAt
 * - Handle visibility changes (pause in background, catch-up on foreground)
 * - Provide catch-up evaluation on startup
 * 
 * Does NOT:
 * - Execute actions (that's AutomationService's job)
 * - Manage undo snapshots
 * - Emit toasts
 * - Import stores
 */
export class SchedulerService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private readonly TICK_INTERVAL_MS = 60_000; // 1 minute
  private onTickComplete?: TickCompleteCallback;

  constructor(
    private clock: Clock,
    private ruleRepo: AutomationRuleRepository,
    private taskRepo: TaskRepository,
    private onRuleFired: ScheduledRuleCallback,
    onTickComplete?: TickCompleteCallback
  ) {
    this.onTickComplete = onTickComplete;
  }

  /**
   * Start the tick loop. Idempotent — calling start() when already running is a no-op.
   * 
   * On start:
   * 1. Run an immediate catch-up evaluation (handles app reopen after being closed)
   *    — PM US-10 requires catch-up within 60s of app open
   * 2. Start the 60-second interval
   * 3. Register Page Visibility API listener
   */
  start(): void {
    if (this.intervalId !== null) return;

    // Immediate catch-up on start
    this.tick(true);

    // Start periodic tick
    this.intervalId = setInterval(() => this.tick(false), this.TICK_INTERVAL_MS);

    // Visibility change handler: catch-up when tab becomes visible
    this.visibilityHandler = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.tick(true);
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  /**
   * Stop the tick loop and clean up listeners.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /**
   * Single tick: evaluate all scheduled rules and fire those that are due.
   * 
   * This method is also called on visibility change (tab becomes visible)
   * to catch up on missed ticks from background throttling.
   * 
   * @param isCatchUp - true when this tick is a catch-up (app open or tab visible)
   */
  tick(isCatchUp = false): void {
    const nowMs = this.clock.now();
    const rules = this.ruleRepo.findAll();
    const tasks = this.taskRepo.findAll();

    const results = evaluateScheduledRules(nowMs, rules, tasks);
    let totalTasksAffected = 0;

    for (const { rule, evaluation } of results) {
      // Update lastEvaluatedAt on the rule BEFORE firing the callback.
      // This prevents double-firing if the callback triggers a synchronous re-evaluation.
      // Also serves as crash recovery: if the browser crashes mid-execution,
      // the rule won't re-fire on next startup (§9).
      this.updateLastEvaluatedAt(rule.id, evaluation.newLastEvaluatedAt);

      // Fire the callback — the integration layer routes this to AutomationService
      this.onRuleFired({ rule, evaluation });

      totalTasksAffected += evaluation.matchingTaskIds?.length ?? 1;
    }

    // Update lastEvaluatedAt for rules that were evaluated but didn't fire
    // (advances the window so catch-up doesn't re-evaluate old windows)
    this.updateNonFiredRules(rules, results.map(r => r.rule.id), nowMs);

    // Notify tick completion for summary toast (§8)
    if (results.length > 0 && this.onTickComplete) {
      this.onTickComplete({
        rulesEvaluated: rules.filter(r => r.enabled && r.brokenReason === null && isScheduledTrigger(r.trigger)).length,
        rulesFired: results.length,
        totalTasksAffected,
        isCatchUp,
      });
    }
  }

  /**
   * Update lastEvaluatedAt on a rule's trigger.
   * Only touches the trigger.lastEvaluatedAt field — no other rule fields are modified.
   */
  private updateLastEvaluatedAt(ruleId: string, lastEvaluatedAt: string): void {
    const rule = this.ruleRepo.findById(ruleId);
    if (!rule || !isScheduledTrigger(rule.trigger)) return;

    this.ruleRepo.update(ruleId, {
      trigger: { ...rule.trigger, lastEvaluatedAt },
    });
  }

  /**
   * For scheduled rules that were evaluated but didn't fire,
   * still advance their lastEvaluatedAt to prevent stale catch-up windows.
   * 
   * Only updates rules whose lastEvaluatedAt is null (first evaluation)
   * or significantly behind (> 2 tick intervals). This avoids unnecessary
   * writes on every tick for rules that are up-to-date.
   */
  private updateNonFiredRules(
    allRules: AutomationRule[],
    firedRuleIds: string[],
    nowMs: number
  ): void {
    const firedSet = new Set(firedRuleIds);
    const nowIso = new Date(nowMs).toISOString();
    const staleThresholdMs = this.TICK_INTERVAL_MS * 2;

    for (const rule of allRules) {
      if (!rule.enabled || rule.brokenReason !== null) continue;
      if (!isScheduledTrigger(rule.trigger)) continue;
      if (firedSet.has(rule.id)) continue;

      const lastMs = rule.trigger.lastEvaluatedAt
        ? new Date(rule.trigger.lastEvaluatedAt).getTime()
        : 0;

      if (nowMs - lastMs > staleThresholdMs) {
        this.updateLastEvaluatedAt(rule.id, nowIso);
      }
    }
  }

  /** Check if the scheduler is currently running */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}
```

### 3.4 Why `setInterval` Over Alternatives

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| `setInterval(60s)` | Simple, well-understood, sufficient for minute-level resolution | Throttled to 1s+ in background tabs | ✅ **Chosen** — visibility API compensates |
| `requestAnimationFrame` | Not throttled the same way | Only fires when tab is visible, 60fps is wasteful for minute-level checks | ❌ Wrong tool |
| Web Worker + `setInterval` | Not throttled in background | Adds complexity (message passing, worker lifecycle), can't access DOM, still throttled in some browsers | ❌ Overkill for v1 |
| Service Worker | Survives tab close, push-based | Requires HTTPS, registration complexity, can't access localStorage directly, overkill for client-side app | ❌ Future consideration |

### 3.5 Tick Resolution: Why 60 Seconds

- Cron schedules have minute-level granularity — 60s tick matches perfectly
- Interval schedules have a 5-minute minimum — 60s tick gives ≤1 minute jitter (acceptable)
- Due-date-relative schedules typically use day-level offsets — 60s is more than sufficient
- Lower tick rates (5s, 10s) waste CPU cycles checking rules that won't fire
- Higher tick rates (5min) would make cron schedules miss their window

The 60-second tick means:
- A cron rule set for 9:00 will fire between 9:00:00 and 9:00:59
- An interval rule set for 30 minutes will fire within ±1 minute of the target
- These tolerances are acceptable for a task management app

---

## 4. Integration with Existing Architecture

### 4.1 New Domain Event Type: `schedule.fired`

Scheduled triggers don't respond to entity mutations — they generate their own synthetic events. We extend the `DomainEvent` type union:

```typescript
// lib/events/types.ts — extend DomainEvent

export interface DomainEvent {
  type: 'task.created' | 'task.updated' | 'task.deleted' 
      | 'section.created' | 'section.updated'
      | 'schedule.fired';  // NEW
  entityId: string;
  projectId: string;
  changes: Record<string, unknown>;
  previousValues: Record<string, unknown>;
  triggeredByRule?: string;
  depth: number;
}
```

For `schedule.fired` events:
- `entityId`: For interval/cron triggers, this is the rule ID itself. For due-date-relative, it's the task ID.
- `projectId`: The rule's `projectId`.
- `changes`: `{ triggerType: 'scheduled_interval' | 'scheduled_cron' | 'scheduled_due_date_relative' }`
- `previousValues`: `{}`
- `triggeredByRule`: The rule ID (always set — scheduled events are always rule-initiated)
- `depth`: `0` — scheduled triggers are top-level initiators, not cascaded (consistent with QA §2.3 recommendation)

### 4.2 Integration Layer: Bridging SchedulerService → AutomationService

The integration layer converts `SchedulerService` callbacks into `DomainEvent`s and feeds them to `AutomationService`. This lives in the service container wiring, not inside either service.

The key change from the original design: **a single shared dedup set spans the entire `tick()` pass**, including all rules and their cascaded events. This resolves QA §2.1 and §3.1.

```typescript
// In lib/serviceContainer.ts — wiring (pseudocode)

import { SchedulerService } from '@/features/automations/services/schedulerService';
import { SystemClock } from '@/features/automations/services/clock';

const schedulerClock = new SystemClock();

/**
 * Integration callback: routes scheduled rule firings into AutomationService.
 * 
 * CRITICAL: The shared dedupSet is created once per tick() in the
 * SchedulerService orchestration layer and passed through all rule
 * firings and their cascades. See §5 for details.
 */
function createScheduledRuleHandler(sharedDedupSet: Set<string>) {
  return ({ rule, evaluation }: { rule: AutomationRule; evaluation: ScheduleEvaluation }) => {
    if (evaluation.matchingTaskIds && evaluation.matchingTaskIds.length > 0) {
      // Due-date-relative: one event per matching task
      automationService.beginBatch();
      for (const taskId of evaluation.matchingTaskIds) {
        const event: DomainEvent = {
          type: 'schedule.fired',
          entityId: taskId,
          projectId: rule.projectId,
          changes: { triggerType: rule.trigger.type },
          previousValues: {},
          triggeredByRule: rule.id,
          depth: 0,
        };
        automationService.handleEvent(event, sharedDedupSet);
      }
      automationService.endBatch();
    } else {
      // For interval/cron triggers, emit a single event
      automationService.beginBatch();
      const event: DomainEvent = {
        type: 'schedule.fired',
        entityId: rule.id,
        projectId: rule.projectId,
        changes: { triggerType: rule.trigger.type },
        previousValues: {},
        triggeredByRule: rule.id,
        depth: 0,
      };
      automationService.handleEvent(event, sharedDedupSet);
      automationService.endBatch();
    }
  };
}
```

### 4.3 Rule Engine Extension

The `evaluateRules` function in `ruleEngine.ts` needs a new branch for `schedule.fired` events:

```typescript
// services/ruleEngine.ts — new branch in evaluateRules()

// Handle schedule.fired events
if (event.type === 'schedule.fired') {
  const triggerType = event.changes.triggerType as string;
  const firedRuleId = event.triggeredByRule;

  // For scheduled triggers, we match the specific rule that fired
  // (unlike event triggers which match ALL rules of a trigger type)
  const matchingRules = ruleIndex.get(triggerType as TriggerType) ?? [];
  
  for (const rule of matchingRules) {
    // Only match the rule that the scheduler determined should fire
    if (rule.id !== firedRuleId) continue;

    if (triggerType === 'scheduled_due_date_relative') {
      // entityId is the task ID — apply filters to that specific task
      if (passesFilters(rule, event.entityId)) {
        actions.push(createRuleAction(rule, event.entityId));
      }
    } else {
      // For interval/cron: apply action to ALL tasks matching filters
      // entityId is the rule ID, not a task ID
      const matchingTasks = context.allTasks.filter(task => {
        if (task.parentTaskId !== null) return false; // skip subtasks
        return passesFilters(rule, task.id);
      });

      for (const task of matchingTasks) {
        actions.push(createRuleAction(rule, task.id));
      }
    }
  }

  return actions;
}
```

**Key design choice**: For interval/cron triggers, the rule engine iterates ALL tasks matching the rule's filters and creates an action for each. This is fundamentally different from event triggers (which act on the single entity that triggered the event). The filters become the primary selection mechanism — e.g., "Every Monday at 9am, for all cards that are overdue, move to Backlog."

### 4.4 Dedup Considerations

The existing dedup mechanism (`ruleId:entityId:actionType`) works correctly for scheduled triggers:

- **Interval/cron + task iteration**: Each task gets its own dedup key. If the same rule fires twice in one tick (shouldn't happen, but defensive), the second firing is deduped per-task.
- **Due-date-relative**: Each task ID is unique, so dedup works naturally.
- **Cascade**: Scheduled trigger actions can cascade (e.g., moving a card triggers a `card_moved_into_section` event trigger). The existing depth limit and dedup set handle this.

**Dedup set scope (RESOLVED — QA §2.1, §3.1)**: One dedup set per `tick()` call, shared across all rules and their cascades. This means:
- Rule A moves task T to Section X → dedup key `A:T:move_card_to_top_of_section` added
- Rule B tries to move task T to Section Y → different dedup key `B:T:move_card_to_top_of_section` → allowed (different rule)
- Rule A's cascade triggers an event-driven rule C that tries to move task T → dedup key `C:T:move_card_to_top_of_section` → allowed (different rule)
- But if Rule A's cascade loops back to Rule A for task T → dedup key `A:T:move_card_to_top_of_section` → blocked (already in set)

This prevents the cascade amplification QA §3.1 warns about: Rule A's cascade can't re-trigger Rule A for the same entity.

### 4.5 Batch Mode

Scheduled triggers use `beginBatch()`/`endBatch()` wrapping (shown in §4.2). This means:
- If a cron rule fires and acts on 15 tasks, the user sees one aggregated toast: "⚡ Automation: [rule name] ran on 15 tasks"
- Undo snapshots are captured for depth-0 events (scheduled events are depth 0)

For the case where multiple scheduled rules fire in the same tick, see §8 (Notification Strategy).

### 4.6 Self-Cascade Prevention

A scheduled trigger's action can produce domain events that trigger other rules (cascade). But we must prevent a scheduled trigger from cascading into itself:

- **Interval/cron**: The `triggeredByRule` field on the synthetic event is set to the rule's own ID. The dedup set will contain `ruleId:entityId:actionType` after the first execution. If the cascade produces an event that would re-trigger the same rule for the same entity, it's deduped.
- **Due-date-relative**: Same mechanism — the dedup set prevents re-triggering for the same task.

No additional protection needed beyond the existing dedup + depth limit.

---

## 5. Batch Execution Optimization

> Addresses QA §3.1 cascade amplification concern and QA §2.7 performance concern.

### 5.1 The Problem

A scheduled rule acting on 50 tasks generates 50 domain events, each triggering event-driven rule evaluation. With 3 matching event-driven rules, that's 150 action executions. Each of those calls `ruleRepo.findByProjectId()`, `taskRepo.findAll()`, `sectionRepo.findAll()` — potentially 150 × 3 repository reads.

QA §2.7 quantifies this: 50 rules × `findAll()` per rule = 50 JSON parses of the task array. While individually fast (<2ms each), the aggregate cost matters.

### 5.2 Shared EvaluationContext Per Tick

The scheduled evaluation orchestrator builds the `EvaluationContext` once per `tick()` and reuses it across all rule evaluations and their cascades within that tick.

```typescript
// In the tick() orchestration (conceptual — actual wiring in serviceContainer)

function scheduledTick(sharedDedupSet: Set<string>): void {
  // Build context ONCE for the entire tick
  const sharedContext: EvaluationContext = {
    allTasks: taskRepo.findAll(),
    allSections: sectionRepo.findAll(),
    maxDepth: 5,
    executedSet: sharedDedupSet,
  };

  // All rule evaluations within this tick reuse sharedContext
  // This avoids 50× findAll() calls (QA §2.7)
  for (const { rule, evaluation } of firedRules) {
    // ... route through AutomationService with sharedContext
  }
}
```

**Trade-off**: The shared context is a snapshot at tick start. If Rule A's action modifies a task (e.g., moves it to a new section), Rule B's filter evaluation within the same tick sees the OLD state. This is acceptable because:
1. The action handlers write to the repository immediately (synchronous), so cascaded events triggered by Rule A's action will see the updated state when they build their own context.
2. Within the same tick's top-level evaluation, rules seeing a consistent snapshot is actually more predictable than seeing partially-mutated state.

### 5.3 Shared Dedup Set Across Tick + Cascades

The dedup set created for a `tick()` call is shared across:
1. All scheduled rules evaluated in that tick
2. All cascaded event-driven rules triggered by those scheduled rules
3. All further cascades (up to depth 5)

This is the definitive answer to QA §2.1's question: **one dedup set per `tick()` call, not per rule.**

```typescript
// Pseudocode for the tick orchestration
function tick(): void {
  const sharedDedupSet = new Set<string>(); // ONE set for the entire tick

  for (const { rule, evaluation } of firedRules) {
    // Each handleEvent call receives the SAME dedupSet
    automationService.handleEvent(syntheticEvent, sharedDedupSet);
    // Cascaded events within handleEvent also use this dedupSet
  }
}
```

**Why this matters (QA §3.1 cascade amplification)**:
- Without shared dedup: Rule A moves 50 tasks → 50 events → Rule C fires 50 times → Rule C's cascades fire independently → potential 50 × 3^5 = 12,150 actions
- With shared dedup: Rule A moves 50 tasks → 50 events → Rule C fires 50 times → but if Rule C tries to act on a task already acted on by Rule A's cascade, the dedup set blocks it. The fan-out is bounded by unique `(ruleId, entityId, actionType)` triples.

---

## 6. Persistence & State Management

### 6.1 `lastEvaluatedAt` — Stored on the Trigger

`lastEvaluatedAt` is a field on the scheduled trigger variants of `TriggerSchema`. It persists to localStorage as part of the rule entity via `LocalStorageAutomationRuleRepository`.

**Why on the trigger, not a separate store?**
- Co-location: The field is meaningless without the schedule config. Storing them together makes the data self-contained.
- No new localStorage key: Reuses `task-management-automations`.
- Repository interface unchanged: `ruleRepo.update(id, { trigger: { ...trigger, lastEvaluatedAt } })` works with the existing `update` method.
- Consistent with `executionCount` and `lastExecutedAt` already on the rule entity.

**Trade-off**: Every tick that updates `lastEvaluatedAt` triggers a localStorage write. With the optimization in §3.3 (`updateNonFiredRules` only writes when stale by >2 ticks), this is at most one write per rule per 2 minutes — negligible.

### 6.2 Catch-Up on App Reopen

When the app loads (PM US-10 — catch-up fires within 60s of app open):
1. `SchedulerService.start()` is called from the service container
2. `start()` calls `tick(true)` immediately
3. `tick()` evaluates all scheduled rules against `clock.now()`
4. Rules whose `lastEvaluatedAt` is stale will fire (at most once per rule)
5. `lastEvaluatedAt` is updated to now

Example: A rule with `intervalMinutes: 60` and `lastEvaluatedAt: "2024-01-15T10:00:00Z"`. The app reopens at `14:30`. The interval check sees 4.5 hours elapsed > 60 minutes → fires once, sets `lastEvaluatedAt` to `14:30`.

### 6.3 Cross-Tab Synchronization

**Problem**: If the user has the app open in two tabs, both tabs run their own `SchedulerService`. Without coordination, a rule fires in both tabs simultaneously (QA §2.10).

**Solution**: `BroadcastChannel` API for leader election.

```typescript
// services/schedulerLeaderElection.ts

/**
 * Simple leader election using BroadcastChannel.
 * Only the leader tab runs the scheduler tick loop.
 * 
 * Algorithm:
 * 1. On start, each tab generates a random ID and broadcasts a "claim" message
 * 2. The tab with the lowest ID becomes leader (deterministic tiebreak)
 * 3. Leader broadcasts heartbeats every 30 seconds
 * 4. If a tab doesn't receive a heartbeat for 60 seconds, it assumes leadership
 * 5. On tab close (beforeunload), the leader broadcasts "resign"
 */
export class SchedulerLeaderElection {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private isLeader = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private leaderTimeout: ReturnType<typeof setTimeout> | null = null;
  private onBecomeLeader: () => void;
  private onLoseLeadership: () => void;

  constructor(
    onBecomeLeader: () => void,
    onLoseLeadership: () => void
  ) {
    this.tabId = Math.random().toString(36).slice(2);
    this.onBecomeLeader = onBecomeLeader;
    this.onLoseLeadership = onLoseLeadership;
  }

  start(): void {
    if (typeof BroadcastChannel === 'undefined') {
      // Fallback: no BroadcastChannel support — assume leader
      this.isLeader = true;
      this.onBecomeLeader();
      return;
    }

    this.channel = new BroadcastChannel('task-mgr-scheduler-leader');
    this.channel.onmessage = (event) => this.handleMessage(event.data);

    // Claim leadership
    this.channel.postMessage({ type: 'claim', tabId: this.tabId });

    // If no one contests within 2 seconds, become leader
    this.leaderTimeout = setTimeout(() => {
      if (!this.isLeader) {
        this.becomeLeader();
      }
    }, 2000);

    // Resign on tab close
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.isLeader) {
          this.channel?.postMessage({ type: 'resign', tabId: this.tabId });
        }
      });
    }
  }

  stop(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.leaderTimeout) clearTimeout(this.leaderTimeout);
    this.channel?.close();
    this.channel = null;
    this.isLeader = false;
  }

  private handleMessage(data: { type: string; tabId: string }): void {
    switch (data.type) {
      case 'claim':
        if (this.isLeader) {
          // Current leader responds with heartbeat to assert leadership
          this.channel?.postMessage({ type: 'heartbeat', tabId: this.tabId });
        } else if (data.tabId < this.tabId) {
          // Lower ID wins — yield
          this.resetLeaderTimeout();
        }
        break;

      case 'heartbeat':
        if (data.tabId !== this.tabId) {
          if (this.isLeader) {
            // Another tab is leader — step down
            this.isLeader = false;
            this.onLoseLeadership();
          }
          this.resetLeaderTimeout();
        }
        break;

      case 'resign':
        // Leader resigned — try to claim
        this.channel?.postMessage({ type: 'claim', tabId: this.tabId });
        this.leaderTimeout = setTimeout(() => {
          if (!this.isLeader) this.becomeLeader();
        }, 2000);
        break;
    }
  }

  private becomeLeader(): void {
    this.isLeader = true;
    this.onBecomeLeader();

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.channel?.postMessage({ type: 'heartbeat', tabId: this.tabId });
    }, 30_000);
  }

  private resetLeaderTimeout(): void {
    if (this.leaderTimeout) clearTimeout(this.leaderTimeout);
    this.leaderTimeout = setTimeout(() => {
      if (!this.isLeader) this.becomeLeader();
    }, 60_000);
  }
}
```

**Wiring**: The leader election wraps `SchedulerService.start()`/`stop()`:

```typescript
// In service container or app initialization
const leaderElection = new SchedulerLeaderElection(
  () => schedulerService.start(),   // become leader → start scheduler
  () => schedulerService.stop()     // lose leadership → stop scheduler
);
leaderElection.start();
```

### 6.4 localStorage Key Strategy

No new localStorage keys. Scheduled trigger state (`lastEvaluatedAt`) is stored on the rule entity within the existing `task-management-automations` key.

| Key | Before | After |
|-----|--------|-------|
| `task-management-automations` | `AutomationRule[]` with event triggers | `AutomationRule[]` with event + scheduled triggers |


---

## 7. Client-Side Constraints & Mitigations

### 7.1 Browser Background Tab Throttling

**Reality**: Browsers throttle `setInterval` in background tabs:
- Chrome: Minimum 1 second interval (was 1 minute before Chrome 88, now 1s with "intensive throttling" after 5 minutes)
- Firefox: Similar behavior, minimum 1 second
- Safari: Aggressive throttling, can pause timers entirely

**Impact**: A 60-second interval may fire at 61s, 65s, or not at all in background tabs.

**Mitigation**: Page Visibility API (already wired in §3.3). When the tab becomes visible:
1. `visibilitychange` event fires
2. `SchedulerService.tick()` runs immediately
3. Catch-up logic in the pure evaluators handles any missed windows

**Guarantee**: Rules will fire within 60 seconds of the tab becoming visible. They may be delayed while the tab is in the background.

### 7.2 Page Visibility API Integration

Already integrated in `SchedulerService.start()` (§3.3). The handler:
```typescript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    this.tick(true); // Immediate catch-up
  }
});
```

### 7.3 Service Worker — Future Consideration

A Service Worker could provide more reliable scheduling by running independently of the tab lifecycle. However:

- **Complexity**: Service Workers can't access localStorage directly (must use IndexedDB or message passing)
- **Registration**: Requires HTTPS (already true for most deployments, but adds setup friction for local dev)
- **Scope**: This app is a static Next.js export — Service Worker registration is possible but adds a new infrastructure concern
- **Diminishing returns**: The Visibility API catch-up already provides "fire on next interaction" semantics, which is sufficient for a task management app

**Recommendation**: Defer Service Worker to a future phase. Document it as an upgrade path if users report missed scheduled rules as a pain point.

### 7.4 Honest Limitations — What We Document to Users

The UI should clearly communicate these constraints:

1. **"Scheduled rules run when the app is open."** — If the app is closed, rules don't fire in real-time. They catch up when you reopen the app.
2. **"Background tabs may delay scheduled rules."** — If the tab is in the background, rules may be delayed until you switch back to the tab.
3. **"Catch-up fires once, not retroactively."** — If a daily rule was missed for 3 days, it fires once on reopen, not 3 times.
4. **"Timing is approximate."** — A rule set for 9:00 AM may fire between 9:00 and 9:01. A 30-minute interval may vary by ±1 minute.
5. **"Only one tab runs scheduled rules."** — If you have multiple tabs open, only one processes scheduled rules (leader election).

These should appear as an info tooltip in the scheduled trigger configuration UI.

### 7.5 What Guarantees We CAN Provide

1. **Consistency**: Given the same `(currentTime, lastEvaluatedAt, scheduleConfig)`, the evaluation is deterministic
2. **At-most-once per window**: A rule fires at most once per scheduled window (no double-firing)
3. **Catch-up on reopen**: Missed rules fire once when the app reopens (PM US-10 — within 60s)
4. **No data loss**: `lastEvaluatedAt` is persisted — closing and reopening the app doesn't reset the schedule baseline
5. **Cascade safety**: Scheduled triggers respect the same depth limit and dedup as event triggers

---

## 8. Notification Strategy

> Addresses QA §2.7 toast flood problem.

### 8.1 The Problem

When 50 scheduled rules fire simultaneously at 9:00 AM, the existing per-rule batch toast system produces 50 toasts — one per rule. With the current sequential toast display, the user sees toast #1 for 5 seconds, then #2, etc. — 250 seconds of toasts. Even with Sonner's 3-toast stack (Decision 12), cycling through 50 toasts is overwhelming.

### 8.2 Scheduled Execution Summary Toast

For scheduled evaluation passes, replace per-rule toasts with a single summary toast:

```
⚡ 5 scheduled rules ran, affecting 23 tasks
   [View execution log]
```

**Implementation**: The `TickCompleteCallback` on `SchedulerService` (§3.3) provides `rulesFired` and `totalTasksAffected`. The integration layer uses these to emit a single summary toast instead of per-rule toasts.

```typescript
// In the integration layer (serviceContainer wiring)

const schedulerService = new SchedulerService(
  schedulerClock,
  automationRuleRepository,
  taskRepository,
  handleScheduledRuleFired,
  // onTickComplete — summary notification
  ({ rulesFired, totalTasksAffected, isCatchUp }) => {
    if (rulesFired === 0) return;

    const prefix = isCatchUp ? '🔄 Catch-up:' : '⚡';
    const message = rulesFired === 1
      ? `${prefix} Scheduled rule ran, affecting ${totalTasksAffected} task${totalTasksAffected === 1 ? '' : 's'}`
      : `${prefix} ${rulesFired} scheduled rules ran, affecting ${totalTasksAffected} task${totalTasksAffected === 1 ? '' : 's'}`;

    // Emit a single summary toast
    showToast(message, 'info', 8000, {
      label: 'View log',
      onClick: () => navigateToAutomationTab(),
    });
  }
);
```

### 8.3 When Per-Rule Toasts Still Apply

- **Single scheduled rule fires**: If only 1 rule fires in a tick, use the existing per-rule toast format ("⚡ Automation: [rule name] ran on N tasks") with undo button. This is more informative than the summary format.
- **Event-driven rules**: No change. Event-driven rules continue to use per-rule batch toasts as today.
- **Cascaded event-driven rules triggered by scheduled rules**: These are suppressed during scheduled evaluation passes. The summary toast covers the entire pass.

### 8.4 Catch-Up Toast

When the app reopens and catch-up fires (PM US-10), the summary toast uses a distinct prefix:

```
🔄 Catch-up: 3 scheduled rules ran, affecting 45 tasks
   [View execution log]
```

This makes it clear to the user that these rules ran because they were missed, not because they were scheduled for right now.

---

## 9. Crash Recovery & Idempotency

> Addresses QA §4.2 and QA Scenarios 3, 5.

### 9.1 `lastEvaluatedAt` Update Timing

**Decision**: `lastEvaluatedAt` is updated BEFORE execution (already implemented in §3.3 — `updateLastEvaluatedAt` is called before `onRuleFired`).

**Rationale**: If the browser crashes mid-execution:
- With update-before: The rule is marked as "ran" but only partially executed. On crash recovery (next app open), the rule does NOT re-fire. Some tasks may have been acted on, others not. The partial execution is visible in the execution log.
- With update-after: The rule re-fires on crash recovery, potentially re-executing actions on tasks that were already acted on. For `move_card` actions, this is idempotent (task is already in the target section). For `create_card`, this creates duplicates.

Update-before is safer because `create_card` duplication is worse than a partial execution. The `create_card` heuristic dedup (§9.2) provides an additional safety net.

### 9.2 `create_card` Deduplication Heuristic

> Addresses QA Scenarios 3 and 5 — catch-up creates duplicate tasks.

The `create_card` action is NOT idempotent. Running it twice creates two tasks with the same title. This is problematic for:
- **Catch-up after absence** (QA Scenario 3): User closes app for 2 months, catch-up fires once, but if the browser crashed mid-execution and catch-up re-fires, duplicates appear.
- **Multi-tab race** (QA §2.10): Despite leader election, a narrow race window exists.
- **Crash recovery** (QA §4.2): If `lastEvaluatedAt` update fails but the `create_card` action succeeded.

**Heuristic dedup for `create_card` in scheduled rules**:

Before creating a task, check if a task with the same title already exists in the target section and was created within the last N hours (where N = the rule's interval or 24 hours for cron rules).

```typescript
// In the create_card action handler (actionHandlers.ts) — new guard for scheduled triggers

function shouldSkipCreateCard(
  cardTitle: string,
  targetSectionId: string,
  allTasks: Task[],
  lookbackMs: number
): boolean {
  const now = Date.now();
  return allTasks.some(task =>
    task.description === cardTitle &&
    task.sectionId === targetSectionId &&
    task.createdAt &&
    (now - new Date(task.createdAt).getTime()) < lookbackMs
  );
}
```

**Trade-offs**:
- **False positive**: If the user legitimately wants two tasks with the same title in the same section within the lookback window, the second one is silently skipped. This is unlikely for scheduled rules (which create the same task on a recurring basis) but possible.
- **False negative**: If the user renames the first task before the second creation attempt, the dedup check misses it. Acceptable — the user explicitly changed the task.
- **Not a guarantee**: This is a heuristic, not a transactional dedup. Document it as "best-effort duplicate prevention for scheduled task creation."

**Lookback window calculation**:
- For `scheduled_interval`: `intervalMinutes * 60 * 1000` (one interval)
- For `scheduled_cron`: 24 hours (covers daily schedules; weekly schedules have a 7-day gap so 24h is conservative)
- For `scheduled_due_date_relative`: 24 hours

**Decision**: This dedup is opt-in via a `skipIfDuplicate` flag on the action config, defaulting to `true` for scheduled triggers and `false` for event triggers. This avoids changing behavior for existing event-driven `create_card` rules.

### 9.3 Idempotency of Other Actions

Non-`create_card` actions are naturally idempotent or safe on re-execution:

| Action | Re-execution behavior | Safe? |
|--------|----------------------|-------|
| `move_card_to_top_of_section` | Task already in target section → `order` recalculated but position unchanged | ✅ Yes |
| `move_card_to_bottom_of_section` | Same as above | ✅ Yes |
| `mark_card_complete` | Task already complete → no-op (handler checks `task.completed`) | ✅ Yes |
| `mark_card_incomplete` | Task already incomplete → no-op | ✅ Yes |
| `set_due_date` | Due date overwritten with same value → no-op | ✅ Yes |
| `remove_due_date` | Due date already null → no-op | ✅ Yes |
| `create_card` | Creates duplicate | ❌ Needs dedup (§9.2) |

---

## 10. TDD Strategy & Correctness Properties

### 10.1 Formal Properties

These properties should be verified with property-based tests (fast-check):

**P1: Interval at-most-once-per-window**
```
∀ (intervalMinutes ∈ [5, 10080], now ∈ Timestamp, lastEvaluatedAt ∈ Timestamp | null):
  let result = evaluateIntervalSchedule(now, lastEvaluatedAt, intervalMinutes)
  if result.shouldFire:
    let result2 = evaluateIntervalSchedule(now, result.newLastEvaluatedAt, intervalMinutes)
    assert result2.shouldFire === false
    // Firing and immediately re-evaluating with the updated lastEvaluatedAt must NOT fire again
```

**P2: Catch-up fires at most once**
```
∀ (intervalMinutes ∈ [5, 10080], closedDuration ∈ [0, 7 days]):
  let lastEvaluatedAt = (now - closedDuration).toISOString()
  let result = evaluateIntervalSchedule(now, lastEvaluatedAt, intervalMinutes)
  // Even if closedDuration >> intervalMinutes, shouldFire is true at most once
  // (the function returns a single boolean, not a count)
  if result.shouldFire:
    assert result.newLastEvaluatedAt === new Date(now).toISOString()
```

**P2a: Catch-up fires within 60s of app open (PM US-10)**
```
// Integration-level property:
∀ (rules with stale lastEvaluatedAt):
  after SchedulerService.start():
    tick(true) is called synchronously
    ⟹ all stale rules are evaluated within the same event loop turn
    // The 60s guarantee comes from start() calling tick() immediately,
    // not from waiting for the first setInterval callback
```

**P3: Interval monotonicity**
```
∀ (intervalMinutes, t1 < t2, lastEvaluatedAt):
  let r1 = evaluateIntervalSchedule(t1, lastEvaluatedAt, intervalMinutes)
  let r2 = evaluateIntervalSchedule(t2, lastEvaluatedAt, intervalMinutes)
  if r1.shouldFire then r2.shouldFire
  // If a rule should fire at t1, it should also fire at any later time t2
  // (given the same lastEvaluatedAt)
```

**P4: Cron day-of-week filtering**
```
∀ (hour ∈ [0,23], minute ∈ [0,59], daysOfWeek ⊂ [0,6], now ∈ Timestamp):
  let result = evaluateCronSchedule(now, null, { hour, minute, daysOfWeek, daysOfMonth: [] })
  if result.shouldFire:
    assert daysOfWeek.length === 0 || daysOfWeek.includes(new Date(now).getDay())
    // A cron rule only fires on its configured days
```

**P5: Due-date-relative window correctness**
```
∀ (offsetMinutes, lastEvaluatedAt, now, task with dueDate):
  let triggerTime = task.dueDate + offsetMinutes
  let result = evaluateDueDateRelativeSchedule(now, lastEvaluatedAt, offsetMinutes, [task])
  if result.shouldFire:
    assert triggerTime > lastEvaluatedAt && triggerTime <= now
    // The trigger time must fall within the evaluation window
```

**P6: Schedule evaluation is deterministic**
```
∀ (now, lastEvaluatedAt, scheduleConfig):
  let r1 = evaluate(now, lastEvaluatedAt, scheduleConfig)
  let r2 = evaluate(now, lastEvaluatedAt, scheduleConfig)
  assert deepEqual(r1, r2)
  // Same inputs always produce same outputs (pure function)
```

**P7: Self-cascade prevention**
```
∀ (scheduledRule, tasks):
  // After a scheduled rule fires and produces cascading events,
  // the dedup set prevents the same rule from re-firing for the same entity
  // This is inherited from the existing dedup mechanism — verify it holds
  // for schedule.fired events
```

**P8: `create_card` idempotency heuristic (PM US-4)**
```
∀ (scheduledRule with create_card action, targetSection, existingTasks):
  let task1 = executeCreateCard(rule, targetSection)
  // Immediately re-executing with the same state should be blocked by dedup
  let task2 = executeCreateCard(rule, targetSection)
  if shouldSkipCreateCard(rule.action.cardTitle, targetSection.id, [...existingTasks, task1], lookbackMs):
    assert task2 === null  // skipped
```

### 10.2 PM User Story → Property Mapping

| PM Story | Property | Coverage |
|----------|----------|----------|
| US-1 (overdue escalation) | P5 (window correctness) + filter tests | Covered by scheduled_cron + is_overdue filter |
| US-2 (due date approaching) | P5 | Covered by scheduled_due_date_relative |
| US-3 (weekly stale flagging) | P4 (day-of-week) | Covered by scheduled_cron with daysOfWeek |
| US-4 (recurring task creation) | P8 (create_card idempotency) | New property — §9.2 |
| US-5 (monthly cleanup) | P4 + filter tests | Covered by scheduled_cron with daysOfMonth |
| US-6 (end-of-sprint) | P1 (interval at-most-once) | Covered by scheduled_interval |
| US-10 (catch-up) | P2, P2a | P2a is new — catch-up within 60s of app open |
| US-11 (one-time scheduled) | Not covered | See §14 — deferred to Phase 5c |

### 10.3 Testability Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Test Layers                        │
├─────────────────────────────────────────────────────┤
│                                                       │
│  Layer 1: Pure evaluators (fast-check)                │
│  ├─ evaluateIntervalSchedule()                        │
│  ├─ evaluateCronSchedule()                            │
│  ├─ evaluateDueDateRelativeSchedule()                 │
│  └─ evaluateScheduledRules()                          │
│  → No mocks needed. Inject timestamps directly.       │
│                                                       │
│  Layer 2: SchedulerService (unit tests)               │
│  ├─ Inject FakeClock                                  │
│  ├─ Inject in-memory repositories (Map<string, T>)    │
│  ├─ Inject mock callback                              │
│  └─ Verify: tick() calls callback with correct args   │
│  → Mocks: repos + callback. No DOM, no timers.        │
│                                                       │
│  Layer 3: Integration (unit tests)                    │
│  ├─ SchedulerService + AutomationService wired        │
│  ├─ FakeClock + in-memory repos                       │
│  └─ Verify: scheduled rule → action executed          │
│  → End-to-end through the service layer.              │
│                                                       │
│  Layer 4: Leader election (unit tests)                │
│  ├─ Mock BroadcastChannel                             │
│  └─ Verify: claim/heartbeat/resign protocol           │
│                                                       │
│  Layer 5: create_card dedup (unit tests)              │
│  ├─ shouldSkipCreateCard() with various task states   │
│  └─ Verify: lookback window, title matching, section  │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 10.4 FakeClock Usage in Tests

```typescript
// Example test structure
import { FakeClock } from '../services/clock';
import { evaluateIntervalSchedule } from '../services/scheduleEvaluator';

describe('evaluateIntervalSchedule', () => {
  it('fires when interval has elapsed', () => {
    const now = new Date('2024-01-15T10:30:00Z').getTime();
    const lastEvaluatedAt = '2024-01-15T10:00:00Z';
    const intervalMinutes = 15;

    const result = evaluateIntervalSchedule(now, lastEvaluatedAt, intervalMinutes);

    expect(result.shouldFire).toBe(true);
    expect(result.newLastEvaluatedAt).toBe(new Date(now).toISOString());
  });

  it('does not fire when interval has not elapsed', () => {
    const now = new Date('2024-01-15T10:10:00Z').getTime();
    const lastEvaluatedAt = '2024-01-15T10:00:00Z';
    const intervalMinutes = 15;

    const result = evaluateIntervalSchedule(now, lastEvaluatedAt, intervalMinutes);

    expect(result.shouldFire).toBe(false);
  });

  // Property-based test
  it('P1: never fires twice with same lastEvaluatedAt', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 10080 }),           // intervalMinutes
        fc.integer({ min: 0, max: 2_000_000_000_000 }), // now (epoch ms)
        fc.option(fc.date().map(d => d.toISOString())), // lastEvaluatedAt
        (intervalMinutes, nowMs, lastEvaluatedAt) => {
          const r1 = evaluateIntervalSchedule(nowMs, lastEvaluatedAt ?? null, intervalMinutes);
          if (r1.shouldFire) {
            const r2 = evaluateIntervalSchedule(nowMs, r1.newLastEvaluatedAt, intervalMinutes);
            expect(r2.shouldFire).toBe(false);
          }
        }
      )
    );
  });
});
```


---

## 11. Proposed File Structure

Following the existing feature-based structure in `features/automations/`:

```
features/automations/
├── services/
│   ├── clock.ts                        # NEW — Clock interface, SystemClock, FakeClock
│   ├── clock.test.ts                   # NEW — FakeClock unit tests
│   ├── scheduleEvaluator.ts            # NEW — Pure schedule evaluation functions
│   ├── scheduleEvaluator.test.ts       # NEW — Unit tests (example-based)
│   ├── scheduleEvaluator.property.test.ts  # NEW — Property-based tests (P1–P8)
│   ├── schedulerService.ts             # NEW — Tick loop, visibility handling
│   ├── schedulerService.test.ts        # NEW — Unit tests with FakeClock + mock repos
│   ├── schedulerLeaderElection.ts      # NEW — BroadcastChannel leader election
│   ├── schedulerLeaderElection.test.ts # NEW — Protocol tests with mock channel
│   ├── createCardDedup.ts              # NEW — shouldSkipCreateCard() heuristic
│   ├── createCardDedup.test.ts         # NEW — Dedup heuristic tests
│   ├── ruleEngine.ts                   # MODIFIED — add schedule.fired branch
│   ├── ruleEngine.test.ts              # MODIFIED — add schedule.fired tests
│   ├── ruleMetadata.ts                 # MODIFIED — add scheduled trigger metadata
│   ├── rulePreviewService.ts           # MODIFIED — preview parts for scheduled triggers
│   ├── rulePreviewService.test.ts      # MODIFIED — preview tests for scheduled triggers
│   ├── sectionReferenceCollector.ts    # UNCHANGED — scheduled triggers don't reference sections in trigger
│   ├── automationService.ts            # UNCHANGED — receives schedule.fired events like any other
│   ├── ruleExecutor.ts                 # MODIFIED — trigger description for scheduled types
│   ├── actionHandlers.ts               # MODIFIED — create_card dedup guard for scheduled triggers
│   └── ...existing files...
├── schemas.ts                          # MODIFIED — discriminated union TriggerSchema, schedule configs
├── schemas.test.ts                     # MODIFIED — schema validation tests for new trigger types
├── types.ts                            # MODIFIED — new type exports, type guards
├── index.ts                            # MODIFIED — export new services
├── components/
│   ├── RuleDialogStepTrigger.tsx       # MODIFIED — schedule configuration UI
│   ├── ScheduleConfigPanel.tsx         # NEW — interval/cron/due-date config panel (see UI/UX Analysis §3)
│   ├── ScheduleConfigPanel.test.tsx    # NEW — component tests
│   └── ...existing files...
└── ...existing docs...
```

### File Responsibility Summary

| File | Responsibility | Dependencies |
|------|---------------|-------------|
| `clock.ts` | Time abstraction | None (leaf) |
| `scheduleEvaluator.ts` | Pure schedule math | `types.ts` only |
| `schedulerService.ts` | Tick loop orchestration | `clock.ts`, `scheduleEvaluator.ts`, repository interfaces |
| `schedulerLeaderElection.ts` | Cross-tab coordination | BroadcastChannel API |
| `createCardDedup.ts` | Duplicate task detection heuristic | `types.ts` only (pure function) |
| `ScheduleConfigPanel.tsx` | Schedule configuration UI | `schemas.ts`, `types.ts` |

### Dependency Graph (new files only)

```
                    ┌──────────────┐
                    │   clock.ts   │ ← leaf, no deps
                    └──────┬───────┘
                           │
                    ┌──────▼───────────────┐
                    │ scheduleEvaluator.ts  │ ← pure functions, depends on types.ts
                    └──────┬───────────────┘
                           │
                    ┌──────▼───────────────┐
                    │ schedulerService.ts   │ ← orchestrator
                    └──────┬───────────────┘
                           │
              ┌────────────┼────────────────┐
              │            │                │
    ┌─────────▼──┐  ┌─────▼──────┐  ┌──────▼──────────────┐
    │ ruleRepo   │  │ taskRepo   │  │ schedulerLeader-     │
    │ (interface)│  │ (interface)│  │ Election.ts          │
    └────────────┘  └────────────┘  └──────────────────────┘

    ┌──────────────────┐
    │ createCardDedup.ts│ ← pure function, no service deps
    └──────────────────┘
```

---

## 12. Migration Strategy

### 12.1 Schema Migration — Zero-Downtime

The discriminated union `TriggerSchema` is backward-compatible with existing data:

```typescript
// Existing rule in localStorage:
{
  "trigger": { "type": "card_moved_into_section", "sectionId": "abc" }
}

// This validates against the new discriminated union because the variant
// z.object({ type: z.literal('card_moved_into_section'), sectionId: z.string().min(1).nullable() })
// matches exactly.
```

No data migration script needed. The new schema accepts all existing data as-is.

### 12.2 Repository Migration

`LocalStorageAutomationRuleRepository` already runs schema migrations on load (adds missing fields with defaults). For scheduled triggers, the new fields (`schedule`, `lastEvaluatedAt`) only exist on new trigger variants — existing rules don't need them.

If we want to be defensive, add a migration step:

```typescript
// In localStorageAutomationRuleRepository.ts — migration
function migrateRule(raw: unknown): AutomationRule {
  const obj = raw as Record<string, unknown>;
  
  // Existing migrations...
  
  // v2: Ensure trigger has the correct shape for discriminated union
  // No-op for existing event triggers — they already have { type, sectionId }
  // New scheduled triggers will be created with the full shape
  
  return AutomationRuleSchema.parse(obj);
}
```

### 12.3 EXTENDING.md Alignment

The existing `EXTENDING.md` describes how to add new trigger types in 8 steps. The discriminated union changes step 1:

**Before**: "Add the new value to `TriggerTypeSchema` enum"
**After**: For event triggers, same as before. For scheduled triggers:
1. Add the value to `ScheduledTriggerTypeSchema` (and it auto-propagates to `TriggerTypeSchema`)
2. Add a new variant to the `TriggerSchema` discriminated union with the appropriate `schedule` shape
3. Add the trigger type to the `SCHEDULED_TRIGGER_TYPES` set in `types.ts`

Steps 2-8 remain the same, with the addition of:
- Step 3 (Rule Engine): Add matching logic in the `schedule.fired` branch, not the event-type branches
- Step 4 (Domain Events): Not applicable — scheduled triggers don't respond to domain events, they generate them

**Action**: Update `EXTENDING.md` with a new section "Adding a New Scheduled Trigger Type" after the existing "Adding a New Trigger Type" section.

### 12.4 Phased Rollout

**Phase 5a: Foundation + Scheduler + UI**
1. Add `Clock` interface + `FakeClock` + `SystemClock`
2. Add `scheduleEvaluator.ts` with pure functions + property tests (including last-day-of-month fix)
3. Add schedule config Zod schemas
4. Extend `TriggerSchema` to discriminated union
5. Update `ruleEngine.ts` with `schedule.fired` branch
6. Add `createCardDedup.ts` with heuristic dedup
7. Add `SchedulerService` with tick loop + `SchedulerLeaderElection`
8. Wire into `serviceContainer.ts` with integration tests
9. Add `ScheduleConfigPanel` component + extend `RuleDialogStepTrigger`
10. Update `ruleMetadata.ts` + preview service for scheduled trigger descriptions
11. Add `is_complete` / `is_incomplete` filters
12. Add aggregated execution log entries (`matchCount` + `details`)
13. Add "Run Now" button on RuleCard for scheduled rules
14. Summary toast + catch-up toast integration
15. Add info tooltip about client-side limitations
16. Add `schemaVersion` to export format
17. All existing tests pass — no behavioral change for event triggers

**Phase 5b: Filters + Polish**
1. Add `in_section_for_more_than` filter (requires `movedToSectionAt` on Task entity)
2. Add `created_more_than`, `completed_more_than`, `last_updated_more_than` filters
3. Add `skip_missed` catch-up policy toggle (per-rule opt-in)
4. Add title templates with `{{date}}`, `{{weekday}}`, `{{month}}` interpolation
5. Dry-run / preview for scheduled rules
6. Schedule history view

**Phase 5c: Power User**
1. One-time scheduled triggers (`scheduled_one_time` with `fireAt` field + auto-disable)
2. Cron expression input (optional power-user escape hatch)
3. Bulk schedule management ("Pause all scheduled rules")

### 12.5 Rollback Strategy

If scheduled triggers cause issues:
1. `SchedulerService.stop()` halts all scheduled evaluation
2. Existing event triggers are completely unaffected (separate code paths)
3. Scheduled rules can be disabled individually via `rule.enabled = false`
4. The discriminated union schema is backward-compatible — removing scheduled trigger types from the enum doesn't invalidate existing event trigger data

---

## 13. Disagreements with PM/QA

### 13.1 ARCHITECT DISAGREES: PM's `catch_up_all` as Phase 5b Option

PM §4.2 recommends `catch_up_all` (fire each missed occurrence) as a Phase 5b enhancement for recurring task creation (US-4). QA §2.1 also lists it as an option.

**Disagreement**: `catch_up_all` is architecturally unsound for a client-side app.

**Rationale**:
1. **Stale filter context**: `catch_up_all` would need to evaluate filters against historical state. We don't have historical state — localStorage only stores current state. Evaluating Saturday's missed rule with Monday's task state produces incorrect results (QA §2.1 identifies this exact problem: "filter evaluation uses stale dates").
2. **Unbounded blast radius**: If the app was closed for 30 days and a daily rule has `catch_up_all`, it fires 30 times on app open. With 50 matching tasks per run, that's 1,500 actions in a single synchronous call stack. This will freeze the UI.
3. **User confusion**: 30 "Daily Standup Prep" tasks appearing simultaneously is worse than 1 task appearing with a note "missed 29 occurrences."
4. **Complexity**: Implementing `catch_up_all` requires computing all missed schedule windows, iterating them in order, and maintaining intermediate state between iterations. This is a mini-scheduler-within-the-scheduler.

**Counter-proposal**: For `create_card` rules where users want one task per missed occurrence, add a `missedOccurrenceCount` field to the catch-up evaluation result. The UI can display "This rule missed 3 occurrences while the app was closed" in the execution log. The user can manually create the missing tasks if needed. This is transparent without being destructive.

### 13.2 ARCHITECT DISAGREES: QA's Per-Rule Catch-Up Policy

QA §2.1 recommends per-rule configurable catch-up policy (`skip_missed`, `catch_up_latest`, `catch_up_all`).

**Disagreement**: Per-rule configuration adds UI complexity for a niche use case.

**Rationale**:
1. `catch_up_latest` is correct for 95%+ of use cases. The PM's own recommendation (§4.2) is Option B (catch-up latest) for MVP.
2. `skip_missed` is dangerous — a user who doesn't understand the setting will wonder why their rule "didn't run" after being away.
3. `catch_up_all` is architecturally unsound (§13.1).
4. Adding a 3-option dropdown to every scheduled rule's configuration increases cognitive load for a setting most users should never change.

**Counter-proposal**: Ship `catch_up_latest` as the only behavior for Phase 5a. If user feedback indicates demand for `skip_missed`, add it as an advanced toggle in Phase 5c. Do not implement `catch_up_all`.

### 13.3 ARCHITECT AGREES: QA's Shared Dedup Set

QA §3.1's recommendation for a shared dedup set across the entire scheduled evaluation pass is correct and adopted (§4.4, §5.3). The original Architecture doc was ambiguous on this point.

### 13.4 ARCHITECT AGREES: PM's "Run Now" Button

PM §8.4 suggests a "Run Now" button for testing scheduled rules. This is low-effort and high-value — it calls the same execution path with `clock.now()` as the reference time. Add to Phase 5c (UI).

---

## 14. Design Decisions — All Resolved

### 14.1 Resolved

| # | Question | Resolution | Source |
|---|----------|-----------|--------|
| 1 | Flat schema vs discriminated union? | Discriminated union — type safety, validation, narrowing (§2.4) | Original |
| 2 | `setInterval` vs Web Worker? | `setInterval` + Visibility API — simpler, sufficient (§3.4) | Original |
| 3 | Where to store `lastEvaluatedAt`? | On the trigger entity — co-location, no new storage key (§6.1) | Original |
| 4 | Catch-up: fire once or N times? | Once — at-most-once-per-window semantics (§3.2) | Original |
| 5 | Cross-tab: ignore or coordinate? | Leader election via BroadcastChannel (§6.3) | Original |
| 6 | Dedup set scope: per-rule or per-tick? | **One dedup set per `tick()` call**, shared across all rules and their cascades (§4.4, §5.3) | QA §2.1, §3.1 |
| 7 | Notification strategy for scheduled passes? | **Summary toast** for multi-rule ticks; per-rule toast for single-rule ticks (§8) | QA §2.7 |
| 8 | `lastEvaluatedAt` update timing (before or after execution)? | **Before execution** — prevents re-execution on crash; `create_card` dedup heuristic as safety net (§9.1) | QA §4.2 |
| 9 | Catch-up policy: per-rule configurable? | **No** — `catch_up_latest` only for Phase 5a. `skip_missed` deferred to Phase 5c if user demand exists. `catch_up_all` rejected (§13.1, §13.2) | QA §2.1, PM §4.2 |

### 14.2 Resolved (formerly "Open for Discussion")

All items below have been promoted from recommendations to final decisions based on cross-doc consensus between Architecture, PM, and QA.

| # | Question | Decision | Rationale | Phase |
|---|----------|----------|-----------|-------|
| 1 | Should interval/cron triggers require at least one filter? | **Action-dependent filter requirement.** Require ≥1 filter for task-targeting actions (`move`, `mark_complete/incomplete`, `set_due_date`, `remove_due_date`). Allow filterless for `create_card` (no existing tasks to filter on). | PM's nuanced position is correct — blanket filter requirement blocks valid `create_card` use cases (US-4, US-7, US-12). The UI validates at rule creation time: if action targets existing tasks and filters are empty, show a warning "This rule will affect ALL tasks in the project on every run." User can override. | 5a |
| 2 | Max scheduled rules per project? | **12 scheduled rules per project.** | Compromise between Architecture's 10 and PM's 15. 12 covers realistic power-user workflows (3 daily + 3 weekly + 3 monthly + 3 relative = 12) while bounding tick evaluation cost. Enforced at rule creation time via UI validation. Revisit based on adoption data — if median is 2 and P95 is <8, keep at 12. If P95 hits 12, raise to 20. | 5a |
| 3 | `scheduled_due_date_relative` — support positive offset (after due date)? | **Yes, both directions.** | "1 day after due date → move to Overdue" is a core use case (PM US-1). The schema already supports positive `offsetMinutes`. No additional work needed. | 5a |
| 4 | Cron: "last day of month" support? | **Phase 5a: `findMostRecentCronMatch` treats `daysOfMonth` values > last day of month as last day.** | QA Decision 10 correctly identifies that the current implementation skips months where the day doesn't exist (e.g., Feb has no 31st). The fix is small: in `findMostRecentCronMatch`, if `schedule.daysOfMonth` contains a value > `lastDayOfMonth`, treat it as `lastDayOfMonth`. This is 5 lines of code and prevents a confusing "rule only fires 7 months/year" bug. Ship in 5a, not 5c. | 5a |
| 5 | Scheduler tick configurable? | **Fixed 60s.** | No user benefit from configurability. Adaptive ticking is clever but hard to reason about and test. For testing, `FakeClock` + manual `tick()` calls provide full control. | 5a |
| 6 | Undo for scheduled triggers? | **Undo when tab visible, skip for catch-up. 30-second window.** | Implementation: check `document.visibilityState === 'visible'` and `!isCatchUp` before capturing undo snapshots in the integration layer. The existing undo mechanism works at the action level — no changes to `undoService.ts`. Only the integration wiring needs the visibility + catch-up guard. Extend `UNDO_EXPIRY_MS` from 10s to 30s for scheduled rule snapshots (add a `scheduledRule: boolean` flag to `UndoSnapshot`). | 5a |
| 7 | Title templates with date interpolation for `create_card`? | **Phase 5b.** Static titles only in MVP. | Templates like `"Weekly Status Update — {{date}}"` prevent duplicate-title confusion but add parsing complexity. The `create_card` dedup heuristic (§9.2) mitigates the worst case for MVP. Phase 5b adds `{{date}}`, `{{weekday}}`, `{{month}}` interpolation using a simple regex-based template engine (no full template language). | 5b |
| 8 | "Run Now" button? | **Phase 5a.** Ship as a small icon button on the RuleCard for scheduled rules. | Low effort — calls `schedulerService.tick()` scoped to a single rule (add a `tickRule(ruleId)` method that evaluates one rule). High value for rule authoring and debugging. PM and Architecture agree. No reason to defer to 5c. | 5a |
| 9 | One-time scheduled triggers (PM US-11)? | **Phase 5c.** | Requires a new `scheduled_one_time` trigger type with `fireAt: z.string().datetime()`. After firing, set `rule.enabled = false`. Straightforward discriminated union extension. Not MVP — users can approximate with a cron rule and manually disabling after it fires. | 5c |
| 10 | `in_section_for_more_than` filter? | **Phase 5b.** | Requires `movedToSectionAt` timestamp on Task entity (§2.7). Meaningful schema change to core entity — separate RFC. For Phase 5a, users approximate with `is_overdue` or `created_more_than` (Phase 5b). | 5b |
| 11 | Execution log format for scheduled rules? | **One aggregated entry per scheduled run.** | Add `matchCount: number` and `details?: string[]` to `ExecutionLogEntrySchema`. For scheduled executions, push ONE entry with `matchCount` = number of affected tasks and `details` = first 10 task names. The 20-entry cap now covers 20 scheduled runs (weeks of history) instead of 20 individual task moves. Event-driven rules continue using per-task entries (no change). | 5a |

---

## Appendix A: Metadata Extensions

```typescript
// services/ruleMetadata.ts — new entries

// Add to TriggerMeta type:
export interface TriggerMeta {
  type: TriggerType;
  category: 'card_move' | 'card_change' | 'section_change' | 'scheduled'; // NEW category
  label: string;
  needsSection: boolean;
  needsSchedule?: boolean; // NEW
}

// Add to TRIGGER_META array:
{
  type: 'scheduled_interval',
  category: 'scheduled',
  label: 'on a recurring interval',
  needsSection: false,
  needsSchedule: true,
},
{
  type: 'scheduled_cron',
  category: 'scheduled',
  label: 'at a specific time',
  needsSection: false,
  needsSchedule: true,
},
{
  type: 'scheduled_due_date_relative',
  category: 'scheduled',
  label: 'relative to due date',
  needsSection: false,
  needsSchedule: true,
},
```

## Appendix B: RuleExecutor Trigger Description Extension

```typescript
// services/ruleExecutor.ts — extend getTriggerDescription()

case 'scheduled_interval': {
  const trigger = rule.trigger as { schedule: { intervalMinutes: number } };
  const mins = trigger.schedule.intervalMinutes;
  if (mins >= 1440) return `Every ${Math.round(mins / 1440)} day(s)`;
  if (mins >= 60) return `Every ${Math.round(mins / 60)} hour(s)`;
  return `Every ${mins} minutes`;
}
case 'scheduled_cron': {
  const trigger = rule.trigger as { schedule: { hour: number; minute: number; daysOfWeek: number[] } };
  const { hour, minute, daysOfWeek } = trigger.schedule;
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  if (daysOfWeek.length === 0) return `Daily at ${timeStr}`;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = daysOfWeek.map(d => dayNames[d]).join(', ');
  return `${days} at ${timeStr}`;
}
case 'scheduled_due_date_relative': {
  const trigger = rule.trigger as { schedule: { offsetMinutes: number; displayUnit: string } };
  const offset = trigger.schedule.offsetMinutes;
  const unit = trigger.schedule.displayUnit;
  const absOffset = Math.abs(offset);
  let value: number;
  let unitLabel: string;
  if (unit === 'days') { value = Math.round(absOffset / 1440); unitLabel = value === 1 ? 'day' : 'days'; }
  else if (unit === 'hours') { value = Math.round(absOffset / 60); unitLabel = value === 1 ? 'hour' : 'hours'; }
  else { value = absOffset; unitLabel = value === 1 ? 'minute' : 'minutes'; }
  return offset < 0
    ? `${value} ${unitLabel} before due date`
    : `${value} ${unitLabel} after due date`;
}
```

## Appendix C: Preview Service Extension

```typescript
// services/rulePreviewService.ts — extend buildTriggerParts()

// For scheduled triggers, the preview sentence changes structure:
// Event: "When a card [filters] is [trigger], [action]"
// Scheduled: "Every [schedule], for cards [filters], [action]"

// In buildPreviewParts():
if (triggerMeta?.category === 'scheduled') {
  // Different sentence structure for scheduled triggers
  parts.push({ type: 'text', content: 'Every ' });
  parts.push({ type: 'value', content: formatScheduleDescription(trigger) });
  
  if (filters && filters.length > 0) {
    parts.push({ type: 'text', content: ', for cards ' });
    filters.forEach((filter, index) => {
      const description = formatFilterDescription(filter, sectionLookup);
      if (description) {
        parts.push({ type: 'value', content: description });
        parts.push({ type: 'text', content: index < filters.length - 1 ? ' and ' : '' });
      }
    });
  }
  
  parts.push({ type: 'text', content: ', ' });
  parts.push(...buildActionParts(action, sectionLookup));
  return parts;
}
```

## Appendix D: Complete Integration Wiring

```typescript
// lib/serviceContainer.ts — full wiring (additions only)

import { SchedulerService } from '@/features/automations/services/schedulerService';
import { SchedulerLeaderElection } from '@/features/automations/services/schedulerLeaderElection';
import { SystemClock } from '@/features/automations/services/clock';
import type { DomainEvent } from '@/lib/events/types';

const schedulerClock = new SystemClock();

function handleScheduledRuleFired(params: {
  rule: AutomationRule;
  evaluation: { shouldFire: boolean; newLastEvaluatedAt: string; matchingTaskIds?: string[] };
}): void {
  const { rule, evaluation } = params;

  if (evaluation.matchingTaskIds && evaluation.matchingTaskIds.length > 0) {
    // Due-date-relative: one event per matching task
    automationService.beginBatch();
    for (const taskId of evaluation.matchingTaskIds) {
      automationService.handleEvent({
        type: 'schedule.fired',
        entityId: taskId,
        projectId: rule.projectId,
        changes: { triggerType: rule.trigger.type },
        previousValues: {},
        triggeredByRule: rule.id,
        depth: 0,
      });
    }
    automationService.endBatch();
  } else {
    // Interval/cron: single event, rule engine iterates tasks
    automationService.beginBatch();
    automationService.handleEvent({
      type: 'schedule.fired',
      entityId: rule.id,
      projectId: rule.projectId,
      changes: { triggerType: rule.trigger.type },
      previousValues: {},
      triggeredByRule: rule.id,
      depth: 0,
    });
    automationService.endBatch();
  }
}

function handleTickComplete(params: {
  rulesEvaluated: number;
  rulesFired: number;
  totalTasksAffected: number;
  isCatchUp: boolean;
}): void {
  const { rulesFired, totalTasksAffected, isCatchUp } = params;
  if (rulesFired === 0) return;

  const prefix = isCatchUp ? '🔄 Catch-up:' : '⚡';
  const message = rulesFired === 1
    ? `${prefix} Scheduled rule ran, affecting ${totalTasksAffected} task${totalTasksAffected === 1 ? '' : 's'}`
    : `${prefix} ${rulesFired} scheduled rules ran, affecting ${totalTasksAffected} task${totalTasksAffected === 1 ? '' : 's'}`;

  // Single summary toast for the entire tick pass (§8)
  showToast(message, 'info', 8000);
}

export const schedulerService = new SchedulerService(
  schedulerClock,
  automationRuleRepository,
  taskRepository,
  handleScheduledRuleFired,
  handleTickComplete
);

// Leader election ensures only one tab runs the scheduler
export const schedulerLeaderElection = new SchedulerLeaderElection(
  () => schedulerService.start(),
  () => schedulerService.stop()
);

// Start leader election (called from app initialization)
// Note: This should be called from a useEffect in the root component,
// not at module scope, to avoid SSR issues with Next.js
// schedulerLeaderElection.start();
```

```typescript
// app/page.tsx or app/layout.tsx — initialization hook

'use client';
import { useEffect } from 'react';
import { schedulerLeaderElection } from '@/lib/serviceContainer';

export function useSchedulerInit() {
  useEffect(() => {
    schedulerLeaderElection.start();
    return () => schedulerLeaderElection.stop();
  }, []);
}
```
