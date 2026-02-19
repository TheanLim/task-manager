# Scheduled/Timer-Based Triggers — Power User & QA Analysis

> **Aligned with**: Architecture doc (§1–§14), PM Analysis (US-1 through US-12), UI/UX Analysis (§1–§13)
> **Trigger types under test**: `scheduled_interval`, `scheduled_cron`, `scheduled_due_date_relative` (Architecture §2.1)
> **Test stack**: Vitest + React Testing Library + fast-check; Playwright for e2e
> **Clock strategy**: All time-dependent scenarios use `FakeClock` (Architecture §3.1) — no `Date.now()` in test code

---

## Table of Contents

1. [Real-World Workflow Scenarios](#1-real-world-workflow-scenarios)
2. [Edge Cases & Failure Modes](#2-edge-cases--failure-modes)
3. [Interaction Matrix with Existing Features](#3-interaction-matrix-with-existing-features)
4. [Reliability Expectations](#4-reliability-expectations)
5. [Testing Scenarios for TDD](#5-testing-scenarios-for-tdd)
6. [Property-Based Test Plan](#6-property-based-test-plan)
7. [DST-Specific Test Scenarios](#7-dst-specific-test-scenarios)
8. [Regression Risk Assessment](#8-regression-risk-assessment)
9. [Test Infrastructure Requirements](#9-test-infrastructure-requirements)
10. [Final Design Decisions — Resolved](#10-final-design-decisions--resolved)

---

## 1. Real-World Workflow Scenarios

### Scenario 1: Weekly Sprint Grooming — "Move Due-This-Week Tasks to Active"

**Rule configuration:**
- Trigger: `scheduled_cron` — `{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] }` (Architecture §2.2)
- Filter: `in_section("Backlog")` AND `due_this_week`
- Action: `move_card_to_top_of_section("This Week")`
- Maps to: PM US-1 (overdue escalation variant), US-3 (weekly stale flagging)

**Expected behavior:** Every Monday morning, all tasks sitting in Backlog whose due date falls within the current Mon–Sun week get moved to the top of "This Week" in creation-order.

**Test setup:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T09:00:00')); // Monday 9 AM
```

**Edge cases:**
- Monday is a public holiday and the user doesn't open the app until Tuesday. Catch-up fires via `evaluateCronSchedule()` (Architecture §3.2) — `findMostRecentCronMatch()` walks back to Monday 9 AM, sees `lastEvaluatedAt` is before that, fires once with `now = Tuesday`. The `due_this_week` filter evaluates against Tuesday's date — the week boundary hasn't changed (Mon–Sun), so the same tasks match. Safe.
- A task was moved OUT of Backlog on Friday by an event-driven rule, then manually moved BACK on Sunday. The scheduled rule should still pick it up Monday — it's in Backlog and due this week. The `in_section` filter checks current state, not history.
- 50 tasks match. The move action fires 50 times, each emitting a `task.updated` event. The `beginBatch()`/`endBatch()` wrapping (Architecture §4.5) aggregates into one toast: "⚡ Automation: [rule name] ran on 50 tasks." But if there's an event-driven rule "when card moved into This Week → mark complete," that cascades 50 completions. The dedup set (`ruleId:entityId:actionType`) is scoped per `handleEvent` call chain — each of the 50 tasks gets its own dedup key, so all 50 cascade. The batch toast system handles this, but the execution log balloons.

**Interaction with event-driven rules:** High cascade risk. The 50 moves each trigger `card_moved_into_section` for "This Week." Any rule watching that section fires 50 times. The batch toast system handles this (one aggregated toast per rule), but the execution log trims to 20 entries per rule — less than half the batch is visible. See §3.4 for log aggregation recommendation.

### Scenario 2: Daily Stale Task Detection — "Flag Stuck In-Progress Tasks"

**Rule configuration:**
- Trigger: `scheduled_cron` — `{ kind: 'cron', hour: 18, minute: 0, daysOfWeek: [], daysOfMonth: [] }` (daily at 6 PM)
- Filter: `in_section("In Progress")` AND `created_more_than(5, days)` (new filter — PM US-8)
- Action: `move_card_to_bottom_of_section("Needs Attention")`
- Maps to: PM US-3 (stale flagging), US-8 (set due date on stale tasks)

**Test setup:**
```typescript
const clock = new FakeClock(new Date('2024-01-20T18:00:00')); // Saturday 6 PM
// Task created on Jan 14 — exactly 6 days ago, should match
// Task created on Jan 15 — exactly 5 days ago, boundary case (see edge cases)
```

**Edge cases:**
- The existing filter system has no concept of "time in section" — only due-date-based filters exist. This workflow requires `created_more_than(N, days)` (PM §3, dependency table). This is a **filter gap** that scheduled triggers expose. The `created_more_than` filter compares `task.createdAt` against `ctx.now - N days`. Edge case from PM US-8: task created exactly 5 days ago at the same minute as the schedule fires. If `created_more_than(5, days)` uses strict `>`, the task is excluded. If `>=`, it's included. **QA recommends strict `>` (consistent with `due_in_more_than` semantics).**
- If the user manually moves a task back to "In Progress" at 5:55 PM, the 6 PM schedule fires and immediately moves it to "Needs Attention" again. The user will be confused — they just moved it. There's no "cooldown" or "ignore recently touched" concept. Document this as expected behavior.
- "Needs Attention" section gets deleted between schedule evaluations. `detectBrokenRules` runs on `deleteSection` and sets `brokenReason: 'section_deleted'`, `enabled: false`. The rule engine's `buildRuleIndex` filters out rules with `brokenReason !== null`. The scheduled rule won't even be evaluated. Safe.

### Scenario 3: Monthly Recurring Task Creation — "Create Monthly Review Task"

**Rule configuration:**
- Trigger: `scheduled_cron` — `{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [1] }` (1st of month at 9 AM)
- Filter: (none — `create_card` doesn't need task filters)
- Action: `create_card("Monthly Review", section: "Recurring", dateOption: last_working_day_of_month)`
- Maps to: PM US-5 (monthly cleanup), US-12 (monthly report prep)

**Test setup:**
```typescript
const clock = new FakeClock(new Date('2024-02-01T09:00:00')); // Feb 1st
```

**Edge cases:**
- User didn't open the app for 2 months. Catch-up behavior: `evaluateCronSchedule()` finds the most recent match (this month's 1st), fires once. At-most-once-per-window semantics (Architecture §3.2) means only ONE "Monthly Review" task is created, not two. **QA DISAGREES with PM US-10 expectation**: PM says "missed scheduled rules to run when I next open the app" — but for `create_card`, creating 2 stale tasks is worse than creating 1 current one. Architecture's at-most-once is correct here.
- February 1st falls on a Saturday. The user opens the app Monday the 3rd. Catch-up fires with `now = Feb 3`. The `last_working_day_of_month` calculation uses the current date's month (February), so the due date is correct (Feb 28 or 29).
- The "Recurring" section is renamed to "Monthly Tasks." The rule references the section by ID, not name, so it still works. But if the section is deleted, `detectBrokenRules` marks it broken.
- **Dedup concern (PM US-4):** `create_card` with the same title creates a new task each time — no dedup by default. After a few months, the user has 10+ "Monthly Review" tasks. The PM doc suggests an optional "only if no matching task exists" toggle. **QA recommends deferring dedup to post-MVP** but adding a test that verifies `create_card` does NOT dedup (explicit behavior documentation via test).

### Scenario 4: Daily Standup Creation (PM US-4)

**Rule configuration:**
- Trigger: `scheduled_cron` — `{ kind: 'cron', hour: 8, minute: 30, daysOfWeek: [1,2,3,4,5], daysOfMonth: [] }` (weekdays at 8:30 AM)
- Filter: (none)
- Action: `create_card("Daily Standup Prep", section: "Today", dateOption: today)`

**Test setup:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T08:30:00')); // Monday 8:30 AM
```

**Edge cases:**
- User on vacation for 3 weeks. Opens app on a Monday. Catch-up creates ONE "Daily Standup Prep" task (at-most-once). The `today` dateOption resolves to Monday's date. The 14 missed weekday occurrences are silently dropped. This is correct for standup prep — stale standup tasks are useless.
- The task title is static. After a few weeks, the user has 10+ "Daily Standup Prep" tasks. No dedup. Test: create 3 tasks via 3 separate cron evaluations, verify 3 distinct task IDs exist.
- Weekend: Saturday and Sunday occurrences don't exist (`daysOfWeek: [1,2,3,4,5]`). `evaluateCronSchedule()` with `daysOfWeek` constraint skips non-matching days. Test: `clock.set(new Date('2024-01-13T08:30:00'))` (Saturday) → `shouldFire: false`.

### Scenario 5: Monthly Archive of Old Completed Tasks (PM US-5)

**Rule configuration:**
- Trigger: `scheduled_cron` — `{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [1] }`
- Filter: `is_complete` AND `completed_more_than(30, days)` (new filter — PM §3)
- Action: `move_card_to_bottom_of_section("Archive")`

**Test setup:**
```typescript
const clock = new FakeClock(new Date('2024-03-01T09:00:00'));
// Task completed on Jan 25 — 36 days ago, should match
// Task completed on Feb 5 — 25 days ago, should NOT match
```

**Edge cases:**
- `completed_more_than(30, days)` requires a `completedAt` field on the task. What if `completedAt` is null for old tasks that were completed before the field existed? **QA recommends**: if `task.completed === true && task.completedAt === null`, treat as "completed infinitely long ago" (matches any `completed_more_than` filter). Add an explicit test for this null-completedAt edge case.
- 200 tasks match. Batch moves 200 tasks. Execution log trims to 20. Toast says "ran on 200 tasks." See §3.4 for aggregated log recommendation.

### Scenario 6: Overdue Task Escalation (PM US-1)

**Rule configuration:**
- Trigger: `scheduled_cron` — `{ kind: 'cron', hour: 8, minute: 0, daysOfWeek: [], daysOfMonth: [] }` (daily at 8 AM)
- Filter: `is_overdue` AND `not_in_section("Urgent")` AND `not_in_section("Done")`
- Action: `move_card_to_top_of_section("Urgent")`

**Test setup:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T08:00:00'));
// Task with dueDate '2024-01-14' in "Backlog" — overdue, should match
// Task with dueDate '2024-01-15' in "Backlog" — due today, NOT overdue
// Task with dueDate '2024-01-14' in "Urgent" — overdue but already in Urgent, excluded by filter
```

**Edge cases:**
- A task becomes overdue at 8:01 AM (due date was today, now it's past midnight in the task's timezone context). The schedule already fired at 8:00 AM and missed it. The task won't be caught until tomorrow's 8:00 AM run. Acceptable for daily granularity — this is the fundamental polling-vs-reactive gap.
- Timezone: `is_overdue` filter checks `new Date(task.dueDate) < ctx.now` which compares UTC timestamps. A user in UTC-8 whose 11:59 PM is 7:59 AM next day UTC — a task due "today" in their timezone might already be "overdue" in UTC. This is a latent timezone bug that scheduled triggers make more visible. Test with explicit UTC and local time comparisons.

### Scenario 7: Due Date Approaching — Relative Trigger (PM US-2)

**Rule configuration:**
- Trigger: `scheduled_due_date_relative` — `{ kind: 'due_date_relative', offsetMinutes: -2880, displayUnit: 'days' }` (2 days before due date) (Architecture §2.2)
- Filter: `not_in_section("Urgent")`
- Action: `move_card_to_top_of_section("Urgent")`

**Test setup:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T10:00:00'));
// Task with dueDate '2024-01-17T10:00:00Z' — trigger time = Jan 15 10:00 — should fire
// Task with dueDate '2024-01-18T10:00:00Z' — trigger time = Jan 16 10:00 — should NOT fire yet
// lastEvaluatedAt = '2024-01-15T09:00:00Z' — window is (09:00, 10:00]
```

**Edge cases:**
- `evaluateDueDateRelativeSchedule()` (Architecture §3.2) checks if `triggerTime` falls within `(lastEvaluatedAt, now]`. A task whose due date is changed AFTER the trigger window has passed won't fire retroactively — the window is gone. The user must also set up an event-driven rule "when due date changed → check proximity" for real-time coverage.
- Completed tasks are skipped (`task.completed` check in Architecture §3.2). Subtasks are skipped (`task.parentTaskId !== null`). Test both exclusions.
- Multiple tasks with different due dates: 3 tasks with due dates on Jan 17, Jan 18, Jan 19. With offset -2 days and `lastEvaluatedAt` at Jan 14, evaluating at Jan 16 should fire for Jan 17 and Jan 18 tasks (trigger times Jan 15 and Jan 16 both fall in window). Test that `matchingTaskIds` contains exactly 2 IDs.

### Scenario 8: One-Time Scheduled Action (PM US-11)

**Rule configuration:**
- Trigger: `scheduled_cron` — `{ kind: 'cron', hour: 15, minute: 0, daysOfWeek: [], daysOfMonth: [15] }` with a one-time flag
- Filter: `in_section("Sprint 12")`
- Action: `move_card_to_bottom_of_section("Archive")`

**Edge cases:**
- PM US-11 describes a one-time trigger that fires once and auto-disables. The Architecture doc doesn't include a `oneTime` flag on the schema. **QA recommends**: add `oneTime: z.boolean().default(false)` to scheduled trigger variants. After firing, the scheduler sets `rule.enabled = false`. Test: fire once → verify `enabled` flipped to `false` → next tick does NOT fire.
- If the one-time trigger is missed (app was closed on March 15), catch-up fires it on next open. After catch-up, it auto-disables. Test: `lastEvaluatedAt` before March 15, `clock.set(March 20)` → fires once → disabled.
- Re-enabling a one-time rule: should it fire again immediately (since `nextScheduledAt` is in the past)? **QA recommends no** — re-enabling should require the user to also update the schedule. Otherwise it fires instantly on re-enable, which is surprising.

### Scenario 9: Bi-Weekly Sprint Carryover (PM US-6)

**Rule configuration:**
- Trigger: `scheduled_interval` — `{ kind: 'interval', intervalMinutes: 20160 }` (14 days = 20160 minutes) (Architecture §2.2)
- Filter: `in_section("In Progress")` AND `is_incomplete` (new filter — PM §3)
- Action: `move_card_to_bottom_of_section("Sprint Backlog")`

**Test setup:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T10:00:00'));
// lastEvaluatedAt = '2024-01-01T10:00:00' — 14 days ago, should fire
```

**Edge cases:**
- `evaluateIntervalSchedule()` (Architecture §3.2) checks `elapsed >= intervalMs`. With 14-day interval, the rule fires every 2 weeks regardless of day-of-week. If the user wants "every other Monday," they need `scheduled_cron` with manual tracking — `scheduled_interval` doesn't align to weekdays. Document this limitation.
- `is_incomplete` filter: the inverse of `is_complete`. Checks `!task.completed`. Trivial but needs to exist in the filter system (PM §3 dependency table).

### Scenario 10: Set Due Date on Stale Tasks (PM US-8)

**Rule configuration:**
- Trigger: `scheduled_cron` — `{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }` (daily)
- Filter: `in_section("To Do")` AND `no_due_date` AND `created_more_than(5, days)`
- Action: `set_due_date("next_working_day")`

**Test setup:**
```typescript
const clock = new FakeClock(new Date('2024-01-20T09:00:00')); // Saturday
// Task created on Jan 14 (6 days ago) with no due date — should match
// Task created on Jan 15 (5 days ago exactly) — boundary, strict > means NO match
// Task created on Jan 16 (4 days ago) — should NOT match
```

**Edge cases:**
- PM US-8 boundary: task created exactly 5 days ago at the same minute as the schedule fires. With `created_more_than(5, days)` using strict `>`, the task is excluded on day 5 and included on day 6. Test both sides of the boundary with `FakeClock`.
- `next_working_day` on a Friday sets due date to Monday. On a Saturday, also Monday. Test weekend handling.
- After the rule fires and sets a due date, the task no longer matches `no_due_date` on the next evaluation. Idempotent by filter design.

---

## 2. Edge Cases & Failure Modes

### 2.1 Catch-Up After Extended Absence

**Scenario:** User closes laptop Friday evening, opens it Monday morning. Three daily schedules were missed (Sat, Sun, Mon morning).

**Architecture answer (§3.2, §5.2):** At-most-once-per-window semantics. `evaluateCronSchedule()` finds the most recent matching cron window via `findMostRecentCronMatch()`, checks if it's after `lastEvaluatedAt`, fires once if so. `evaluateIntervalSchedule()` checks `elapsed >= intervalMs`, fires once if so. Both update `lastEvaluatedAt` to `now`.

**Test setup:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T10:00:00')); // Monday 10 AM
// Rule: daily at 9 AM, lastEvaluatedAt = '2024-01-12T09:00:00' (Friday)
// Expected: fires once, newLastEvaluatedAt = Monday 10 AM
```

**Concrete tests:**
- Interval rule with `intervalMinutes: 60`, `lastEvaluatedAt` 72 hours ago → fires once (not 72 times).
- Cron rule `daysOfWeek: [1,2,3,4,5]` (weekdays), `lastEvaluatedAt` Friday 9 AM, `now` Monday 10 AM → fires once. Saturday and Sunday occurrences don't exist for this cron config.
- Cron rule `daysOfWeek: []` (every day), `lastEvaluatedAt` Friday 9 AM, `now` Monday 10 AM → fires once (most recent match is Monday 9 AM, which is after Friday's `lastEvaluatedAt`).
- First-ever evaluation (`lastEvaluatedAt: null`): `evaluateIntervalSchedule` fires immediately. `evaluateCronSchedule` fires only if currently in a matching window (`isSameMinute` check in Architecture §3.2). Test: `lastEvaluatedAt: null`, `now` is 14:00, cron is 9 AM → `shouldFire: false` (not in the 9:00 minute window, and first eval doesn't catch up).

**Storage requirement:** `lastEvaluatedAt` persists on the trigger entity (Architecture §5.1). Verify it survives `JSON.parse(localStorage.getItem(...))` round-trip.

### 2.2 Simultaneous Rule Conflicts

**Scenario:** Two scheduled rules fire at the same time (both cron at 9:00 AM daily):
- Rule A (order: 1): "Move overdue tasks to Urgent"
- Rule B (order: 2): "Move tasks in Urgent that are complete to Done"

**Architecture answer (§4.3):** `evaluateScheduledRules()` iterates rules in array order. The integration layer (§4.2) calls `automationService.handleEvent()` for each fired rule sequentially. Rule A's `handleEvent` completes (synchronous) before Rule B's starts. Rule B sees the updated state from Rule A.

**Test setup:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T09:00:00'));
// Rule A: order 1, cron 9 AM, filter is_overdue, action move_to_top("Urgent")
// Rule B: order 2, cron 9 AM, filter in_section("Urgent") AND is_complete, action move_to_bottom("Done")
// Task T: overdue, completed, in "Backlog"
// Expected: A moves T to Urgent, then B moves T to Done. Final: T in Done.
```

**Concrete tests:**
- Two rules with different `order` values fire in the same tick. Verify execution order matches `order` ASC.
- Two rules with same `order` value: fallback to `createdAt` ASC. Test with explicit `createdAt` timestamps.
- Rule A's action makes a task match Rule B's filter that it didn't match before. Verify Rule B sees the updated state.

### 2.3 Scheduled-to-Event Cascade Loop

**Scenario:**
- Scheduled rule: "Every day at 9 AM, move tasks in Backlog with `due_this_week` to This Week"
- Event-driven rule: "When card moved into This Week, move to Backlog" (no filter)

**Architecture answer (§4.6):** The dedup set (`ruleId:entityId:actionType`) and depth limit (5) protect against infinite loops. Scheduled evaluation is depth 0 (Architecture §4.1). Cascaded event-driven rules start at depth 1.

**Test setup:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T09:00:00'));
// Scheduled rule moves T: Backlog → This Week (depth 0)
// Event rule fires: This Week → Backlog (depth 1)
// Event rule fires: Backlog → This Week (depth 2) — but dedup blocks if same ruleId:T:move
```

**Key verification:** The dedup key includes `ruleId`. If the two event-driven rules have different IDs, the ping-pong continues until depth 5. If the same rule triggers both directions (impossible — different trigger sections), dedup blocks at depth 1. Test both scenarios.

### 2.4 Target Section Deleted

**Scenario:** Schedule fires, but the target section in the action was deleted yesterday.

**Current protection:** `detectBrokenRules` runs on `deleteSection` and sets `brokenReason`, `enabled: false`. The rule is filtered out by `buildRuleIndex`. Safe.

**TOCTOU concern:** In the current synchronous architecture, section deletion and rule evaluation can't interleave. But if scheduled evaluation becomes async (e.g., `setTimeout` callback), there's a theoretical race. The action handler already checks `sectionRepo.findById(targetSectionId)` and returns empty events if null. The action silently fails. **QA recommends**: add a "failed execution" log entry when an action's target section is not found, so the user knows the rule tried and failed.

### 2.5 Schedule Fires During Import/Export

**Scenario:** User clicks "Import" to load a shared project state. A scheduled rule fires mid-import.

**Architecture answer:** JS is single-threaded. The `setTimeout`-based scheduler callback queues behind the synchronous import. By the time it fires, the import is complete. The scheduled rule evaluates against the new state. Safe.

**Test:** Import a project that removes sections referenced by scheduled rules → verify `detectBrokenRules` marks them broken → verify the next scheduler tick skips broken rules.

### 2.6 Timezone and DST Handling

**Scenario:** User creates a rule "Every day at 9:00 AM." They're in US Eastern (UTC-5). They travel to Japan (UTC+9).

**Architecture answer (§6.4):** Schedule times are in local time. The rule "follows" the user — fires at 9 AM in whatever timezone the browser reports. This is correct for "morning grooming" workflows.

**Concrete DST tests:** See [§7 DST-Specific Test Scenarios](#7-dst-specific-test-scenarios).

### 2.7 50 Rules at the Same Time

**Scenario:** Power user creates 50 scheduled rules all set to 9:00 AM.

**Architecture answer (§10.2, Q2):** Recommends a limit of 10 scheduled rules per project. **QA agrees** — 10 is sufficient for real workflows and prevents performance degradation.

**Performance test setup:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T09:00:00'));
// Create 10 cron rules all at 9 AM, each matching ~100 tasks
// Measure: evaluateScheduledRules() completes in < 50ms
// Verify: all 10 rules fire, each produces correct actions
```

**Toast flood:** 10 rules × N tasks each. With `beginBatch()`/`endBatch()` (Architecture §4.5), each rule gets one aggregated toast. 10 toasts is manageable with Sonner stack display. **QA recommends**: for scheduled evaluations with >3 rules firing in one tick, collapse to a single summary toast: "⚡ 10 scheduled rules executed, affecting 200 tasks."

### 2.8 Section Renamed Between Evaluations

**Non-issue for the engine.** Rules reference sections by ID, not name. The preview text updates dynamically via `buildTriggerParts`. Historical execution log entries use the section name at execution time — cosmetic inconsistency, not a bug. No test needed beyond existing section-rename tests.

### 2.9 Rule Enabled/Disabled During Scheduled Window

**Scenario:** User disables a scheduled rule at 8:59 AM. The schedule was set for 9:00 AM.

**Architecture answer:** `evaluateScheduledRules()` (§3.2) checks `rule.enabled` at evaluation time. If disabled before the tick, it's skipped. In a synchronous system, no race condition.

**Test:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T09:00:00'));
// Rule: cron 9 AM, enabled: false
// evaluateScheduledRules() → empty results
// Toggle enabled: true → next tick fires
```

### 2.10 App Open in Multiple Tabs

**Scenario:** User has the app open in 3 browser tabs. A scheduled rule fires.

**Architecture answer (§5.3):** `SchedulerLeaderElection` via `BroadcastChannel`. Only the leader tab runs the scheduler. Others defer.

**Test scenarios for leader election:**
- **Leader election:** 3 tabs start. Each broadcasts `claim` with random `tabId`. Lowest ID wins. Verify only one tab's `onBecomeLeader` callback fires.
- **Leader crash/resign:** Leader tab closes → broadcasts `resign` → remaining tabs re-elect. Verify new leader starts scheduler within 2 seconds.
- **Leader timeout:** Leader tab crashes without sending `resign` (no `beforeunload`). Other tabs detect missing heartbeat after 60 seconds → re-elect. Test with `FakeClock` advancing 60s.
- **New tab joins:** Leader is running. New tab opens, broadcasts `claim`. Leader responds with `heartbeat`. New tab yields. Verify new tab does NOT start scheduler.
- **BroadcastChannel not supported:** Fallback — tab assumes leadership immediately. Test: mock `typeof BroadcastChannel === 'undefined'` → `isLeader = true` → `onBecomeLeader()` called.

**Cross-tab state consistency:** The leader tab writes `lastEvaluatedAt` to localStorage. Non-leader tabs read from the same localStorage on their next `findAll()`. The `storage` event (fired when another tab modifies localStorage) is NOT currently wired to trigger re-reads. **QA recommends**: add a `storage` event listener in `LocalStorageAutomationRuleRepository` for cross-tab reactivity. Test: leader updates rule → non-leader tab's `findAll()` returns updated data.

### 2.11 `evaluateScheduledRules` — Pure Function Verification

**Architecture §3.2** defines `evaluateScheduledRules()` as a pure function with no side effects. This is the most testable layer.

**Concrete tests:**
- Given 5 rules (2 interval, 2 cron, 1 due-date-relative), only the ones whose schedule matches `now` appear in results.
- Disabled rules are excluded.
- Broken rules (`brokenReason !== null`) are excluded.
- Event-trigger rules are excluded (only `isScheduledTrigger()` passes).
- The function does NOT mutate any input — verify with `Object.freeze()` on inputs.

---

## 3. Interaction Matrix with Existing Features

### 3.1 Scheduled Triggers × Event-Driven Triggers

| Aspect | Behavior | Risk Level |
|--------|----------|------------|
| Cascade direction | Scheduled → executes action → emits `schedule.fired` event (Architecture §4.1) → rule engine matches → action produces `task.updated` → event-driven rules evaluate | High |
| Depth accounting | Scheduled execution = depth 0 (Architecture §4.1); cascaded event-driven = depth 1+ | Must be explicit |
| Dedup set scope | One dedup set per `handleEvent` call chain. Shared across all cascaded event-driven rules triggered by that chain. | Architecture §4.4 confirms |
| Ordering | Scheduled rules evaluate in array order within `evaluateScheduledRules()`; event-driven rules fire from the resulting domain events in `order` ASC | Predictable if documented |
| Mutual exclusion | No mechanism to say "don't fire event-driven rules on tasks touched by scheduled rules" | Medium — users will want this |

**Cascade amplification risk:** A scheduled rule that moves 50 tasks generates 50 `task.updated` events (one per `handleEvent` call in the batch loop — Architecture §4.2). Each event triggers event-driven rule evaluation. If 3 event-driven rules match, that's 150 action executions from one scheduled tick. With depth 5, worst case is 50 × 3^5 = 12,150 actions. The dedup set prevents most of these, but the theoretical fan-out is concerning.

**Test:** Create a scheduled cron rule that moves 10 tasks, plus 2 event-driven rules that cascade. Verify total action count stays within dedup bounds. Verify depth never exceeds 5.

**Recommendation:** Scheduled evaluation should share a single dedup set across all rules in one evaluation pass AND across all cascaded event-driven rules triggered by that pass. Architecture §4.4 confirms this is already the case — each `handleEvent` call chain has its own dedup set, and the batch wrapping ensures cascades within one scheduled rule share a set.

### 3.2 Scheduled Triggers × Filter System

**Fundamental difference from event triggers:** For event-driven rules, the filter evaluates the single task that triggered the event (`event.entityId`). For scheduled interval/cron triggers, there's no single triggering task — the rule engine iterates ALL tasks matching filters (Architecture §4.3). For `scheduled_due_date_relative`, the evaluator pre-selects tasks by due date window, then the rule engine applies filters to each (Architecture §4.3).

**Test:** Scheduled cron rule with filter `in_section("Backlog") AND has_due_date`. 100 tasks total, 30 in Backlog, 20 of those have due dates. Verify exactly 20 actions produced.

**New filter types exposed by scheduled triggers (PM §3 dependency table):**

| Filter | Needed For | Complexity | Test Focus |
|--------|-----------|------------|------------|
| `is_complete` / `is_incomplete` | US-5, US-6, US-9 | Trivial — check `task.completed` | Boundary: task with `completed: true, completedAt: null` |
| `created_more_than(N, days)` | US-8 | Medium — needs `task.createdAt` | Boundary: exactly N days (strict `>`) |
| `completed_more_than(N, days)` | US-5 | Medium — needs `task.completedAt` | Null `completedAt` on old completed tasks |
| `last_updated_more_than(N, days)` | US-3 | Medium — needs `task.updatedAt` | Tasks never updated (updatedAt = createdAt) |

### 3.3 Scheduled Triggers × Undo

**Should scheduled executions support undo?**

**QA recommendation:** Yes, with visibility check. Support undo for scheduled executions that fire while the user is actively using the app (`document.visibilityState === 'visible'`). Skip undo for catch-up executions (app just opened, user hasn't seen the state yet). Extend the undo window to 30 seconds for scheduled rules since the user needs time to notice and react.

**Architecture alignment:** Architecture §10.2 Q6 recommends full undo support. The existing undo mechanism works at the action level — since scheduled triggers produce the same `RuleAction` objects, undo works for free. The only change is the extended expiry window and the visibility check.

**Test:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T09:00:00'));
// Mock document.visibilityState = 'visible'
// Scheduled rule fires, moves 5 tasks
// Verify: undo snapshot captured with 5 task previous states
// Advance clock by 25 seconds → undo still available
// Advance clock by 35 seconds → undo expired
```

### 3.4 Scheduled Triggers × Execution Log

**Log volume concern:** A daily rule that matches 50 tasks generates 50 log entries per day. The 20-entry cap means the log only shows the last 20 executions — less than half a day's worth.

**QA recommendation:** For scheduled executions, push ONE log entry per evaluation pass with a `matchCount` field:

```typescript
{
  timestamp: '2024-01-15T09:00:00Z',
  triggerDescription: 'Scheduled: Mon at 09:00',  // from Architecture Appendix B
  actionDescription: 'Moved to top of "This Week"',
  taskName: '50 tasks affected',  // aggregated
  matchCount: 50,  // NEW field
  details: ['Task A', 'Task B', ...],  // optional sub-array
}
```

This keeps the log useful without flooding it. The 20-entry cap now covers 20 scheduled runs (potentially weeks of history) instead of 20 individual task moves.

**Test:** Scheduled rule matches 50 tasks → verify exactly 1 `recentExecutions` entry with `matchCount: 50`.

### 3.5 Scheduled Triggers × Broken Rule Detection

Existing `detectBrokenRules` runs on section deletion and checks all section references via `collectSectionReferences`. This already covers scheduled rules — the trigger type doesn't matter; the section references in the action and filters are what get checked.

**New broken scenarios specific to scheduled triggers:**
- Schedule references a time that doesn't exist (2:30 AM during DST spring-forward). Not "broken" — just skip that occurrence. `findMostRecentCronMatch()` won't find a match for that day.
- Schedule interval is nonsensical (0 minutes, negative). Validated at creation time via `IntervalScheduleSchema.min(5)` (Architecture §2.2). Test: attempt to create rule with `intervalMinutes: 0` → Zod validation error.

**No changes needed to `detectBrokenRules`.** The existing mechanism handles scheduled rules correctly.

### 3.6 Scheduled Triggers × Import/Export

**Export:** The `AutomationRule` schema gains new schedule-related fields (`schedule`, `lastEvaluatedAt`) on scheduled trigger variants. These serialize naturally with the existing `ruleImportExport.ts` flow.

**Import — version mismatch scenario:** A project with scheduled rules is exported from a newer app version and imported into an older version that doesn't support scheduled triggers. The current `TriggerSchema` uses `z.object()` which strips unknown fields. The discriminated union (Architecture §2.3) changes this — the trigger `type` value `scheduled_cron` won't match any variant in the old schema, causing a Zod parse error.

**QA recommendation:**
- Add a `schemaVersion` field to the export format. On import, warn if the export version is newer.
- For scheduled rules that fail Zod parse, catch the error and mark the rule as broken with `brokenReason: 'unsupported_trigger_type'` instead of dropping it silently.
- Test: import a rule with `trigger.type: 'scheduled_cron'` into a schema that only knows event triggers → verify rule is preserved but marked broken.

**Import — lastEvaluatedAt reset:** When importing scheduled rules, `lastEvaluatedAt` should be reset to `null` so the rule evaluates fresh in the new environment. Test: import a rule with `lastEvaluatedAt: '2024-01-15T09:00:00Z'` → verify it's reset to `null` after import.

### 3.7 Scheduled Triggers × Rule Ordering (Drag-and-Drop)

**Scenario:** User reorders scheduled rules via drag-and-drop in the AutomationTab. The next tick should respect the new order.

**Test:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T09:00:00'));
// Rule A: order 1, cron 9 AM → moves task to "Urgent"
// Rule B: order 2, cron 9 AM → moves task to "Done"
// User drags B above A → B.order = 1, A.order = 2
// Next tick: B fires first (moves to Done), then A fires (moves to Urgent)
// Final state: task in Urgent (A was last)
```

**Verify:** `evaluateScheduledRules()` returns results in the order rules appear in the input array. The caller (SchedulerService) gets rules from `ruleRepo.findAll()` which returns them sorted by `order`. After drag-and-drop updates `order` values, the next `findAll()` returns the new order.

### 3.8 Scheduled Triggers × Cross-Project Rules (Future)

Cross-project rules are deferred. The scheduled trigger architecture should not hard-code project scoping. `evaluateScheduledRules()` accepts a `rules` array — the caller can pass rules from any project. No test needed now, but verify the function doesn't internally filter by `projectId`.

---

## 4. Reliability Expectations

### 4.1 App Was Closed and Reopened

**User expectation:** "I set a daily rule. I closed the app for 3 days. When I open it, the rule should have 'caught up.'"

**Architecture answer (§5.2):** On app load, `SchedulerService.start()` calls `tick()` immediately. Rules whose `lastEvaluatedAt` is stale fire once (at-most-once). `lastEvaluatedAt` updates to `now`.

**Minimum viable behavior:**
1. On app startup, `SchedulerService.start()` → `tick()` → `evaluateScheduledRules(clock.now(), rules, tasks)`
2. Rules with stale `lastEvaluatedAt` fire once with current context
3. A summary toast: "⚡ Caught up on 3 missed scheduled runs — 45 tasks affected"
4. Catch-up executions happen synchronously during the first tick

**What the user should NOT expect:**
- Real-time execution while the app is closed. Impossible without a service worker or backend (Architecture §6.3).
- Perfect fidelity of missed runs. Filter evaluation uses current state, not historical state. A task that was in "Backlog" on Monday but moved to "Done" on Tuesday won't be caught by Monday's catch-up if it runs on Wednesday.

**Test:**
```typescript
const clock = new FakeClock(new Date('2024-01-15T10:00:00')); // Monday 10 AM
// Rule: daily cron at 9 AM, lastEvaluatedAt = '2024-01-12T09:00:00' (Friday)
// Simulate app startup: schedulerService.start() → tick()
// Verify: rule fires once, lastEvaluatedAt = Monday 10 AM
// Verify: rule does NOT fire again on next tick at 10:01
```

### 4.2 Browser Crashed Mid-Execution

**Architecture answer (§5.1):** `lastEvaluatedAt` is updated BEFORE firing the callback (Architecture §3.3 — `updateLastEvaluatedAt` called before `onRuleFired`). If the browser crashes mid-execution, the schedule is marked as "ran" but actions may be partially executed.

**QA DISAGREES (RESOLVED — Architecture position adopted):** Updating `lastEvaluatedAt` before execution means a crash loses the remaining actions with no recovery. QA originally recommended updating AFTER execution. However, the Architecture's `create_card` dedup heuristic (§9.2) mitigates the duplicate-creation risk, making update-before the safer overall choice. The final decision is: update `lastEvaluatedAt` BEFORE execution, with `create_card` dedup heuristic as safety net.

**Test:** Simulate crash by throwing mid-execution. Verify `lastEvaluatedAt` state based on chosen strategy. Verify idempotent re-execution for move actions.

### 4.3 App Open in Two Tabs

See §2.10 for leader election details.

**Minimum viable behavior:** `SchedulerLeaderElection` (Architecture §5.3) ensures only one tab runs the scheduler. Other tabs see state updates via localStorage reads.

**Known gap:** `LocalStorageAutomationRuleRepository.subscribe()` is not cross-tab. Changes in one tab don't notify the other tab's subscribers. The `storage` event could bridge this but isn't currently wired. For scheduled triggers, the non-leader tab might show stale `lastEvaluatedAt` until the user navigates or triggers a re-read.

### 4.4 User Is Offline

**Non-issue.** The app is fully client-side. No network dependency. Scheduled rules evaluate against localStorage data. Offline mode is the default mode. Test: verify scheduler runs with no network (mock `navigator.onLine = false`).

---

## 5. Testing Scenarios for TDD

All scenarios use `FakeClock` (Architecture §3.1) for deterministic time control. No `Date.now()` or `new Date()` in test code.

### Category A: Schedule Evaluation — `evaluateIntervalSchedule()` (Architecture §3.2)

**A1. Interval fires when elapsed time exceeds interval**
```typescript
clock.set(new Date('2024-01-15T10:30:00Z'));
const result = evaluateIntervalSchedule(clock.now(), '2024-01-15T10:00:00Z', 15); // 15 min
expect(result.shouldFire).toBe(true);
expect(result.newLastEvaluatedAt).toBe('2024-01-15T10:30:00.000Z');
```

**A2. Interval does not fire before interval elapses**
```typescript
clock.set(new Date('2024-01-15T10:10:00Z'));
const result = evaluateIntervalSchedule(clock.now(), '2024-01-15T10:00:00Z', 15);
expect(result.shouldFire).toBe(false);
expect(result.newLastEvaluatedAt).toBe('2024-01-15T10:00:00Z'); // unchanged
```

**A3. Interval fires immediately on first evaluation (null lastEvaluatedAt)**
```typescript
clock.set(new Date('2024-01-15T14:00:00Z'));
const result = evaluateIntervalSchedule(clock.now(), null, 60);
expect(result.shouldFire).toBe(true);
```

**A4. Interval fires only once after long absence (at-most-once)**
```typescript
clock.set(new Date('2024-01-18T10:00:00Z')); // 3 days later
const result = evaluateIntervalSchedule(clock.now(), '2024-01-15T10:00:00Z', 60);
expect(result.shouldFire).toBe(true);
// Re-evaluate with updated lastEvaluatedAt
const result2 = evaluateIntervalSchedule(clock.now(), result.newLastEvaluatedAt, 60);
expect(result2.shouldFire).toBe(false);
```

### Category B: Schedule Evaluation — `evaluateCronSchedule()` (Architecture §3.2)

**B1. Cron fires at matching time**
```typescript
clock.set(new Date('2024-01-15T09:00:30Z')); // Monday 9:00 (within the minute)
const result = evaluateCronSchedule(clock.now(), '2024-01-14T09:00:00Z', {
  hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] // Monday
});
expect(result.shouldFire).toBe(true);
```

**B2. Cron does not fire on wrong day of week**
```typescript
clock.set(new Date('2024-01-16T09:00:00Z')); // Tuesday
const result = evaluateCronSchedule(clock.now(), '2024-01-15T09:00:00Z', {
  hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] // Monday only
});
expect(result.shouldFire).toBe(false);
```

**B3. Cron fires on catch-up (most recent match after lastEvaluatedAt)**
```typescript
clock.set(new Date('2024-01-15T14:00:00Z')); // Monday 2 PM
const result = evaluateCronSchedule(clock.now(), '2024-01-12T09:00:00Z', { // Friday
  hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] // daily
});
// Most recent match: Monday 9 AM > Friday 9 AM (lastEvaluatedAt) → fires
expect(result.shouldFire).toBe(true);
```

**B4. Cron with daysOfMonth fires on correct day**
```typescript
clock.set(new Date('2024-02-01T09:00:00Z'));
const result = evaluateCronSchedule(clock.now(), '2024-01-01T09:00:00Z', {
  hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [1] // 1st of month
});
expect(result.shouldFire).toBe(true);
```

**B5. Cron with daysOfMonth skips wrong day**
```typescript
clock.set(new Date('2024-02-02T09:00:00Z')); // 2nd
const result = evaluateCronSchedule(clock.now(), '2024-02-01T09:00:00Z', {
  hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [1]
});
expect(result.shouldFire).toBe(false);
```

**B6. Cron rejects both daysOfWeek and daysOfMonth (schema validation)**
```typescript
const result = CronScheduleSchema.safeParse({
  hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [15]
});
expect(result.success).toBe(false);
```

**B7. First evaluation with null lastEvaluatedAt — only fires if in current window**
```typescript
clock.set(new Date('2024-01-15T09:00:30Z')); // in the 9:00 minute
const result = evaluateCronSchedule(clock.now(), null, {
  hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: []
});
expect(result.shouldFire).toBe(true);

clock.set(new Date('2024-01-15T14:00:00Z')); // NOT in the 9:00 minute
const result2 = evaluateCronSchedule(clock.now(), null, {
  hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: []
});
expect(result2.shouldFire).toBe(false);
```

### Category C: Schedule Evaluation — `evaluateDueDateRelativeSchedule()` (Architecture §3.2)

**C1. Due-date-relative fires for task in window**
```typescript
clock.set(new Date('2024-01-15T10:00:00Z'));
const tasks = [{ id: 't1', dueDate: '2024-01-17T10:00:00Z', completed: false, parentTaskId: null }];
const result = evaluateDueDateRelativeSchedule(
  clock.now(), '2024-01-15T09:00:00Z', -2880, tasks // -2 days = -2880 min
);
// triggerTime = Jan 17 - 2 days = Jan 15 10:00 → in window (09:00, 10:00]
expect(result.shouldFire).toBe(true);
expect(result.matchingTaskIds).toEqual(['t1']);
```

**C2. Due-date-relative skips completed tasks**
```typescript
const tasks = [{ id: 't1', dueDate: '2024-01-17T10:00:00Z', completed: true, parentTaskId: null }];
const result = evaluateDueDateRelativeSchedule(clock.now(), '2024-01-15T09:00:00Z', -2880, tasks);
expect(result.shouldFire).toBe(false);
expect(result.matchingTaskIds).toEqual([]);
```

**C3. Due-date-relative skips subtasks**
```typescript
const tasks = [{ id: 't1', dueDate: '2024-01-17T10:00:00Z', completed: false, parentTaskId: 'parent1' }];
const result = evaluateDueDateRelativeSchedule(clock.now(), '2024-01-15T09:00:00Z', -2880, tasks);
expect(result.shouldFire).toBe(false);
```

**C4. Due-date-relative with positive offset (after due date)**
```typescript
clock.set(new Date('2024-01-17T10:00:00Z'));
const tasks = [{ id: 't1', dueDate: '2024-01-16T10:00:00Z', completed: false, parentTaskId: null }];
const result = evaluateDueDateRelativeSchedule(
  clock.now(), '2024-01-17T09:00:00Z', 1440, tasks // +1 day = 1440 min
);
// triggerTime = Jan 16 + 1 day = Jan 17 10:00 → in window (09:00, 10:00]
expect(result.shouldFire).toBe(true);
```

**C5. Multiple tasks with different due dates — correct subset matches**
```typescript
clock.set(new Date('2024-01-16T10:00:00Z'));
const tasks = [
  { id: 't1', dueDate: '2024-01-17T10:00:00Z', completed: false, parentTaskId: null }, // trigger: Jan 15
  { id: 't2', dueDate: '2024-01-18T10:00:00Z', completed: false, parentTaskId: null }, // trigger: Jan 16 ✓
  { id: 't3', dueDate: '2024-01-19T10:00:00Z', completed: false, parentTaskId: null }, // trigger: Jan 17
];
const result = evaluateDueDateRelativeSchedule(
  clock.now(), '2024-01-16T09:00:00Z', -2880, tasks
);
expect(result.matchingTaskIds).toEqual(['t2']); // only t2's trigger time is in window
```

### Category D: `evaluateScheduledRules()` — Orchestrator (Architecture §3.2)

**D1. Only scheduled rules are evaluated**
```typescript
const rules = [
  makeEventRule({ type: 'card_moved_into_section', sectionId: 's1' }),
  makeCronRule({ hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }),
];
clock.set(new Date('2024-01-15T09:00:00Z'));
const results = evaluateScheduledRules(clock.now(), rules, []);
expect(results).toHaveLength(1); // only the cron rule
```

**D2. Disabled and broken rules are excluded**
```typescript
const rules = [
  makeCronRule({ ...config, enabled: false }),
  makeCronRule({ ...config, brokenReason: 'section_deleted' }),
  makeCronRule({ ...config, enabled: true, brokenReason: null }),
];
const results = evaluateScheduledRules(clock.now(), rules, []);
expect(results).toHaveLength(1); // only the enabled, non-broken rule
```

**D3. Mixed trigger types — each evaluated by correct function**
```typescript
const rules = [
  makeIntervalRule({ intervalMinutes: 30, lastEvaluatedAt: '...' }),
  makeCronRule({ hour: 9, minute: 0, ... }),
  makeDueDateRelativeRule({ offsetMinutes: -2880, ... }),
];
// Set clock so all three should fire
// Verify: results contain all 3 rules with correct evaluation types
```

### Category E: SchedulerService — Tick Loop (Architecture §3.3)

**E1. tick() calls onRuleFired for due rules**
```typescript
const clock = new FakeClock(new Date('2024-01-15T09:00:00Z'));
const onRuleFired = vi.fn();
const service = new SchedulerService(clock, ruleRepo, taskRepo, onRuleFired);
service.tick();
expect(onRuleFired).toHaveBeenCalledWith(expect.objectContaining({
  rule: expect.any(Object),
  evaluation: expect.objectContaining({ shouldFire: true }),
}));
```

**E2. tick() updates lastEvaluatedAt before firing callback**
```typescript
// Architecture §3.3: updateLastEvaluatedAt called before onRuleFired
// Verify: after tick(), rule in repo has updated lastEvaluatedAt
// even if onRuleFired throws
```

**E3. start() runs immediate catch-up tick**
```typescript
const onRuleFired = vi.fn();
const service = new SchedulerService(clock, ruleRepo, taskRepo, onRuleFired);
service.start();
expect(onRuleFired).toHaveBeenCalled(); // immediate tick on start
service.stop();
```

**E4. start() is idempotent**
```typescript
service.start();
service.start(); // no-op
expect(service.isRunning()).toBe(true);
service.stop();
```

**E5. stop() cleans up interval and visibility listener**
```typescript
service.start();
service.stop();
expect(service.isRunning()).toBe(false);
// Verify: no more ticks fire after stop
```

### Category F: Cascade Behavior

**F1. Scheduled action triggers event-driven rule**
```typescript
clock.set(new Date('2024-01-15T09:00:00Z'));
// Scheduled cron rule: move task T from Backlog to Active
// Event-driven rule: when card moved into Active → set due date to tomorrow
// After scheduled evaluation: T is in Active with dueDate = Jan 16
```

**F2. Cascade depth limit applies**
```typescript
// Scheduled rule (depth 0) → event rule (depth 1) → event rule (depth 2) → ... → depth 5 stops
// Verify: actions at depth 5+ are silently dropped
```

**F3. Scheduled rule does not trigger other scheduled rules**
```typescript
// Scheduled rule A fires → produces task.updated event
// Scheduled rule B has trigger type scheduled_cron, NOT task.updated
// Verify: B does NOT fire from A's cascade — only from the scheduler tick
```

**F4. Dedup prevents cascade loops**
```typescript
// Scheduled rule moves T to Section A (depth 0)
// Event rule moves T from A to B (depth 1)
// Event rule moves T from B to A (depth 2) — dedup key ruleId:T:move blocks if same rule
// Verify: chain terminates, task ends in deterministic position
```

### Category G: State Consistency

**G1. Scheduled execution updates rule metadata**
```typescript
// After scheduled rule fires affecting 5 tasks:
// executionCount += 5 (or += 1 if aggregated — design decision)
// lastExecutedAt = now
// recentExecutions has new entry
```

**G2. Zero matching tasks — no metadata update**
```typescript
// Scheduled rule fires but filters match 0 tasks
// executionCount unchanged, no log entry
```

**G3. lastEvaluatedAt persists across app restarts**
```typescript
// Rule fires at 09:00, lastEvaluatedAt = '2024-01-15T09:00:00Z'
// Simulate restart: new SchedulerService with same ruleRepo
// Verify: ruleRepo.findById(ruleId).trigger.lastEvaluatedAt === '2024-01-15T09:00:00Z'
```

**G4. create_card produces exactly one task per evaluation**
```typescript
clock.set(new Date('2024-01-15T09:00:00Z'));
// Scheduled cron rule with create_card action
// After one tick: exactly 1 new task in target section
// After second tick (9:01, within same cron window): 0 new tasks (already evaluated)
```

**G5. Import during scheduled evaluation window — no corruption**
```typescript
// Import replaces all tasks. Scheduled rule fires after import.
// Verify: rule evaluates against imported state, not pre-import state.
// Rules referencing deleted sections are marked broken by import flow.
```

---

## 6. Property-Based Test Plan

Maps Architecture §7.1 formal properties (P1–P7) to concrete fast-check implementations. All tests target the pure evaluation functions in `scheduleEvaluator.ts` — no mocks needed.

### P1: Interval At-Most-Once-Per-Window

**Property in plain English:** If an interval rule fires, immediately re-evaluating with the updated `lastEvaluatedAt` must NOT fire again.

**Generators:**
```typescript
fc.integer({ min: 5, max: 10080 }),                    // intervalMinutes
fc.integer({ min: 0, max: 2_000_000_000_000 }),         // nowMs (epoch)
fc.option(fc.date({ min: new Date(0), max: new Date(2_000_000_000_000) })
  .map(d => d.toISOString())),                           // lastEvaluatedAt | null
```

**Assertion:**
```typescript
(intervalMinutes, nowMs, lastEvaluatedAt) => {
  const r1 = evaluateIntervalSchedule(nowMs, lastEvaluatedAt ?? null, intervalMinutes);
  if (r1.shouldFire) {
    const r2 = evaluateIntervalSchedule(nowMs, r1.newLastEvaluatedAt, intervalMinutes);
    expect(r2.shouldFire).toBe(false);
  }
}
```

**Edge cases the generator should cover:**
- `nowMs = 0` (epoch start)
- `lastEvaluatedAt = null` (first evaluation)
- `intervalMinutes = 5` (minimum)
- `intervalMinutes = 10080` (maximum — 7 days)
- `nowMs` very close to `lastEvaluatedAt + intervalMs` (boundary)

### P2: Catch-Up Fires At Most Once

**Property in plain English:** Regardless of how long the app was closed, an interval rule fires at most once per evaluation.

**Generators:**
```typescript
fc.integer({ min: 5, max: 10080 }),                     // intervalMinutes
fc.integer({ min: 0, max: 604_800_000 }),                // closedDurationMs (0 to 7 days)
fc.integer({ min: 1_700_000_000_000, max: 1_800_000_000_000 }), // nowMs
```

**Assertion:**
```typescript
(intervalMinutes, closedDurationMs, nowMs) => {
  const lastEvaluatedAt = new Date(nowMs - closedDurationMs).toISOString();
  const result = evaluateIntervalSchedule(nowMs, lastEvaluatedAt, intervalMinutes);
  // The function returns a single boolean, not a count — at most one fire
  if (result.shouldFire) {
    expect(result.newLastEvaluatedAt).toBe(new Date(nowMs).toISOString());
  }
}
```

### P3: Interval Monotonicity

**Property in plain English:** If a rule should fire at time t1, it should also fire at any later time t2 (given the same `lastEvaluatedAt`).

**Generators:**
```typescript
fc.integer({ min: 5, max: 10080 }),                     // intervalMinutes
fc.integer({ min: 1_700_000_000_000, max: 1_800_000_000_000 }), // t1
fc.integer({ min: 0, max: 604_800_000 }),                // delta (t2 = t1 + delta)
fc.date({ min: new Date(1_600_000_000_000), max: new Date(1_700_000_000_000) })
  .map(d => d.toISOString()),                            // lastEvaluatedAt
```

**Assertion:**
```typescript
(intervalMinutes, t1, delta, lastEvaluatedAt) => {
  const t2 = t1 + delta;
  const r1 = evaluateIntervalSchedule(t1, lastEvaluatedAt, intervalMinutes);
  const r2 = evaluateIntervalSchedule(t2, lastEvaluatedAt, intervalMinutes);
  if (r1.shouldFire) {
    expect(r2.shouldFire).toBe(true);
  }
}
```

### P4: Cron Day-of-Week Filtering

**Property in plain English:** A cron rule only fires on its configured days of the week.

**Generators:**
```typescript
fc.integer({ min: 0, max: 23 }),                        // hour
fc.integer({ min: 0, max: 59 }),                        // minute
fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }), // daysOfWeek
fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }), // now
```

**Assertion:**
```typescript
(hour, minute, daysOfWeek, now) => {
  const nowMs = now.getTime();
  const result = evaluateCronSchedule(nowMs, null, {
    hour, minute, daysOfWeek, daysOfMonth: []
  });
  if (result.shouldFire) {
    // The most recent cron match must be on a configured day
    // Since we pass null lastEvaluatedAt, it only fires if currently in the window
    expect(daysOfWeek).toContain(now.getDay());
  }
}
```

**Edge cases:** All 7 days selected (fires every day), single day selected, weekend-only `[0, 6]`.

### P5: Due-Date-Relative Window Correctness

**Property in plain English:** A due-date-relative rule fires for a task only if the task's trigger time falls within the evaluation window `(lastEvaluatedAt, now]`.

**Generators:**
```typescript
fc.integer({ min: -10080, max: 10080 }),                // offsetMinutes
fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-30') }), // now
fc.date({ min: new Date('2023-12-01'), max: new Date('2024-06-30') }), // lastEvaluatedAt
fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }), // task dueDate
```

**Assertion:**
```typescript
(offsetMinutes, now, lastEval, dueDate) => {
  const nowMs = now.getTime();
  const lastEvaluatedAt = lastEval.toISOString();
  const tasks = [{ id: 't1', dueDate: dueDate.toISOString(), completed: false, parentTaskId: null }];
  const result = evaluateDueDateRelativeSchedule(nowMs, lastEvaluatedAt, offsetMinutes, tasks);

  const triggerTime = dueDate.getTime() + offsetMinutes * 60_000;
  const windowStart = new Date(lastEvaluatedAt).getTime();

  if (result.matchingTaskIds?.includes('t1')) {
    expect(triggerTime).toBeGreaterThan(windowStart);
    expect(triggerTime).toBeLessThanOrEqual(nowMs);
  }
  if (triggerTime <= windowStart || triggerTime > nowMs) {
    expect(result.matchingTaskIds ?? []).not.toContain('t1');
  }
}
```

**Edge cases:** `offsetMinutes = 0` (fire at exact due date), large negative offset (fire weeks before), `lastEvaluatedAt` after `now` (shouldn't happen but test defensively), DST boundary dates.

### P6: Schedule Evaluation Is Deterministic

**Property in plain English:** Same inputs always produce same outputs (pure function).

**Generators:** Reuse generators from P1–P5.

**Assertion:**
```typescript
(nowMs, lastEvaluatedAt, intervalMinutes) => {
  const r1 = evaluateIntervalSchedule(nowMs, lastEvaluatedAt, intervalMinutes);
  const r2 = evaluateIntervalSchedule(nowMs, lastEvaluatedAt, intervalMinutes);
  expect(r1).toEqual(r2);
}
```

Apply the same pattern to `evaluateCronSchedule` and `evaluateDueDateRelativeSchedule`.

### P7: Self-Cascade Prevention

**Property in plain English:** After a scheduled rule fires and produces cascading events, the dedup set prevents the same rule from re-firing for the same entity.

**This property is inherited from the existing dedup mechanism.** Test at the integration level:

**Generators:**
```typescript
fc.integer({ min: 1, max: 10 }),                        // number of tasks
fc.integer({ min: 1, max: 3 }),                         // number of cascading event rules
```

**Assertion:**
```typescript
(taskCount, eventRuleCount) => {
  // Create a scheduled rule that moves N tasks
  // Create M event-driven rules that cascade
  // Verify: no rule fires more than once per task per action type
  // Verify: total actions ≤ taskCount × (1 + eventRuleCount × maxDepth)
}
```

---

## 7. DST-Specific Test Scenarios

Both the Architecture doc (§6) and PM doc (§4.8) identify DST as a risk. These are concrete test cases using `FakeClock`.

> **Note:** The pure evaluation functions (`evaluateIntervalSchedule`, `evaluateCronSchedule`) operate on epoch milliseconds and ISO strings. DST handling depends on how `findMostRecentCronMatch()` constructs `Date` objects — it uses `setHours()` which operates in local time. Tests must run with a controlled timezone or use UTC-based assertions.

### DST-1: Spring Forward — Rule at 2:30 AM

**Context:** US Eastern, second Sunday in March. Clocks jump from 2:00 AM to 3:00 AM. 2:30 AM doesn't exist.

```typescript
// Cron rule: hour=2, minute=30, daysOfWeek=[] (daily)
// lastEvaluatedAt: Saturday 2:30 AM EST
// now: Sunday 3:00 AM EDT (2:30 AM never happened)
clock.set(new Date('2024-03-10T08:00:00Z')); // 3:00 AM EDT = 08:00 UTC

const result = evaluateCronSchedule(clock.now(), '2024-03-09T07:30:00Z', {
  hour: 2, minute: 30, daysOfWeek: [], daysOfMonth: []
});
// Expected: findMostRecentCronMatch walks back, can't find 2:30 AM on Sunday
// (setHours(2, 30) on March 10 in EST → actually becomes 3:30 AM EDT)
// Behavior depends on JS Date implementation — document and test
```

**Expected behavior:** The rule fires at the next valid time (3:00 AM or the next day's 2:30 AM). **QA recommends**: fire at the next tick after the skipped window — effectively 3:00 AM. The catch-up logic handles this: `findMostRecentCronMatch` won't find a 2:30 AM match for Sunday, so it falls back to Saturday's 2:30 AM which is already evaluated. The rule skips Sunday and fires Monday at 2:30 AM. **Document this as known behavior.**

### DST-2: Fall Back — Rule at 1:30 AM

**Context:** US Eastern, first Sunday in November. Clocks repeat 1:00–2:00 AM. 1:30 AM happens twice.

```typescript
// Cron rule: hour=1, minute=30, daysOfWeek=[] (daily)
// lastEvaluatedAt: Saturday 1:30 AM EDT
// now: Sunday 1:30 AM EST (second occurrence)
clock.set(new Date('2024-11-03T06:30:00Z')); // 1:30 AM EST = 06:30 UTC

const result = evaluateCronSchedule(clock.now(), '2024-11-02T05:30:00Z', {
  hour: 1, minute: 30, daysOfWeek: [], daysOfMonth: []
});
// Expected: fires once (first occurrence at 1:30 AM EDT = 05:30 UTC)
// The second occurrence at 1:30 AM EST = 06:30 UTC should NOT fire again
```

**Expected behavior:** Fire once (first occurrence). After the first fire, `lastEvaluatedAt` is updated. The second 1:30 AM is after `lastEvaluatedAt` but `findMostRecentCronMatch` returns the same calendar date/time — the epoch milliseconds differ but the `isSameMinute` check uses local time components. **QA recommends**: add a test that verifies the rule fires exactly once during the fall-back hour, regardless of which 1:30 AM the tick lands on.

### DST-3: User Travels Across Timezones

**Context:** Rule created in UTC-5 (New York), evaluated in UTC+9 (Tokyo).

```typescript
// Cron rule: hour=9, minute=0 (local time)
// Created in NYC: 9 AM EST = 14:00 UTC
// Evaluated in Tokyo: 9 AM JST = 00:00 UTC
// The rule fires at 9 AM local time in whatever timezone the browser reports
```

**Expected behavior:** The rule fires at 9 AM JST in Tokyo. This is correct for "morning grooming" workflows — the rule follows the user. The `findMostRecentCronMatch` uses `new Date().setHours(hour, minute)` which operates in the browser's local timezone.

**Test:** Set `FakeClock` to 00:00 UTC (9 AM JST). Mock timezone to Asia/Tokyo. Verify cron rule with `hour: 9` fires. Then mock timezone to America/New_York (where 00:00 UTC = 7 PM previous day). Verify the same rule does NOT fire.

> **Note:** Timezone mocking in Vitest requires `process.env.TZ` or a library like `timezone-mock`. Add this to test infrastructure requirements (§9).

### DST-4: Interval Rule Across DST Boundary

**Context:** Interval rule with `intervalMinutes: 1440` (24 hours). DST spring-forward makes the day only 23 hours.

```typescript
// lastEvaluatedAt: Saturday 9:00 AM EST (14:00 UTC)
// now: Sunday 9:00 AM EDT (13:00 UTC) — only 23 hours elapsed
clock.set(new Date('2024-03-10T13:00:00Z')); // Sunday 9 AM EDT
const result = evaluateIntervalSchedule(
  clock.now(),
  '2024-03-09T14:00:00Z', // Saturday 9 AM EST
  1440 // 24 hours
);
// 23 hours elapsed < 24 hours → shouldFire: false
// The rule fires 1 hour late (at 10 AM EDT / 14:00 UTC)
```

**Expected behavior:** The interval is measured in absolute milliseconds, not "calendar days." A 24-hour interval across spring-forward fires 1 hour late in local time. **QA recommends documenting this**: "Interval rules measure elapsed time, not calendar time. A 24-hour interval may fire at a different local time after DST transitions."

---

## 8. Regression Risk Assessment

The scheduled triggers implementation touches several existing subsystems. This section identifies which features are most at risk and specifies what regression tests to run.

### 8.1 Event-Driven Rule Evaluation (`ruleEngine.ts`)

**What's changing:** A new `schedule.fired` branch is added to `evaluateRules()` (Architecture §4.3). This branch handles the fundamentally different evaluation model — iterating ALL tasks matching filters instead of evaluating a single entity.

**Regression risk: HIGH**
- The new branch shares code paths with event triggers (`passesFilters`, `createRuleAction`). A bug in the shared path affects both.
- The `ruleIndex` (built by `buildRuleIndex`) now includes scheduled trigger types. If the index grouping logic has an off-by-one or missing type, scheduled rules silently fail.

**Regression tests to run:**
- All existing `ruleEngine.test.ts` tests — verify no behavioral change for event triggers.
- Specifically: `card_moved_into_section` trigger still matches only the moved task (not all tasks).
- Specifically: `card_marked_complete` trigger still fires only for the completed task.
- New: `schedule.fired` event with `entityId = ruleId` (interval/cron) iterates all tasks.
- New: `schedule.fired` event with `entityId = taskId` (due-date-relative) evaluates only that task.

**What to watch for:** The `schedule.fired` branch uses `context.allTasks.filter(...)` to iterate tasks. If `allTasks` is empty or stale (e.g., not refreshed before evaluation), the rule matches nothing. Verify `allTasks` is populated from the current repository state at evaluation time.

### 8.2 Schema Validation (`schemas.ts`)

**What's changing:** `TriggerSchema` changes from a flat `z.object()` to a discriminated union (Architecture §2.3). This is the most significant schema change.

**Regression risk: HIGH**
- Every existing rule in localStorage must still validate against the new schema. Architecture §2.4 argues backward compatibility, but this must be verified empirically.
- Any code that constructs `Trigger` objects (rule creation, import, tests) must produce objects matching the new discriminated union shape.
- TypeScript type narrowing changes — code that accessed `trigger.sectionId` without checking `trigger.type` may now get type errors.

**Regression tests to run:**
- Schema round-trip: parse every existing trigger type through the new `TriggerSchema` → verify success.
- Specifically: `{ type: 'card_moved_into_section', sectionId: 'abc' }` validates against the new union.
- Specifically: `{ type: 'card_moved_into_section', sectionId: null }` validates (nullable sectionId).
- New: `{ type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 30 }, lastEvaluatedAt: null }` validates.
- New: `{ type: 'card_moved_into_section', schedule: { ... } }` REJECTS (event trigger with schedule config).
- Migration: load a localStorage blob with old-format rules → verify `AutomationRuleSchema.parse()` succeeds.

**What to watch for:** The discriminated union uses `z.literal()` for each trigger type. If a trigger type string is misspelled or missing from the union, rules with that type fail validation silently on load. The repository's migration function (`migrateRule`) must handle this gracefully — log a warning, don't crash.

### 8.3 Import/Export (`ruleImportExport.ts`, `shareService.ts`)

**What's changing:** New trigger types in the schema. Export includes `schedule` and `lastEvaluatedAt` fields. Import must handle rules from newer versions that include unknown trigger types.

**Regression risk: MEDIUM**
- Export: scheduled rules serialize with additional fields. Older app versions importing this data will encounter unknown trigger types.
- Import: `lastEvaluatedAt` should be reset to `null` on import (fresh evaluation in new environment).
- The `ruleImportExport.ts` validation flow uses `AutomationRuleSchema.parse()` — if the schema rejects a rule, the import drops it.

**Regression tests to run:**
- Export a project with mixed event + scheduled rules → import into the same version → verify all rules preserved.
- Export from new version → import into old version (simulate by using old schema) → verify event rules survive, scheduled rules are handled gracefully (marked broken or dropped with warning).
- Import a rule with `lastEvaluatedAt: '2024-01-15T09:00:00Z'` → verify it's reset to `null`.
- Import a rule with `trigger.type: 'scheduled_cron'` into a schema that doesn't know `scheduled_cron` → verify the import doesn't crash.

**What to watch for:** The `detectBrokenRules` call after import checks section references. It does NOT check trigger type validity. A scheduled rule with a valid section reference but unsupported trigger type would pass broken-rule detection but fail at evaluation time. Add a trigger-type validity check to the import flow.

### 8.4 Rule Preview Service (`rulePreviewService.ts`)

**What's changing:** New trigger descriptions for scheduled types (Architecture Appendix B, C). The preview sentence structure changes from "When a card [trigger]..." to "Every [schedule], for cards [filters]..." for scheduled triggers.

**Regression risk: LOW**
- The preview service is display-only — bugs here don't affect rule execution.
- But incorrect previews confuse users and erode trust in the automation system.

**Regression tests to run:**
- All existing `rulePreviewService.test.ts` tests — verify event trigger previews unchanged.
- New: `scheduled_interval` with `intervalMinutes: 30` → "Every 30 minutes"
- New: `scheduled_interval` with `intervalMinutes: 1440` → "Every 1 day(s)"
- New: `scheduled_cron` with `hour: 9, minute: 0, daysOfWeek: [1]` → "Mon at 09:00"
- New: `scheduled_cron` with `hour: 9, minute: 0, daysOfWeek: []` → "Daily at 09:00"
- New: `scheduled_due_date_relative` with `offsetMinutes: -2880` → "2 days before due date"
- New: `scheduled_due_date_relative` with `offsetMinutes: 1440` → "1 day after due date"

### 8.5 Broken Rule Detection (`sectionReferenceCollector.ts`, `detectBrokenRules`)

**What's changing:** Scheduled triggers have `sectionId: null` on the trigger itself, but may reference sections in their action and filters. The `collectSectionReferences` function walks `trigger.sectionId`, `action.sectionId`, and filter `sectionId` fields.

**Regression risk: LOW**
- Scheduled triggers don't add new section reference locations — the action and filter references are the same as event triggers.
- The `trigger.sectionId = null` for scheduled triggers means `collectSectionReferences` correctly skips the trigger's section reference.

**Regression tests to run:**
- Create a scheduled rule with action targeting section S. Delete section S. Verify `detectBrokenRules` marks the rule broken.
- Create a scheduled rule with filter `in_section(S)`. Delete section S. Verify rule marked broken.
- Create a scheduled rule with no section references (e.g., `mark_card_complete` action, no section filters). Delete any section. Verify rule is NOT marked broken.

### 8.6 Rule Metadata (`ruleMetadata.ts`)

**What's changing:** New `TriggerMeta` entries for the three scheduled trigger types (Architecture Appendix A). New `category: 'scheduled'` value.

**Regression risk: LOW**
- Metadata is used by the UI (trigger selection dropdown) and preview service.
- Adding new entries doesn't affect existing entries.

**Regression tests to run:**
- Verify `TRIGGER_META` contains entries for all 7 event trigger types (unchanged).
- Verify `TRIGGER_META` contains entries for all 3 scheduled trigger types (new).
- Verify `needsSection: false` for all scheduled triggers.
- Verify `needsSchedule: true` for all scheduled triggers.

---

## 9. Test Infrastructure Requirements

These test utilities must be built before the feature can be tested. Listed in dependency order.

### 9.1 `FakeClock` (Architecture §3.1)

**Already designed.** The Architecture doc provides the full implementation. Needs a test file.

**Location:** `features/automations/services/clock.ts` (production + test clock)

**Capabilities needed:**
- `now(): number` — returns epoch millis
- `toDate(): Date` — returns Date object
- `advance(ms: number)` — move time forward
- `set(time: number | Date)` — jump to specific time

**Test file:** `features/automations/services/clock.test.ts`
- Verify `FakeClock` starts at initial time
- Verify `advance()` moves time forward
- Verify `set()` jumps to exact time
- Verify `SystemClock.now()` returns a value close to `Date.now()`

### 9.2 Mock `BroadcastChannel`

**Needed for:** Leader election tests (§2.10). `BroadcastChannel` is not available in jsdom (Vitest's default environment).

**Implementation:**
```typescript
// test-utils/mockBroadcastChannel.ts
export class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  name: string;
  onmessage: ((event: { data: unknown }) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown): void {
    // Deliver to all other instances with the same name
    for (const instance of MockBroadcastChannel.instances) {
      if (instance !== this && instance.name === this.name && instance.onmessage) {
        // Simulate async delivery (microtask)
        queueMicrotask(() => instance.onmessage?.({ data }));
      }
    }
  }

  close(): void {
    const idx = MockBroadcastChannel.instances.indexOf(this);
    if (idx >= 0) MockBroadcastChannel.instances.splice(idx, 1);
  }

  static reset(): void {
    MockBroadcastChannel.instances = [];
  }
}
```

**Usage in tests:**
```typescript
beforeEach(() => {
  MockBroadcastChannel.reset();
  globalThis.BroadcastChannel = MockBroadcastChannel as any;
});
afterEach(() => {
  delete (globalThis as any).BroadcastChannel;
});
```

### 9.3 In-Memory `AutomationRuleRepository` with Schedule-Aware Rules

**Needed for:** SchedulerService unit tests. The existing `Map<string, T>` pattern from the testing steering doc applies.

**Implementation:**
```typescript
// test-utils/inMemoryAutomationRuleRepo.ts
export class InMemoryAutomationRuleRepository implements AutomationRuleRepository {
  private rules = new Map<string, AutomationRule>();

  findAll(): AutomationRule[] { return [...this.rules.values()]; }
  findById(id: string): AutomationRule | null { return this.rules.get(id) ?? null; }
  findByProjectId(projectId: string): AutomationRule[] {
    return this.findAll().filter(r => r.projectId === projectId);
  }
  create(rule: AutomationRule): void { this.rules.set(rule.id, rule); }
  update(id: string, updates: Partial<AutomationRule>): void {
    const existing = this.rules.get(id);
    if (existing) this.rules.set(id, { ...existing, ...updates });
  }
  delete(id: string): void { this.rules.delete(id); }
  // ... other interface methods as needed
}
```

### 9.4 Scheduled Rule Factory Helpers

**Needed for:** Reducing boilerplate in test files. Create scheduled rules with specific configs in one call.

```typescript
// test-utils/scheduledRuleFactories.ts
export function makeIntervalRule(overrides: Partial<{
  id: string;
  projectId: string;
  intervalMinutes: number;
  lastEvaluatedAt: string | null;
  enabled: boolean;
  brokenReason: string | null;
  filters: CardFilter[];
  action: Action;
  order: number;
}>): AutomationRule {
  return {
    id: overrides.id ?? `rule-${Math.random().toString(36).slice(2)}`,
    projectId: overrides.projectId ?? 'project-1',
    name: 'Test Interval Rule',
    trigger: {
      type: 'scheduled_interval',
      sectionId: null,
      schedule: { kind: 'interval', intervalMinutes: overrides.intervalMinutes ?? 60 },
      lastEvaluatedAt: overrides.lastEvaluatedAt ?? null,
    },
    filters: overrides.filters ?? [],
    action: overrides.action ?? {
      type: 'move_card_to_top_of_section',
      sectionId: 'section-1',
      dateOption: null,
      position: 'top',
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    },
    enabled: overrides.enabled ?? true,
    brokenReason: overrides.brokenReason ?? null,
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    order: overrides.order ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Similar factories: makeCronRule(), makeDueDateRelativeRule(), makeEventRule()
```

### 9.5 Time-Travel Helpers for fast-check

**Needed for:** Property-based tests that generate timestamps around DST boundaries, month boundaries, and leap years.

```typescript
// test-utils/timeGenerators.ts
import * as fc from 'fast-check';

/** Generate timestamps around DST spring-forward (US Eastern, 2nd Sunday in March) */
export const dstSpringForwardArb = fc.integer({ min: 2020, max: 2030 }).map(year => {
  // Find 2nd Sunday in March
  const march1 = new Date(year, 2, 1);
  let sundayCount = 0;
  let day = 1;
  while (sundayCount < 2) {
    const d = new Date(year, 2, day);
    if (d.getDay() === 0) sundayCount++;
    if (sundayCount < 2) day++;
  }
  // DST transition at 2:00 AM local
  return new Date(year, 2, day, 2, 0, 0).getTime();
});

/** Generate timestamps around month boundaries */
export const monthBoundaryArb = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }),
  fc.integer({ min: 0, max: 11 }),
).map(([year, month]) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, lastDay, 23, 59, 0).getTime();
});

/** Generate timestamps around leap year Feb 29 */
export const leapYearArb = fc.constantFrom(2024, 2028, 2032).map(year => {
  return new Date(year, 1, 29, 12, 0, 0).getTime();
});

/** Generate a valid ISO datetime string within a range */
export const isoDatetimeArb = (min: Date, max: Date) =>
  fc.date({ min, max }).map(d => d.toISOString());
```

### 9.6 Timezone Mocking

**Needed for:** DST tests (§7). Vitest runs in Node.js where `process.env.TZ` controls the timezone.

```typescript
// test-utils/timezoneMock.ts
export function withTimezone(tz: string, fn: () => void): void {
  const originalTZ = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    process.env.TZ = originalTZ;
  }
}

// Usage:
withTimezone('America/New_York', () => {
  const clock = new FakeClock(new Date('2024-03-10T07:00:00Z')); // 2 AM EST
  // ... test DST behavior
});
```

> **Caveat:** Changing `process.env.TZ` at runtime may not work reliably in all Node.js versions. An alternative is to run DST-specific test files with `TZ=America/New_York npx vitest run path/to/dst.test.ts`. Document this in the test README.

### 9.7 Integration Test Harness

**Needed for:** End-to-end tests through SchedulerService → AutomationService → RuleExecutor.

```typescript
// test-utils/schedulerTestHarness.ts
export function createSchedulerTestHarness(options?: {
  clock?: FakeClock;
  rules?: AutomationRule[];
  tasks?: Task[];
  sections?: Section[];
}) {
  const clock = options?.clock ?? new FakeClock(new Date('2024-01-15T09:00:00Z'));
  const ruleRepo = new InMemoryAutomationRuleRepository();
  const taskRepo = new InMemoryTaskRepository();
  const sectionRepo = new InMemorySectionRepository();

  // Seed data
  for (const rule of options?.rules ?? []) ruleRepo.create(rule);
  for (const task of options?.tasks ?? []) taskRepo.create(task);
  for (const section of options?.sections ?? []) sectionRepo.create(section);

  const firedRules: Array<{ rule: AutomationRule; evaluation: ScheduleEvaluation }> = [];
  const scheduler = new SchedulerService(clock, ruleRepo, taskRepo, (params) => {
    firedRules.push(params);
  });

  return { clock, ruleRepo, taskRepo, sectionRepo, scheduler, firedRules };
}
```

---

## 10. Final Design Decisions — Resolved

All 12 design decisions have been resolved through cross-doc consensus between Architecture, PM, and QA. Recommendations are now final decisions.

### Decision 1: Catch-Up Policy ✅ RESOLVED

**Decision: `catch_up_latest` as the only behavior for Phase 5a. `skip_missed` added as opt-in toggle in Phase 5b. `catch_up_all` rejected.**

- Architecture §3.2 implements at-most-once-per-window, which is `catch_up_latest`
- Architecture §13.1 rejects `catch_up_all` as architecturally unsound (stale filter context, unbounded blast radius)
- PM §9.2 Decision 7 agrees: per-rule policy deferred to Phase 5b

**Test:** Verify `evaluateIntervalSchedule` and `evaluateCronSchedule` both return `shouldFire: true` at most once per call, regardless of how many intervals were missed.

### Decision 2: Schedule Storage Format ✅ RESOLVED

**Decision: Structured object with `kind` discriminator (Architecture §2.2 `ScheduleConfigSchema`).**

**Test:** Schema validation tests for all valid and invalid combinations. Property test: any output of the schedule config generators passes `ScheduleConfigSchema.parse()`.

### Decision 3: Time Reference ✅ RESOLVED

**Decision: Local time. `findMostRecentCronMatch()` uses `Date.setHours()` which operates in local time.**

**Test:** See §7 DST-Specific Test Scenarios. Verify cron rules fire at the configured local hour regardless of UTC offset.

### Decision 4: Dedup Set Scope ✅ RESOLVED

**Decision: One dedup set per `tick()` call, shared across all rules and their cascades within a single scheduled evaluation pass.**

Different rules in the same tick get independent `handleEvent` call chains (each with its own dedup set). Within each chain, dedup prevents cascading loops. This means different rules CAN independently act on the same task, but a single rule's cascade can't loop back on itself.

**Test:** Two scheduled rules both match task T with different actions → both execute. One scheduled rule matches task T, cascade loops back → dedup blocks.

### Decision 5: Undo Support ✅ RESOLVED

**Decision: Undo when tab visible (`document.visibilityState === 'visible'` AND `!isCatchUp`). 30-second window for scheduled rules. Skip undo for catch-up executions.**

Implementation: add `scheduledRule: boolean` flag to `UndoSnapshot`. Extend `UNDO_EXPIRY_MS` to 30s when `scheduledRule === true`.

**Test:** Scheduled rule fires while visible → undo snapshot captured (30s window). Catch-up execution → no undo snapshot. Undo within 30s → reverts all affected tasks. Undo at 31s → expired.

### Decision 6: Execution Log Format ✅ RESOLVED

**Decision: One aggregated entry per scheduled run with `matchCount: number` and `details?: string[]` (first 10 task names).**

Add to `ExecutionLogEntrySchema`:
```typescript
matchCount: z.number().int().optional(), // only for scheduled runs
details: z.array(z.string()).optional(),  // first 10 task names
```

Event-driven rules continue using per-task entries (no change).

**Test:** Scheduled rule matches 50 tasks → exactly 1 `recentExecutions` entry with `matchCount: 50` and `details.length <= 10`. The 20-entry cap covers 20 scheduled runs.

### Decision 7: Multi-Tab Coordination ✅ RESOLVED

**Decision: BroadcastChannel leader election (Architecture §6.3). Fallback: assume leader if BroadcastChannel unavailable.**

**Test:** See §2.10 for leader election test scenarios. Key test: leader crashes → new leader elected within 60 seconds → scheduler resumes.

### Decision 8: Notification Strategy ✅ RESOLVED

**Decision: Single-rule tick → per-rule toast with undo button. Multi-rule tick (>1 rule) → single summary toast: "⚡ N scheduled rules ran, affecting M tasks" with "View log" action. Catch-up → "🔄 Catch-up:" prefix.**

Architecture §8 provides the `TickCompleteCallback` implementation.

**Test:** 1 rule fires → 1 toast with rule name and task count. 3 rules fire → 1 summary toast. Catch-up → prefix is "🔄 Catch-up:".

### Decision 9: New Filter Types ✅ RESOLVED

**Decision: Ship `is_complete` and `is_incomplete` in Phase 5a. Defer `created_more_than`, `completed_more_than`, `last_updated_more_than` to Phase 5b.**

`is_complete`/`is_incomplete` are trivial checks on `task.completed`. Age-based filters require verifying `createdAt`, `completedAt`, `updatedAt` fields exist on all tasks (including migrated/imported).

**Test:** `is_complete`: `task.completed === true` → passes. `task.completed === false` → fails. `is_incomplete`: inverse. Edge case: `task.completed === undefined` (old data) → `is_complete` fails, `is_incomplete` passes.

### Decision 10: Monthly Schedule on Missing Days ✅ RESOLVED

**Decision: Fire on last day of month. Ship fix in Phase 5a.**

In `findMostRecentCronMatch`, add: if any value in `schedule.daysOfMonth` exceeds the last day of the candidate month, treat it as the last day. This is ~5 lines of code:

```typescript
// After computing candidate date:
const lastDayOfMonth = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
const adjustedDaysOfMonth = schedule.daysOfMonth.map(d => Math.min(d, lastDayOfMonth));
if (adjustedDaysOfMonth.length > 0 && !adjustedDaysOfMonth.includes(candidate.getDate())) {
  continue;
}
```

**Test:** Cron with `daysOfMonth: [31]`, February (28 days) → fires on Feb 28. April (30 days) → fires on Apr 30. July (31 days) → fires on Jul 31.

### Decision 11: Scheduled Evaluation Entry Point ✅ RESOLVED

**Decision: Hybrid — Architecture's approach (§3.2 + §4.2). Pure `evaluateScheduledRules()` → `schedule.fired` synthetic events → existing `evaluateRules()` handles task iteration and filter application.**

**Test:** Full chain: `evaluateScheduledRules()` → `schedule.fired` event → `evaluateRules()` → `RuleAction[]` → `RuleExecutor.executeActions()`. Use the integration test harness (§9.7).

### Decision 12: Depth Assignment ✅ RESOLVED

**Decision: Depth 0. Scheduled triggers are top-level initiators, consistent with user-initiated events.**

Cascaded event-driven rules start at depth 1, leaving 4 levels of cascade (same as user-initiated).

**Test:** Scheduled rule fires at depth 0. Cascaded event-driven rule fires at depth 1. Chain stops at depth 5.
