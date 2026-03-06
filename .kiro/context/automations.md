<!-- v1 | last-verified: 2025-07-15 -->
# Automations

Rule-based "if this, then that" engine for task management. Rules are scoped to projects or global (cross-project). Two trigger families: event-driven (domain events from user actions) and scheduled (interval, cron, due-date-relative, one-time). Filters narrow which tasks match. Actions mutate tasks/sections. Cascades up to depth 5 with dedup. Undo within 10s. Pure evaluation layer, side-effecting execution layer.

## Overview

The automations subsystem is the most complex feature module. It spans 5 service sub-modules (evaluation, execution, scheduler, preview, rules), a dedicated repository with independent localStorage key, 30+ filter types, 7 action types, 11 trigger types, and a multi-tab leader-elected scheduler. The architecture enforces a strict separation: evaluation is pure (no side effects), execution is side-effecting (writes to repos, emits events), and the scheduler is a tick-loop coordinator.

| Aspect | Design Choice |
|--------|--------------|
| Scope | Project-scoped (`projectId` set) or global (`projectId: null`) |
| Execution order | Global rules fire first (baseline), project rules fire second (override/last word) |
| Subtask exclusion | `evaluateRules` skips events where `parentTaskId !== null` — by design |
| Loop protection | Cascade depth limit (default 5) + dedup set (`ruleId:entityId:actionType`) |
| Storage | Own localStorage key `task-management-automations`, NOT managed by `LocalStorageBackend.reset()` |
| Validation | Zod schemas on every read/write; migration layer for schema evolution |

## Trigger Types

### Event Triggers

Fired by domain events emitted from `dataStore` mutations.

| Trigger Type | Domain Event | Match Condition |
|-------------|-------------|-----------------|
| `card_moved_into_section` | `task.updated` | `changes.sectionId === trigger.sectionId` |
| `card_moved_out_of_section` | `task.updated` | `previousValues.sectionId === trigger.sectionId` |
| `card_marked_complete` | `task.updated` | `changes.completed === true && prev === false` |
| `card_marked_incomplete` | `task.updated` | `changes.completed === false && prev === true` |
| `card_created_in_section` | `task.created` | `changes.sectionId === trigger.sectionId` |
| `section_created` | `section.created` | Always matches (no filter eval) |
| `section_renamed` | `section.updated` | `changes.name !== previousValues.name` |

### Scheduled Triggers

Fired by the scheduler tick loop (60s interval). Each has a `lastEvaluatedAt` timestamp and optional `catchUpPolicy`.

| Trigger Type | Schedule Config | Behavior |
|-------------|----------------|----------|
| `scheduled_interval` | `intervalMinutes` (5–10080) | Fire when elapsed ≥ interval since lastEvaluatedAt |
| `scheduled_cron` | `hour`, `minute`, `daysOfWeek[]`, `daysOfMonth[]` | Backward search up to 7 days for most recent match |
| `scheduled_due_date_relative` | `offsetMinutes` (can be negative) | Fire for tasks whose `dueDate + offset` falls in `(lastEvaluatedAt, now]` |
| `scheduled_one_time` | `fireAt` (ISO datetime) | Fire once when `now ≥ fireAt`; auto-disabled after firing |

Catch-up policies: `catch_up_latest` (fire once for most recent missed window) or `skip_missed` (log "skipped" entry, suppress callback).

## Action Types

| Action Type | Category | Needs Section | Needs Date | Description |
|------------|----------|---------------|------------|-------------|
| `move_card_to_top_of_section` | move | ✓ | | Move task to top of target section |
| `move_card_to_bottom_of_section` | move | ✓ | | Move task to bottom of target section |
| `mark_card_complete` | status | | | Mark task complete (cascades to subtasks) |
| `mark_card_incomplete` | status | | | Mark task incomplete (cascades to subtasks) |
| `set_due_date` | dates | | ✓ | Set due date using RelativeDateOption |
| `remove_due_date` | dates | | | Clear due date to null |
| `create_card` | create | ✓ | optional | Create new task with title template + optional due date |


### Title Template Engine (create_card)

Supports `{{date}}` (YYYY-MM-DD), `{{day}}` (alias), `{{weekday}}` (Sunday–Saturday), `{{month}}` (January–December). Unrecognized `{{...}}` left as-is. Requires injectable `Clock` for deterministic testing.

### Create Card Dedup

Heuristic dedup prevents duplicate task creation on catch-up/crash recovery. Checks if same title exists in target section within lookback window:
- Interval: `(intervalMinutes - 1) * 60s` (min 60s)
- Cron/due-date-relative: 24 hours

## Filter System

Filters are optional AND-logic conditions on the target task. 30+ filter types in 6 categories.

### Filter Categories

| Category | Filter Types | Parameters |
|----------|-------------|------------|
| Section | `in_section`, `not_in_section` | `sectionId` |
| Due date simple | `has_due_date`, `no_due_date`, `is_overdue`, `due_today`, `due_tomorrow`, `due_this_week`, `due_next_week`, `due_this_month`, `due_next_month` | none |
| Due date negated | `not_due_today`, `not_due_tomorrow`, `not_due_this_week`, `not_due_next_week`, `not_due_this_month`, `not_due_next_month` | none |
| Due date relative | `due_in_less_than`, `due_in_more_than`, `due_in_exactly`, `due_in_between` | `value`, `unit` (days/working_days), `minValue`/`maxValue` for between |
| Completion | `is_complete`, `is_incomplete` | none |
| Age-based | `created_more_than`, `completed_more_than`, `last_updated_more_than`, `not_modified_in`, `overdue_by_more_than` | `value`, `unit` |
| Section duration | `in_section_for_more_than` | `value`, `unit` |

Filter units: `days` or `working_days` (Mon–Fri, no holidays).

## Architecture

### Service Layers

```
AutomationService (orchestrator)
├── Evaluation (pure)
│   ├── ruleEngine.ts         — buildRuleIndex(), evaluateRules(), createRuleAction()
│   ├── filterPredicates.ts   — evaluateFilters(), 30+ filter predicates
│   ├── scopeFilter.ts        — isRuleActiveForProject() (global scope modes)
│   └── dateCalculations.ts   — calculateRelativeDate() (80+ date options)
├── Execution (side-effecting)
│   ├── ruleExecutor.ts       — executeActions(), section guard, execution logging
│   ├── actionHandlers.ts     — Strategy pattern: 7 handlers (execute/describe/undo)
│   ├── undoService.ts        — snapshot stack, 10s expiry, performUndo/performUndoById
│   ├── sectionResolver.ts    — findSectionByName() for global rules
│   ├── createCardDedup.ts    — shouldSkipCreateCard(), getLookbackMs()
│   └── titleTemplateEngine.ts — interpolateTitle() with {{date}}/{{weekday}}/{{month}}
├── Scheduler
│   ├── schedulerService.ts   — tick loop (60s), catch-up, visibility handler, Run Now
│   ├── scheduleEvaluator.ts  — pure evaluation for all 4 schedule types
│   ├── schedulerLeaderElection.ts — BroadcastChannel multi-tab coordination
│   ├── bulkScheduleService.ts — pauseAllScheduled/resumeAllScheduled
│   ├── cronExpressionParser.ts — cron parsing utilities
│   └── clock.ts              — SystemClock/FakeClock abstraction
├── Preview
│   ├── rulePreviewService.ts — buildPreviewParts(), runGlobalDryRun()
│   ├── ruleMetadata.ts       — TRIGGER_META, ACTION_META, FILTER_META constants
│   ├── formatters.ts         — human-readable formatting
│   ├── scheduleDescriptions.ts — describeSchedule() for trigger descriptions
│   ├── toastMessageFormatter.ts — formatAutomationToastMessage()
│   └── logFilterService.ts   — execution log filtering
└── Rules (lifecycle)
    ├── ruleFactory.ts        — createRuleWithMetadata(), createFromProjectRule() (promote)
    ├── ruleSaveService.ts    — buildRuleUpdates(), buildNewRuleData() from wizard state
    ├── brokenRuleDetector.ts — detectBrokenRules() on section delete
    ├── dryRunService.ts      — dryRunScheduledRule() (pure, no side effects)
    ├── duplicateDetector.ts  — findDuplicateGlobalRule() (trigger+action+filters match)
    ├── ruleDuplicator.ts     — duplicateRuleToProject() with section name remapping
    ├── ruleImportExport.ts   — validateImportedRules() (section refs, trigger types)
    ├── ruleValidation.ts     — validateOneTimeReEnable() (past fireAt guard)
    ├── scopeCleanup.ts       — cleanExcludedProjectIds() on scope change
    ├── sectionReferenceCollector.ts — collectSectionReferences() (trigger+action+filters)
    ├── sectionUtils.ts       — section utility functions
    └── skipSelectors.ts      — countGlobalRulesWithActiveSkips() for sidebar badge
```

### Event Flow: User Action → Rule Execution

```
User action (e.g., drag task to section)
→ dataStore.updateTask() captures previousValues
→ taskRepository.update() writes to localStorage
→ emitDomainEvent() wrapped in beginBatch()/endBatch()
→ AutomationService.handleEvent(event, depth=0)
  → Collect rules: globalRules (excl. excluded projects) + projectRules
  → evaluateRules() (pure): buildRuleIndex → match triggers → evaluate filters → createRuleAction[]
  → filterDuplicateActions() via dedup set
  → capturePreExecutionSubtasks() for undo
  → RuleExecutor.executeActions(): handler.execute() per action → domain events
  → buildUndoSnapshots() (conflicting moves: first rule's previousValues + last rule's ID)
  → notifyRuleExecutions() → toast callbacks (batch or individual)
  → Cascade: handleEvent(newEvent, depth+1) for each produced event
```

### Event Flow: Scheduled Rule Execution

```
SchedulerService.tick() (every 60s or on visibility change)
→ evaluateScheduledRules() (pure): check all 4 schedule types
→ For each rule that should fire:
  → updateLastEvaluatedAt() BEFORE callback (crash recovery ordering)
  → Check catchUpPolicy: skip_missed → log "skipped" entry, continue
  → onRuleFired callback → builds synthetic schedule.fired DomainEvent
  → AutomationService.handleEvent() with schedule.fired event
    → ruleEngine matches the specific firedRuleId
    → For interval/cron: apply to ALL matching tasks (or single create_card)
    → For due_date_relative: apply to specific task IDs from evaluation
  → Auto-disable one-time rules after firing
→ updateNonFiredRules() to prevent stale catch-up windows
→ onTickComplete callback for summary notifications
```

### Multi-Tab Leader Election

Only one browser tab runs the scheduler tick loop. Protocol:
1. On init: broadcast `claim` with random tab ID via BroadcastChannel
2. 2-second claim window: lower ID wins, higher ID yields
3. Leader sends `heartbeat` every 30s
4. If no heartbeat for 60s: re-elect
5. On `beforeunload`: broadcast `resign`, other tabs re-elect
6. Fallback: if BroadcastChannel unavailable, assume leadership immediately


## Global Rules

Rules with `projectId: null` apply across projects. Key differences from project-scoped rules:

| Aspect | Project-Scoped | Global |
|--------|---------------|--------|
| Section references | By ID (direct) | By name (resolved at runtime per project) |
| Scope control | Implicit (own project) | `scope: 'all'/'selected'/'all_except'` + `excludedProjectIds`/`selectedProjectIds` |
| Execution order | Fires second (override) | Fires first (baseline) |
| Section guard | None | `checkSectionExists()` — skips + logs if section name not found in firing project |
| Duplicate detection | N/A | `findDuplicateGlobalRule()` checks trigger+action+filters match |
| Promote from project | N/A | `createFromProjectRule()` with `by_name` or `source_project_only` resolution |
| Scheduled triggers | Supported | Deferred to Phase 3 (filtered out in scheduler) |

### Scope Modes

| Mode | Behavior |
|------|----------|
| `all` | All projects minus `excludedProjectIds` |
| `all_except` | Alias for `all` |
| `selected` | Only projects in `selectedProjectIds` |

## Undo System

In-memory snapshot stack with 10-second expiry window. Each executed action gets its own snapshot.

| Constant | Value | Purpose |
|----------|-------|---------|
| `UNDO_EXPIRY_MS` | 10,000 ms | Window for undo availability |
| Stack behavior | LIFO | Most recent action undone first |

Key behaviors:
- `pushUndoSnapshot()` adds to stack during batch execution
- `performUndoById(ruleId)` undoes a specific rule's action, leaves others
- `clearAllUndoSnapshots()` called at start of each new event handling
- Conflicting moves on same entity: first rule's `previousValues` (true original) + last rule's ID (for toast wiring)
- `mark_card_complete`/`incomplete` undo includes `subtaskSnapshots` for cascade revert
- `create_card` undo deletes the created task

## Broken Rule Detection

When a section is deleted, `detectBrokenRules()` scans all project rules:
1. `collectSectionReferences(rule)` gathers all section IDs from trigger, action, and filters
2. If any reference matches the deleted section ID → `enabled: false`, `brokenReason: 'section_deleted'`
3. On rule edit: if all section refs become valid again → `brokenReason: null`, `enabled: true`

Other broken reasons: `'unsupported_trigger'` (from import validation).

## Rule Lifecycle

### Creation

`ruleFactory.createRuleWithMetadata()` generates: UUID id, ISO timestamps, `executionCount: 0`, `order: maxOrder + 1`.

### Save from Wizard

`ruleSaveService.buildNewRuleData()` / `buildRuleUpdates()` constructs rule data from wizard state (`TriggerConfig` + `ActionConfig` + filters). Auto-generates name from preview parts if user leaves name blank.

### Duplication

`ruleDuplicator.duplicateRuleToProject()` copies a rule to another project with section name remapping. If any section name doesn't match in target → `brokenReason: 'section_deleted'`, `enabled: false`.

### Import/Export

`ruleImportExport.validateImportedRules()`:
- Unsupported trigger types → `brokenReason: 'unsupported_trigger'`
- Scheduled rules → `lastEvaluatedAt` reset to null
- Invalid section references → `brokenReason: 'section_deleted'`

## Repository

| Property | Value |
|----------|-------|
| Interface | `AutomationRuleRepository extends Repository<AutomationRule>` |
| Implementation | `LocalStorageAutomationRuleRepository` |
| Storage key | `task-management-automations` |
| Extra methods | `findByProjectId(projectId)`, `findGlobal()` |
| Validation | Zod parse on every `create()` and `update()` |
| Migration | `migrateRule()` adds missing fields (filters, recentExecutions, action fields) |
| Listeners | Subscriber pattern — `subscribe(callback)` returns unsubscribe fn |

Critical: This repository uses its own localStorage key, independent from `LocalStorageBackend`. `reset()` does NOT clear automation rules. Import/export must handle rules separately.

## Execution Logging

Each rule stores up to 20 `recentExecutions` entries (trimmed FIFO).

| Field | Type | Purpose |
|-------|------|---------|
| `timestamp` | ISO string | When the execution occurred |
| `triggerDescription` | string | Human-readable trigger description |
| `actionDescription` | string | Human-readable action description |
| `taskName` | string | Name of affected task |
| `matchCount` | number? | For scheduled: number of tasks affected |
| `details` | string[]? | For scheduled: first 10 task names |
| `executionType` | enum? | `event`, `scheduled`, `catch-up`, `manual`, `skipped`, `warning` |
| `isGlobal` | boolean? | Whether this was a global rule execution |
| `skipReason` | string? | Why the rule was skipped (section not found) |

## Tuning Constants

```
MaxCascadeDepth:         5 — maximum recursion depth for cascading rule evaluation
UndoExpiryMs:            10,000 ms — window for undo availability after rule execution
SchedulerTickMs:         60,000 ms — scheduler evaluation interval
LeaderHeartbeatMs:       30,000 ms — leader election heartbeat interval
LeaderTimeoutMs:         60,000 ms — re-elect if no heartbeat received
LeaderClaimWindowMs:     2,000 ms — claim window for leader election
MaxRecentExecutions:     20 — max execution log entries per rule
IntervalMinRange:        5–10,080 min — interval schedule range (5 min to 7 days)
CronLookbackDays:        7 — backward search window for cron match
DueDateLookbackMs:       60,000 ms — lookback on first due-date-relative eval
CreateCardDedupCron:     86,400,000 ms (24h) — dedup lookback for cron/due-date triggers
RuleNameMaxLength:       200 — max characters for rule name
CardTitleMaxLength:      200 — max characters for card title
```


## UI Components

### Wizard (Rule Creation/Edit)

| Component | Purpose |
|-----------|---------|
| `RuleDialog.tsx` | Multi-step wizard dialog (scope → trigger → filters → action → review) |
| `RuleDialogStepScope.tsx` | Global scope configuration (all/selected/all_except) |
| `RuleDialogStepTrigger.tsx` | Trigger type + section/schedule selection |
| `RuleDialogStepFilters.tsx` | Optional AND-logic filter configuration |
| `RuleDialogStepAction.tsx` | Action type + parameters (section, date, title) |
| `RuleDialogStepReview.tsx` | Preview summary before save |
| `ScopeChangeConfirmDialog.tsx` | Confirmation when changing rule scope |
| `SectionResolutionStep.tsx` | Section resolution for promote-to-global |

### Schedule Components

| Component | Purpose |
|-----------|---------|
| `ScheduleConfigPanel.tsx` | Schedule type picker + config (interval/cron/due-date/one-time) |
| `IntervalConfig.tsx` | Interval minutes input |
| `CronConfig.tsx` | Hour/minute + day-of-week/month pickers |
| `DueDateRelativeConfig.tsx` | Offset + unit (before/after due date) |
| `OneTimeConfig.tsx` | Date-time picker for one-time fire |
| `DryRunDialog.tsx` | Preview matching tasks for scheduled rules |
| `GlobalDryRunDialog.tsx` | Dry-run across all projects for global rules |
| `ScheduleHistoryView.tsx` | Execution history for scheduled rules |

### Main Components

| Component | Purpose |
|-----------|---------|
| `AutomationTab.tsx` | Main tab: rule list, create/edit/delete, bulk operations |
| `RuleCard.tsx` | Individual rule display with enable/disable toggle |
| `RuleCardExecutionLog.tsx` | Inline execution log for a rule |
| `RulePreview.tsx` | Human-readable rule summary |
| `FilterRow.tsx` | Single filter row in wizard |
| `SectionPicker.tsx` | Section dropdown for trigger/action/filter |
| `DateOptionSelect.tsx` | Date option dropdown (80+ options) |
| `SectionContextMenuItem.tsx` | Context menu item for quick rule creation from section |
| `GlobalAutomationsPanel.tsx` | Global rules management panel |
| `GlobalRuleCard.tsx` | Global rule card with scope display |
| `GlobalRulesBadge.tsx` | Badge showing global rule count |
| `GlobalRulesSection.tsx` | Section in AutomationTab for global rules |
| `GlobalSectionNamePicker.tsx` | Section name picker for global rules (name-based) |
| `ProjectPickerDialog.tsx` | Project selection for scope configuration |
| `PromoteConfirmDialog.tsx` | Confirmation for promote-to-global |
| `ScopePill.tsx` | Visual scope indicator pill |
| `SectionMismatchWarning.tsx` | Warning when section name doesn't match |
| `ExecutionLogFilterBar.tsx` | Filter bar for execution log table |
| `ExecutionLogTable.tsx` | Tabular execution log display |
| `DuplicateGlobalRuleWarning.tsx` | Warning when creating duplicate global rule |

### Hooks

| Hook | Purpose |
|------|---------|
| `useAutomationRules` | CRUD operations for project-scoped rules |
| `useGlobalAutomationRules` | CRUD operations for global rules |
| `useWizardState` | Wizard state machine: steps, validation, dirty tracking, navigation |
| `useRuleActions` | Dry-run, run-now, bulk schedule operations |
| `useUndoAutomation` | Undo toast with 10s countdown |
| `useSchedulerInit` | Initialize scheduler with leader election on mount |
| `useExecutionLogFilters` | Filter state for execution log table |
| `useGlobalDryRun` | Global dry-run across all projects |
| `useGlobalAutomationSkipCount` | Skip count for sidebar badge |
| `usePromoteToGlobal` | Promote project rule to global |

## Testing

### Unit Tests

Run all automation tests:
```bash
npx vitest run --reporter=verbose features/automations/
```

Key test files:
- `ruleEngine.test.ts` — evaluation logic, trigger matching, filter evaluation
- `actionHandlers.test.ts` — all 7 action handlers (execute, describe, undo)
- `automationService.test.ts` — orchestration, batching, cascade, dedup
- `automationService.global.test.ts` — global rule execution, scope filtering
- `scheduleEvaluator.property.test.ts` — property-based tests for schedule evaluation
- `ruleExecutor.sectionGuard.test.ts` — section guard for global rules
- `schemas.test.ts` — Zod schema validation

### E2E Tests

```bash
npx playwright test e2e/automation-rules.spec.ts
npx playwright test e2e/scheduled-triggers.spec.ts
```

### Regression Scenarios

1. **Cascade loop**: Create two rules that trigger each other → verify depth limit stops at 5
2. **Dedup**: Same rule + same entity + same action type → verify only executes once
3. **Subtask exclusion**: Create subtask, trigger parent rule → verify subtask events ignored
4. **Broken rule**: Delete section referenced by rule → verify rule disabled with `brokenReason`
5. **Global section mismatch**: Global rule references section name not in firing project → verify skip + log
6. **Undo expiry**: Execute rule, wait >10s → verify undo unavailable
7. **Multi-tab**: Open two tabs → verify only one runs scheduler (leader election)
8. **One-time auto-disable**: Create one-time rule, let it fire → verify `enabled: false`
9. **Create card dedup**: Scheduled create_card, force catch-up → verify no duplicate task

## Critical Gotchas

- **beginBatch/endBatch required**: Every domain event emission in `dataStore` MUST be wrapped. Missing this causes individual toasts per task instead of aggregated "ran on N tasks" toast.
- **AutomationRuleRepository independent storage**: Own key `task-management-automations`. `LocalStorageBackend.reset()` does NOT clear rules. Import/export must handle separately.
- **Global rules use sectionName, not sectionId**: Section resolution happens at runtime via `findSectionByName()`. If project doesn't have a matching section name, the action is skipped (not errored).
- **Execution order matters**: Global rules fire first, project rules fire second. Project rules have the last word on the same entity.
- **Scheduled global triggers deferred**: Phase 1 filters out global rules in `schedulerService.tick()`. Only project-scoped scheduled rules run.
- **One-time rule re-enable guard**: `validateOneTimeReEnable()` blocks re-enabling with past `fireAt`. UI must enforce this.
- **Conflicting move undo**: When multiple rules move the same entity, undo uses the FIRST rule's `previousValues` (true original state) but the LAST rule's ID (for toast button wiring).

## Key Files

| File | Description |
|------|-------------|
| `features/automations/schemas.ts` | Zod schemas — canonical entity definitions |
| `features/automations/types.ts` | TypeScript types inferred from schemas + type guards |
| `features/automations/index.ts` | Barrel exports — public API |
| `features/automations/repositories/types.ts` | AutomationRuleRepository interface |
| `features/automations/repositories/localStorageAutomationRuleRepository.ts` | localStorage implementation + migration |
| `features/automations/services/automationService.ts` | Orchestrator: event handling, batching, cascade, undo |
| `features/automations/services/configTypes.ts` | Shared TriggerConfig/ActionConfig types |
| `features/automations/services/evaluation/ruleEngine.ts` | Pure rule evaluation + index building |
| `features/automations/services/evaluation/filterPredicates.ts` | 30+ filter predicates with AND logic |
| `features/automations/services/evaluation/scopeFilter.ts` | Global rule scope filtering |
| `features/automations/services/evaluation/dateCalculations.ts` | 80+ relative date calculations |
| `features/automations/services/execution/ruleExecutor.ts` | Action execution + section guard + logging |
| `features/automations/services/execution/actionHandlers.ts` | Strategy pattern: 7 action handlers |
| `features/automations/services/execution/undoService.ts` | Undo snapshot stack (10s expiry) |
| `features/automations/services/execution/sectionResolver.ts` | Section name → ID resolution |
| `features/automations/services/execution/createCardDedup.ts` | Create card dedup heuristic |
| `features/automations/services/execution/titleTemplateEngine.ts` | Title template interpolation |
| `features/automations/services/scheduler/schedulerService.ts` | Tick loop, catch-up, Run Now |
| `features/automations/services/scheduler/scheduleEvaluator.ts` | Pure schedule evaluation (4 types) |
| `features/automations/services/scheduler/schedulerLeaderElection.ts` | BroadcastChannel multi-tab leader |
| `features/automations/services/scheduler/bulkScheduleService.ts` | Bulk pause/resume scheduled rules |
| `features/automations/services/scheduler/clock.ts` | SystemClock/FakeClock abstraction |
| `features/automations/services/preview/rulePreviewService.ts` | Preview parts + global dry-run |
| `features/automations/services/preview/ruleMetadata.ts` | TRIGGER_META, ACTION_META, FILTER_META |
| `features/automations/services/preview/toastMessageFormatter.ts` | Toast message formatting |
| `features/automations/services/preview/logFilterService.ts` | Execution log filtering |
| `features/automations/services/rules/ruleFactory.ts` | Rule creation + promote-to-global |
| `features/automations/services/rules/ruleSaveService.ts` | Wizard state → rule data conversion |
| `features/automations/services/rules/brokenRuleDetector.ts` | Broken rule detection on section delete |
| `features/automations/services/rules/dryRunService.ts` | Pure dry-run simulation |
| `features/automations/services/rules/duplicateDetector.ts` | Global rule duplicate detection |
| `features/automations/services/rules/ruleDuplicator.ts` | Cross-project rule duplication |
| `features/automations/services/rules/ruleImportExport.ts` | Import validation |
| `features/automations/services/rules/ruleValidation.ts` | One-time re-enable guard |
| `features/automations/services/rules/scopeCleanup.ts` | Scope change cleanup |
| `features/automations/services/rules/sectionReferenceCollector.ts` | Section reference collection |
| `features/automations/services/rules/skipSelectors.ts` | Skip count for sidebar badge |
| `features/automations/components/AutomationTab.tsx` | Main automation tab UI |
| `features/automations/components/wizard/RuleDialog.tsx` | Multi-step rule wizard |
| `features/automations/hooks/useWizardState.ts` | Wizard state machine hook |
| `features/automations/hooks/useRuleActions.ts` | Rule action operations hook |
| `lib/events/domainEvents.ts` | Domain event pub/sub |
| `lib/events/types.ts` | DomainEvent interface |

## References

### Source Files
- `features/automations/` — all automation feature code
- `lib/events/domainEvents.ts` — domain event pub/sub that triggers automations
- `lib/events/types.ts` — DomainEvent interface consumed by automations
- `lib/serviceContainer.ts` — composition root where AutomationService is wired
- `stores/dataStore.ts` — emits domain events that trigger automation evaluation

### Related Context Docs
- [core-infrastructure.md](core-infrastructure.md) — persistence layer, domain events, service wiring
- [stores.md](stores.md) — Zustand stores that emit domain events consumed by automations
- [e2e-tests.md](e2e-tests.md) — E2E coverage: automation-rules.spec.ts, scheduled-triggers.spec.ts, global-automations*.spec.ts
