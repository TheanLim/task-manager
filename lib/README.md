# lib/ — Domain Infrastructure

Core persistence, validation, events, and wiring layer. No UI code lives here.

## Quick Reference

| File / Dir | Purpose |
|---|---|
| `serviceContainer.ts` | Single composition root — instantiates all repositories and services, exports singletons |
| `events/` | Cross-cutting domain event pub/sub (`emitDomainEvent`, `subscribeToDomainEvents`) and `DomainEvent` type |
| `repositories/types.ts` | Generic `Repository<T>` interface + entity-specific interfaces (`TaskRepository`, etc.) |
| `repositories/localStorageBackend.ts` | Unified localStorage persistence with Zod validation and dual-write for backward compat |
| `repositories/localStorageRepositories.ts` | Per-entity repository implementations backed by `LocalStorageBackend` |
| `schemas.ts` | Zod schemas for every entity and composite state. IDs use `.min(1)` not `.uuid()` — section IDs and seed data use non-UUID formats |
| `validation.ts` | Input validation for user-facing fields (project name, task description, section/column name). Throws `ValidationError` |
| `utils.ts` | Shared utility (`cn` for classnames merge) |

## Architecture

```
serviceContainer.ts  (composition root)
├── LocalStorageBackend        (single instance, owns in-memory state + localStorage I/O)
│   ├── Zod validation on load
│   └── Dual-write: unified key + legacy Zustand keys
├── Repositories               (thin CRUD wrappers over backend)
│   ├── LocalStorageProjectRepository
│   ├── LocalStorageTaskRepository
│   ├── LocalStorageSectionRepository
│   ├── LocalStorageDependencyRepository
│   └── LocalStorageAutomationRuleRepository  (in features/automations/)
├── Services                   (business logic, cascade deletes, defaults)
│   ├── TaskService
│   ├── ProjectService
│   ├── SectionService
│   ├── DependencyService
│   └── AutomationService + RuleExecutor
└── events/                    (cross-cutting domain event infrastructure)
    ├── domainEvents.ts        (emitDomainEvent, subscribeToDomainEvents)
    └── types.ts               (DomainEvent interface)
```

## What moved out

- `importExport.ts` → `features/sharing/services/importExport.ts` (only consumers are sharing components)
- `deduplicateData.ts` → `features/sharing/services/deduplicateData.ts` (only consumer is ImportExportMenu)
- `hooks/useDialogManager.ts` → `app/hooks/useDialogManager.ts` (app-shell orchestration, not a library)
- `hooks/useCrossTabSync.ts` → `app/hooks/useCrossTabSync.ts` (app-shell glue for Layout.tsx)
