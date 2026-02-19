# Cross-Feature Integration Guide

This document maps the dependencies between features and tells you what to update (and test) when changing one feature. Read this before making changes that touch service interfaces, domain events, or repository contracts.

## Dependency Map

```
                    ┌──────────┐
                    │ lib/     │
                    │ events/  │  ← cross-cutting domain event infrastructure
                    └────┬─────┘
                         │ consumed by
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌────────────┐ ┌───────────┐ ┌────────────┐
   │ automations│ │  tasks    │ │  stores/   │
   │ (consumer) │ │ (emitter) │ │ dataStore  │
   └──────┬─────┘ └─────┬─────┘ └────────────┘
          │              │
          │    ┌─────────┼─────────┐
          ▼    ▼         ▼         ▼
   ┌────────────┐ ┌───────────┐ ┌──────────┐
   │  projects  │ │ keyboard  │ │ sharing  │
   └────────────┘ └───────────┘ └──────────┘
```

### Who imports from whom

| Feature | Imports from | What it uses |
|---|---|---|
| **projects** | tasks | TaskService, TaskList, TaskBoard, TaskCalendar, useFilteredTasks |
| **projects** | automations | AutomationTab, RuleDialog, SectionContextMenuItem, detectBrokenRules, AutomationRuleRepository |
| **projects** | sharing | ShareButton |
| **tasks** | automations | SectionContextMenuItem, TriggerType |
| **tasks** | keyboard | useKeyboardNavigation, shortcutService, keyboardNavStore |
| **sharing** | automations | AutomationRuleRepository (optional), validateImportedRules, ruleImportExport |
| **sharing** | tms | useTMSStore (for export state) |
| **stores/dataStore** | lib/events | emitDomainEvent, subscribeToDomainEvents |
| **stores/dataStore** | lib/serviceContainer | all repositories + services |
| **lib/serviceContainer** | tasks, projects, automations | service + repository classes |

### Domain Event Flow

```
User action in UI
  → dataStore mutation (addTask, updateTask, deleteTask, addSection, updateSection)
    → repository.create/update/delete
    → emitDomainEvent() from lib/events
      → automationService.handleEvent() (subscribed in dataStore)
        → evaluateRules() → ruleExecutor.executeActions()
          → may emit cascading events (up to depth 5)
```

## Change Checklists

### If you change a Zod schema in `lib/schemas.ts`

- [ ] Update `types/index.ts` if re-exported types changed shape
- [ ] Check `features/sharing/services/importExport.ts` — `AppStateSchema.safeParse` validates imports
- [ ] Check `lib/repositories/localStorageBackend.ts` — validates on load
- [ ] Check `features/sharing/services/shareService.ts` — validates shared state
- [ ] Run ALL tests — schema changes can break anything
- [ ] Run `npx next build` — catches type errors vitest misses

### If you change `TaskService` (features/tasks/services/taskService.ts)

- [ ] Check `lib/serviceContainer.ts` — constructor wiring
- [ ] Check `stores/dataStore.ts` — calls taskService methods
- [ ] Check `features/automations/services/ruleExecutor.ts` — calls taskService.cascadeComplete
- [ ] Check `features/projects/services/projectService.ts` — calls taskService.cascadeDelete
- [ ] Test: `stores/dataStore.test.ts`, `features/tasks/services/taskService.test.ts`
- [ ] Test: `features/automations/services/ruleExecutor.test.ts` (if cascadeComplete/cascadeDelete changed)

### If you change `SectionService` (features/projects/services/sectionService.ts)

- [ ] Check `lib/serviceContainer.ts` — constructor wiring
- [ ] Check `stores/dataStore.ts` — calls sectionService.cascadeDelete
- [ ] Verify `detectBrokenRules` still called on section delete (disables automation rules referencing deleted sections)
- [ ] Test: `features/projects/services/sectionService.test.ts`
- [ ] Test: automation rules that reference sections (e2e: `automation-rules.spec.ts`)

### If you change `ProjectService` (features/projects/services/projectService.ts)

- [ ] Verify cascade delete still removes: sections → tasks → subtasks → dependencies → automation rules
- [ ] Test: `features/projects/services/projectService.test.ts`
- [ ] Test: e2e `project-management.spec.ts`

### If you add a new domain event type

- [ ] Add the type to `lib/events/types.ts` → `DomainEvent.type` union
- [ ] Update `features/automations/types.ts` (re-exports DomainEvent)
- [ ] Update `features/automations/services/ruleEngine.ts` — `evaluateRules` switch on event type
- [ ] Emit the event in `stores/dataStore.ts` wrapped in `beginBatch()`/`endBatch()`
- [ ] Test: `features/automations/services/ruleEngine.test.ts`
- [ ] Test: `stores/dataStore.test.ts`

### If you add a new automation trigger type

- [ ] Add to `features/automations/schemas.ts` → `TriggerTypeSchema`
- [ ] Add matching logic in `features/automations/services/ruleEngine.ts` → `evaluateRules`
- [ ] Add UI in `features/automations/components/RuleDialogStepTrigger.tsx`
- [ ] Update `features/automations/README.md` trigger table
- [ ] Test: `ruleEngine.test.ts`, `RuleDialogStepTrigger.test.tsx`

### If you add a new automation action type

- [ ] Add to `features/automations/schemas.ts` → `ActionTypeSchema`
- [ ] Implement in `features/automations/services/ruleExecutor.ts` → `executeAction`
- [ ] Add undo support in `features/automations/services/undoService.ts` if reversible
- [ ] Add UI in `features/automations/components/RuleDialogStepAction.tsx`
- [ ] Add toast message in `features/automations/services/toastMessageFormatter.ts`
- [ ] Update `features/automations/README.md` action table
- [ ] Test: `ruleExecutor.test.ts`, `undoService.test.ts`, `toastMessageFormatter.test.ts`

### If you change repository interfaces (`lib/repositories/types.ts`)

- [ ] Update ALL implementations: `lib/repositories/localStorageRepositories.ts`
- [ ] Update `features/automations/repositories/localStorageAutomationRuleRepository.ts` if base `Repository<T>` changed
- [ ] Check all service constructors that accept repository interfaces
- [ ] Update test mocks — many tests create in-memory repo mocks
- [ ] Run ALL tests

### If you change `ImportExportMenu` or import/export flow

- [ ] Check `features/sharing/services/importExport.ts` — validation logic
- [ ] Check `features/sharing/services/deduplicateData.ts` — merge dedup
- [ ] Check `features/sharing/hooks/useSharedStateLoader.ts` — URL import uses same flow
- [ ] Verify automation rules are handled on import (validateImportedRules)
- [ ] Test: `importExport.test.ts`, `deduplicateData.test.ts`, `shareService.test.ts`

### If you change the `LocalStorageBackend`

- [ ] Check dual-write to 4 localStorage keys (unified + 3 Zustand persist keys)
- [ ] Check `app/hooks/useCrossTabSync.ts` — rehydrates stores on storage events
- [ ] Verify Zod validation on load still works
- [ ] Test: `localStorageBackend.test.ts`, `stores/dataStore.test.ts`

### If you add a new entity type

- [ ] Add Zod schema to `lib/schemas.ts`
- [ ] Add to `AppStateSchema` if persisted
- [ ] Add TypeScript type re-export to `types/index.ts`
- [ ] Create repository interface in `lib/repositories/types.ts`
- [ ] Create repository implementation in `lib/repositories/localStorageRepositories.ts`
- [ ] Wire in `lib/serviceContainer.ts`
- [ ] Add to `stores/dataStore.ts` state + subscription
- [ ] Update `LocalStorageBackend` if new top-level key needed
- [ ] Update import/export flow in `features/sharing/`
- [ ] Update share URL serialization in `features/sharing/services/shareService.ts`

## Fragile Integration Points

These are areas where bugs have historically appeared:

1. **Zustand persist + LocalStorageBackend dual-write** — Both write to the same localStorage keys. If one gets out of sync, data can be silently lost. The backend is the source of truth; Zustand stores are caches synced via repository subscriptions.

2. **Domain event emission in dataStore** — Every mutation that should trigger automations MUST be wrapped in `beginBatch()`/`endBatch()`. Missing this causes individual toasts instead of aggregated ones. `deleteSection` intentionally does NOT emit domain events (calls `detectBrokenRules` directly instead).

3. **AutomationRuleRepository is independent** — Uses its own localStorage key (`task-management-automations`), not the `LocalStorageBackend`. The backend's `reset()` does NOT clear automation rules. Import/export must handle automation rules separately.

4. **ShareService optional automationRuleRepository** — If you create `new ShareService()` without passing the repo, automation rules are silently excluded from exports. Always pass `automationRuleRepository` when automation support is needed.

5. **Subtask exclusion in automations** — `evaluateRules` skips events where the entity has a non-null `parentTaskId`. If you change subtask behavior, automation rules won't fire on subtasks by design.
