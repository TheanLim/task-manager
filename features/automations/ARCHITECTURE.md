# Automations Architecture Guide

## Layered Architecture

The automations feature follows a strict layered architecture. Each layer depends only on layers below it.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: UI Components                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ components/  │ │ wizard/      │ │ schedule/            │ │
│  │ (shared)     │ │ RuleDialog + │ │ ScheduleConfigPanel, │ │
│  │              │ │ step panels  │ │ IntervalConfig,      │ │
│  │              │ │              │ │ CronConfig,          │ │
│  │              │ │              │ │ OneTimeConfig,       │ │
│  │              │ │              │ │ DueDateRelativeConfig│ │
│  │              │ │              │ │ HistoryView, DryRun  │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  hooks/                                                     │
│  ├── useAutomationRules  — CRUD operations                  │
│  ├── useWizardState      — wizard state machine             │
│  ├── useRuleActions      — dry-run, run-now, bulk ops       │
│  ├── useUndoAutomation   — undo integration                 │
│  └── useSchedulerInit    — scheduler lifecycle              │
│  Depends on: Layer 4, Layer 3, types/schemas                │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Preview & Metadata (services/preview/)            │
│  ┌──────────────────────┐ ┌──────────────────────────────┐  │
│  │ rulePreviewService   │ │ ruleMetadata                 │  │
│  │ (preview sentences)  │ │ (trigger/action/filter meta) │  │
│  ├──────────────────────┤ ├──────────────────────────────┤  │
│  │ scheduleDescriptions │ │ formatters                   │  │
│  │ (schedule text)      │ │ (relative time, dates, etc.) │  │
│  └──────────────────────┘ └──────────────────────────────┘  │
│  Depends on: types/schemas only                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Orchestration (services/automationService.ts)     │
│  Event handling, batch mode, cascade depth, dedup, undo     │
│  Depends on: Layer 2, Layer 1                               │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Execution & Scheduling                            │
│  ┌──────────────────────┐  ┌──────────────────────────┐     │
│  │ services/execution/  │  │ services/scheduler/      │     │
│  │ Action handlers,     │  │ Tick loop, evaluator,    │     │
│  │ rule executor, undo, │  │ leader election, cron,   │     │
│  │ dedup, templates     │  │ bulk ops, clock          │     │
│  └──────────────────────┘  └──────────────────────────┘     │
│  Depends on: Layer 1, repositories                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Evaluation & Rules (pure functions)               │
│  ┌──────────────────────┐  ┌──────────────────────────┐     │
│  │ services/evaluation/ │  │ services/rules/          │     │
│  │ Rule engine, filter  │  │ Broken detection, import │     │
│  │ predicates, dates    │  │ export, duplication, dry  │     │
│  │                      │  │ run, factory, validation, │     │
│  │                      │  │ save builder              │     │
│  └──────────────────────┘  └──────────────────────────┘     │
│  Depends on: types/schemas, repositories (interfaces only)  │
├─────────────────────────────────────────────────────────────┤
│  Layer 0: Domain Model                                      │
│  schemas.ts, types.ts, repositories/                        │
│  No internal dependencies                                   │
└─────────────────────────────────────────────────────────────┘
```

## Sub-Module Responsibilities

### `services/evaluation/` — Pure Rule Matching

All functions are pure (no side effects, no repository writes). Barrel: `index.ts`.

| File | Responsibility |
|------|---------------|
| `ruleEngine.ts` | Matches domain events to rules via trigger type index. Evaluates filters. Returns `RuleAction[]` |
| `filterPredicates.ts` | Predicate functions for each filter type. Date comparison helpers. Negation factory |
| `dateCalculations.ts` | Data-driven relative date parser. Converts `RelativeDateOption` enum values to `Date` objects |

### `services/execution/` — Action Execution & Undo

Applies actions to entities via repositories. Manages undo snapshots. Barrel: `index.ts`.

| File | Responsibility |
|------|---------------|
| `actionHandlers.ts` | Strategy pattern: one handler per action type (execute, describe, undo). `ACTION_HANDLER_REGISTRY` |
| `ruleExecutor.ts` | Iterates `RuleAction[]`, delegates to handlers, updates execution metadata |
| `undoService.ts` | In-memory undo stack (10s expiry). Push/pop/clear snapshots. Per-rule undo |
| `createCardDedup.ts` | Heuristic dedup for `create_card` in scheduled rules |
| `titleTemplateEngine.ts` | `{{date}}`, `{{weekday}}`, `{{month}}` interpolation for card titles |

### `services/scheduler/` — Scheduled Trigger Subsystem

Manages the timer-based evaluation loop for scheduled rules. Barrel: `index.ts`.

| File | Responsibility |
|------|---------------|
| `schedulerService.ts` | 60s tick loop. Evaluates scheduled rules, fires callbacks, handles catch-up |
| `scheduleEvaluator.ts` | Pure functions: `evaluateIntervalSchedule`, `evaluateCronSchedule`, `evaluateDueDateRelativeSchedule`, `evaluateOneTimeSchedule` |
| `schedulerLeaderElection.ts` | BroadcastChannel-based leader election. Only leader tab runs the tick loop |
| `cronExpressionParser.ts` | Parses 5-field cron strings ↔ structured `CronSchedule` objects |
| `bulkScheduleService.ts` | Bulk pause/resume of scheduled rules per project |
| `clock.ts` | Injectable `Clock` interface. `SystemClock` for production, `FakeClock` for tests |

### `services/preview/` — Human-Readable Descriptions

Generates text for UI display. No side effects. Barrel: `index.ts`. Each module is independently importable — import from the canonical module, not through re-exports.

| File | Responsibility |
|------|---------------|
| `rulePreviewService.ts` | Builds "WHEN X IF Y THEN Z" preview sentences. Duplicate detection. Config types (`TriggerConfig`, `ActionConfig`) |
| `ruleMetadata.ts` | `TRIGGER_META`, `ACTION_META`, `FILTER_META` constants with labels, categories, capability flags |
| `scheduleDescriptions.ts` | `describeSchedule`, `computeNextRunDescription` — human-readable schedule text |
| `formatters.ts` | `formatRelativeTime`, `formatDateOption`, `formatFilterDescription` — general formatting |
| `toastMessageFormatter.ts` | Formats toast notification messages for rule executions |

### `services/rules/` — Rule Lifecycle Management

Operations on rules as entities (not execution). Barrel: `index.ts`.

| File | Responsibility |
|------|---------------|
| `brokenRuleDetector.ts` | Scans rules for deleted section references, marks them broken |
| `sectionReferenceCollector.ts` | Walks trigger/action/filters to collect all referenced section IDs |
| `ruleImportExport.ts` | Validates imported rules against available sections. Resets scheduled state |
| `ruleDuplicator.ts` | Cross-project rule duplication with section name remapping |
| `ruleFactory.ts` | Entity creation factory — generates id, timestamps, order |
| `ruleSaveService.ts` | Builds rule data from wizard state |
| `ruleValidation.ts` | Validates one-time rule re-enable (fireAt must be future) |
| `dryRunService.ts` | Previews what a scheduled rule would do without executing |

### `hooks/` — React Hooks

| File | Responsibility |
|------|---------------|
| `useAutomationRules.ts` | CRUD operations for automation rules. Subscribes to repository changes |
| `useWizardState.ts` | Wizard state machine — step navigation, validation, dirty tracking, form state |
| `useRuleActions.ts` | Dry-run preview, run-now, bulk schedule operations, scheduled/event counts |
| `useUndoAutomation.ts` | Undo integration — connects undo snapshots to toast actions |
| `useSchedulerInit.ts` | Scheduler lifecycle — starts/stops scheduler on mount/unmount |

### `components/wizard/` — Rule Creation Wizard

| File | Responsibility |
|------|---------------|
| `RuleDialog.tsx` | Dialog chrome — renders steps, focus management, save orchestration. Delegates state to `useWizardState` |
| `RuleDialogStepTrigger.tsx` | Step 0: trigger type + section selection |
| `RuleDialogStepFilters.tsx` | Step 1: optional filter conditions |
| `RuleDialogStepAction.tsx` | Step 2: action type + parameters |
| `RuleDialogStepReview.tsx` | Step 3: review + confirm |

### `components/schedule/` — Schedule UI

| File | Responsibility |
|------|---------------|
| `ScheduleConfigPanel.tsx` | Coordinator — routes to the correct config component |
| `IntervalConfig.tsx` | Interval schedule: value + unit |
| `CronConfig.tsx` | Cron schedule: picker mode or expression mode |
| `OneTimeConfig.tsx` | One-time schedule: date picker + time selectors |
| `DueDateRelativeConfig.tsx` | Due-date-relative: offset value + unit + direction |
| `ScheduleHistoryView.tsx` | Execution history for scheduled rules |
| `DryRunDialog.tsx` | Dry-run preview dialog |

## Dependency Rules

1. Sub-modules within `services/` may import from sibling sub-modules (e.g., `execution/` imports from `evaluation/dateCalculations`)
2. Sub-modules import `../../types` and `../../schemas` for domain types
3. Sub-modules import `../../repositories/types` for repository interfaces
4. No sub-module imports from `automationService.ts` (the orchestrator imports from them, not vice versa)
5. `preview/` has no dependencies on `execution/` or `scheduler/`
6. `evaluation/` has no dependencies on `execution/`, `scheduler/`, or `rules/`
7. `wizard/` components import shared components from `../` and services from `../../services/`
8. Import from canonical modules: `ruleMetadata.ts` for metadata, `formatters.ts` for formatting, `scheduleDescriptions.ts` for schedule text — not through re-exports

## Import Guidelines for `services/preview/`

| Symbol | Import from |
|--------|------------|
| `TriggerConfig`, `ActionConfig` | `services/configTypes.ts` (canonical) or `rulePreviewService.ts` (re-export) |
| `TRIGGER_META`, `ACTION_META`, `FILTER_META`, `TriggerMeta`, `ActionMeta` | `ruleMetadata.ts` |
| `formatRelativeTime`, `formatDateOption`, `formatFilterDescription` | `formatters.ts` |
| `describeSchedule`, `computeNextRunDescription`, `formatShortDate`, `formatFireAt` | `scheduleDescriptions.ts` |
| `buildPreviewParts`, `buildPreviewString`, `TRIGGER_SECTION_SENTINEL`, `isDuplicateRule`, `PreviewPart` | `rulePreviewService.ts` |

## Integration Points Outside This Feature

| File | What It Does |
|------|-------------|
| `stores/dataStore.ts` | Instantiates AutomationService, wraps mutations in batch mode, emits domain events |
| `app/page.tsx` | Wires toast notifications via callback, includes Undo button logic |
| `lib/serviceContainer.ts` | Creates singletons: RuleExecutor, AutomationService, SchedulerService, BulkScheduleService |
| `features/projects/services/sectionService.ts` | Calls `detectBrokenRules` on section delete |
| `features/projects/services/projectService.ts` | Cascade-deletes automation rules on project delete |
| `features/projects/components/ProjectView.tsx` | Renders AutomationTab and RuleDialog |
| `features/sharing/services/shareService.ts` | Serializes/imports automation rules via `validateImportedRules` |
| `features/tasks/components/TaskList.tsx` | Renders SectionContextMenuItem in section header |
| `features/tasks/components/TaskBoard.tsx` | Renders SectionContextMenuItem in column header |
