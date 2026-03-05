---
inclusion: fileMatch
fileMatchPattern: 'features/automations/**'
---

# Automations Subsystem

Feature path: `features/automations/`

## Architecture

- `services/automationService.ts` — orchestrator; `handleEvent()` merges global + project rules
- `services/evaluation/` — pure rule engine, filter predicates, date calculations
- `services/execution/` — action handlers (Strategy pattern), rule executor, undo
- `services/scheduler/` — tick loop, schedule evaluator, leader election, cron parser
- `services/preview/` — human-readable descriptions, toast formatting
- `services/rules/` — rule lifecycle: factory, save, validation, duplicator, broken detector
- `repositories/` — `LocalStorageAutomationRuleRepository` with `findByProjectId()` + `findGlobal()`
- `hooks/` — `useAutomationRules`, `useGlobalAutomationRules`, `useWizardState`, `useRuleActions`, `useExecutionLogFilters`, `useGlobalDryRun`, `usePromoteToGlobal`
- `components/` — `AutomationTab`, `RuleCard`, `GlobalAutomationsPanel`, `ScopePill`, `ExecutionLogFilterBar`, wizard (`RuleDialogStepScope`), schedule UI

## Global Automations (Phase 1 + Phase 2)

- `projectId: null` on `AutomationRule` = global scope (applies to all projects)
- `excludedProjectIds: string[]` on rule = projects to skip
- `scope: 'all' | 'selected' | 'all_except'` + `selectedProjectIds: string[]` — Phase 2 scope control
- Execution order: global rules fire **first**, project rules fire **second** (project rules override)
- `findGlobal()` on repository returns all null-projectId rules
- `handleEvent()`: `[...globalRules.filter(isRuleActiveForProject), ...projectRules]`
- Scheduler skips global rules (no scheduled global triggers yet)
- Section-based triggers on global rules: store `sectionName` alongside `sectionId`
- Section picker in global rule wizard: shows **deduplicated section names** (not IDs), stores name only
- At execution time: section-not-found guard logs skipped entry with `skipReason`
- Promote to Global: clears `sectionId` (uses `sectionName` for cross-project resolution), sets scope to `selected` with source project
- Duplicate on global rules: simple "Duplicate" (no project picker submenu)
- Sidebar badge: shows count of rules with active skips; badge link goes to filtered log

## Key Conventions

- Rule engine is pure — no store imports, no side effects
- Action handlers receive `ActionContext` (repos + services), return domain events
- `ExecutionLogEntry` fields for global rules: `isGlobal`, `firingProjectId`, `skipReason`, `ruleId`
- `RuleDialog` accepts `isGlobal` prop — changes title, scope step, scope pill, disables scheduled triggers
- `RuleDialog` accepts `promoteFromRule` prop — pre-fills trigger/filters/action from source rule, clears sectionId
- `GlobalAutomationsPanel` renders when `appStore.activeView === 'global-automations'`; has Rules + Execution Log tabs
- `AutomationTab` shows `GlobalRulesSection` above local rules; wires promote/toggle handlers
- `AutomationTab` imports `useDataStore` for projects/allSections (needed by promote flow)

## Test Files

- `automations.ui-wiring.test.tsx` — integration wiring tests (mock `useGlobalAutomationRules` + `useAppStore`)
- `AutomationTab.test.tsx` — same mocks required
- New global-specific tests: `automationService.global.test.ts`, `ruleExecutor.sectionGuard.test.ts`
