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
