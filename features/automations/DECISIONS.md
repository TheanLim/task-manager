# Architecture Decisions

Key design decisions and their rationale. Read this before changing the automation engine's core behavior.

## 1. Execution log stored on the rule entity

**Decision**: `recentExecutions` is a field on `AutomationRule`, not a separate log repository.

**Why**: Co-locates data with the rule, avoids a new storage key, and keeps the repository interface simple. The 20-entry cap bounds payload size to ~4KB per rule worst case (20 entries × ~200 bytes each JSON-serialized).

**Trade-off**: If we ever need a global execution history view across all rules, we'd need to aggregate from all rules or introduce a separate log store. The inline collapsible log on RuleCard covers the current need.

## 2. Undo snapshot is in-memory only

**Decision**: Undo snapshots are stored as a module-level array (`undoSnapshotStack`) in `services/execution/undoService.ts`, not persisted to localStorage.

**Why**: Undo is ephemeral by design — snapshots expire after 10 seconds. Persisting would add complexity with no user benefit.

**Multi-rule undo**: When multiple rules fire from one user action, each rule gets its own snapshot pushed onto the stack. Each toast gets an undo button that calls `performUndoById(ruleId)` to revert that specific rule's action without affecting others. The stack is cleared when a new user gesture triggers new automations.

**Trade-off**: Page refresh kills all undo windows. Acceptable given the 10-second expiry.

## 3. Batch mode uses synchronous collection

**Decision**: `beginBatch()` / `endBatch()` wraps each data store mutation. During batch mode, toast notifications are collected and emitted as one aggregated toast per rule after the batch completes.

**Why**: The entire event → evaluate → execute pipeline is synchronous. No async gaps means we can reliably collect all executions before emitting toasts.

**Where it's wired**: `stores/dataStore.ts` wraps `addTask`, `updateTask`, `deleteTask`, `addSection`, `updateSection` in `beginBatch()`/`endBatch()`. Note: `deleteSection` does NOT emit a domain event or use batch mode — it calls `detectBrokenRules` directly instead.

**Gotcha**: If you add a new mutation to the data store that emits domain events, you MUST wrap it in `beginBatch()`/`endBatch()` or users will get individual toasts instead of aggregated ones.

## 4. Cross-project duplication remaps by section name

**Decision**: When duplicating a rule to another project, section references are matched by name (case-sensitive). Unmatched sections result in a broken rule.

**Why**: Simple, predictable, matches user mental models. Users name sections consistently across projects ("To Do", "Done"). Case-sensitive avoids ambiguity.

## 5. Broken rule detection is a service-layer concern

**Decision**: `detectBrokenRules()` is called from the data store's `deleteSection` handler, not from the repository.

**Why**: Follows the architecture rule that business logic lives in the service layer, not in stores or repositories.

## 6. Rule ordering uses the existing `order` field

**Decision**: Phase 1 defined `order: number` on `AutomationRule`. Phase 4 made it user-controllable via drag-and-drop and ensured the Rule Engine respects it.

**Evaluation order**: Rules are sorted by `order` ascending, then `createdAt` ascending as tiebreaker. This happens in `buildRuleIndex()` in `ruleEngine.ts`.

## 7. Domain events emitted from data store, not repositories

**Decision**: `emitDomainEvent()` is called in the data store's mutation handlers, not in the repository layer.

**Why**: Repositories are dumb CRUD. The data store knows the semantic intent and can capture `previousValues` before the mutation.

## 8. Automation rule repository is independent from LocalStorageBackend

**Decision**: `LocalStorageAutomationRuleRepository` manages its own `localStorage['task-management-automations']` key, separate from the `LocalStorageBackend` used by other repositories.

**Why**: Avoids bloating the main Zustand persist payload. Automation rules can grow large (filters, execution logs) and don't need to be part of the core app state hydration.

## 9. ShareService constructor takes only optional AutomationRuleRepository

**Decision**: `ShareService` constructor takes only an optional `AutomationRuleRepository`. The old `LocalStorageAdapter` dependency was removed.

**Why**: `ShareService` only needed validation and load, both replaced by standalone functions.

## 10. Automations skip subtasks

**Decision**: `evaluateRules` in `ruleEngine.ts` checks if the event's entity has a non-null `parentTaskId` and returns empty actions if so.

**Why**: Subtasks inherit behavior from their parent. Firing automations on subtask events would cause confusing double-actions.

## 11. Undo captures subtask state before execution

**Decision**: `handleEvent` captures subtask `completed`/`completedAt` state BEFORE calling `executeActions`, then attaches it to the `UndoSnapshot` as `subtaskSnapshots`.

**Why**: `cascadeComplete` mutates subtasks during execution. Capturing before ensures we have the true previous state.

## 12. Toast stacking: Sonner-based visible stack

**Decision**: Uses Sonner (`sonner` package) for toast notifications with stacking, hover-pause, and per-toast undo buttons.

## 13. ActionHandler Strategy pattern for action execution and undo

**Decision**: Each action type implements `execute()`, `describe()`, and `undo()` via the `ActionHandler` interface. Handlers are registered in `ACTION_HANDLER_REGISTRY`.

**How to add a new action type**: Add to `ActionTypeSchema`, create handler in `actionHandlers.ts`, register in `ACTION_HANDLER_REGISTRY`. Done.

## 14. Data-driven `calculateRelativeDate` replaces 80-case switch

**Decision**: Four parser functions use regex to extract parameters from enum string values. Lookup tables map names to numbers.

## 15. `schemas.ts` exports only schema objects, not types

**Decision**: Types are exclusively exported from `types.ts`, which infers them from the schemas.

## 16. `automationService.ts` no longer re-exports undo functions

**Decision**: Consumers import undo functions directly from `undoService.ts`.

## 17. Unified `formatFilterDescription` eliminates duplicate filter-to-text logic

**Decision**: Shared `formatFilterDescription()` in `formatters.ts` replaces per-component duplicates.

## 18. THEN block in Review step navigates to Action step (step 2)

**Decision**: Fixed `RuleDialogStepReview.tsx` THEN block `onClick` from `onNavigateToStep(1)` to `onNavigateToStep(2)`.

## 19. Unified `formatRelativeTime` for timestamp display

**Decision**: Shared `formatRelativeTime()` in `formatters.ts` replaces per-component duplicates.

## 20. Removed stale orphaned JSDoc from `rulePreviewService.ts`

## 21. Shared `collectSectionReferences` eliminates duplicate section-walking logic

**Decision**: `services/rules/sectionReferenceCollector.ts` is the single source of truth for "which sections does this rule depend on?"

## 22. Extracted `ruleMetadata.ts` from `rulePreviewService.ts`

**Decision**: `TRIGGER_META`, `ACTION_META`, `FILTER_META` live in `services/preview/ruleMetadata.ts`.

## 23. Simplified `createRuleAction` params mapping in `ruleEngine.ts`

## 24. Restructured flat `services/` into responsibility-based sub-modules

**Decision**: Split into `evaluation/`, `execution/`, `scheduler/`, `preview/`, `rules/` plus orchestrator at root.

## 25. Split `rulePreviewService.ts` into focused modules

**Decision**: Extracted `scheduleDescriptions.ts` and `formatters.ts`.

## 26. Removed `events.ts` backward-compat shim

## 27. Extracted `ruleFactory.ts` from `useAutomationRules` hook

## 28. Restructured `components/` into sub-folders

**Decision**: `wizard/` (RuleDialog + steps), `schedule/` (config panels, history, dry-run), root (shared components).

## 29. Deleted stale planning documents

## 30. Extracted schedule config sub-components from ScheduleConfigPanel

## 31. Extracted `ruleSaveService.ts` from RuleDialog's handleSave

## 32. Removed Middle Man re-exports from rulePreviewService

**Decision**: Updated all consumers (including test files) to import directly from canonical modules (`ruleMetadata.ts`, `formatters.ts`, `scheduleDescriptions.ts`). Removed all re-exports from `rulePreviewService.ts`.

**Import guideline**: Import from the module that owns the symbol:
- Metadata → `ruleMetadata.ts`
- Formatting → `formatters.ts`
- Schedule text → `scheduleDescriptions.ts`
- Preview parts, config types, sentinel, duplicate detection → `rulePreviewService.ts`

## 33. Added barrel `index.ts` to each service sub-module

**Decision**: Each sub-module (`evaluation/`, `execution/`, `scheduler/`, `preview/`, `rules/`) now has an `index.ts` barrel export.

**Why**: Reduces import noise for internal consumers. External consumers still use the feature-level `index.ts`. Internal cross-module imports can use `../evaluation` instead of `../evaluation/ruleEngine`.

**Trade-off**: One more file per sub-module. Barrel files must be maintained when adding new exports.

## 34. Extracted `useWizardState` hook from RuleDialog

**Decision**: Moved ~200 lines of wizard state machine logic (step navigation, validation, dirty tracking, form state, same-section warning) from `RuleDialog.tsx` into `hooks/useWizardState.ts`.

**Why**: `RuleDialog.tsx` was 545 lines mixing state machine logic with dialog UI chrome. The wizard state (step transitions, validation gates, dirty tracking) is a pure state machine with no DOM dependencies — it's independently testable and reusable.

**What moved**:
- Step navigation (`handleNext`, `handleBack`, `handleNavigateToStep`, `handleSkipFilters`)
- Validation (`isTriggerValid`, `isActionValid`, `isStepValid`, `isSaveDisabled`)
- Form state (`trigger`, `filters`, `action`, `ruleName`, `isDirty`)
- Same-section warning detection
- Pre-populate/reset logic on dialog open
- Step announcement for screen readers

**RuleDialog.tsx impact**: Went from 545 lines to ~280 lines. The component now focuses on dialog chrome, focus management, save orchestration, and rendering step components.

**Trade-off**: `RuleDialog` now depends on the hook's return type. The hook is tightly coupled to the wizard's domain — it's not a generic wizard hook, it's specific to automation rule creation.

## 35. Extracted `useRuleActions` hook from AutomationTab

**Decision**: Moved dry-run preview, run-now, bulk schedule operations, and scheduled/event-driven count computation from `AutomationTab.tsx` into `hooks/useRuleActions.ts`.

**Why**: `AutomationTab.tsx` was 433 lines mixing action orchestration (dry-run, run-now, bulk pause/resume) with list rendering and dialog management. The action logic depends on service imports (`dryRunScheduledRule`, `evaluateRules`, `schedulerService`, `bulkScheduleService`) that don't belong in a rendering component.

**What moved**:
- `handlePreview` (dry-run evaluation)
- `handleRunNow` (manual scheduler execution)
- `handleBulkPauseScheduled` / `handleBulkResumeScheduled` (with Sonner toast + undo)
- `scheduledCount` / `eventDrivenCount` memoized computation
- Dry-run dialog state (`dryRunResult`, `dryRunOpen`)

**AutomationTab.tsx impact**: Went from 433 lines to ~280 lines. The component now focuses on rule list rendering, dialog management, and drag-and-drop.


## 36. Extracted `TriggerConfig`/`ActionConfig` to `services/configTypes.ts`

**Decision**: Moved `TriggerConfig` and `ActionConfig` interfaces from `rulePreviewService.ts` to a new `services/configTypes.ts` file. `rulePreviewService.ts` re-exports them for backward compatibility.

**Why**: These types describe wizard/rule configuration state, not preview-specific concerns. They were consumed by 7+ files across 3 layers (hooks, components, services). Having them in `rulePreviewService.ts` forced a dependency on the preview module for anyone who just needed the config shape — e.g., `useWizardState.ts` and `ruleSaveService.ts` had no reason to depend on preview logic.

**Import guideline**: New code should import from `services/configTypes.ts`. The re-exports in `rulePreviewService.ts` exist for backward compatibility and will be removed once all consumers are migrated.

**Trade-off**: One more file. The re-exports in `rulePreviewService.ts` add a small amount of indirection, but they prevent a breaking change for any external consumers.
