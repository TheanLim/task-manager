# TMS Consolidation — Implementation Tasks

> Source of truth: REVIEW-QUEUE-CONSOLIDATION.md
> Stack: Next.js + Zustand + Tailwind + shadcn/ui + Vitest + Playwright
> All new `.ts`/`.tsx` files with logic get a co-located test file.

---

## Phase A — Foundation (pure logic, no UI)

### T-00a: Extract `tmsSwitchService.ts` from `TMSHost`
**Files:** `features/tms/services/tmsSwitchService.ts` (new), `features/tms/components/TMSHost.tsx` (refactor)
**Test:** `features/tms/services/tmsSwitchService.test.ts`

**Signature (arch rule #4 — no whole-blob interfaces):**
```ts
executeTMSSwitch(
  fromId: TMSSystemId,
  toId: TMSSystemId,
  tasks: Task[],
  systemStates: Record<TMSSystemId, SystemState>,
): { newActiveSystem: TMSSystemId; systemStateUpdates: Partial<Record<TMSSystemId, SystemState>> }
```
`systemStates` is the per-system state map only — **not** the full `tmsStore` blob. `fromId`/`toId` are already separate params. `tasks` is the filtered task array passed to `onActivate`. No other store data is needed by the switch logic.

**Test cases:**
- `executeTMSSwitch('none', 'af4', tasks, systemStates)` → `{ newActiveSystem: 'af4', systemStateUpdates: { af4: <af4InitialState> } }`
- `executeTMSSwitch('af4', 'fvp', tasks, systemStates)` → calls AF4 `onDeactivate` first, then FVP `onActivate`; returns `{ newActiveSystem: 'fvp', systemStateUpdates: { fvp: <fvpInitialState> } }`
- `executeTMSSwitch('fvp', 'none', tasks, systemStates)` → calls FVP `onDeactivate`; returns `{ newActiveSystem: 'none', systemStateUpdates: {} }`
- Return value `systemStateUpdates` contains only the systems that changed — not the full state map
- Pure function — no store imports; same inputs always produce same outputs (mock handlers via dependency injection or test registry)
- DIT day-rollover toast logic is NOT in this service — it remains in `TMSHost` as a side effect after applying the returned deltas

**Deps:** none
**Size:** M

---

### T-01: Add `tms.openModeSelector` to `ShortcutAction`
**Files:** `features/keyboard/types.ts`
**Test:** `features/keyboard/services/shortcutService.test.ts` (compile check)
**Test cases:**
- Type compiles; existing 21 actions unchanged
**Deps:** none
**Size:** S

---

### T-02: Register `Shift+R` default binding in `shortcutService`
**Files:** `features/keyboard/services/shortcutService.ts`
**Test:** `features/keyboard/services/shortcutService.test.ts`
**Test cases:**
- `getDefaultShortcutMap()` contains `tms.openModeSelector` with key `shift+r`
- `task.reinsert` still maps to `r` (no regression)
- Total binding count is 22
**Deps:** T-01
**Size:** S

---

### T-03: Write `tms-copy.ts`
**Files:** `features/tms/copy/tms-copy.ts` (new)
**Test:** `features/tms/copy/tms-copy.test.ts`
**Test cases:**
- `fvpProgress(0, 0)` → `'FVP — 0 of 0'`
- `fvpProgress(7, 23)` → `'FVP — 7 of 23'`
- `fvpProgressNarrow(7, 23)` → `'FVP 7/23'`
- All static strings are non-empty strings
- `confirmDialog.fvpBody(18, 30)` contains "18 of 30"
- `srAnnouncements.activated.FVP` contains "snapshotted"
- `confirmDialog.toFvpBody('DIT')` contains "DIT" and "snapshot"
- `popover.options.FVP.description` contains "session start" (snapshot caveat — Risk 2 mitigation)
**Deps:** none
**Size:** S

---

### T-04: Write `fvpSnapshotService.ts`
**Files:** `features/tms/services/fvpSnapshotService.ts` (new)
**Test:** `features/tms/services/fvpSnapshotService.test.ts`
**Test cases:**
- `buildFvpSnapshot([])` → `[]`
- `buildFvpSnapshot(tasks)` returns array of all task IDs
- `isTaskInSnapshot('id', ['id', 'other'])` → `true`
- `isTaskInSnapshot('missing', ['id'])` → `false`
- Completed tasks ARE included in snapshot (completion checked at render time, not snapshot time)
- Pure function — same input always produces same output
**Deps:** none
**Size:** S

---

### T-05: Write `flags.ts`
**Files:** `features/tms/flags.ts` (new)
**Test:** none (constants only)
**Deps:** none
**Size:** S

---

### T-06: Extend FVP system state with `snapshotTaskIds`
**Files:** `features/tms/stores/tmsStore.ts` (type + initial state only)
**Test:** `features/tms/stores/tmsStore.test.ts`
**Test cases:**
- FVP initial state includes `snapshotTaskIds: []`
- `applySystemStateDelta('fvp', { snapshotTaskIds: ['a', 'b'] })` merges correctly
- `clearSystemState('fvp')` resets to initial state including `snapshotTaskIds: []`
- Existing migration (`migrateTMSState`) handles blobs without `snapshotTaskIds` (defaults to `[]`)
**Deps:** none
**Size:** S

---

### T-07: Remove `needsAttentionSort` from `appStore`
**Files:** `stores/appStore.ts`, `features/tasks/components/GlobalTasksView.tsx`, `app/page.tsx`
**Test:** `stores/appStore.test.ts`, `features/tasks/components/GlobalTasksHeader.test.tsx`, `features/tasks/components/TaskList.tms-props.test.tsx`
**Test cases:**
- `appStore` no longer exposes `needsAttentionSort` or `setNeedsAttentionSort`
- `GlobalTasksView` no longer reads `needsAttentionSort` (uses `tmsStore.activeSystem` instead for completed-task filtering)
- `GlobalTasksView` passes `showReinsertButton={activeSystem !== 'none'}` to `TaskList` — replaces the old `showReinsertButton={needsAttentionSort}` prop; verify the prop is updated at the call site and the test asserts the new expression
- `app/page.tsx` `onReinsertTask` guard updated: `task.reinsert` only fires when `tmsStore.activeSystem !== 'none'` — covers AF4, DIT, FVP, and Standard (all active sessions)
- `onReinsertTask` with `activeSystem='af4'` fires the reinsert handler
- `onReinsertTask` with `activeSystem='dit'` fires the reinsert handler (DIT supports skip-and-requeue)
- `onReinsertTask` with `activeSystem='none'` does NOT fire the reinsert handler
- Existing persisted blob with stale `needsAttentionSort` key rehydrates without error
- `TaskList.tms-props.test.tsx` mock updated to remove `needsAttentionSort`
**Deps:** none
**Size:** M

> **Note:** `task.reinsert` is allowed for all non-none modes (not just AF4/FVP). DIT has a "do it tomorrow" mechanic that maps to reinsert. Standard mode is a sorted review — reinsert is meaningful there too. The guard `activeSystem !== 'none'` is correct as written.

> **`showReinsertButton` note:** `GlobalTasksView` currently passes `showReinsertButton={needsAttentionSort}` to `TaskList`. This prop must be updated to `showReinsertButton={activeSystem !== 'none'}` in this task. T-20 does not touch this prop — it must be handled here to avoid a broken intermediate state after T-07 ships.

---

## Phase B — Core UI (pill, popover, mode switching)

### T-08: Write `useTMSModeSelector` hook
**Files:** `features/tms/hooks/useTMSModeSelector.ts` (new)
**Test:** `features/tms/hooks/useTMSModeSelector.test.ts`

> **Arch rule #2 note:** `useTMSModeSelector` is a React hook (UI layer) — store imports are permitted. The `filterStore` import is read-only, used only to get the current filtered task list at FVP snapshot time. If this hook is ever extracted into a pure service, the snapshot task array must be passed in as a parameter instead.

> **FVP snapshot writer (resolved):** `useTMSModeSelector` writes `snapshotTaskIds` via `applySystemStateDelta` immediately after `executeTMSSwitch` returns — **not** the FVP handler's `onActivate`. The hook has access to the current `filteredTasks` at activation time; the handler does not. The handler's `onActivate` handles algorithm-internal initialization only (e.g., resetting `markedOrder`).

**Test cases:**
- Switching from `none` to `af4` calls `setActiveSystem('af4')` and runs activation lifecycle
- Switching from `none` to `fvp` calls `applySystemStateDelta('fvp', { snapshotTaskIds: [...] })` with the current filtered task IDs — snapshot is written by the hook, not the handler
- Switching from in-progress FVP (dottedTasks.length > 0) to AF4 sets `isConfirmDialogOpen=true` without switching yet
- `confirmSwitch()` completes the switch and closes dialog
- `cancelSwitch()` leaves `activeSystem` unchanged and closes dialog
- Switching to `none` never opens dialog (immediate)
- Switching from AF4 with `markedOrder.length > 0` to DIT opens dialog
- Switching from AF4 with `markedOrder.length === 0` to DIT switches immediately (no dialog)
- Switching from Standard to any mode switches immediately (no dialog)
- Scroll position saved on activate, restored on exit (via `scrollContainerRef` passed as parameter)
- `openModeSelector()` sets `isPopoverOpen=true`
- Hook signature: `useTMSModeSelector(scrollContainerRef: React.RefObject<HTMLElement>)` — ref is passed in, not created inside the hook
- `isPopoverOpen` is exposed in the return value so `useGlobalShortcuts` can suppress Escape-to-exit-mode when the popover is open
**Deps:** T-00a, T-04, T-06
**Size:** M

---

### T-09: Write `ModeSwitchDialog`
**Files:** `features/tms/components/ModeSwitchDialog.tsx` (new)
**Test:** `features/tms/components/ModeSwitchDialog.test.tsx`
**Test cases:**
- Renders FVP variant: title "Switch to AF4?", body contains "18 of 30", confirm button "Switch to AF4"
- Renders generic variant: body contains "DIT session will end", no progress count
- Renders to-FVP variant: body contains "snapshot"
- `Escape` key triggers `onCancel`
- Focus lands on Cancel button on open
- Confirm button triggers `onConfirm`
- No store imports in component file
- **While dialog is open, `TMSModePill` has `aria-disabled="true"` and `pointer-events-none`** — the pill cannot be clicked to open the popover while the dialog is active (see T-14 disabled state)
**Deps:** T-03
**Size:** M

---

### T-10: Write `TMSModeOption`
**Files:** `features/tms/components/TMSModeOption.tsx` (new)
**Test:** covered by T-11
**Deps:** T-03
**Size:** S

---

### T-11: Write `TMSModePopover`
**Files:** `features/tms/components/TMSModePopover.tsx` (new)
**Test:** `features/tms/components/TMSModePopover.test.tsx`
**Test cases:**
- Renders 5 options (None, AF4, DIT, FVP, Standard)
- Pressing `1` calls `onSelect('af4')`
- Pressing `2` calls `onSelect('dit')`
- Pressing `3` calls `onSelect('fvp')`
- Pressing `4` calls `onSelect('standard')`
- Pressing `0` calls `onSelect('none')`
- `↓` moves focus to next option; wraps from last to first
- `↑` moves focus to previous option; wraps from first to last
- `Escape` calls `onClose` without calling `onSelect`
- `Enter` on focused option calls `onSelect` with that option's id
- Active option has `aria-selected="true"`; others have `aria-selected="false"`
- `role="listbox"` on container, `role="option"` on each item
- **`prefers-reduced-motion`:** open/close animation classes use `motion-safe:` Tailwind variant — users with `prefers-reduced-motion: reduce` get instant show/hide (assert `motion-safe:animate-in` class is present, not bare `animate-in`)
**Deps:** T-10
**Size:** M

---

### T-12: Write `FVPProgressChip`
**Files:** `features/tms/components/FVPProgressChip.tsx` (new)
**Test:** `features/tms/components/FVPProgressChip.test.tsx`
**Test cases:**
- Renders "FVP — 7 of 23" for `progress=7, total=23`
- Has `aria-live="polite"` and `aria-atomic="true"`
- `aria-label` contains "7 of 23"
- Renders "(filtered)" suffix when `isFiltered=true`
- Does not render "(filtered)" when `isFiltered=false`
- Has `hidden md:inline-flex` classes (hidden below 768px breakpoint)
- Has `min-w-[96px]` to prevent layout jitter as numbers change

> **UI/UX Review note:** At `< 768px` the chip is hidden and the count moves into the pill label as `fvpProgressNarrow`. The pill's max-width at narrow sizes is `max-w-[96px]` with `truncate` to prevent overflow on large counts.

**Deps:** T-03
**Size:** S

---

### T-13: Write `FilteredBadge`
**Files:** `features/tms/components/FilteredBadge.tsx` (new)
**Test:** covered by T-15
**Note:** At `< 768px` the badge is hidden (`hidden md:inline-flex`). The filter state at narrow widths is communicated via the pill icon changing from `ChevronDown` to `FilterIcon` (12px) when a mode is active and filters are on. See T-14 for the pill `aria-label` filtered variant.
**Deps:** T-03
**Size:** S

---

### T-14: Write `TMSModePill`
**Files:** `features/tms/components/TMSModePill.tsx` (new)
**Test:** `features/tms/components/TMSModePill.test.tsx`
**Test cases:**
- Idle state renders label "Review" and `aria-label="TMS mode: Review (inactive)"`
- Active AF4 state renders label "AF4" and `aria-label="TMS mode: AF4 (active)"`
- Active FVP + filters active renders `aria-label="TMS mode: FVP (active, filtered)"`
- `aria-haspopup="listbox"` always present
- `aria-expanded="false"` when closed, `"true"` when open
- Clicking pill opens `TMSModePopover`
- `ModeSwitchDialog` renders when `isConfirmDialogOpen=true`
- `FVPProgressChip` renders only when `activeSystem === 'fvp'`
- `FilteredBadge` renders when mode is active AND at least one filter is active
- `FilteredBadge` does not render when mode is active but no filters active
- `FilteredBadge` does not render when mode is `none`
- **Disabled state:** when `isConfirmDialogOpen=true`, pill has `aria-disabled="true"` and `pointer-events-none` — clicking does NOT open the popover
- At narrow widths (`< 768px`): pill renders icon-only (no text label); when mode active + filters on, icon is `FilterIcon` instead of `ChevronDown`
**Deps:** T-08, T-09, T-11, T-12, T-13
**Size:** L

---

### T-15: Wire `TMSModePill` into `GlobalTasksHeader`
**Files:** `features/tasks/components/GlobalTasksHeader.tsx`, `features/tasks/components/GlobalTasksContainer.tsx`
**Test:** `features/tasks/components/GlobalTasksHeader.test.tsx`

> **`scrollContainerRef` placement decision (Lead SDE):** The ref is created in `GlobalTasksContainer` (the component that owns the `overflow-auto` scroll div) and threaded down via props: `GlobalTasksContainer` → `GlobalTasksHeader` → `TMSModePill` → `useTMSModeSelector(scrollContainerRef)`. This is the correct owner — the ref must point to the actual scroll container DOM node, which is rendered by `GlobalTasksContainer`. A context-based approach (passing via React context instead of props) was considered but rejected: the prop chain is only 3 levels deep and the ref is only needed by `TMSModePill`. If the chain grows beyond 3 levels in a future refactor, migrate to context then.

**Test cases:**
- `TMSModePill` renders in toolbar
- Old `needsAttentionSort` / "Review Queue" button is absent
- Pill is positioned between filter controls and Add Task button
- `scrollContainerRef` is created in `GlobalTasksContainer` via `useRef<HTMLElement>()` and passed down to `GlobalTasksHeader` → `TMSModePill` → `useTMSModeSelector(scrollContainerRef)` — verify the ref prop is threaded through all three layers
- `GlobalTasksHeader` accepts a `scrollContainerRef: React.RefObject<HTMLElement>` prop (new)
- Small-screen snapshot: pill collapses to icon-only (no text label)
**Deps:** T-07, T-14
**Size:** M

---

## Phase C — Task List Integration

### T-16: Write `useTMSOrderedTasks` hook
**Files:** `features/tms/hooks/useTMSOrderedTasks.ts` (new)
**Test:** `features/tms/hooks/useTMSOrderedTasks.test.ts`
**Test cases:**
- `activeSystem='none'` returns input array reference unchanged (no re-order)
- `activeSystem='af4'` returns `handler.getOrderedTasks(tasks, state)` result
- Handler receives already-filtered tasks (mock verifies input is the filtered array, not raw store tasks)
- Memoises: same `filteredTasks` reference + same `activeSystem` → same output reference
- `activeSystem='fvp'` returns FVP-ordered tasks using current `snapshotTaskIds`

> **⚠️ `useMemo` reference stability (Lead SDE):** The memo guarantee "same `filteredTasks` reference → same output reference" only holds if the caller passes a stable array reference. If `GlobalTasksView` derives `filteredTasks` via an inline `.filter()` call, a new array is produced on every render and the memo never hits — defeating the purpose. **Before implementing T-20, verify that `GlobalTasksView` wraps its filter call in `useMemo` (or equivalent).** If it does not, add a `useMemo` around the filter derivation in T-20 as part of that task. Add a verification checklist item: `grep -r "\.filter(" features/tasks/components/GlobalTasksView` and confirm the result is memoised.

**Deps:** T-06
**Size:** M

---

### T-17: Write `useFVPSessionState` hook
**Files:** `features/tms/hooks/useFVPSessionState.ts` (new)
**Test:** `features/tms/hooks/useFVPSessionState.test.ts`
**Test cases:**
- `isInSnapshot('id-in-snap')` → `true`; `isInSnapshot('id-not-in-snap')` → `false`
- `isOutsideFilter('id-in-snap')` → `true` when task is in snapshot but not in `visibleTasks`
- `isOutsideFilter('id-in-snap')` → `false` when task is in snapshot AND in `visibleTasks`
- `progress` = count of snapshot IDs present in `visibleTasks` and not completed
- `total` = `snapshotTaskIds.length`
- `isFiltered` = `true` when `snapshotTaskIds.length !== visibleTasks.length`
- Returns all-zero/false state when `activeSystem !== 'fvp'`
**Deps:** T-06
**Size:** M

---

### T-18: Write `TMSCandidateRow`
**Files:** `features/tms/components/TMSCandidateRow.tsx` (new)
**Test:** `features/tms/components/TMSCandidateRow.test.tsx`
**Test cases:**
- `isCandidate=true, mode='af4'` → applies `border-l-violet-500` and `bg-violet-950/30`
- `isCandidate=true, mode='dit'` → applies `border-l-amber-500` and `bg-amber-950/30`
- `isCandidate=true, mode='fvp'` → applies `border-l-blue-500` and `bg-blue-950/30`
- `isCandidate=false` → no border/tint classes; children rendered unchanged
- `transition-all duration-200` present when `isCandidate=true`
- **`mode='standard', isCandidate=true` → no border class, no tint class, no `opacity-60` on siblings — Standard is a passthrough; `TMSCandidateRow` renders children unchanged**
- **`mode='standard', isCandidate=false` → same as above — no visual treatment**
**Deps:** none
**Size:** S

---

### T-19: Write `TMSInlineNotice`
**Files:** `features/tms/components/TMSInlineNotice.tsx` (new)
**Test:** `features/tms/components/TMSInlineNotice.test.tsx`
**Test cases:**
- `variant='info'` renders `role="status"` with info styling
- `variant='warning'` renders `role="alert"` with warning styling
- `variant='success'` renders `role="status"` with success styling
- `autoDismiss=4000` calls `onDismiss` after 4000ms (use `vi.useFakeTimers()`)
- Dismiss `×` button calls `onDismiss` immediately
- `actions` prop renders action buttons; each action has shape `{ label: string; onClick: () => void; variant: 'secondary' | 'ghost-destructive' }` — `secondary` gets amber border/text (safe action), `ghost-destructive` gets zinc border/text (destructive action)
- `aria-live="polite"` for info/success; `aria-live="assertive"` for warning
- **Enter animation:** has `motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 duration-200` classes — `motion-safe:` prefix ensures no animation when `prefers-reduced-motion: reduce` is set
- **Exit animation:** has `motion-safe:animate-out motion-safe:fade-out-0 motion-safe:slide-out-to-top-2 duration-150` classes on dismiss (not present on non-dismissible `warning` variant)
- **`prefers-reduced-motion` test:** render with `prefers-reduced-motion: reduce` media query mocked; assert the component still renders and `onDismiss` still fires after `autoDismiss` — only the CSS transition is suppressed, not the timer
- **Focus on dismiss:** when `×` button is clicked, `onDismiss` is called; the caller is responsible for moving focus (e.g., to first task row) — the component itself does not manage post-dismiss focus
**Deps:** T-03
**Size:** M

---

### T-20: Apply TMS ordering in `GlobalTasksView`
**Files:** `features/tasks/components/GlobalTasksView.tsx`
**Test:** `features/tasks/components/GlobalTasksView.test.tsx` (update/create)
**Test cases:**
- With `activeSystem='af4'`, task list order matches `handler.getOrderedTasks` output
- With `activeSystem='none'`, task list order is unchanged from filter output
- Filter change re-runs ordering with new filtered set (not stale)
- `needsAttentionSort` references removed; completed-task filtering now uses `activeSystem !== 'none'` as the equivalent guard
**Deps:** T-07, T-16
**Size:** M

---

### T-21: Candidate highlight + dimming + notices in `TaskList`/`GlobalTasksView`
**Files:** `features/tasks/components/GlobalTasksView.tsx`, `features/tasks/components/TaskList.tsx`
**Test:** `features/tasks/components/TaskList.test.tsx` (update)
**Test cases:**
- Current candidate row has `TMSCandidateRow` wrapper with correct mode
- Non-candidate rows have `opacity-60` class when mode is active (AF4, DIT, FVP)
- **No `opacity-60` when `activeSystem='standard'`** — Standard mode applies no dimming; all rows render at full opacity
- No `opacity-60` when `activeSystem='none'`
- "View changed" notice renders after Nested/Flat toggle while mode active; auto-dismisses after 4s
  - `GlobalTasksView` watches `globalTasksDisplayMode` via a `useEffect`; when it changes while `activeSystem !== 'none'`, it sets a `viewChangedNotice` boolean that triggers the banner
  - Test: render with `activeSystem='dit'`, toggle `globalTasksDisplayMode` from `'nested'` to `'flat'`, assert `TMSInlineNotice` with text "View changed — candidate pool updated." appears
- "Queue complete" notice renders when queue exhausted; auto-dismisses after 6s; mode resets to `none`
  - Queue exhaustion is detected in `GlobalTasksView`: when `activeSystem !== 'none'` and `orderedTasks.length === 0` and the previous `orderedTasks.length` was `> 0`, fire the "queue complete" notice and call `switchMode('none')` after the dismiss delay
  - **⚠️ 6-second window (Lead SDE):** During the 6 seconds between queue exhaustion and `switchMode('none')`, `activeSystem` is still non-`none` but `orderedTasks` is empty. `useTMSOrderedTasks` returns `[]` and `TMSCandidateRow` has nothing to highlight — this is correct and intentional. The pill still shows the active mode name (e.g., "AF4 ▾") during this window. This is the intended behavior: the notice is the signal to the user; the mode resets only after they've seen it. Document this in a code comment at the `useEffect` call site.
  - Test: render with `activeSystem='af4'` and a non-empty task list; complete all tasks; assert notice appears and `activeSystem` becomes `'none'` after 6s
- "No FVP candidates" notice renders when `activeSystem='fvp'` and all snapshot tasks are outside current filter
- DIT `todayTasks` filtering: when `activeSystem='dit'`, completed tasks are excluded from the DIT candidate pool (the DIT handler's `getOrderedTasks` receives only non-completed tasks when hide-completed is off — verify the handler itself filters, or that `GlobalTasksView` pre-filters completed tasks before passing to the DIT handler)
- AF4 `markedOrder` cleanup: when a task is completed mid-AF4 session, `markedOrder` no longer contains that task's ID — verify `useTMSOrderedTasks` or the AF4 handler drops completed task IDs from `markedOrder` on the next render cycle
- **Task list reorder on mode change is instant** — no animated reorder; scroll resets to top; the new candidate row's `transition-all duration-200` highlight is the only transition
**Deps:** T-17, T-18, T-19, T-20
**Size:** L

---

### T-22: FVP "Not in session" badge + outside-filter separator in `TaskRow`
**Files:** `features/tasks/components/TaskRow.tsx`
**Test:** `features/tasks/components/TaskRow.test.tsx` (update)
**Test cases:**
- Badge "Not in session" renders when `isNotInFvpSession=true`
- Badge absent when `isNotInFvpSession=false`
- `aria-label="This task was added after the FVP session started"` on badge
- Separator "FVP candidate · outside current filter" renders above task when `isOutsideFvpFilter=true`
- Separator absent when `isOutsideFvpFilter=false`
**Deps:** T-17
**Size:** M

---

### T-23: "No FVP candidates" empty state + actions
**Files:** `features/tasks/components/GlobalTasksView.tsx`
**Test:** `features/tasks/components/GlobalTasksView.test.tsx` (update)
**Test cases:**
- Notice renders when `activeSystem='fvp'` and all snapshot tasks are outside current filter
- "Clear filters" button calls `filterStore.clearFilters()`
- "End session" button calls `switchMode('none')`
- Notice does NOT auto-dismiss (requires user action)
- `role="alert"` on notice container
**Deps:** T-17, T-19
**Size:** M

---

## Phase D — Keyboard

### T-24: Register `tms.openModeSelector` in `useGlobalShortcuts`
**Files:** `features/keyboard/hooks/useGlobalShortcuts.ts`
**Test:** `features/keyboard/hooks/useGlobalShortcuts.test.ts` (update)

> **⚠️ Breaking interface change (Lead SDE):** Adding `onOpenModeSelector` to `UseGlobalShortcutsOptions` is a breaking change. Every call site of `useGlobalShortcuts` must pass the new prop. Before implementing, run `grep -r "useGlobalShortcuts(" features/ src/` to find all call sites. If there is more than one, update all of them in this task. Add a verification checklist item (see Phase 1 checklist).

**Test cases:**
- `Shift+R` on body calls `onOpenModeSelector()`
- `Shift+R` while focus is in `<input>` does NOT call `onOpenModeSelector()`
- `Shift+R` while focus is in `<textarea>` does NOT call `onOpenModeSelector()`
- Uses same `hotkeyOpts` + `isInputContext` guard pattern as existing shortcuts
- `UseGlobalShortcutsOptions` interface gains `onOpenModeSelector: () => void`
**Deps:** T-02, T-08
**Size:** S

---

### T-25: `Escape` exits active mode via global shortcut
**Files:** `features/keyboard/hooks/useGlobalShortcuts.ts`
**Test:** `features/keyboard/hooks/useGlobalShortcuts.test.ts` (update)

> **⚠️ Breaking interface change (Lead SDE):** T-25 adds `onExitMode`, `isModeActive`, and `isModePopoverOpen` to `UseGlobalShortcutsOptions`. Combined with T-24's `onOpenModeSelector`, this is a 4-prop addition to an existing interface. Implement T-24 and T-25 in the same pass to avoid two separate breaking changes. The single call site grep from T-24 covers both tasks.

**Test cases:**
- `Escape` while `activeSystem !== 'none'` and no popover/dialog open calls `onExitMode()`
- `Escape` while popover is open does NOT call `onExitMode()` (popover handles it) — requires `isModePopoverOpen: boolean` in `UseGlobalShortcutsOptions` so the global handler can check before firing
- `Escape` while `activeSystem='none'` does NOT call `onExitMode()`
- `UseGlobalShortcutsOptions` interface gains `onExitMode: () => void`, `isModeActive: boolean`, and `isModePopoverOpen: boolean`
- `isModePopoverOpen` is sourced from `useTMSModeSelector`'s `isPopoverOpen` return value and threaded into `useGlobalShortcuts` at the call site in `GlobalTasksContainer` (or wherever `useGlobalShortcuts` is called)
**Deps:** T-08
**Size:** S

---

### T-26: Add "Review mode" section to `ShortcutHelpOverlay`
**Files:** `features/keyboard/components/ShortcutHelpOverlay.tsx`
**Test:** `features/keyboard/components/ShortcutHelpOverlay.test.tsx` (update)
**Test cases:**
- "Review mode" section header renders
- Entry for `Shift+R` with description "Open the review mode selector" renders
- Entry for `Escape` with description "Exit the active review mode" renders
- Section appears after existing sections (not before)
**Deps:** T-02, T-03
**Size:** S

---

## Phase E — Rollout

### T-27: Write `NudgeBanner` (Phase 2)
**Files:** `features/tms/components/NudgeBanner.tsx` (new)
**Test:** `features/tms/components/NudgeBanner.test.tsx`
**Test cases:**
- Renders when `ENABLE_TMS_NUDGE_BANNER=true`
- Does not render when flag is `false`
- Dismiss button writes `tms-nudge-dismissed=true` to localStorage
- Does not render when localStorage key is present (dismissed)
- CTA link text is "Take me there →"
- `aria-label="Dismiss this notice"` on dismiss button
**Deps:** T-05, T-03
**Size:** M

---

### T-27b: Wire `NudgeBanner` into the Focus tab page (Phase 2)
**Files:** Focus tab page component (find via `grep -r "Focus" app/` — same file touched by T-28)
**Test:** existing Focus tab page test or new `FocusTabPage.test.tsx`
**Test cases:**
- `NudgeBanner` renders at the top of the Focus tab content when `ENABLE_TMS_NUDGE_BANNER=true`
- `NudgeBanner` is absent when flag is `false`
- `NudgeBanner` renders above the existing Review Queue UI (not below it)
- Dismissing the banner does not affect the Review Queue below it
**Deps:** T-27
**Size:** S

> **Why this task exists:** T-27 creates the component but nothing wires it into the Focus tab page. T-28 gates the nav item but does not add the banner to the page content. Without this task the banner is built but never shown.

---

### T-28: Gate Focus tab on `ENABLE_FOCUS_TAB` flag
**Files:** Navigation component (find via `grep -r "Focus" app/`), Focus tab page component
**Test:** existing nav tests (update)
**Test cases:**
- Focus tab nav item absent when `ENABLE_FOCUS_TAB=false`
- Focus tab nav item present when `ENABLE_FOCUS_TAB=true`
- Navigating to Focus tab URL when flag is `false` calls `router.replace` to All Tasks (client-side redirect per OQ-7 resolution — Focus tab page component renders `null` and calls `router.replace('/all-tasks')` on mount)
- No runtime error when flag is `false` and Focus tab URL is visited
- Redirect test: render Focus tab page with `ENABLE_FOCUS_TAB=false`; assert `router.replace` was called with the All Tasks route
**Deps:** T-05
**Size:** S

---

### T-29: Phase 3 one-time migration tooltip on `TMSModePill`
**Files:** `features/tms/components/TMSModePill.tsx`
**Test:** `features/tms/components/TMSModePill.test.tsx` (update)
**Test cases:**
- Tooltip "Review Queue moved here. Select a mode to start a session." renders when `hadFocusTab` localStorage key is present
- Tooltip does not render when key is absent
- Tooltip does not render after first dismissal (key removed or dismissed flag set)
**Deps:** T-14
**Size:** S

---

### T-29b: Set `hadFocusTab` localStorage marker when user visits the Focus tab
**Files:** Focus tab page component (same file as T-28)
**Test:** Focus tab page test (update)
**Test cases:**
- Visiting the Focus tab page writes `hadFocusTab=true` to localStorage on mount (when `ENABLE_FOCUS_TAB=true`)
- Key is written even if the user immediately navigates away
- Key is NOT written when `ENABLE_FOCUS_TAB=false` (tab is hidden; user can't visit it)
- Writing the key is idempotent — calling it multiple times does not cause errors
**Deps:** T-28
**Size:** S

> **Why this task exists:** T-29 reads `hadFocusTab` to decide whether to show the migration tooltip, but nothing sets it. Without this task, the tooltip never appears for any user — the Phase 3 migration UX is silently broken.

---

## E2E Tests

**File:** `e2e/tms-consolidation.spec.ts`

| # | Scenario |
|---|----------|
| E-01 | Pill renders in All Tasks toolbar with label "Review" |
| E-02 | Click pill opens popover with 5 options |
| E-03 | `Shift+R` opens popover |
| E-04 | `Shift+R` suppressed when focus is in inline add input |
| E-05 | Press `1` in popover → AF4 activates, pill shows "AF4", candidate highlight visible |
| E-06 | Press `3` in popover → FVP activates, progress chip shows "FVP — 0 of N" |
| E-07 | FVP progress chip increments after comparison |
| E-08 | Task added mid-FVP shows "Not in session" badge; progress total unchanged |
| E-09 | Active mode + active filter → "Filtered" badge appears |
| E-10 | `Escape` exits mode; pill returns to "Review"; scroll position restored |
| E-11 | Mid-session FVP → press `1` → confirmation dialog appears |
| E-12 | Confirm switch → FVP state discarded, AF4 activates |
| E-13 | Cancel switch → FVP session preserved |
| E-14 | Switching to None never shows dialog |
| E-15 | Queue exhausted → "Queue complete" notice → mode resets after 6s |
| E-16 | All Tasks features (inline add, filter, Nested/Flat) work during active TMS session |
| E-17 | Nested mode: subtasks not in AF4 candidate pool |
| E-18 | Flat toggle during DIT → "View changed" banner appears |
| E-19 | Phase 2 nudge banner visible in Focus tab when flag enabled |
| E-20 | Focus tab hidden when `ENABLE_FOCUS_TAB=false`; URL redirects to All Tasks |
| E-21 | Complete all tasks mid-AF4 session → queue exhausted notice fires, mode resets to none |
| E-22 | `Escape` while mode selector popover is open closes popover only — does NOT exit the active mode |

---

## Dependency Graph

```
T-00a ──────────────────────────────────────────► T-08
T-01 ──► T-02 ──────────────────────────────────► T-24, T-25, T-26
T-03 ──► T-09, T-12, T-13, T-19, T-26, T-27
T-04 ──► T-08
T-05 ──► T-27, T-28
T-06 ──► T-08, T-16, T-17
T-07 ──► T-15, T-20
T-08 ──► T-14, T-24, T-25
T-09 ──► T-14
T-10 ──► T-11
T-11 ──► T-14
T-12 ──► T-14
T-13 ──► T-15 (via T-14)
T-14 ──► T-15, T-29
T-15 (done) → Phase C unblocked
T-16 ──► T-20, T-21
T-17 ──► T-21, T-22, T-23
T-18 ──► T-21
T-19 ──► T-21, T-23
T-20 ──► T-21, T-23
T-21, T-22, T-23 → Phase D unblocked
T-27 ──► T-27b
T-28 ──► T-27b, T-29b
T-29b must ship before T-29 is meaningful (sets the key T-29 reads)
```

## Verification Checklist (before shipping Phase 1)

- [ ] `grep -r needsAttentionSort src/` returns zero results
- [ ] `grep -r needsAttentionSort features/` returns zero results
- [ ] `grep -r showReinsertButton features/` confirms the prop is `activeSystem !== 'none'` (not `needsAttentionSort`) at the `GlobalTasksView` → `TaskList` call site
- [ ] `grep -r isModePopoverOpen features/` confirms it is threaded from `useTMSModeSelector` → `useGlobalShortcuts` call site
- [ ] `grep -r "useGlobalShortcuts(" features/ src/` — confirm all call sites pass `onOpenModeSelector`, `onExitMode`, `isModeActive`, and `isModePopoverOpen` (T-24/T-25 breaking interface change)
- [ ] `grep -r "\.filter(" features/tasks/components/GlobalTasksView` — confirm the filtered task array passed to `useTMSOrderedTasks` is wrapped in `useMemo` (reference stability for memo hit — see T-16 note)
- [ ] `npx vitest run` — all pass
- [ ] `npm run lint` — zero errors
- [ ] `npx next build` — zero errors
- [ ] All 22 E2E scenarios pass in `e2e/tms-consolidation.spec.ts`
- [ ] Full existing E2E suite passes (no regressions)

## Verification Checklist (before shipping Phase 2)

- [ ] `NudgeBanner` is rendered inside the Focus tab page component (T-27b)
- [ ] `ENABLE_TMS_NUDGE_BANNER=true` env var causes banner to appear in Focus tab; `false` hides it
- [ ] E2E scenario E-19 passes with `ENABLE_TMS_NUDGE_BANNER=true`

## Verification Checklist (before shipping Phase 3)

- [ ] `hadFocusTab` localStorage key is written when Focus tab page mounts with `ENABLE_FOCUS_TAB=true` (T-29b)
- [ ] Migration tooltip appears on `TMSModePill` for a session where `hadFocusTab` is present in localStorage (T-29)
- [ ] Focus tab URL redirects to All Tasks when `ENABLE_FOCUS_TAB=false` — verified by E2E scenario E-20
- [ ] `grep -r ENABLE_FOCUS_TAB src/` and `features/` — confirm all references are gated correctly and no Focus tab UI leaks through

---

## UI/UX Review Notes

Changes made during the UI/UX design review pass. Task entries above have been updated in-place; this section records the reasoning.

---

### 1. `TMSInlineNotice` action button styles (T-19)

The `actions` prop now types each action with `variant: 'secondary' | 'ghost-destructive'`. The "No FVP candidates" notice passes `[Clear filters]` as `secondary` (amber border/text, safe action) and `[End session]` as `ghost-destructive` (zinc border/text). Both are `h-7 px-3 text-xs rounded-md` — compact enough to sit inside the notice without dominating it. Button order: safe left, destructive right — consistent with `ModeSwitchDialog`.

---

### 2. `FVPProgressChip` responsive behavior (T-12)

Added `hidden md:inline-flex` and `min-w-[96px]` to the chip spec. At `< 768px` the chip is hidden and the count moves into the pill label via `fvpProgressNarrow`. The pill gets `max-w-[96px] truncate` at narrow widths to handle large counts gracefully.

---

### 3. `FilteredBadge` responsive behavior (T-13, T-14)

Badge is hidden at `< 768px` (`hidden md:inline-flex`). Filter state at narrow widths is communicated by swapping the pill's chevron icon for a `FilterIcon` (12px). The pill `aria-label` gains a `(filtered)` suffix: `"TMS mode: AF4 (active, filtered)"`.

---

### 4. `TMSInlineNotice` animation spec (T-19)

All notice variants get enter (`animate-in fade-in-0 slide-in-from-top-2 duration-200`) and exit (`animate-out fade-out-0 slide-out-to-top-2 duration-150`) animations. The non-dismissible "No FVP candidates" warning variant has enter animation only — no exit animation since it persists until user action.

---

### 5. `TMSCandidateRow` Standard mode (T-18, T-21)

`mode='standard'` is a passthrough — no border, no tint, no `opacity-60` on siblings. The wrapper is still used for structural consistency and future extensibility. Added explicit test cases for both `isCandidate=true` and `isCandidate=false` in Standard mode.

---

### 6. `TMSModePill` disabled state (T-09, T-14)

When `isConfirmDialogOpen=true`, the pill gets `aria-disabled="true"` and `pointer-events-none opacity-50`. This prevents opening the popover while the dialog is active. Added test cases to T-14 (pill disabled state) and a note to T-09 (dialog causes pill to disable).

---

### 7. Focus management — notice dismiss and auto-dismiss (T-19)

On manual dismiss (`×` click): `onDismiss` fires; the **caller** (e.g., `GlobalTasksView`) is responsible for moving focus to the first task row or Add Task button. `TMSInlineNotice` does not manage post-dismiss focus internally — it only calls `onDismiss`. On auto-dismiss: no programmatic focus movement. The `aria-live` region handles screen reader notification.

---

### 8. Toolbar density (no task change needed)

Worst-case toolbar at 768px–900px: `~232px` right group + `~160px` left group + spacer. No overflow at any defined breakpoint. The existing responsive collapse rules (chip hidden, badge hidden, pill icon-only at `< 768px`) are sufficient. No additional overflow strategy required.

---

### 9. Task list reorder transition (T-21)

Reorder on mode change is **instant** — no FLIP animation. Rationale: mode change is a deliberate user action; scroll-to-top provides the visual reset signal; Framer Motion is not in scope for this feature. The only transition is the new candidate row's `transition-all duration-200` highlight appearing. Added as an explicit test case in T-21.

---

### 10. Dark mode only (no task change needed)

The app is dark-theme only. No `dark:` Tailwind variants are needed anywhere in the TMS components. All color specs in the design doc are canonical. Documented in REVIEW-QUEUE-CONSOLIDATION.md §2 and §7 to prevent implementers from adding unnecessary light-mode variants.
