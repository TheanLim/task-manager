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
- `hooks/` — `useAutomationRules`, `useGlobalAutomationRules`, `useWizardState`, `useRuleActions`
- `components/` — `AutomationTab`, `RuleCard`, `GlobalAutomationsPanel`, wizard, schedule UI

## Global Automations (Phase 1)

- `projectId: null` on `AutomationRule` = global scope (applies to all projects)
- `excludedProjectIds: string[]` on rule = projects to skip
- Execution order: global rules fire **first**, project rules fire **second** (project rules override)
- `findGlobal()` on repository returns all null-projectId rules
- `handleEvent()`: `[...globalRules.filter(not excluded), ...projectRules]`
- Scheduler skips global rules in Phase 1 (no scheduled global triggers yet)
- Section-based triggers on global rules: store `sectionName` alongside `sectionId`
- Section picker in global rule wizard: shows **deduplicated section names** (not IDs), stores name only
- At execution time: section-not-found guard logs skipped entry with `skipReason`

## Key Conventions

- Rule engine is pure — no store imports, no side effects
- Action handlers receive `ActionContext` (repos + services), return domain events
- `ExecutionLogEntry` fields for global rules: `isGlobal`, `firingProjectId`, `skipReason`, `ruleId`
- `RuleDialog` accepts `isGlobal` prop — changes title, scope pill, disables scheduled triggers
- `GlobalAutomationsPanel` renders when `appStore.activeView === 'global-automations'`
- `AutomationTab` shows `GlobalRulesSection` (read-only) above local rules

## Test Files

- `automations.ui-wiring.test.tsx` — integration wiring tests (mock `useGlobalAutomationRules` + `useAppStore`)
- `AutomationTab.test.tsx` — same mocks required
- New global-specific tests: `automationService.global.test.ts`, `ruleExecutor.sectionGuard.test.ts`
