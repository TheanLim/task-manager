---
name: cross-feature
description: Cross-feature dependency awareness for safe changes
inclusion: auto
fileMatchPattern: "features/**/*,lib/serviceContainer.ts,lib/events/**/*,lib/repositories/**/*,lib/schemas.ts,stores/dataStore.ts"
---

# Cross-Feature Safety

When editing files matched by this pattern, check these integration points:

## Domain Events (lib/events/)
- Emitted in `stores/dataStore.ts`, consumed by `automationService.handleEvent()`
- New mutations MUST wrap in `beginBatch()`/`endBatch()` or toasts break
- Adding event types → update `DomainEvent` union + `ruleEngine.evaluateRules`

## Service Container (lib/serviceContainer.ts)
- Composition root — changing constructor signatures here breaks everything
- After changing: run full test suite, not just the changed feature's tests

## Schema Changes (lib/schemas.ts)
- Affects: localStorage load validation, import/export, share URLs
- After changing: test import flow, share flow, and fresh-load behavior
- `TMSStateSchema` uses generic `systemStates: z.record(z.string(), z.unknown())` — each TMS system owns its own state shape, versioned via `systemStateVersions`

## Repository Interfaces (lib/repositories/types.ts)
- Implementations: `localStorageRepositories.ts` + `automationRuleRepository`
- Test mocks in many files use `Map<string, T>` — update them too

## Key Cross-Feature Rules
- `TaskService` is used by: dataStore, projectService, ruleExecutor
- `SectionService.cascadeDelete` calls `detectBrokenRules` from automations
- `ShareService` optionally imports automation rules — always pass the repo
- `filterStore` lives in `features/tasks/stores/` not top-level `stores/`
- Domain events live in `lib/events/`, re-exported from `features/automations/events.ts`
- `bulkScheduleService` and `schedulerService` are automation singletons — used by `useRuleActions` hook and `useSchedulerInit`
- `automationRuleRepository` has `findGlobal()` for null-projectId rules — used by `useGlobalAutomationRules` and `useGlobalAutomationSkipCount`

## See Also
- Full checklist: [CROSS-FEATURE-GUIDE.md](../../CROSS-FEATURE-GUIDE.md)
