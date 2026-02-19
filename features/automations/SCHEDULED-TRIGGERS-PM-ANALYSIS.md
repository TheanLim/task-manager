# Scheduled/Timer-Based Triggers — PM Analysis

**Feature**: Phase 5 — Scheduled Triggers for the Automation Engine
**Status**: Pre-development analysis — all open questions resolved (see §9)
**Date**: 2025-02-20
**Last Updated**: 2025-02-20

---

## Executive Summary

The current automation engine is purely reactive — rules fire in response to user actions (move, complete, create). Scheduled triggers add a time dimension: rules that fire based on the passage of time, recurring schedules, or proximity to task dates. This is the single most-requested gap in the automation system, and the one that transforms it from "convenience shortcuts" into a genuine workflow engine.

The critical constraint: this is a client-side-only app with localStorage persistence. There is no server to run cron jobs. Every scheduled trigger must execute in the browser, which fundamentally shapes the design.

**Cross-references**: [Architecture RFC](./SCHEDULED-TRIGGERS-ARCHITECTURE.md) for technical design, [QA Analysis](./SCHEDULED-TRIGGERS-QA-ANALYSIS.md) for edge cases and test scenarios, [UI/UX Analysis](./SCHEDULED-TRIGGERS-UI-UX-ANALYSIS.md) for component design and interaction specs.

---

## 1. User Stories & Use Cases

### Core Stories (MVP)

**US-1: Overdue task escalation**
> As a project manager, I want tasks that are past their due date to automatically move to an "Overdue" section, so I don't have to manually scan for missed deadlines every morning.

Trigger: Cron — daily at 9am. Filter: `is_overdue` + `not_in_section("Overdue")`. Action: `move_card_to_top_of_section("Overdue")`.

**US-2: Due date approaching — move to Urgent**
> As a user, I want tasks due within 2 days to automatically move to my "Urgent" section, so approaching deadlines surface without manual triage.

Trigger: Due-date-relative — 2 days before due date. Filter: `not_in_section("Urgent")`. Action: `move_card_to_top_of_section("Urgent")`.

**US-3: Weekly stale task flagging**
> As a team lead, I want tasks that haven't been updated in 7+ days to be moved to a "Needs Attention" section every Monday, so stale work doesn't go unnoticed.

Trigger: Cron — Monday at 9am. Filter: `last_updated_more_than(7, days)` (new filter). Action: `move_card_to_bottom_of_section("Needs Attention")`.

**US-4: Recurring task creation — daily standup**
> As a user, I want a "Daily Standup Prep" task created every weekday morning in my "Today" section, so I have a consistent reminder.

Trigger: Cron — weekdays at 8am. Action: `create_card("Daily Standup Prep", section: "Today", dueDate: today)`.

**US-5: Monthly cleanup — archive completed tasks**
> As a user, I want completed tasks older than 30 days to be automatically moved to an "Archive" section on the 1st of each month, so my board stays clean.

Trigger: Cron — 1st of month at 9am. Filter: `is_complete` + `completed_more_than(30, days)` (new filter). Action: `move_card_to_bottom_of_section("Archive")`.

### Extended Stories (Post-MVP)

**US-6: End-of-sprint automation**
> As a scrum master, I want all incomplete tasks in "In Progress" to move to "Sprint Backlog" at the end of each 2-week sprint, so carryover is handled automatically.

Trigger: Interval — every 14 days. Filter: `in_section("In Progress")` + `is_incomplete`. Action: `move_card_to_bottom_of_section("Sprint Backlog")`.

**US-7: Recurring weekly review task**
> As a user, I want a "Weekly Review" task created every Friday in my "To Do" section with a due date of that Friday, so I never forget my weekly review.

Trigger: Cron — Friday at 2pm. Action: `create_card("Weekly Review", section: "To Do", dueDate: today)`.

**US-8: Due date reminder — set due date on stale tasks**
> As a project manager, I want tasks without a due date that have been sitting in "To Do" for more than 5 days to automatically get a due date of "next working day", so nothing sits indefinitely without a deadline.

Trigger: Cron — daily. Filter: `in_section("To Do")` + `no_due_date` + `created_more_than(5, days)` (new filter). Action: `set_due_date("next_working_day")`.

**US-9: Morning triage — mark overdue tasks incomplete**
> As a user, if I marked a task complete but it's now past its due date and still in "In Progress" (indicating it was re-opened), I want it automatically marked incomplete so the board reflects reality.

Trigger: Cron — daily. Filter: `is_overdue` + `in_section("In Progress")` + `is_complete`. Action: `mark_card_incomplete`.

**US-10: Catch-up on missed schedules**
> As a user who doesn't leave the app open 24/7, I want missed scheduled rules to run when I next open the app, so I don't lose automations just because my laptop was closed.

This is a system behavior, not a user-configured rule — but it's the most important UX story for the entire feature.

**US-11: One-time scheduled action**
> As a user, I want to schedule a one-time automation — e.g., "On March 15th, move all tasks in 'Sprint 12' to 'Archive'" — for planned milestones.

Trigger: One-time at specific date/time. Filter + Action: same as existing.

**US-12: Recurring monthly report prep**
> As a team lead, I want a "Monthly Status Report" task created on the last working day of each month in my "Admin" section, so I never miss the reporting deadline.

Trigger: Cron — last working day of month. Action: `create_card("Monthly Status Report", section: "Admin", dueDate: last_working_day_of_month)`.

---

## 2. Schedule Types to Support

### 2.1 Recommended Schedule Types — Aligned with Architecture RFC

The Architecture RFC (§2.1–2.2) settled on a 3-type discriminated union model. This PM doc originally proposed 5 types (`scheduled_interval`, `scheduled_daily`, `scheduled_weekly`, `scheduled_monthly`, `scheduled_relative`). The Architecture's `scheduled_cron` type with structured fields (hour, minute, daysOfWeek, daysOfMonth) subsumes daily, weekly, and monthly into a single type with better composability and simpler schema.

| Trigger Type | Architecture Name | User-Facing Label | What It Covers | MVP? |
|---|---|---|---|---|
| **Interval** | `scheduled_interval` | "On a recurring interval" | Every N minutes/hours/days (5 min – 7 days) | Yes |
| **Cron (structured)** | `scheduled_cron` | "At a specific time" | Daily, weekday, weekly, monthly — all via structured fields | Yes |
| **Due-date-relative** | `scheduled_due_date_relative` | "Relative to due date" | N days/hours before or after a task's due date | Yes |
| **One-time** | (deferred) | "Run once at a specific time" | Single-fire at a date/time | Phase 5c |
| **Raw cron expression** | (deferred) | "Custom cron expression" | Power user escape hatch | Phase 5c |

**Why 3 types, not 5**: The `scheduled_cron` type with `daysOfWeek: [1]` is "weekly on Monday." With `daysOfWeek: []` it's "daily." With `daysOfMonth: [1]` it's "monthly on the 1st." The UI presents these as separate picker modes (daily/weekly/monthly tabs), but the underlying schema is one type. This avoids schema proliferation and simplifies the rule engine — it only needs 3 branches, not 5.

### 2.2 Schedule Configuration Data Model

The Architecture RFC (§2.2–2.3) defines a discriminated union `ScheduleConfigSchema` with a `kind` discriminator. Key design choices:

- **Structured fields, not cron strings.** `{ hour: 9, minute: 0, daysOfWeek: [1, 5] }` instead of `"0 9 * * 1,5"`. This enables a picker UI and per-field validation. See Architecture §2.2 for rationale.
- **`intervalMinutes` as canonical unit.** The UI can present hours/days, but storage is always minutes (5–10080 range). Avoids unit-conversion bugs.
- **`offsetMinutes` for due-date-relative.** Negative = before due date, positive = after. `displayUnit` is cosmetic for the UI.
- **`lastEvaluatedAt` on the trigger entity.** Co-located with the schedule config, persisted to localStorage as part of the rule. No new storage keys. See Architecture §5.1.

For full schema definitions, see Architecture RFC §2.2.

### 2.3 Why "Relative to Due Date" Is Special

This is the most valuable schedule type for a task management app, and it's architecturally different from the others:

- **Interval/Cron** operate on a global clock. One timer fires, scans all tasks matching filters, executes actions.
- **Relative to due date** is per-task. Each task with a due date has its own implicit schedule. "2 days before due date" means different absolute times for different tasks.

Implementation approach (Architecture §3.2): The scheduler evaluates relative triggers by scanning all tasks with due dates and checking if `now` falls within the trigger window since `lastEvaluatedAt`. This is a scan, not a per-task timer — keeps it simple and avoids managing thousands of individual timers.

The Architecture RFC supports both negative offsets (before due date) and positive offsets (after due date). "1 day after due date → move to Overdue" is a valid use case (Architecture §10.2, Q3).

---

## 3. Priority & Phasing — Aligned with Architecture RFC

The Architecture RFC (§9.3) proposes a 3-phase rollout: Foundation → Scheduler Service → UI. This PM phasing aligns with that structure but frames it in terms of user value delivered.

### Phase 5a — MVP (4-6 weeks)

**Goal**: Ship the complete scheduled triggers feature end-to-end. All architecture, scheduler, and UI in one phase.

| Item | Rationale | Architecture Ref |
|------|-----------|-----------------|
| Clock abstraction (`SystemClock`, `FakeClock`) | Foundation for deterministic testing | §3.1 |
| Pure schedule evaluators (incl. last-day-of-month fix) | Core scheduling logic — everything depends on this | §3.2 |
| `scheduled_interval` trigger type | Simplest schedule type, validates the architecture | §2.1 |
| `scheduled_cron` trigger type | Covers daily/weekly/monthly — US-1, US-3, US-4, US-5, US-8, US-9 | §2.1 |
| `scheduled_due_date_relative` trigger type | Covers US-2 — the killer use case for a task management app | §2.1 |
| Discriminated union `TriggerSchema` | Type-safe schema, backward-compatible migration | §2.3 |
| `schedule.fired` domain event | Bridges scheduler to existing automation pipeline | §4.1 |
| SchedulerService with 60s tick loop | Tick-based evaluation, visibility-aware | §3.3 |
| Catch-up on app open (at-most-once) | Non-negotiable for client-side — US-10 | §3.2, §6.2 |
| BroadcastChannel leader election | Prevents multi-tab duplicate execution | §6.3 |
| `lastEvaluatedAt` persistence on rule entity | Required for catch-up and missed schedule detection | §6.1 |
| `create_card` dedup heuristic | Prevents duplicate tasks on crash recovery / multi-tab race | §9.2 |
| New filters: `is_complete`, `is_incomplete` | Needed for cleanup rules (US-5, US-9) | — |
| Schedule configuration UI (`ScheduleConfigPanel`) | New step in the wizard for schedule config | §11 |
| Aggregated execution log entries | One entry per scheduled pass with `matchCount` + `details` | §14.2 #11 |
| "Run Now" button on RuleCard | Low-effort, high-value for rule authoring and debugging | §14.2 #8 |
| Summary toast + catch-up toast | Prevents toast flood for multi-rule ticks | §8 |
| `schemaVersion` in export format | Prevents silent data loss on version-mismatched imports | §9.2 #5 |
| Info tooltip about client-side limitations | Manages user expectations | §7.4 |

**Not in Phase 5a**: One-time triggers, raw cron expressions, dry-run preview, age-based filters, title templates, per-rule catch-up policy.

### Phase 5b — Filters + Polish (2-3 weeks)

| Item | Rationale |
|------|-----------|
| New filters: `last_updated_more_than`, `created_more_than`, `completed_more_than` | Age-based filtering for stale/cleanup rules (US-3, US-5, US-8) |
| New filters: `in_section_for_more_than`, `not_modified_in` | QA-identified filter gaps (QA §1.2, §3.2) — requires `movedToSectionAt` on Task entity |
| `skip_missed` catch-up policy toggle | Per-rule opt-in for time-sensitive rules (e.g., "Friday summary" is useless on Monday) |
| Title templates with `{{date}}`, `{{weekday}}`, `{{month}}` interpolation | Prevents duplicate-title confusion for recurring task creation |
| Dry-run / preview for scheduled rules | "What would this rule do if it ran right now?" |
| Schedule history view | When did this rule last run? What did it do? |

### Phase 5c — Power User (2 weeks)

| Item | Rationale |
|------|-----------|
| One-time scheduled triggers | US-11 — milestone automation |
| Cron expression input (optional) | Power users who know cron |
| Bulk schedule management | "Pause all scheduled rules" |

### Dependency: New Filters Required

Several user stories need filters that don't exist yet. QA Analysis (§3.2) identified additional filter gaps that scheduled triggers expose:

| Filter | Needed For | Complexity | Phase |
|--------|-----------|------------|-------|
| `is_complete` / `is_incomplete` | Cleanup, re-open rules | Trivial — check `task.completed` | 5a |
| `last_updated_more_than(N, unit)` | Stale task detection (US-3) | Medium — needs `task.updatedAt` | 5b |
| `created_more_than(N, unit)` | Age-based rules (US-8) | Medium — needs `task.createdAt` | 5b |
| `completed_more_than(N, unit)` | Archive old completed tasks (US-5) | Medium — needs `task.completedAt` | 5b |
| `in_section_for_more_than(N, unit)` | Stale-in-section detection (QA §1.2) | Hard — needs `movedToSectionAt` timestamp | 5b |
| `not_modified_in(N, unit)` | Inactivity detection (QA §3.2) | Medium — needs `updatedAt` comparison | 5b |
| `overdue_by_more_than(N, unit)` | Graduated escalation (QA §1.7) | Medium — compute days past due | 5b |

These filters are independently useful even without scheduled triggers and could ship earlier.

---

## 4. Constraints & Risks

### 4.1 The Client-Side Elephant in the Room

This is the defining constraint. No server means:

- **No guaranteed execution.** If the browser tab isn't open, nothing runs. Period.
- **No background workers.** Service Workers can't access localStorage reliably and have their own lifecycle issues. Web Workers can't access the DOM or localStorage.
- **No push notifications.** Can't alert the user that a scheduled rule fired while they were away (without a server-side push service).
- **Clock drift.** `setInterval` in a background tab is throttled by browsers (Chrome: minimum 1 second, often much worse). `setTimeout` is unreliable for long durations.

**Mitigation strategy: Tick-based evaluation, not real-time timers.**

The Architecture RFC (§3.3–3.5) specifies a single `setInterval` at 60-second resolution. Each tick checks "is it time yet?" for all scheduled rules. This is robust against timer throttling because it doesn't depend on precise timer firing. The Page Visibility API compensates for background throttling — an immediate catch-up tick fires when the tab becomes visible.

Why 60 seconds (Architecture §3.5): Cron has minute-level granularity, intervals have a 5-minute minimum, due-date-relative uses day-level offsets. A 60s tick gives ≤1 minute jitter — acceptable for a task management app.

### 4.2 Catch-Up Behavior — RESOLVED

**Decision: At-most-once-per-window (Architecture §3.2, §5.2).**

When the user opens the app after being away, each missed scheduled rule fires exactly once with the current timestamp as context. Not N times for N missed intervals.

User impact: A user who closes the app for 3 days and has a daily "move overdue to Urgent" rule will see one catch-up execution on reopen. Tasks that became overdue during the 3 days are caught by the current-context evaluation. This is correct for move/filter rules.

**Known gap for `create_card` rules (QA §1.3, §1.5):** A daily "create standup task" rule missed for 3 days creates only 1 task on catch-up, not 3. For most users this is fine — they don't want 3 stale standup tasks. But some users may want full catch-up for recurring task creation. **Phase 5b adds a per-rule catch-up policy toggle** (`catch_up_latest` default, `catch_up_all` opt-in) to address this.

### 4.3 Idempotency

Scheduled rules that scan tasks and apply actions MUST be idempotent. If a rule says "move overdue tasks to Overdue section," running it twice should not produce different results — tasks already in "Overdue" should not be moved again.

The existing filter system handles this naturally: `not_in_section("Overdue")` ensures already-moved tasks are skipped. But the rule author must configure filters correctly. The UI should guide this — when a scheduled rule's action is "move to section X", auto-suggest a `not_in_section(X)` filter.

### 4.4 Interaction with Event-Driven Triggers

Scheduled rules execute actions that produce domain events. Those events can trigger event-driven rules. This is intentional and desirable (e.g., scheduled move → event-driven "card moved into section" → mark complete). The existing cascade/dedup infrastructure handles this — scheduled rule execution feeds into `automationService.handleEvent()` with `depth: 0` (Architecture §4.1).

Risk: A scheduled rule that runs on catch-up could trigger a cascade of event-driven rules. The existing depth limit (5) and dedup set protect against infinite loops, but the user might see unexpected cascading behavior. Mitigation: execution log clearly shows the chain.

### 4.5 Cascade Amplification Risk — NEW (from QA Analysis)

QA Analysis (§1.1, §3.1) identified a critical amplification scenario: a scheduled rule that moves 50 tasks generates 50 `task.updated` events. If 3 event-driven rules match those events, that's 150 action executions from one scheduled tick. With depth 5, the theoretical worst case is 50 × 3^5 = 12,150 actions.

**User impact**: The user sees a wall of execution log entries and potentially confusing cascaded state changes. The system won't crash (dedup + depth limits protect it), but the UX is poor.

**Mitigations**:
1. The Architecture's batch mode (§4.5) aggregates toasts — one per rule, not one per task.
2. The dedup set prevents the same rule from re-acting on the same task (Architecture §4.4).
3. **PM recommendation**: Add a "scheduled rule impact preview" in Phase 5b — "This rule would affect ~50 tasks. Proceed?" — so users understand the blast radius before enabling.
4. **PM recommendation**: Consider a configurable max-tasks-per-scheduled-execution cap (default: 100) as a safety valve. Rules exceeding the cap log a warning and process only the first N tasks.

### 4.6 Multi-Tab Duplicate Execution — NEW (from QA Analysis)

QA Analysis (§2.10) identified that multiple browser tabs each run their own scheduler. Without coordination, `create_card` actions execute in every tab, creating duplicate tasks. Move actions are naturally idempotent (second move is a no-op), but creation is not.

**Resolution (Architecture §5.3)**: BroadcastChannel-based leader election. Only the leader tab runs the scheduler. Other tabs defer. If the leader tab closes, another tab claims leadership within 2 seconds.

**User impact**: Transparent — the user doesn't need to know about leader election. The Architecture doc recommends documenting "Only one tab runs scheduled rules" in the UI tooltip (§6.4).

**Fallback**: If BroadcastChannel is unavailable (older browsers), the Architecture falls back to assuming leadership. This means multi-tab duplication is possible in legacy browsers. Acceptable trade-off — the app is designed for modern browsers.

### 4.7 Timezone and DST Handling — NEW (from QA Analysis)

QA Analysis (§2.6) raised timezone and DST edge cases:

- **Travel scenario**: User creates "daily at 9am" in US Eastern, travels to Japan. Should the rule fire at 9am JST or 9am ET?
- **DST spring-forward**: A rule set for 2:30 AM — that time doesn't exist during spring-forward.
- **DST fall-back**: 1:30 AM happens twice during fall-back.

**Resolution (Architecture §6.4, QA §2.6)**: Store and evaluate in local time. The rule "follows" the user across timezones — 9am means 9am wherever they are. For DST: spring-forward skips to next valid time (3:00 AM), fall-back fires once (first occurrence).

**User impact**: Intuitive for most users. The edge case is a user who wants a rule to fire at a fixed UTC time (e.g., syncing with a team in another timezone). This is not supported in MVP — document as a known limitation.

### 4.8 Undo Semantics for Scheduled Executions — NEW (from QA Analysis)

QA Analysis (§3.3, §1.7) raised the question: should scheduled executions support undo?

The 10-second undo window assumes the user is actively watching. Scheduled rules fire in the background — the user might not see the toast for minutes. Catch-up executions fire on app open before the user is oriented.

**Resolution (Architecture §10.2 Q6)**: Full undo support — the existing mechanism works at the action level, not the trigger level. Scheduled triggers produce the same `RuleAction` objects, so undo works for free.

**PM recommendation**: Undo for scheduled executions that fire while the user is actively using the app (tab visible). Skip undo for catch-up executions on app open — the user wasn't present to undo, and the state changes may be minutes/hours/days old. Extend the undo window to 30 seconds for scheduled rules since the user needs time to notice and react. This aligns with QA's recommendation (§3.3).

### 4.9 Notification Strategy for Scheduled Executions — NEW

QA Analysis (§2.7) identified the toast flood problem: 50 rules × N tasks = overwhelming toasts. Even with batch aggregation (one toast per rule), 50 toasts cycling through a Sonner stack is 250+ seconds of notifications.

**PM recommendation**: Scheduled executions use a **summary toast**, not per-rule toasts:
- Single toast: "⚡ 5 scheduled rules executed, affecting 32 tasks" with a "View details" link to the execution log.
- If only 1 rule fired: "⚡ [Rule Name] ran on 12 tasks" (same as current batch toast).
- Catch-up executions: "⚡ Caught up on 3 missed scheduled runs — 45 tasks affected."

This keeps the notification useful without flooding the user. Detailed per-rule results live in the execution log.

### 4.10 Performance

A scheduled tick scans all tasks in the project against all active scheduled rules. For a typical project (50-200 tasks, 5-10 rules), this is negligible. For pathological cases (1000+ tasks, 50+ scheduled rules), the scan could take noticeable time.

Mitigations:
- The Architecture RFC (§10.2 Q2) recommends a **limit of 10 scheduled rules per project** since each tick evaluates all of them.
- QA Analysis (§2.7) recommends building the `EvaluationContext` once per tick, not per rule — avoids redundant `findAll()` calls.
- The `buildRuleIndex` approach already groups rules by trigger type. Scheduled rules are a new trigger type group, evaluated only during scheduler ticks, not on every domain event.

### 4.11 User Expectations Around Reliability

Users will expect scheduled rules to "just work." In a client-side app, they won't. We must be transparent:

- **Onboarding tooltip**: "Scheduled rules run when this app is open in your browser. If the app is closed, missed schedules will run when you next open it."
- **Rule card indicator**: Show "Last ran: 3 days ago (missed 2 scheduled runs)" on the rule card.
- **Settings**: Consider a "Run missed schedules on app open" toggle (default: on).
- **Multi-tab note**: "Only one tab runs scheduled rules" (Architecture §6.4).
- **Timing tolerance**: "A rule set for 9:00 AM may fire between 9:00 and 9:01" (Architecture §3.5).

### 4.12 Filter Gaps Exposed by Scheduled Triggers — NEW (from QA Analysis)

QA Analysis (§1.2, §3.2) identified that scheduled triggers expose filter gaps that don't matter for event-driven triggers:

- **"Time in section"** (QA §1.2): "Tasks stuck in In Progress for 5+ days" requires `in_section_for_more_than` — needs a `movedToSectionAt` timestamp that doesn't exist today.
- **"Not modified in N days"** (QA §3.2): Requires `updatedAt` comparison.
- **"Overdue by more than N days"** (QA §1.7): Requires computing days past due date, not just "is overdue."

These are polling-style filters that make sense for scheduled evaluation but are less useful for event-driven triggers. They should ship in Phase 5b alongside the scheduled trigger feature, not as a prerequisite.

---

## 5. Decisions Resolved — NEW

The Architecture RFC and QA Analysis resolved several open questions from the original PM analysis. This section captures those decisions in business terms.

| # | Decision | Business Rationale | Source |
|---|----------|-------------------|--------|
| 1 | **Catch-up fires once, not retroactively.** A user who closes the app for 3 days gets one catch-up execution per rule, not 3. | Prevents action storms on app open. A daily "move overdue to Urgent" rule doesn't need to replay 3 days — one scan with current context catches everything. The gap is `create_card` rules (addressed by per-rule catch-up policy in Phase 5b). | Architecture §3.2 |
| 2 | **Schedule storage uses structured fields, not cron strings.** "Monday at 9am" is `{ hour: 9, minute: 0, daysOfWeek: [1] }`, not `"0 9 * * 1"`. | Enables a picker UI accessible to non-technical users. Cron strings are powerful but hostile — most users can't write or read them. Structured fields let us validate each dimension independently and build intuitive UI controls. | Architecture §2.2 |
| 3 | **All schedule times are in local time.** A rule set for "9am" fires at 9am in whatever timezone the browser reports. | Intuitive — "9am" means "9am in my morning" regardless of travel. The alternative (UTC storage) would cause a "morning grooming" rule to fire at bedtime when traveling. Trade-off: users who want fixed-UTC schedules (team sync across timezones) aren't supported in MVP. | Architecture §6.4, QA §2.6 |
| 4 | **Only one tab runs the scheduler.** BroadcastChannel leader election ensures a single tab processes scheduled rules. | Prevents duplicate task creation and redundant execution. Transparent to the user — they don't need to think about tabs. Fallback for older browsers: assume leadership (accept multi-tab risk in legacy environments). | Architecture §5.3, QA §2.10 |
| 5 | **3 trigger types, not 5.** `scheduled_cron` with structured fields subsumes daily/weekly/monthly. | Simpler schema, fewer rule engine branches, less code to maintain. The UI still presents daily/weekly/monthly as separate picker modes — the simplification is internal. | Architecture §2.1 |
| 6 | **Discriminated union schema, not flat extension.** Scheduled triggers carry `schedule` + `lastEvaluatedAt`; event triggers carry `sectionId`. No cross-contamination. | Type safety — TypeScript narrows correctly, invalid states are unrepresentable. Zero migration cost — existing event trigger data validates against the new schema as-is. | Architecture §2.3–2.4 |
| 7 | **60-second tick interval, fixed.** Not configurable, not adaptive. | Matches cron's minute-level granularity. Lower ticks waste CPU; higher ticks miss cron windows. ≤1 minute jitter is acceptable for a task management app. No user benefit from configurability. | Architecture §3.5, §10.2 Q5 |
| 8 | **Scheduled evaluation = depth 0.** Cascaded event-driven rules start at depth 1, leaving 4 levels of cascade. | Consistent with user-initiated events. The existing depth limit (5) and dedup set protect against runaway cascades. | Architecture §4.1, QA §2.3 |
| 9 | **`lastEvaluatedAt` stored on the trigger entity, not a separate store.** | Co-location — the field is meaningless without the schedule config. No new localStorage key. Repository interface unchanged. | Architecture §5.1 |
| 10 | **Full undo support for scheduled executions.** The existing undo mechanism works at the action level, so it's free. | PM adds nuance: undo for visible-tab executions, skip undo for catch-up on app open. Extended 30-second window for scheduled rules. | Architecture §10.2 Q6, QA §3.3 |

---

## 6. Success Metrics

### 6.1 Adoption Metrics

| Metric | Target (3 months post-launch) | How to Measure |
|--------|-------------------------------|----------------|
| % of projects with ≥1 scheduled rule | 25% of active projects | Count rules where trigger type starts with `scheduled_` |
| Scheduled rules per project (median) | 2 | Aggregate from localStorage |
| Most popular schedule type | Cron (daily) or due-date-relative | Count by trigger type |
| Catch-up executions per week | Tracked but no target | Count executions where `isCatchUp: true` in log |

### 6.2 Reliability Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Scheduled rules that fire within 2 min of target time (tab open) | 95% | Compare `nextScheduledAt` vs actual `lastEvaluatedAt` |
| Catch-up rules that fire within 60s of app open | 99% | Timestamp comparison |
| Rules disabled due to repeated errors | < 5% | Count rules with `brokenReason` containing "schedule" |

### 6.3 User Satisfaction Signals

- Scheduled rules are not immediately disabled after creation (retention > 7 days)
- Users create multiple scheduled rules (not just trying it once)
- Execution log shows consistent firing patterns (not erratic)
- No increase in "all rules" disable rate after feature launch

### 6.4 Instrumentation Plan

Since there's no server-side analytics, all metrics live in localStorage. Add a lightweight `schedulerMetrics` object:

```typescript
interface SchedulerMetrics {
  totalTicksRun: number;
  totalCatchUpExecutions: number;
  totalScheduledExecutions: number;
  averageTickDurationMs: number;
  lastTickAt: string;
}
```

Surface these in a "Scheduler Health" section of the automation tab (dev mode or advanced settings).

---

## 7. TDD Considerations — Key Properties & Invariants

This section defines the business-level invariants that the scheduled trigger system must uphold. The Architecture RFC (§7.1) defines formal mathematical properties (P1–P7) with fast-check verification. The QA Analysis (§5) defines concrete test scenarios (A1–F8). This section bridges the two — each PM invariant maps to the formal properties and test scenarios that verify it.

### 7.1 Schedule Evaluation Correctness

**Invariant: A rule fires when its time comes, and only when its time comes.**

- A rule whose scheduled time has passed (and hasn't been evaluated since) fires on the next tick.
- A rule whose scheduled time is in the future does not fire.
- After firing, the rule's next scheduled time is strictly in the future.

*Formal properties*: Architecture P1 (at-most-once-per-window), P3 (interval monotonicity), P6 (determinism).
*Test scenarios*: QA A1–A9 (schedule evaluation), QA D1–D5 (filter interaction).

### 7.2 Missed Execution / Catch-Up

**Invariant: Catch-up fires at most once per rule, with current context.**

- On app open, every rule with a missed schedule fires exactly once.
- Catch-up uses current time for filter evaluation, not the missed time.
- A rule that was already caught up does not fire again on the same tick.
- `lastEvaluatedAt` updates to `now` after catch-up, not to the missed time.

*Formal properties*: Architecture P2 (catch-up fires at most once).
*Test scenarios*: QA B1–B6 (catch-up behavior).

### 7.3 Idempotency

**Invariant: Running a scheduled rule twice with no intervening state changes produces the same final state.**

- Tasks already in the target section are not re-moved.
- `create_card` is the exception — it is NOT idempotent. The UI should warn when a scheduled rule uses `create_card` without filters.

*Test scenarios*: QA F5 (create_card produces exactly one task), QA C2 (dedup prevents double execution).

### 7.4 Cascade Safety

**Invariant: Scheduled triggers respect the same safety limits as event-driven triggers.**

- Domain events from scheduled actions are valid inputs to `handleEvent`.
- Cascade depth ≤ 5 (maxDepth).
- Dedup set prevents the same rule from re-acting on the same task in one evaluation pass.
- Scheduled rules do NOT trigger other scheduled rules — only event-driven rules cascade.

*Formal properties*: Architecture P7 (self-cascade prevention).
*Test scenarios*: QA E1–E4 (cascade behavior), QA C1–C3 (conflict resolution).

### 7.5 Schedule Computation

**Invariant: Schedule math is correct for all calendar edge cases.**

- Weekly schedules land on the specified day of week (Architecture P4).
- Monthly `dayOfMonth: 31` in February lands on the last day of February, not March.
- Due-date-relative triggers fire for all matching tasks in the evaluation window (Architecture P5).
- DST transitions: spring-forward skips to next valid time, fall-back fires once.

*Test scenarios*: QA A4 (weekly), A5–A6 (monthly), A7 (weekday-only).

### 7.6 Persistence & State Consistency

**Invariant: Schedule state survives page refresh and app restart.**

- `lastEvaluatedAt` and schedule config persist across page refresh.
- Disabling a rule does not clear its schedule metadata (re-enabling resumes from where it left off).
- The scheduler never runs two ticks concurrently.
- Multi-tab: only the leader tab executes scheduled rules.

*Test scenarios*: QA F1–F4 (state consistency), F6–F7 (concurrent operations).

### 7.7 Undo

**Invariant: Undo reverts all tasks affected by a scheduled execution.**

- If a scheduled rule moved 5 tasks, undo returns all 5 to their original sections with original order values.
- Undo is available for visible-tab executions (30-second window). Not available for catch-up executions.

*Test scenarios*: QA F8 (undo of scheduled execution).

---

## 8. Proposed Architecture Sketch

```
                    ┌──────────────────────────────┐
                    │  SchedulerLeaderElection      │
                    │  (BroadcastChannel)           │
                    │  onBecomeLeader → start()     │
                    │  onLoseLeadership → stop()    │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
                    │   SchedulerService            │
                    │                               │
  setInterval(60s)──▶  tick()                       │
  visibilitychange──▶  tick() (catch-up)            │
                    │    │                          │
                    │    ▼                          │
                    │  evaluateScheduledRules()     │  ← pure function (Architecture §3.2)
                    │  (Clock, Rules, Tasks → Results)
                    │    │                          │
                    │    ▼                          │
                    │  For each due rule:           │
                    │    update lastEvaluatedAt     │
                    │    emit schedule.fired event ─┼──▶ AutomationService.handleEvent()
                    │                               │     (existing cascade pipeline)
                    └───────────────────────────────┘
```

Key architectural decisions (from Architecture RFC):

1. **SchedulerService as a peer to AutomationService**, not a child. Both consume rules from the same repository. SchedulerService produces synthetic `schedule.fired` domain events that feed into AutomationService (Architecture §4.1–4.2).

2. **Schedule evaluation is pure.** `evaluateScheduledRules(nowMs, rules, tasks)` returns a list of rules to execute. No side effects. Testable with fast-check. See Architecture §3.2 for full implementation.

3. **Schedule state lives on the rule entity** (`lastEvaluatedAt` on the trigger), not in a separate store. Follows the co-location principle — no new localStorage keys (Architecture §5.1).

4. **Injectable Clock abstraction.** `SystemClock` in production, `FakeClock` in tests. No `Date.now()` calls in scheduler logic (Architecture §3.1).

5. **Leader election wraps scheduler lifecycle.** `SchedulerLeaderElection` calls `start()`/`stop()` on `SchedulerService` based on BroadcastChannel coordination (Architecture §5.3).

For full schema definitions, evaluation functions, service implementation, and integration wiring, see Architecture RFC §2–5 and Appendix D.

---

## 9. Design Decisions — All Resolved

### 9.1 Resolved (by Architecture RFC and QA Analysis)

| # | Original Question | Resolution | Source |
|---|-------------------|-----------|--------|
| 1 | Should scheduled rules share the same `AutomationRule` schema or use a separate entity? | **Shared schema with discriminated union.** Scheduled triggers are variants of `TriggerSchema`, not a separate entity. Keeps the system unified — one repository, one UI, one rule engine with branching logic. | Architecture §2.3 |
| 2 | Should `create_card` actions in scheduled rules deduplicate? | **No dedup in MVP.** Each execution creates a new task. Phase 5b adds per-rule catch-up policy (`catch_up_latest` vs `catch_up_all`) which indirectly controls duplicate creation on catch-up. A "only if no matching task exists" option is a Phase 5c consideration. | QA §1.3, §1.5 |
| 3 | How do we handle the scheduler tick when multiple projects have scheduled rules? | **Scan all projects on each tick.** Rules should fire regardless of which project is open. The Architecture's `evaluateScheduledRules` iterates all rules from the repository. Performance is acceptable — see §4.10. | Architecture §3.3 |
| 4 | Should we expose a "Run Now" button for scheduled rules? | **Yes, low effort.** Calls the same execution path with `now` as the reference time. Ship in Phase 5a as a developer/debug tool; promote to user-facing in Phase 5b alongside dry-run preview. | Architecture §3.3 (tick is callable) |
| 5 | What's the minimum interval we allow? | **5 minutes** (Architecture §2.2: `intervalMinutes: z.number().int().min(5).max(10080)`). Shorter intervals waste CPU and confuse users. | Architecture §2.2 |
| 6 | Catch-up policy: run all missed or run once? | **Run once (at-most-once-per-window).** See Decision #1 in §5. | Architecture §3.2 |
| 7 | Schedule storage format? | **Structured fields with discriminated union.** See Decision #2 in §5. | Architecture §2.2 |
| 8 | Time reference: local or UTC? | **Local time.** See Decision #3 in §5. | Architecture §6.4 |
| 9 | Cross-tab coordination? | **BroadcastChannel leader election.** See Decision #4 in §5. | Architecture §5.3 |

### 9.2 Resolved — Final Decisions (cross-doc consensus)

All items below have been promoted from recommendations to final decisions based on consensus across Architecture, PM, and QA analysis.

| # | Question | Final Decision | Phase |
|---|----------|---------------|-------|
| 1 | **Filter requirement for interval/cron triggers** | **Action-dependent.** Require ≥1 filter for task-targeting actions (move, complete, set date). Allow filterless for `create_card`. UI shows warning if no filters on task-targeting action: "This rule will affect ALL tasks in the project on every run." | 5a |
| 2 | **Max scheduled rules per project** | **12 per project.** Compromise between Architecture's 10 and PM's 15. Covers realistic power-user workflows (3 daily + 3 weekly + 3 monthly + 3 relative). Revisit based on adoption data. | 5a |
| 3 | **Dedup set scope** | **Shared per `tick()` call.** One dedup set spans all rules and their cascades within a single scheduled evaluation pass. Prevents cascade amplification while allowing different rules to independently act on the same task. | 5a |
| 4 | **Execution log format** | **One aggregated entry per scheduled run.** Add `matchCount: number` and `details?: string[]` to `ExecutionLogEntrySchema`. Push ONE entry per scheduled pass with first 10 task names in `details`. The 20-entry cap now covers 20 runs (weeks of history). | 5a |
| 5 | **Import/export version field** | **Yes.** Add `schemaVersion: number` to export format. On import, warn if version is newer. Mark rules with unsupported trigger types as broken with `brokenReason: 'unsupported_trigger'` instead of silently dropping them. | 5a |
| 6 | **"Last day of month" support** | **Phase 5a** (promoted from 5c). Small fix in `findMostRecentCronMatch`: if `daysOfMonth` contains a value > last day of current month, treat as last day. Prevents "rule only fires 7 months/year" bug. | 5a |
| 7 | **Per-rule catch-up policy** | **Phase 5b.** MVP ships with `catch_up_latest` as the only behavior. Phase 5b adds `skip_missed` as an opt-in toggle. `catch_up_all` is rejected (Architecture §13.1 — stale filter context, unbounded blast radius). | 5b |
| 8 | **Cooldown / "ignore recently touched"** | **Defer.** Document as known interaction. Users work around it with `not_modified_in(N, minutes)` filter in Phase 5b. No cooldown mechanism in MVP. | Post-5b |

> All previous "PM DISAGREES" callouts are resolved: filter requirement adopted PM's action-dependent position; rule cap compromised at 12.

---

## 10. Recommendation

Ship Phase 5a (MVP) with:
- All 3 schedule trigger types: `scheduled_interval`, `scheduled_cron`, `scheduled_due_date_relative`
- Discriminated union `TriggerSchema` (backward-compatible, zero migration)
- Tick-based scheduler with 60-second interval and injectable Clock
- BroadcastChannel leader election for multi-tab safety
- Catch-up on app open (at-most-once per rule)
- Tab visibility awareness (pause in background, catch-up on foreground)
- Summary toast notification strategy for scheduled executions
- `is_complete` / `is_incomplete` filters (trivial, high value)
- Clear UX messaging about client-side limitations
- "Run Now" button for testing scheduled rules

This gives users the three most valuable patterns: daily triage automation (cron), due-date-based escalation (relative), and recurring task creation (cron/interval). The architecture supports weekly/monthly/one-time as configuration variations of `scheduled_cron`, not new trigger types.

The biggest risk is user expectations. A scheduled rule that "doesn't run" because the tab was closed will feel broken. Invest heavily in the catch-up mechanism and in transparent UI communication about when rules last ran and when they'll run next.

The second biggest risk is cascade amplification (§4.5). A scheduled rule touching 50 tasks that triggers 3 event-driven rules creates 150 actions. The dedup + depth limits prevent system failure, but the UX can be confusing. The summary toast (§4.9) and aggregated execution log (§9.2 Decision 4) are essential mitigations.
