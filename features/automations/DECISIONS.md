# Architecture Decisions

Key design decisions and their rationale. Read this before changing the automation engine's core behavior.

## 1. Execution log stored on the rule entity

**Decision**: `recentExecutions` is a field on `AutomationRule`, not a separate log repository.

**Why**: Co-locates data with the rule, avoids a new storage key, and keeps the repository interface simple. The 20-entry cap bounds payload size to ~4KB per rule worst case (20 entries × ~200 bytes each JSON-serialized).

**Trade-off**: If we ever need a global execution history view across all rules, we'd need to aggregate from all rules or introduce a separate log store. The inline collapsible log on RuleCard covers the current need.

## 2. Undo snapshot is in-memory only

**Decision**: Undo snapshots are stored as a module-level array (`undoSnapshotStack`) in `services/undoService.ts`, not persisted to localStorage.

**Why**: Undo is ephemeral by design — snapshots expire after 10 seconds. Persisting would add complexity with no user benefit.

**Multi-rule undo**: When multiple rules fire from one user action, each rule gets its own snapshot pushed onto the stack. Each toast gets an undo button that calls `performUndoById(ruleId)` to revert that specific rule's action without affecting others. The stack is cleared when a new user gesture triggers new automations.

**Key functions**:
- `pushUndoSnapshot(snapshot)` — adds to the stack (used during batch execution)
- `performUndoById(ruleId, taskRepo)` — undoes a specific rule's action, removes it from stack
- `performUndo(taskRepo)` — undoes the most recent snapshot (backward compat)
- `getUndoSnapshots()` — returns all non-expired snapshots
- `clearAllUndoSnapshots()` — empties the stack

**Trade-off**: Page refresh kills all undo windows. Acceptable given the 10-second expiry.

## 3. Batch mode uses synchronous collection

**Decision**: `beginBatch()` / `endBatch()` wraps each data store mutation. During batch mode, toast notifications are collected and emitted as one aggregated toast per rule after the batch completes.

**Why**: The entire event → evaluate → execute pipeline is synchronous. No async gaps means we can reliably collect all executions before emitting toasts.

**Where it's wired**: `stores/dataStore.ts` wraps `addTask`, `updateTask`, `deleteTask`, `addSection`, `updateSection` in `beginBatch()`/`endBatch()`. Note: `deleteSection` does NOT emit a domain event or use batch mode — it calls `detectBrokenRules` directly instead.

**Gotcha**: If you add a new mutation to the data store that emits domain events, you MUST wrap it in `beginBatch()`/`endBatch()` or users will get individual toasts instead of aggregated ones.

## 4. Cross-project duplication remaps by section name

**Decision**: When duplicating a rule to another project, section references are matched by name (case-sensitive). Unmatched sections result in a broken rule.

**Why**: Simple, predictable, matches user mental models. Users name sections consistently across projects ("To Do", "Done"). Case-sensitive avoids ambiguity.

**Trade-off**: If the target project has sections with different names, the rule will be broken. The user can fix it by editing the rule and selecting the correct section.

## 5. Broken rule detection is a service-layer concern

**Decision**: `detectBrokenRules()` is called from the data store's `deleteSection` handler, not from the repository.

**Why**: Follows the architecture rule that business logic lives in the service layer, not in stores or repositories. The data store calls the service function after deleting the section.

**Gotcha**: If section deletion is ever moved to a dedicated `SectionService`, the `detectBrokenRules` call must move with it.

## 6. Rule ordering uses the existing `order` field

**Decision**: Phase 1 defined `order: number` on `AutomationRule`. Phase 4 made it user-controllable via drag-and-drop and ensured the Rule Engine respects it.

**Why**: No schema change needed. The `order` field was already there for deterministic evaluation. Adding drag-and-drop just makes it user-visible.

**Evaluation order**: Rules are sorted by `order` ascending, then `createdAt` ascending as tiebreaker. This happens in `buildRuleIndex()` in `ruleEngine.ts`.

## 7. Domain events emitted from data store, not repositories

**Decision**: `emitDomainEvent()` is called in the data store's mutation handlers (`addTask`, `updateTask`, etc.), not in the repository layer.

**Why**: Repositories are dumb CRUD. The data store knows the semantic intent (e.g., "task moved to section" vs "task field updated") and can capture `previousValues` before the mutation.

**Trade-off**: If mutations happen outside the data store (e.g., direct repository calls in tests), no domain events fire. This is intentional — only user-initiated mutations should trigger automations.

## 8. Automation rule repository is independent from LocalStorageBackend

**Decision**: `LocalStorageAutomationRuleRepository` manages its own `localStorage['task-management-automations']` key, separate from the `LocalStorageBackend` used by other repositories.

**Why**: Avoids bloating the main Zustand persist payload. Automation rules can grow large (filters, execution logs) and don't need to be part of the core app state hydration.

**Trade-off**: Two separate localStorage writes on rule changes. The repository has its own subscription mechanism that the data store subscribes to for syncing the Zustand `automationRules` array.

## 9. ShareButton must pass automationRuleRepository to ShareService

**Decision**: `ShareService` accepts an optional `automationRuleRepository` in its constructor. The `ShareButton` component must pass it when creating a `ShareService` instance.

**Why**: ShareService is a pure service with no store imports. It needs the repository to serialize automation rules into the export payload.

**Bug history**: This was missed initially — `ShareButton` created `new ShareService()` without the repo, silently producing exports without automation rules. Fixed by importing `automationRuleRepository` from `stores/dataStore` and passing it to the constructor. Added a steering rule to prevent this class of bug: "When adding optional parameters to constructors, grep for ALL existing call sites."


## 9. ShareService no longer depends on LocalStorageAdapter

**Decision**: `ShareService` constructor takes only an optional `AutomationRuleRepository`. The old `LocalStorageAdapter` dependency was removed.

**Why**: `ShareService` only needed two things from `LocalStorageAdapter`: `validateState()` and `load()`. Validation is now a standalone function (`validateAppState` in `lib/importExport.ts`). The `load()` fallback was replaced by requiring callers to pass `currentState` explicitly — which they already did in practice.

**Trade-off**: `serializeState()` without a `currentState` argument now returns an empty default state instead of reading from localStorage. All real call sites already pass the state.

**Constructor change**: `new ShareService(storageAdapter?, automationRuleRepo?)` → `new ShareService(automationRuleRepo?)`. All call sites updated.

## 10. Automations skip subtasks

**Decision**: `evaluateRules` in `ruleEngine.ts` checks if the event's entity has a non-null `parentTaskId` and returns empty actions if so.

**Why**: Subtasks inherit behavior from their parent (e.g., cascade complete). Firing automations on subtask events would cause confusing double-actions — the parent's automation already handles the intent. Users think in terms of top-level tasks, not subtasks.

**Where**: Early return in `evaluateRules()` before `buildRuleIndex`.

## 11. Undo captures subtask state before execution

**Decision**: `handleEvent` captures subtask `completed`/`completedAt` state BEFORE calling `executeActions`, then attaches it to the `UndoSnapshot` as `subtaskSnapshots`.

**Why**: `cascadeComplete` mutates subtasks during execution. If we captured state after execution, we'd get the post-action state (useless for undo). Capturing before ensures we have the true previous state.

**Trade-off**: Adds a `findAll()` + filter call before every mark_complete/incomplete execution at depth 0. This is acceptable because it only runs for user-initiated events, not cascaded ones.


## 12. Toast stacking: visible stack with 3-toast cap (recommended, not yet implemented)

**Decision**: Show up to 3 toasts stacked vertically (bottom-right), each with independent dismiss timers. Toasts beyond 3 queue behind the stack and appear as earlier ones dismiss.

**Current state**: The toast queue in `useDialogManager` already supports multiple toasts — it just renders only the first one. Toasts appear sequentially as each auto-dismisses.

**Why upgrade to visible stack**: Automation rules can fire multiple toasts from a single user action. The sequential queue breaks undo accessibility — by the time toast #3 appears, toast #1's 10-second undo window has already expired. A visible stack ensures all undo buttons are simultaneously accessible.

**Recommended approach: Adopt Sonner via shadcn/ui**

The shadcn ecosystem recommends Sonner (`sonner` package) for toast notifications. It handles stacking, animations, hover-pause, swipe-to-dismiss, reduced-motion, keyboard navigation, and accessibility out of the box. Building custom stacking is reinventing the wheel.

Migration path:
1. Install: `npx shadcn@latest add sonner`
2. Add `<Toaster />` to `app/layout.tsx`
3. Replace `dm.showToast(message, type, duration, action)` calls with `toast(message, { action, duration })`
4. Remove the custom `Toast` component and `useDialogManager` toast queue
5. For undo toasts: `toast(message, { action: { label: 'Undo', onClick: () => performUndo(taskRepo) }, duration: 10000 })`

**If building custom instead of Sonner, the spec must include**:
- Max visible: 3 toasts. Additional toasts queue behind.
- Position: Bottom-right, 16px from viewport edges. z-50 (highest in z-index scale).
- Spacing: 8px vertical gap. Newest at bottom, older shift up.
- Animation: `translateY` + `opacity` only (no `top`/`height` — GPU-composited). Enter: 300ms ease-out. Dismiss: 200ms ease-in.
- Reduced motion: Skip slide animations when `prefers-reduced-motion: reduce` is set. Show/hide instantly.
- Timers: Each toast runs independently. Hovering any toast pauses ALL timers (critical for undo).
- Keyboard: Tab navigates between toasts. Escape dismisses the focused toast.
- Undo: Each toast has its own undo button. Clicking undo dismisses that specific toast.
- Mobile: Cap at 2 visible, full-width (16px margin), swipe-to-dismiss.
- Accessibility: Stack container `role="region"` `aria-label="Notifications"`. Each toast `role="status"` `aria-live="polite"`.

**Implementation path (custom)**: Change `page.tsx` to render `toastQueue.slice(0, 3)` with stacked positioning. Each `Toast` already manages its own timer. Main work: stacked CSS positioning, hover-pause, per-toast dismiss callbacks, reduced-motion query, keyboard navigation.


## 13. ActionHandler Strategy pattern for action execution and undo

**Decision**: Replaced the `switch (actionType)` conditionals in `RuleExecutor`, `undoService.applyUndo`, and `getActionDescription` with an `ActionHandler` Strategy interface. Each action type (move_to_top, mark_complete, create_card, etc.) implements `execute()`, `describe()`, and `undo()`. Handlers are registered in `ACTION_HANDLER_REGISTRY` in `services/actionHandlers.ts`.

**Why**: The same `actionType` field was driving conditionals in 3-4 different places (execute, describe, undo, getActionDescription). Adding a new action type required touching all of them — classic shotgun surgery. The Strategy pattern collapses all per-action-type logic into one file per handler.

**How to add a new action type**:
1. Add the type to `ActionTypeSchema` in `schemas.ts`
2. Create a handler object implementing `ActionHandler` in `actionHandlers.ts`
3. Register it in `ACTION_HANDLER_REGISTRY`
4. Done — `RuleExecutor`, `undoService`, and description generation all pick it up automatically.

**Trade-off**: The `ActionContext` passed to handlers uses `as any` for `sectionRepo` and `taskService` in the undo path (undo only needs `taskRepo`). This is acceptable because undo handlers only access `ctx.taskRepo`. If a future undo handler needs other repos, the caller must provide them.


## 14. Data-driven `calculateRelativeDate` replaces 80-case switch

**Decision**: Replaced the ~230-line `switch` statement in `calculateRelativeDate()` with data-driven parsers that extract numeric parameters from the enum string values (`day_of_month_N`, `next_<weekday>`, `<ordinal>_<weekday>_of_month`).

**Why**: The switch had 80+ cases that were purely mechanical mappings — 31 `day_of_month_N` cases, 7 `next_<weekday>`, 7 `next_week_<weekday>`, and 35 `<ordinal>_<weekday>_of_month>` cases. Each was a one-liner calling the same function with different numeric args. The data-driven approach collapses ~150 lines into ~20 lines of parsing logic.

**How it works**: Four parser functions (`parseDayOfMonth`, `parseNextWeekday`, `parseNextWeekOn`, `parseNthWeekdayOfMonth`) use regex to extract parameters from the enum string. Lookup tables (`WEEKDAY_MAP`, `ORDINAL_MAP`) map names to numbers. The parsers are tried in order; `next_week_*` is checked before `next_*` to avoid false matches.

**Trade-off**: Lost the `never` exhaustive check on the default case. The function now throws a generic error for unhandled options. This is acceptable because the `RelativeDateOption` Zod enum validates inputs at the boundary.

## 15. `schemas.ts` exports only schema objects, not types

**Decision**: Removed duplicate type exports from `schemas.ts`. Types are now exclusively exported from `types.ts`, which infers them from the schemas.

**Why**: Both files exported the same type names (`AutomationRule`, `CardFilter`, etc.), causing confusion about which was canonical. Some files imported from `schemas`, others from `types`. Now the rule is simple: import schemas from `schemas.ts`, import types from `types.ts`.

## 16. `automationService.ts` no longer re-exports undo functions

**Decision**: Removed the 10-function re-export block from `automationService.ts`. Consumers now import undo functions directly from `undoService.ts`.

**Why**: The re-exports made `automationService.ts` look like it owned undo logic when it doesn't. It was a Middle Man — adding indirection with no value. Direct imports are clearer and make dependency graphs accurate.

**Migration**: `app/page.tsx` and `useUndoAutomation.ts` updated to import from `undoService` directly. Test files updated accordingly.


## 17. Unified `formatFilterDescription` eliminates duplicate filter-to-text logic

**Decision**: Removed the local `getFilterDescription()` function from `RuleDialogStepReview.tsx` and replaced it with the shared `formatFilterDescription()` exported from `rulePreviewService.ts`.

**Why**: Both functions mapped `CardFilter` types to human-readable strings with nearly identical switch statements. The Review step used slightly different wording (e.g., "has due date" vs "with a due date") but the shared version's phrasing is more natural and consistent with the preview sentence.

**Trade-off**: Filter badge text in the Review step changed slightly (e.g., "has due date" → "with a due date", "due in < 3 days" → "due in less than 3 days"). This is a cosmetic improvement, not a regression.

## 18. THEN block in Review step navigates to Action step (step 2), not Filters (step 1)

**Decision**: Fixed `RuleDialogStepReview.tsx` THEN block `onClick` from `onNavigateToStep(1)` to `onNavigateToStep(2)`.

**Why**: Clicking the THEN block should navigate to the Action step (where the action is configured), not the Filters step. The WHEN block correctly navigated to step 0 (Trigger), the IF block correctly navigated to step 1 (Filters), but the THEN block incorrectly also navigated to step 1 instead of step 2 (Action).


## 19. Unified `formatRelativeTime` for timestamp display

**Decision**: Extracted the relative time formatting logic ("Just now", "5m ago", "3h ago", "2d ago") from `RuleCard.tsx` (`formatLastExecuted`) and `RuleCardExecutionLog.tsx` (`formatRelativeTime`) into a single shared `formatRelativeTime()` function exported from `rulePreviewService.ts`.

**Why**: Both components had identical timestamp-to-relative-time logic. `RuleCard` used it for "Last fired" display, `RuleCardExecutionLog` used it for execution log entry timestamps. The only difference was `RuleCard`'s version accepted `string | null` (returning "Never" for null) — the null check is now inline at the call site.

**Trade-off**: `rulePreviewService.ts` is growing as the home for formatting utilities. If it gets too large, these formatters could move to a dedicated `services/formatters.ts`. For now, co-locating with other human-readable formatting (filter descriptions, preview parts) keeps imports simple.

## 20. Removed stale orphaned JSDoc from `rulePreviewService.ts`

**Decision**: Removed a dangling JSDoc comment above `buildTriggerParts()` that was originally the doc for `buildPreviewParts()` before the function was split into `buildTriggerParts` + `buildActionParts` + `buildPreviewParts`.

**Why**: The orphaned comment described parameters (`trigger`, `action`, `sectionLookup`, `filters`) that belong to `buildPreviewParts`, not `buildTriggerParts`. It was misleading.


## 21. Shared `collectSectionReferences` eliminates duplicate section-walking logic

**Decision**: Extracted `collectSectionReferences(rule)` from both `brokenRuleDetector.ts::referencesSection()` and `ruleImportExport.ts::collectSectionReferences()` into a shared `services/sectionReferenceCollector.ts`.

**Why**: Both functions walked the same trigger/action/filters structure to find section IDs. `referencesSection` checked if a specific ID was present; `collectSectionReferences` collected all IDs. The underlying traversal was identical — a Data Clump that could diverge if a new section-carrying filter type were added and only one function was updated.

**How**: The shared function returns `string[]` of all referenced section IDs. `brokenRuleDetector` now calls `collectSectionReferences(rule).includes(deletedSectionId)`. `ruleImportExport` uses it directly as before.

**Trade-off**: `brokenRuleDetector` now allocates a temporary array instead of short-circuiting on first match. Negligible for the small number of references per rule (typically 1–3).

## 22. Extracted `ruleMetadata.ts` from `rulePreviewService.ts`

**Decision**: Moved `TRIGGER_META`, `ACTION_META`, `TriggerMeta`, and `ActionMeta` into a dedicated `services/ruleMetadata.ts`. `rulePreviewService.ts` re-exports them for backward compatibility.

**Why**: `rulePreviewService.ts` was a growing grab-bag — preview generation, formatting utilities, metadata constants, config types, and duplicate detection all in one file. The metadata constants are consumed by 5+ UI components and the preview service. Extracting them reduces `rulePreviewService.ts` to its core responsibility (preview generation and formatting) and makes the metadata independently importable.

**Trade-off**: One more file in `services/`. All existing imports from `rulePreviewService` continue to work via re-exports — no migration needed.

## 23. Simplified `createRuleAction` params mapping in `ruleEngine.ts`

**Decision**: Replaced the `action.field ?? undefined` pattern with destructured variables from `rule.action`.

**Why**: The previous code referenced `action.sectionId`, `action.position`, etc. repeatedly. Destructuring makes the mapping more concise and easier to scan. The `completed` field derivation from `type` is preserved as-is since it's computed, not mapped.

**Trade-off**: Purely cosmetic — same runtime behavior. Slightly easier to maintain when new action fields are added.

## 24. Restructured flat `services/` into responsibility-based sub-modules

**Decision**: Split the flat `services/` directory (28 files) into 5 sub-modules plus the orchestrator at root:

| Sub-module | Files | Responsibility |
|-----------|-------|---------------|
| `services/evaluation/` | ruleEngine, filterPredicates, dateCalculations | Pure rule matching & filtering |
| `services/execution/` | actionHandlers, ruleExecutor, undoService, createCardDedup, titleTemplateEngine | Action execution & undo |
| `services/scheduler/` | schedulerService, scheduleEvaluator, schedulerLeaderElection, cronExpressionParser, bulkScheduleService, clock | Scheduled trigger subsystem |
| `services/preview/` | rulePreviewService, ruleMetadata, toastMessageFormatter | Human-readable descriptions |
| `services/rules/` | brokenRuleDetector, sectionReferenceCollector, ruleImportExport, ruleDuplicator, ruleValidation, dryRunService | Rule lifecycle management |
| `services/automationService.ts` | (root) | Orchestrator — event handling, batch mode, cascade |

**Why**: The flat `services/` directory had 28 files with distinct responsibility clusters that were hard to navigate. Finding "the cron parser" required scanning past "the undo service" and "the filter predicates." The sub-modules group files by what they do, making it obvious where to look and where to add new code.

**Grouping rationale**:
- `evaluation/` — all pure functions that evaluate rules against events. No side effects, no repository writes
- `execution/` — everything that applies actions to entities. Owns the Strategy pattern registry and undo
- `scheduler/` — the entire scheduled trigger subsystem (tick loop, evaluators, leader election, cron). Self-contained
- `preview/` — human-readable text generation. No dependencies on execution or scheduling
- `rules/` — operations on rules as entities (validation, import/export, duplication, broken detection)

**Dependency flow**: `evaluation/` and `rules/` are leaf modules (no cross-sub-module deps). `execution/` imports from `evaluation/` (for dateCalculations) and `scheduler/` (for Clock). `preview/` imports only from types. `automationService.ts` imports from `evaluation/`, `execution/`, and is the only file that orchestrates across sub-modules.

**Trade-off**: Deeper import paths (e.g., `../services/scheduler/clock` instead of `../services/clock`). The barrel `index.ts` absorbs this for external consumers. Internal cross-references use relative paths. Test files are co-located with their source files in each sub-module.


## 25. Split `rulePreviewService.ts` into focused modules

**Decision**: Extracted `scheduleDescriptions.ts` (schedule description formatters) and `formatters.ts` (general formatting utilities) from `rulePreviewService.ts`. The preview service re-exports everything for backward compatibility.

**Why**: `rulePreviewService.ts` was 543 lines mixing preview generation, schedule descriptions, formatting utilities, and duplicate detection — a classic grab-bag / Large Class smell. The schedule description logic (`describeSchedule`, `computeNextRunDescription`) is consumed by `ruleExecutor.ts` and `RuleCard.tsx` independently of preview generation. The formatters (`formatRelativeTime`, `formatFilterDescription`, `formatDateOption`) are consumed by 5+ components independently.

**New module responsibilities**:
- `scheduleDescriptions.ts` — `describeSchedule`, `computeNextRunDescription`, `formatShortDate`, `formatFireAt`
- `formatters.ts` — `formatRelativeTime`, `formatDateOption`, `formatFilterDescription`
- `rulePreviewService.ts` — preview part building, duplicate detection, sentinel constant, config types

**Trade-off**: `rulePreviewService.ts` re-exports from both new modules for backward compatibility. Existing consumers don't need to change imports. New code should import from the canonical module.

## 26. Removed `events.ts` backward-compat shim

**Decision**: Deleted `features/automations/events.ts` which was a 6-line re-export of `emitDomainEvent`, `subscribeToDomainEvents`, `unsubscribeAll` from `@/lib/events`.

**Why**: No consumers imported from it. The barrel `index.ts` re-exported from it, but no external code imported those event functions from the automations barrel. Dead code.

## 27. Extracted `ruleFactory.ts` from `useAutomationRules` hook

**Decision**: Moved `createRuleWithMetadata()` from a module-level function in `hooks/useAutomationRules.ts` to `services/rules/ruleFactory.ts`.

**Why**: Architecture rule #5 — no inline entity construction in components/hooks. The function generates `id` (via `uuidv4()`), `createdAt`/`updatedAt` timestamps, and computes `order`. This is entity creation logic that belongs in the service layer.

**Trade-off**: One more import in the hook. The function is now independently testable and reusable.

## 28. Restructured `components/` into sub-folders

**Decision**: Split the flat `components/` directory (33 files) into:

| Sub-folder | Files | Responsibility |
|-----------|-------|---------------|
| `components/wizard/` | RuleDialog, StepTrigger, StepFilters, StepAction, StepReview | Multi-step rule creation/edit wizard |
| `components/schedule/` | ScheduleConfigPanel, ScheduleHistoryView, DryRunDialog | Schedule-specific UI |
| `components/` (root) | AutomationTab, RuleCard, RuleCardExecutionLog, RulePreview, SectionContextMenuItem, SectionPicker, DateOptionSelect, FilterRow, ProjectPickerDialog | Shared/top-level components |

**Why**: The flat directory had 33 files (16 source + 17 tests). The wizard steps are tightly coupled to `RuleDialog` and never used independently. The schedule components are a cohesive group. Grouping makes navigation easier and clarifies which components are public vs internal.

**Trade-off**: Deeper import paths for wizard steps. The barrel `index.ts` absorbs this for external consumers. Internal references use relative paths.

## 29. Deleted stale planning documents

**Decision**: Removed 4 `SCHEDULED-TRIGGERS-*.md` files (Architecture, PM Analysis, QA Analysis, UI/UX Analysis).

**Why**: These were pre-implementation planning artifacts from the scheduled triggers feature. The feature is fully implemented and the runtime documentation (ARCHITECTURE.md, EXTENDING.md, DATA-FLOW.md) covers everything. Planning docs in the feature folder create noise and confusion about what's current.


## 30. Extracted schedule config sub-components from ScheduleConfigPanel

**Decision**: Split `ScheduleConfigPanel.tsx` (658 lines) into 5 files:

| File | Lines | Responsibility |
|------|-------|---------------|
| `ScheduleConfigPanel.tsx` | 83 | Coordinator — routes to correct config, renders catch-up toggle |
| `IntervalConfig.tsx` | 96 | Interval: value + unit (minutes/hours/days) with range clamping |
| `CronConfig.tsx` | 295 | Cron: picker mode (daily/weekly/monthly tabs) or expression mode |
| `OneTimeConfig.tsx` | 130 | One-time: date picker + time selectors + past-time warning |
| `DueDateRelativeConfig.tsx` | 83 | Due-date-relative: offset + unit + direction (before/after) |

**Why**: Classic Large Class smell — 4 self-contained sub-components plus helper functions all in one file. Each config component has its own state, callbacks, and rendering logic with zero coupling to the others. The coordinator just routes by `triggerType`.

**How**: `ScheduleConfig` interface is exported from `ScheduleConfigPanel.tsx` so sub-components can import it. Helper functions (`getTodayISO`, `formatOneTimePreview`) moved with `OneTimeConfig`. `DAY_LABELS` constant moved with `CronConfig`.

**Trade-off**: Sub-components import the `ScheduleConfig` type from the parent, creating a mild circular-ish dependency direction. Acceptable because it's a type-only import and the interface is stable.

## 31. Extracted `ruleSaveService.ts` from RuleDialog's handleSave

**Decision**: Moved entity construction logic from `RuleDialog.tsx`'s `handleSave` callback into `services/rules/ruleSaveService.ts`. Two functions: `buildRuleUpdates()` (for editing) and `buildNewRuleData()` (for creating).

**Why**: Architecture rule #5 — no inline entity construction in components. The `handleSave` callback was building trigger and action objects with `as any` casts and duplicated object construction for create vs update paths. The service properly types the `Trigger` object instead of casting.

**What moved**:
- Trigger object construction (with schedule, lastEvaluatedAt, catchUpPolicy)
- Action object construction
- Auto-name generation (calls `buildPreviewString`/`buildPreviewParts`)
- Section reference validation (for clearing `brokenReason`)

**RuleDialog.tsx impact**: `handleSave` went from ~60 lines of inline construction to ~10 lines calling the service. Removed `buildPreviewParts`/`buildPreviewString` imports from the component.

**Trade-off**: One more service file. The `Trigger` type still needs `as Trigger` cast in `buildTriggerObject` because the discriminated union can't be constructed generically — but the cast is now in one place instead of two.

## 32. Removed Middle Man re-exports from rulePreviewService

**Decision**: Updated 9 source files to import directly from canonical modules (`ruleMetadata.ts`, `formatters.ts`, `scheduleDescriptions.ts`) instead of through `rulePreviewService.ts` re-exports.

**Why**: `rulePreviewService.ts` was a Middle Man — re-exporting symbols from 3 other modules "for backward compatibility." This added indirection, made dependency graphs inaccurate, and obscured the actual module boundaries. Consumers should import from the module that owns the symbol.

**Remaining re-exports**: 5 symbols (`TRIGGER_META`, `ACTION_META`, `formatFilterDescription`, `describeSchedule`, `computeNextRunDescription`) are still re-exported because co-located test files import them from `rulePreviewService` and test files were not modified in this pass. These are annotated with a comment explaining why.

**Import guideline**: New code should import from the canonical module:
- Metadata → `ruleMetadata.ts`
- Formatting → `formatters.ts`
- Schedule text → `scheduleDescriptions.ts`
- Preview building, config types, sentinel → `rulePreviewService.ts`
