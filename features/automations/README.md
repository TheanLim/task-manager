# Automations Feature

Rule-based automation engine that executes actions when domain events occur. Users create "if this, then that" rules scoped to a project — when a trigger fires and optional filters pass, the system executes the configured action. Scheduled triggers generate events on a timer.

## Quick Reference

| Concept | Location |
|---------|----------|
| Data model & Zod schemas | `schemas.ts`, `types.ts` |
| Orchestrator | `services/automationService.ts` |
| Rule evaluation (pure) | `services/evaluation/ruleEngine.ts` |
| Filter predicates | `services/evaluation/filterPredicates.ts` |
| Date calculations | `services/evaluation/dateCalculations.ts` |
| Action execution (Strategy) | `services/execution/actionHandlers.ts` |
| Rule executor | `services/execution/ruleExecutor.ts` |
| Undo snapshot management | `services/execution/undoService.ts` |
| Scheduler tick loop | `services/scheduler/schedulerService.ts` |
| Schedule evaluator (pure) | `services/scheduler/scheduleEvaluator.ts` |
| Leader election (multi-tab) | `services/scheduler/schedulerLeaderElection.ts` |
| Cron expression parser | `services/scheduler/cronExpressionParser.ts` |
| Bulk pause/resume | `services/scheduler/bulkScheduleService.ts` |
| Clock abstraction | `services/scheduler/clock.ts` |
| Trigger/action metadata | `services/preview/ruleMetadata.ts` |
| Schedule descriptions | `services/preview/scheduleDescriptions.ts` |
| General formatters | `services/preview/formatters.ts` |
| Preview sentence builder | `services/preview/rulePreviewService.ts` |
| Toast message formatting | `services/preview/toastMessageFormatter.ts` |
| Broken rule detection | `services/rules/brokenRuleDetector.ts` |
| Section reference walking | `services/rules/sectionReferenceCollector.ts` |
| Import/export validation | `services/rules/ruleImportExport.ts` |
| Cross-project duplication | `services/rules/ruleDuplicator.ts` |
| Rule factory | `services/rules/ruleFactory.ts` |
| Rule save builder | `services/rules/ruleSaveService.ts` |
| One-time rule validation | `services/rules/ruleValidation.ts` |
| Dry-run preview | `services/rules/dryRunService.ts` |
| Repository (localStorage) | `repositories/localStorageAutomationRuleRepository.ts` |
| React hook | `hooks/useAutomationRules.ts` |
| Rule creation wizard | `components/wizard/RuleDialog.tsx` |
| Rule list UI | `components/AutomationTab.tsx`, `components/RuleCard.tsx` |
| Schedule UI | `components/schedule/` |

## Directory Structure

```
features/automations/
├── services/
│   ├── automationService.ts          # Orchestrator (top-level)
│   ├── evaluation/                   # Pure rule matching & filtering
│   │   ├── ruleEngine.ts
│   │   ├── filterPredicates.ts
│   │   └── dateCalculations.ts
│   ├── execution/                    # Action execution & undo
│   │   ├── actionHandlers.ts         # Strategy pattern registry
│   │   ├── ruleExecutor.ts
│   │   ├── undoService.ts
│   │   ├── createCardDedup.ts
│   │   └── titleTemplateEngine.ts
│   ├── scheduler/                    # Scheduled trigger subsystem
│   │   ├── schedulerService.ts       # Tick loop
│   │   ├── scheduleEvaluator.ts      # Pure evaluation
│   │   ├── schedulerLeaderElection.ts
│   │   ├── cronExpressionParser.ts
│   │   ├── bulkScheduleService.ts
│   │   └── clock.ts
│   ├── preview/                      # Human-readable descriptions
│   │   ├── rulePreviewService.ts     # Preview sentence builder
│   │   ├── ruleMetadata.ts           # Trigger/action/filter metadata
│   │   ├── scheduleDescriptions.ts   # Schedule description formatters
│   │   ├── formatters.ts             # General formatting utilities
│   │   └── toastMessageFormatter.ts
│   └── rules/                        # Rule lifecycle management
│       ├── brokenRuleDetector.ts
│       ├── sectionReferenceCollector.ts
│       ├── ruleImportExport.ts
│       ├── ruleDuplicator.ts
│       ├── ruleFactory.ts            # Entity creation factory
│       ├── ruleSaveService.ts        # Wizard → rule data builder
│       ├── ruleValidation.ts
│       └── dryRunService.ts
├── components/                       # React UI components
│   ├── AutomationTab.tsx             # Rule list + controls
│   ├── RuleCard.tsx                  # Individual rule display
│   ├── RuleCardExecutionLog.tsx      # Execution log inline
│   ├── RulePreview.tsx               # Preview sentence renderer
│   ├── SectionContextMenuItem.tsx    # Context menu integration
│   ├── SectionPicker.tsx             # Section selector
│   ├── DateOptionSelect.tsx          # Date option dropdown
│   ├── FilterRow.tsx                 # Filter condition row
│   ├── ProjectPickerDialog.tsx       # Cross-project picker
│   ├── wizard/                       # Rule creation/edit wizard
│   │   ├── RuleDialog.tsx            # Multi-step dialog
│   │   ├── RuleDialogStepTrigger.tsx
│   │   ├── RuleDialogStepFilters.tsx
│   │   ├── RuleDialogStepAction.tsx
│   │   └── RuleDialogStepReview.tsx
│   └── schedule/                     # Schedule-specific UI
│       ├── ScheduleConfigPanel.tsx   # Coordinator + catch-up toggle
│       ├── IntervalConfig.tsx        # Interval schedule config
│       ├── CronConfig.tsx            # Cron picker/expression config
│       ├── OneTimeConfig.tsx         # One-time date/time config
│       ├── DueDateRelativeConfig.tsx # Due-date-relative config
│       ├── ScheduleHistoryView.tsx
│       └── DryRunDialog.tsx
├── hooks/                            # React hooks
├── repositories/                     # Storage layer
├── schemas.ts                        # Zod schemas (source of truth)
├── types.ts                          # TypeScript types (inferred from schemas)
└── index.ts                          # Public API barrel
```

## Architecture Overview

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full layered architecture diagram.

```
User Action (move task, complete task, etc.)
    │
    ▼
Data Store (stores/dataStore.ts)
    │  emitDomainEvent()
    │  wrapped in beginBatch() / endBatch()
    ▼
AutomationService.handleEvent()
    │
    ├─ evaluateRules() — pure function, matches triggers + filters
    │
    ├─ RuleExecutor.executeActions() — applies actions via ActionHandler strategies
    │     └─ Pushes execution log entry (last 20 kept)
    │
    ├─ Captures undo snapshot (in-memory, 10s expiry, depth 0 only)
    │
    ├─ Dedup check (ruleId:entityId:actionType)
    │
    ├─ Cascade: new events → recursive handleEvent() up to depth 5
    │
    └─ Toast notification (batch-aggregated or individual)
```

## Trigger Types

### Event Triggers

| Trigger | Event | Section Required |
|---------|-------|-----------------|
| `card_moved_into_section` | `task.updated` (sectionId changed) | Yes |
| `card_moved_out_of_section` | `task.updated` (sectionId changed) | Yes |
| `card_marked_complete` | `task.updated` (completed: false→true) | No |
| `card_marked_incomplete` | `task.updated` (completed: true→false) | No |
| `card_created_in_section` | `task.created` | Yes |
| `section_created` | `section.created` | No |
| `section_renamed` | `section.updated` (name changed) | No |

### Scheduled Triggers

| Type | Schedule Kind | Description | Auto-Disable |
|------|--------------|-------------|-------------|
| `scheduled_interval` | `interval` | Fires every N minutes (5 min–7 days) | No |
| `scheduled_cron` | `cron` | Fires at specific times/days | No |
| `scheduled_due_date_relative` | `due_date_relative` | Fires relative to task due dates | No |
| `scheduled_one_time` | `one_time` | Fires once at a specific datetime | Yes |

## Action Types

| Action | What It Does |
|--------|-------------|
| `move_card_to_top_of_section` | Sets task.sectionId, order = min - 1 |
| `move_card_to_bottom_of_section` | Sets task.sectionId, order = max + 1 |
| `mark_card_complete` | Calls TaskService.cascadeComplete(true) |
| `mark_card_incomplete` | Calls TaskService.cascadeComplete(false) |
| `set_due_date` | Calculates date from RelativeDateOption, sets task.dueDate |
| `remove_due_date` | Sets task.dueDate = null |
| `create_card` | Creates a new task in the target section |

## Filter System

Filters are optional AND-logic conditions evaluated after trigger matching. Categories: section membership, date presence, relative date ranges and negations, comparison operators (less than / more than / exactly / between N days/working_days), age-based (created/completed/updated more than N ago), section duration, and overdue status.

## Loop Protection

1. Max cascade depth: 5 (configurable)
2. Dedup set: `ruleId:entityId:actionType` prevents same action firing twice per cascade
3. Subtask exclusion: `evaluateRules` skips events where `parentTaskId` is non-null

## Key Design Decisions

See [DECISIONS.md](./DECISIONS.md) for rationale behind architectural choices.

## Extending This Feature

See [EXTENDING.md](./EXTENDING.md) for step-by-step guides to add triggers, actions, filters, and scheduled trigger types.

## Data Flow & Debugging

See [DATA-FLOW.md](./DATA-FLOW.md) for end-to-end data flow traces and debugging checklists.
