<!-- v1 | last-verified: 2025-07-14 -->
# Core Infrastructure

Persistence, validation, domain events, and service wiring for the task management app. All features depend on this layer — it provides the `Repository<T>` pattern backed by localStorage, Zod schemas as the single source of truth for entity types, a lightweight pub/sub domain event bus, and a composition root (`serviceContainer.ts`) that wires every singleton.

## Overview

The infrastructure follows a layered architecture: Zod schemas define entities → repositories provide CRUD over `LocalStorageBackend` → services encapsulate business logic → `serviceContainer.ts` wires everything as singletons → `dataStore.ts` (Zustand) consumes repositories via subscriptions and emits domain events on mutations. No component ever touches localStorage directly.

## Zod Schemas — Single Source of Truth

All entity types are defined as Zod schemas in `lib/schemas.ts`. TypeScript types are inferred via `z.infer<>`, re-exported from `types/index.ts`.

### Entity Schemas

| Schema | Key Fields | ID Format | Notes |
|--------|-----------|-----------|-------|
| `ProjectSchema` | name (1-200), viewMode, color?, icon? | `.string().min(1)` | |
| `TaskSchema` | description (1-500), priority, tags[], dueDate?, parentTaskId? | `.string().min(1)` | `movedToSectionAt` optional for backward compat |
| `SectionSchema` | name (1-100), projectId?, order, collapsed | `.string()` (no min) | IDs like `${projectId}-section-todo` |
| `TaskDependencySchema` | blockingTaskId, blockedTaskId | `.string().min(1)` | |
| `AppStateSchema` | projects[], tasks[], sections[], dependencies[], tmsState, settings, version | — | Composite; used for load validation |

### Enum Schemas

| Schema | Values |
|--------|--------|
| `PrioritySchema` | `none`, `low`, `medium`, `high` |
| `ViewModeSchema` | `list`, `board`, `calendar` |
| `TimeManagementSystemSchema` | `none`, `dit`, `af4`, `fvp` |
| `AutoHideThresholdSchema` | `24h`, `48h`, `1w`, `show-all`, `always` |

### Composite Schemas

| Schema | Purpose |
|--------|---------|
| `TMSStateSchema` | DIT/AF4/FVP state (today/tomorrow tasks, marked tasks, dotted tasks) |
| `AppSettingsSchema` | UI prefs: activeProjectId, theme, TMS, showOnlyActionable, autoHideThreshold |
| `AppStateSchema` | Full app state — validated on load and import |

Critical: Entity IDs are NOT UUIDs. Section IDs use `${projectId}-section-todo` format. Schemas use `.string().min(1)` (or `.string()` for sections), never `.uuid()`. Using `.uuid()` caused a silent data-wipe bug (Zod validation failed → fallback to empty state → repo writes wiped everything).

### Type Re-exports

`types/index.ts` re-exports Zod-inferred types as canonical types plus runtime enums (`Priority`, `ViewMode`, `TimeManagementSystem`) and future extensibility types (`Comment`, `Attachment`).

## Persistence Layer

### LocalStorageBackend

Central persistence gateway. All entity repositories delegate to this single backend instance.

```
Load priority:
  1. Unified key → AppStateSchema.safeParse()
  2. Fallback: assemble from 3 Zustand persist keys → safeParse()
  3. All fail → getDefaultState() (empty)
```

### Storage Keys

| Key | Purpose | Managed By |
|-----|---------|------------|
| `task-management-app-state` | Unified state (source of truth) | LocalStorageBackend |
| `task-management-data` | Zustand persist (projects, tasks, sections, deps) | Backend dual-write + Zustand |
| `task-management-settings` | Zustand persist (settings, projectTabs) | Backend dual-write + Zustand |
| `task-management-tms` | Zustand persist (TMS state) | Backend dual-write + Zustand |
| `task-management-automations` | Automation rules (independent) | AutomationRuleRepository only |

Critical: `LocalStorageBackend.reset()` does NOT clear automation rules — they use a separate key managed by `AutomationRuleRepository`. Import/export must handle rules separately.

### Dual-Write Strategy

`save()` writes to both the unified key and the 3 Zustand persist keys for backward compatibility. This means Zustand's `persist` middleware and `LocalStorageBackend` both write to the same keys — the backend is the source of truth; Zustand stores are caches synced via repository subscriptions.

### SSR Safety

All localStorage access is guarded with `typeof window === 'undefined'` checks. Returns default empty state during SSR.

### Error Handling

`QuotaExceededError` is caught and re-thrown as a descriptive `Error('localStorage quota exceeded')`. All other errors propagate.

### Listener System

`LocalStorageBackend` maintains a `Map<string, Set<() => void>>` of listeners keyed by AppState field name. `setEntities()` calls `save()` then `notify()`. Repositories use `onEntityChange()` to subscribe, which returns an unsubscribe function.

## Repository Pattern

### Generic Interface

```typescript
interface Repository<T extends { id: string }> {
  findById(id: UUID): T | undefined;
  findAll(): T[];
  create(item: T): void;
  update(id: UUID, updates: Partial<T>): void;
  delete(id: UUID): void;
  replaceAll(items: T[]): void;
  subscribe(callback: SubscriptionCallback<T>): Unsubscribe;
}
```

### Specialized Interfaces

| Interface | Extra Methods |
|-----------|--------------|
| `TaskRepository` | `findByProjectId(id)`, `findByParentTaskId(id)` |
| `ProjectRepository` | (none) |
| `SectionRepository` | `findByProjectId(id \| null)` |
| `DependencyRepository` | `findByBlockingTaskId(id)`, `findByBlockedTaskId(id)` |

### Implementations

All 4 core repositories (`LocalStorageProjectRepository`, `LocalStorageTaskRepository`, `LocalStorageSectionRepository`, `LocalStorageDependencyRepository`) follow the same pattern:
- Constructor takes `LocalStorageBackend`
- CRUD methods delegate to `backend.getEntities(key)` / `backend.setEntities(key, value)`
- `subscribe()` wraps `backend.onEntityChange(key, callback)`
- Immutable updates: spread into new arrays on every mutation

### AutomationRuleRepository (Special Case)

`LocalStorageAutomationRuleRepository` is independent — it manages its own localStorage key (`task-management-automations`), maintains its own in-memory `rules[]` array, and does its own Zod validation (`AutomationRuleSchema.parse()`). It also includes a `migrateRule()` method for schema evolution (Phase 1→3 migration: adds missing `filters[]`, `recentExecutions[]`, action field defaults).

Extra methods: `findByProjectId(id)`, `findGlobal()`.

## Domain Events

Lightweight pub/sub in `lib/events/`. Synchronous — listeners execute inline during `emitDomainEvent()`.

### Event Types

| Type | Emitted When | entityId | changes |
|------|-------------|----------|---------|
| `task.created` | `dataStore.addTask()` | task.id | full task object |
| `task.updated` | `dataStore.updateTask()` | task.id | updated fields |
| `task.deleted` | `dataStore.deleteTask()` | task.id | `{}` |
| `section.created` | `dataStore.addSection()` | section.id | full section object |
| `section.updated` | `dataStore.updateSection()` | section.id | updated fields |
| `schedule.fired` | Scheduler tick matches rule | taskId or ruleId | triggerType + metadata |

### DomainEvent Shape

```typescript
interface DomainEvent {
  type: 'task.created' | 'task.updated' | 'task.deleted' |
        'section.created' | 'section.updated' | 'schedule.fired';
  entityId: string;
  projectId: string;
  changes: Record<string, unknown>;
  previousValues: Record<string, unknown>;
  triggeredByRule?: string;   // set when automation-triggered
  depth: number;              // 0 = user-initiated, increments per cascade
}
```

### API

| Function | Purpose |
|----------|---------|
| `emitDomainEvent(event)` | Broadcast to all listeners (synchronous) |
| `subscribeToDomainEvents(listener)` | Register listener, returns unsubscribe fn |
| `unsubscribeAll()` | Clear all listeners (testing cleanup, HMR guard) |

### Integration with Automations

In `dataStore.ts`, every mutation that emits a domain event is wrapped in `automationService.beginBatch()` / `endBatch()` for aggregated toast notifications. The automation service subscribes via `subscribeToDomainEvents()` at module load time, with an `unsubscribeAll()` guard to prevent HMR listener accumulation.

Flow: `dataStore mutation → emitDomainEvent() → automationService.handleEvent() → evaluateRules() → ruleExecutor.executeActions() → may cascade (depth ≤ 5)`

## Composition Root — serviceContainer.ts

Single wiring point for all singletons. Components never construct services — they import from `serviceContainer` (or via `dataStore` re-exports).

### Instantiation Order

```
1. LocalStorageBackend (loads + validates state)
2. Core Repositories (project, task, section, dependency) — all take backend
3. AutomationRuleRepository (independent, own storage)
4. DependencyResolverImpl
5. TaskService (taskRepo, depRepo, emitDomainEvent)
6. ProjectService (projectRepo, sectionRepo, taskService, taskRepo, automationRuleRepo)
7. SectionService (sectionRepo, taskRepo, automationRuleRepo)
8. DependencyService (depRepo, depResolver)
9. SystemClock
10. RuleExecutor (taskRepo, sectionRepo, taskService, automationRuleRepo, clock)
11. AutomationService (automationRuleRepo, taskRepo, sectionRepo, taskService, ruleExecutor)
12. BulkScheduleService (automationRuleRepo, clock)
13. SchedulerService (clock, automationRuleRepo, taskRepo, onScheduledRuleFired callback)
```

### Exported Singletons

| Export | Type | Notes |
|--------|------|-------|
| `localStorageBackend` | `LocalStorageBackend` | |
| `projectRepository` | `LocalStorageProjectRepository` | |
| `taskRepository` | `LocalStorageTaskRepository` | |
| `sectionRepository` | `LocalStorageSectionRepository` | |
| `dependencyRepository` | `LocalStorageDependencyRepository` | |
| `automationRuleRepository` | `LocalStorageAutomationRuleRepository` | Independent storage |
| `taskService` | `TaskService` | Cascade delete/complete, entity factories |
| `projectService` | `ProjectService` | createWithDefaults, cascade delete |
| `sectionService` | `SectionService` | Cascade delete |
| `dependencyService` | `DependencyService` | Add/remove with circular check |
| `automationService` | `AutomationService` | Event handling, rule evaluation |
| `bulkScheduleService` | `BulkScheduleService` | Bulk schedule operations |
| `schedulerService` | `SchedulerService` | Scheduled trigger ticks |

### Scheduled Rule Callback

`onScheduledRuleFired()` is defined inline in `serviceContainer.ts`. It routes scheduler ticks into `automationService.handleEvent()`:
- Due-date-relative triggers: one `schedule.fired` event per matching task
- Interval/cron triggers: single event with rule ID as entityId
- Global rules (projectId: null) are skipped defensively

## Input Validation

`lib/validation.ts` provides imperative validation for user-facing fields. Throws `ValidationError` (custom error class with `field` and `value` properties).

| Function | Field | Max Length | Rules |
|----------|-------|-----------|-------|
| `validateProjectName` | name | 200 | Non-empty, trimmed |
| `validateTaskDescription` | description | 500 | Non-empty, trimmed |
| `validateSectionName` | name | 100 | Non-empty, trimmed |
| `validateColumnName` | name | 100 | Non-empty, trimmed |

These are separate from Zod schema validation — Zod validates data shape at persistence boundaries; `validation.ts` validates user input at the UI boundary.

## dataStore Integration

`stores/dataStore.ts` is the primary consumer of core infrastructure. It:

1. Imports all singletons from `serviceContainer.ts` and re-exports them
2. Creates a Zustand store with `persist` middleware (key: `task-management-data`)
3. Delegates mutations to repositories/services (not direct state manipulation)
4. Emits domain events wrapped in `beginBatch()`/`endBatch()`
5. Subscribes to all 5 repositories to sync cached state into Zustand
6. Subscribes `automationService` to domain events (with HMR guard)
7. Runs `backfillMovedToSectionAt()` migration on module load

### Write Path

```
Component → dataStore.updateTask(id, updates)
  → captures previousValues from repo
  → taskRepository.update(id, updates)
    → LocalStorageBackend.setEntities() → save() to 4 keys → notify()
    → repo subscription → useDataStore.setState({ tasks })
  → beginBatch() → emitDomainEvent() → endBatch()
    → automationService.handleEvent() → evaluate → execute → may cascade
```

### Read Path

```
App loads → LocalStorageBackend constructor
  → try unified key → AppStateSchema.safeParse()
  → fallback: assemble from 3 Zustand persist keys
  → if all fail → empty default state
→ Zustand persist rehydrates from task-management-data key
→ repo subscriptions sync backend state → Zustand setState
```

## Testing

### Test Files

| File | Coverage |
|------|----------|
| `lib/repositories/localStorage.test.ts` | Property-based: create-read round-trip, subscriber notification, replaceAll |
| `lib/schemas.test.ts` | Property-based: Zod rejects invalid data on load/import, lastActionAt compat, movedToSectionAt |
| `lib/serviceContainer.test.ts` | Singleton existence, interface method checks |
| `lib/validation.test.ts` | (exists) |

### Running Tests

```bash
npm run test:run                              # All tests
npx vitest run lib/repositories               # Repository tests only
npx vitest run lib/schemas.test.ts            # Schema validation tests
npx vitest run lib/serviceContainer.test.ts   # Composition root tests
```

### Property-Based Testing (fast-check)

All core infrastructure tests use `fast-check` with `{ numRuns: 100 }`. Key properties:
- P1: Zod rejects any invalid AppState on load
- P2: Zod rejects any invalid JSON on import
- P3: Repository create → findById round-trip returns equivalent entity
- P4: N mutations → subscriber called exactly N times
- P5: replaceAll → findAll returns exact replacement

## Key Files

| File | Description |
|------|-------------|
| `lib/schemas.ts` | Zod entity schemas, type inference |
| `lib/validation.ts` | User input validation (throws ValidationError) |
| `lib/serviceContainer.ts` | Composition root — all singletons |
| `lib/repositories/types.ts` | Repository<T> interface + specialized interfaces |
| `lib/repositories/localStorageBackend.ts` | Persistence gateway, dual-write, Zod validation on load |
| `lib/repositories/localStorageRepositories.ts` | 4 concrete repository implementations |
| `lib/events/types.ts` | DomainEvent interface |
| `lib/events/domainEvents.ts` | emit, subscribe, unsubscribeAll |
| `lib/events/index.ts` | Barrel export |
| `lib/utils.ts` | Tailwind `cn()` utility (not core infra) |
| `types/index.ts` | Re-exports Zod-inferred types + runtime enums |
| `stores/dataStore.ts` | Primary consumer — Zustand + repo subscriptions + event emission |

## References

### Source Files
- `lib/schemas.ts` — Zod schemas, canonical entity definitions
- `lib/validation.ts` — User input validation
- `lib/serviceContainer.ts` — Composition root
- `lib/repositories/types.ts` — Repository interfaces
- `lib/repositories/localStorageBackend.ts` — Persistence layer
- `lib/repositories/localStorageRepositories.ts` — Repository implementations
- `lib/events/domainEvents.ts` — Domain event pub/sub
- `lib/events/types.ts` — DomainEvent type
- `stores/dataStore.ts` — Zustand store, infrastructure consumer
- `features/automations/repositories/localStorageAutomationRuleRepository.ts` — Independent rule storage

### Related Context Docs
- [stores.md](stores.md) — Zustand stores that consume repositories and emit domain events
- [automations.md](automations.md) — AutomationService, RuleExecutor, SchedulerService wired in serviceContainer; domain events drive rule evaluation
- [ui-shared.md](ui-shared.md) — cn() utility in lib/utils.ts, ErrorBoundary wraps the app
- [e2e-tests.md](e2e-tests.md) — E2E seed fixtures inject data via localStorage keys defined by this layer
