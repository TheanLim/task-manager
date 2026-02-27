# Review Queue Consolidation Plan
> Consolidating the Focus subtab's Review Queue into All Tasks view

## Context
- **Current:** Standalone "Focus" subtab with Review Queue (4 TMS modes: AF4, DIT, FVP, Standard)
- **Target:** Remove Focus subtab. Add TMS mode selector to All Tasks toolbar.
- **Why:** All Tasks has more functionality — inline add task, keyboard shortcuts, Nested/Flat toggle, hide completed filter. TMS review gains all of these for free.

## Key Decisions (from prior discussion)
- TMS modes are an **additive lens** on All Tasks, not a modal experience
- Filters pre-filter the list **before** TMS algorithm runs
- FVP needs candidate list **snapshotted** at session start
- "None" / Standard = normal All Tasks (default)
- Keyboard: `R` to open mode selector, `1–4` to pick, `Escape` to exit

---

## PM Section

### Problem Statement

The "Focus" subtab exists solely to host the Review Queue — a TMS-mode-driven view of tasks. But it's a stripped-down experience: no inline task creation, no keyboard shortcuts, no Nested/Flat toggle, no hide-completed filter. Users who want to do a TMS review session have to leave All Tasks, lose context, and work in a degraded environment.

This creates two problems:

1. **Feature fragmentation.** The same task list is surfaced in two places with different capabilities. Users learn two interaction models for what is conceptually one thing.
2. **Wasted surface area.** The Focus subtab adds navigation overhead (an extra tab click, a different URL/state) for a feature that is purely a lens on the same underlying data.

Consolidating TMS modes into All Tasks removes the split. Users get the full All Tasks toolset — filters, keyboard shortcuts, inline add, view toggles — while in a TMS review session. The Focus subtab goes away entirely, simplifying the nav and reducing the mental model.

**User value:** A power user running an AF4 or FVP session can now add tasks mid-review, filter by project, toggle flat view, and navigate entirely by keyboard — none of which were possible in the Focus subtab.

---

### Success Metrics

> **⚠️ Measurability note (PM Review):** This app is localStorage-based with no analytics backend. Metrics 1–4 below reference event counts, DAU, and session completion rates that cannot be measured without instrumentation. Before Phase 2 ships, engineering must confirm whether any lightweight event logging exists (e.g., a `console` hook, a local event log, or a planned analytics integration). If none exists, metrics 1–4 should be treated as qualitative signals (e.g., manual observation, user interviews) rather than quantitative gates. Metric 5 (support tickets) is measurable externally regardless of app architecture.

1. **Focus subtab usage drops to 0** within 2 weeks of the nudge phase going live (measured by click/navigation events on the Focus tab).
2. **TMS session start rate holds or increases** after the Focus tab is removed — measured as "user selects a non-None TMS mode" events per DAU. A drop >10% vs. pre-consolidation baseline signals the new entry point is harder to discover.
3. **Session completion rate improves** — defined as a TMS session where the user reaches the end of the review queue (no more candidates) without switching away. Baseline from Focus subtab; target: +5% or better.
4. **Zero regression in All Tasks core actions** — inline task creation, filter application, and Nested/Flat toggle usage rates stay within ±5% of pre-consolidation baseline during and after rollout.
5. **Support/feedback tickets about "missing Focus tab"** stay under 5 in the 30 days post-removal. More than that signals the removal was too abrupt or the new entry point is not discoverable enough.

---

### Rollout Plan

**Phase 1 — Coexist (1–2 sprints)**

- Ship the TMS mode selector (pill button → popover) in the All Tasks toolbar.
- All 4 modes (AF4, DIT, FVP, Standard) are available there.
- Focus subtab remains fully functional. No changes to its behavior.
- Goal: validate the new selector works correctly alongside the existing tab. Catch bugs without user impact.

**Phase 2 — Nudge (1 sprint)**

- Add a persistent but dismissible banner inside the Focus subtab: *"Review Queue is moving to All Tasks. [Take me there →]"*
- The banner links directly to All Tasks with the last-used TMS mode pre-selected.
- Log dismissals and click-throughs to measure migration rate.
- No functionality removed yet.

**Phase 3 — Remove Focus Tab (1 sprint, after nudge metrics look good)**

- Remove the Focus subtab from navigation entirely.
- Any deep-links or bookmarks to the Focus subtab redirect to All Tasks (with mode selector defaulting to the last-used mode, or None if no prior session).
- Remove the nudge banner (no longer needed).
- Ship a one-time in-app tooltip on the TMS mode pill for users who had previously used the Focus tab, pointing them to the new location.

**Gate criteria between phases:** Phase 3 only ships if Focus subtab usage has dropped below 20% of its Phase 1 baseline during Phase 2, OR after 3 weeks of Phase 2 regardless (to avoid indefinite coexistence).

> **⚠️ Gate measurability note (PM Review):** "Below 20% of Phase 1 baseline" requires event tracking that does not currently exist in this localStorage-only app. Until analytics are confirmed, the practical gate is: **3 weeks of Phase 2 with no critical bug reports and no more than 5 user complaints about the nudge banner or missing functionality.** The time-based fallback ("after 3 weeks regardless") is the operative gate for now.

---

### Risks & Mitigations

**Risk 1 — TMS mode selector is not discoverable**
Users who relied on the Focus tab as their entry point may not find the pill button in the All Tasks toolbar.
*Mitigation:* Phase 2 nudge banner with direct link. Phase 3 one-time tooltip on the pill. Keyboard shortcut `Shift+R` is documented in the keyboard shortcuts overlay. If session start rate drops >10% post-removal, ship a "What's new" callout pointing to the pill.

**Risk 2 — FVP snapshot behavior surprises users**
FVP snapshots the candidate list at session start. In the old Focus subtab, this was the only view. In All Tasks, users can add tasks mid-session. Newly added tasks won't appear in the current FVP session, which may feel like a bug.
*Mitigation:* UX copy in the FVP mode description (in the popover) explicitly states: "Candidate list is fixed at session start. New tasks appear in your next session." Engineering to confirm this is enforced correctly in the consolidated view.

**Risk 3 — Filter + TMS interaction is confusing**
Filters pre-filter before the TMS algorithm runs. A user who has an active filter may wonder why their review queue is smaller than expected.
*Mitigation:* When a TMS mode is active and filters are also active, show a subtle indicator (e.g., "Filtered" badge or count) so users know the queue is a subset. UX Writing to define the exact copy. This is a UX concern but PM owns the requirement to surface it.

**Risk 4 — Rollback complexity if Phase 3 ships with bugs**
Once the Focus tab is removed, rolling back requires re-adding navigation and restoring the old view — non-trivial mid-sprint.
*Mitigation:* Keep the Focus subtab code behind a feature flag through Phase 3. Flag defaults to off (tab hidden) but can be flipped to on in <1 hour if a critical bug surfaces post-removal. Flag cleanup happens in the sprint after Phase 3 stabilizes.

---

### Out of Scope

- **New TMS modes.** This consolidation moves existing modes; it does not add, modify, or deprecate any TMS algorithm behavior.
- **TMS mode persistence across sessions.** Whether the selected mode is remembered between browser sessions is a separate decision. For this consolidation, mode resets to None on page load (existing behavior preserved).
- **Mobile / responsive layout changes.** The pill button placement and popover design are scoped to the existing desktop layout. Mobile layout is a follow-on.
- **Analytics dashboard or reporting on TMS usage.** Metrics listed above are for internal tracking; no user-facing reporting UI is in scope.
- **Changes to how tasks are scored or ordered within TMS modes.** Algorithm logic is untouched.
- **Onboarding or empty-state flows for new users discovering TMS.** Existing onboarding is unchanged.

---

### Acceptance Criteria

- [ ] A TMS mode selector (pill button) is visible in the All Tasks toolbar when no mode is active; it opens a popover listing None, AF4, DIT, FVP, and Standard.
- [ ] Selecting a mode activates it as an additive lens — the task list re-orders/filters per the TMS algorithm, and all existing All Tasks features (inline add, filters, Nested/Flat toggle, hide completed) remain fully functional.
- [ ] "None" / Standard mode restores All Tasks to its default behavior with no TMS overlay.
- [ ] Keyboard shortcut `Shift+R` opens the mode selector popover; `1`–`4` select a mode; `Escape` closes without changing the active mode.
- [ ] FVP mode snapshots the candidate list at the moment the mode is activated; tasks added after activation do not appear in the current session's queue.
- [ ] When a TMS mode is active and one or more filters are also active, the UI indicates that the queue is filtered (exact treatment per UX spec).
- [ ] The Focus subtab is hidden (Phase 3) and any navigation to its previous route redirects to All Tasks.
- [ ] A one-time tooltip appears on the TMS pill for users who previously used the Focus subtab, pointing them to the new location.
- [ ] No regression in All Tasks core actions: inline task creation, filter application, and Nested/Flat toggle all work identically to pre-consolidation behavior.
- [ ] The feature flag controlling Focus subtab visibility exists and can be toggled without a code deploy.
- [ ] Exiting a mode (via `Escape` or selecting None) restores the scroll position to where it was before the mode was activated; exiting via queue exhaustion resets scroll to the top.
- [ ] When the queue is exhausted (all candidates reviewed or completed), a "Queue complete" notice appears and the mode resets to None automatically.
- [ ] Screen reader announcements are emitted on mode activation and exit via a hidden `aria-live="polite"` region; FVP activation announces "Candidate list snapshotted."
- [ ] The empty state when all tasks are filtered out during an active TMS session shows "No tasks match the current filters" with an option to clear filters; the empty state when all tasks are completed shows "All done — no tasks to review."

---

## Power User Section

### Workflow Scenarios

#### Scenario 1 — Starting an AF4 session while a project filter is active

1. User is in All Tasks with filter `project = "Work"` active. 14 tasks visible.
2. User presses `Shift+R` → mode selector popover opens.
3. User presses `1` (AF4). Popover closes. AF4 activates.
4. AF4 runs against the 14 filtered tasks only. The first candidate is highlighted with the AF4 prompt ("Do you want to do this task?").
5. User works through AF4 decisions. At task 7, they realize they need to add a quick task: they press `N` (inline add), type the task, press `Enter`. Task is added to the list.
6. Because AF4 does not snapshot (unlike FVP), the new task enters the AF4 candidate pool immediately and will surface when AF4's algorithm reaches it.
7. User finishes the session. Mode auto-resets to None when the queue is exhausted, or user presses `Escape` to exit early.

#### Scenario 2 — Running FVP with a mid-session filter change

1. User opens All Tasks with no filters. 40 tasks visible.
2. User presses `Shift+R` → `3` (FVP). FVP snapshots the 40-task candidate list. Progress indicator shows "FVP — 0 of 40".
3. User works through 12 comparisons. Indicator shows "FVP — 12 of 40".
4. User decides to narrow focus: applies filter `tag = "urgent"`. The visible list shrinks to 9 tasks.
5. FVP continues operating on the original 40-task snapshot — the filter does not invalidate the session. The progress indicator updates to show "FVP — 12 of 40 (filtered view active)" to signal the divergence.
6. Tasks that are in the snapshot but hidden by the filter are still processed by FVP internally; they just don't appear in the visible list. When FVP surfaces one of those hidden tasks as the next candidate, it is temporarily shown above the filter line with a "FVP candidate (outside current filter)" label.
7. User completes the session or presses `Escape`. Filter remains active after exit.

#### Scenario 3 — Switching from FVP to AF4 mid-session

1. User is 18 comparisons into an FVP session (snapshot: 30 tasks, progress: "18 of 30").
2. User decides FVP is too slow today and wants AF4 instead.
3. User presses `Shift+R` → `1` (AF4). A confirmation prompt appears: "Switch to AF4? Your FVP progress (18 of 30) will be lost." with `Confirm` / `Cancel`.
4. User confirms. FVP state is discarded. AF4 activates immediately against the current visible task list (respecting any active filters).
5. No FVP state is persisted — switching back to FVP later starts a fresh snapshot.

#### Scenario 4 — Nested mode + DIT review

1. User is in Nested view. Parent tasks are collapsed; subtasks are hidden.
2. User activates DIT mode (`R` → `2`). DIT operates on the visible rows only — parent tasks in their current collapsed state.
3. User expands a parent task mid-session. Its subtasks become visible rows. DIT does not retroactively include them in the current pass; they are candidates in the next DIT cycle.
4. User toggles to Flat view mid-session. All tasks (parents + subtasks) are now visible rows. DIT continues from where it left off, but the candidate pool now includes the newly visible subtasks. A subtle banner reads: "View changed — DIT candidate pool updated."
5. User toggles back to Nested. DIT candidate pool contracts back to parent-level rows. Banner appears again.

---

### Interaction Requirements

#### Scroll position and task selection on mode enter/exit

- **Entering a mode:** The task list re-orders per the TMS algorithm. Scroll position resets to the top (the first candidate). If a task was selected before entering the mode, selection is preserved only if that task is still visible in the re-ordered list; otherwise selection is cleared.
- **Exiting a mode (Escape or selecting None):** The list returns to its pre-mode order. Scroll position is restored to where it was before the mode was activated (not reset to top). If a task was selected during the session, that task remains selected and scrolled into view on exit.
- **Exiting via queue exhaustion:** Scroll resets to top. No task is selected. A "Queue complete" inline notice appears at the top of the list.

#### Keyboard behavior for the mode selector

| Key | Context | Action |
|-----|---------|--------|
| `Shift+R` | No popover open | Opens mode selector popover, focuses first option |
| `1` | Popover open | Activates AF4, closes popover |
| `2` | Popover open | Activates DIT, closes popover |
| `3` | Popover open | Activates FVP, closes popover |
| `4` | Popover open | Activates Standard, closes popover |
| `0` | Popover open | Selects None (deactivate), closes popover |
| `Escape` | Popover open | Closes popover, no mode change |
| `Escape` | Mode active, no popover | Exits active mode (same as selecting None), restores scroll |
| `Shift+R` | Mode active, no popover | Opens popover to switch modes (does not exit current mode until a new one is selected) |
| `↑` / `↓` | Popover open | Moves focus between mode options |
| `Enter` | Popover open, option focused | Activates focused mode |

- `Shift+R` must not conflict with inline task editing. If focus is inside a text input, `Shift+R` is a normal character and does not open the popover.
- `r` (unmodified) remains bound to `task.reinsert` — no conflict.
- The active mode is visually indicated on the pill button (e.g., "AF4 ▾") so the user always knows the current state without opening the popover.

#### Mid-session state indicators

- **FVP:** Progress indicator in the toolbar: `FVP — 7 of 23`. Updates after each comparison. If the candidate list was snapshotted at 23 but filters are active, shows `FVP — 7 of 23 (filtered)`.
- **AF4:** No progress counter (AF4 is open-ended). Pill shows `AF4 ▾`. The current candidate task is highlighted with a distinct left-border accent.
- **DIT:** Pill shows `DIT ▾`. Current candidate highlighted. No counter.
- **Standard:** Pill shows `Standard ▾`. No candidate highlighting — Standard is just a sort order, not a prompted review.

#### Nested vs. Flat interaction with TMS modes

- TMS algorithms operate on **visible rows** at the moment of activation (or snapshot, for FVP).
- In Nested mode, collapsed subtasks are not visible rows and are excluded from the TMS candidate pool.
- Toggling Nested/Flat while a non-FVP mode is active updates the candidate pool immediately (with the banner described in Scenario 4).
- Toggling Nested/Flat while FVP is active does **not** change the snapshot. The snapshot was taken at activation time. The toggle only affects which tasks are visible in the list; FVP's internal queue is unchanged.
- FVP candidates that are subtasks (visible in Flat mode but not in Nested) are still processed if they were in the snapshot. If the user switches to Nested mid-FVP, those subtask candidates are surfaced as "FVP candidate (outside current view)" when they come up.

---

### Filter Composition Rules

#### Order of operations

```
Raw task list
  → User-defined filters (project, tag, assignee, hide-completed, etc.)
  → TMS algorithm (ordering / candidate selection)
  → Visible rows
```

Filters always run first. The TMS algorithm never sees tasks that have been filtered out. This is intentional: a user filtering to `project = "Home"` expects their AF4 session to be about Home tasks only.

#### FVP candidate list snapshot behavior

- Snapshot is taken at the exact moment the user activates FVP (presses `3` or clicks FVP in the popover).
- The snapshot captures the task IDs of all tasks that pass the current filters at that instant. Task order within the snapshot follows the pre-FVP sort order.
- Tasks added after snapshot: not in the current session. They appear in the visible list (if they pass filters) but FVP ignores them. They are candidates in the next FVP session.
- Tasks completed after snapshot: removed from the visible list normally. FVP skips them silently when they come up in the queue (no error, no prompt — just advances to the next candidate).
- Tasks deleted after snapshot: same as completed — silently skipped.
- Filter changes after snapshot: the snapshot is unchanged. See Scenario 2 for the divergence UX.

#### What happens when a filter change would invalidate an in-progress FVP session

"Invalidate" means the filter change removes tasks that FVP has already marked as selected candidates (i.e., tasks the user has already decided to do). This does not break the session — those tasks are simply hidden from view but remain in FVP's internal state. When FVP surfaces them as the next action, they appear above the filter line with the "FVP candidate (outside current filter)" treatment.

If the filter change removes **all remaining unprocessed candidates** from view (e.g., user filters to a project that has no tasks in the snapshot), FVP shows an inline notice: "No FVP candidates match the current filter. Remove filters or end the session." The session is not automatically ended — the user decides.

---

### Edge Cases to Handle

| Edge case | Expected behavior |
|-----------|-------------------|
| **Empty queue — all tasks filtered out** | Mode selector is still accessible. Activating any TMS mode shows an empty state: "No tasks match the current filters." No crash, no spinner. |
| **Empty queue — all tasks completed** | Same empty state. If "hide completed" is off and all tasks are complete, TMS shows them normally. If "hide completed" is on, empty state. |
| **Single task in queue** | AF4: prompts once ("Do you want to do this?"), then queue complete. FVP: single task is immediately the selected candidate (no comparison needed), session ends. DIT: same as AF4. |
| **Adding a task mid-AF4 session** | New task enters the candidate pool immediately. AF4 will surface it when the algorithm reaches it. No interruption to the current candidate prompt. |
| **Adding a task mid-FVP session** | New task is visible in the list (if it passes filters) but is NOT added to the FVP snapshot. A subtle inline note on the new task row: "Not in current FVP session." |
| **Switching from FVP to AF4 mid-session** | Confirmation dialog (see Scenario 3). FVP state fully discarded on confirm. |
| **Switching from AF4/DIT to FVP mid-session** | Confirmation dialog: "Start a new FVP session? A new candidate list will be snapshotted from the current view." Existing AF4/DIT state is discarded. |
| **Switching from any mode to None** | No confirmation needed. Mode exits immediately. Scroll restored. |
| **Nested mode + FVP: subtask becomes visible mid-session** | User expands a parent. Subtask rows appear. If subtasks were in the FVP snapshot (i.e., they existed and passed filters at snapshot time), they are now visible and will be surfaced by FVP normally. If they were not in the snapshot (created after), they get the "Not in current FVP session" label. |
| **Nested mode + FVP: FVP candidate is a collapsed subtask** | FVP surfaces the candidate. The parent row auto-expands to reveal the subtask. A visual indicator (e.g., animated expand) makes the expansion obvious. |
| **All FVP candidates completed before session ends** | FVP shows "Queue complete — all candidates done." Session ends automatically. Mode resets to None. |
| **Mode selector opened during inline task add** | If the user is mid-typing in the inline add row, `R` is suppressed (focus is in a text input). The mode selector does not open. |
| **Rapid mode switching (e.g., 1 → 2 → 3 in quick succession)** | Each switch is processed sequentially. No race conditions. If FVP is selected after AF4, the snapshot is taken after AF4's state is fully cleared. |

---

### Power User Acceptance Criteria

These complement the PM's list and focus on session fidelity and keyboard-first workflows.

- [ ] Pressing `Escape` while a mode is active exits the mode and restores the exact scroll position from before the mode was activated — verified by scrolling to task 30 of 50, activating AF4, then pressing `Escape` and confirming task 30 is still in view.
- [ ] `Shift+R` does not open the mode selector when focus is inside any text input (inline add row, task title edit, search/filter field).
- [ ] FVP progress indicator (`FVP — N of M`) increments correctly after each comparison and does not reset on scroll, filter toggle, or Nested/Flat toggle.
- [ ] A task added mid-FVP session displays the "Not in current FVP session" label and is excluded from FVP's internal queue for the duration of the session.
- [ ] Switching modes mid-session (any → any) always presents a confirmation dialog if the current mode has in-progress state (FVP with comparisons made, AF4/DIT with candidates surfaced). Switching to None never requires confirmation.
- [ ] In Nested mode, activating any TMS mode operates only on parent-level visible rows. Expanding a parent mid-session does not retroactively add subtasks to the current AF4 or DIT pass.
- [ ] FVP correctly skips completed or deleted tasks from the snapshot without surfacing an error or stalling.
- [ ] When all FVP candidates are outside the current filter, the "No FVP candidates match the current filter" notice appears and the session remains active (not auto-terminated).
- [ ] The mode pill label updates immediately on mode change: idle state shows "Review ▾", active state shows the mode name (e.g., "AF4 ▾", "FVP ▾").
- [ ] Keyboard navigation within the mode selector popover (`↑`/`↓`/`Enter`) is fully functional without mouse interaction — a complete AF4 session can be started and exited using only the keyboard (`Shift+R` to open, `1` to select AF4, existing task shortcuts to navigate, `Escape` to exit).

---

## UI/UX Design Section

### 1. Toolbar Layout Spec

The All Tasks toolbar has three existing control groups, left to right:

```
[Nested/Flat toggle]  [Hide Completed]  ···  [TMS Mode Pill]  [+ Add Task]
```

The TMS mode pill sits between the filter controls and the Add Task button, separated by `gap-2` from each neighbor. It is part of the right-side control cluster, not the left-side view toggles.

**Full toolbar DOM order (left → right):**

```
<toolbar role="toolbar" aria-label="Task list controls">
  <!-- Left group -->
  <NestedFlatToggle />          <!-- existing -->
  <HideCompletedToggle />       <!-- existing -->

  <!-- Spacer -->
  <div class="flex-1" />

  <!-- Right group -->
  <TMSModePill />               <!-- NEW -->
  <AddTaskButton />             <!-- existing -->
</toolbar>
```

**Spacing tokens:**

| Gap | Tailwind class |
|-----|---------------|
| Between left-group controls | `gap-2` |
| Between right-group controls | `gap-2` |
| Toolbar horizontal padding | `px-4` |
| Toolbar vertical padding | `py-2` |

**Responsive behavior:**

- At `≥ 768px` (md): full layout as above, all labels visible.
- At `< 768px` (sm): TMS pill collapses to icon-only (`w-8 h-8`, no text label). The icon is a `ListFilter` or `Layers` icon (16px). Tooltip on hover/focus shows the current mode name. Add Task button remains icon+label.
- At `< 480px`: Hide Completed label also collapses to icon-only. Nested/Flat toggle stays as-is (already compact).

---

### 2. TMS Mode Pill — Component Spec

**Base dimensions:**

- Height: `h-8` (32px)
- Padding: `px-3 py-1`
- Border radius: `rounded-md`
- Font: `text-sm font-medium` (Plus Jakarta Sans)
- Gap between label and chevron: `gap-1.5`

---

**Idle state** (no mode active, label: "Review ▾"):

```
class="inline-flex items-center gap-1.5 h-8 px-3 rounded-md
       text-sm font-medium
       bg-zinc-800 text-zinc-400
       border border-zinc-700
       hover:bg-zinc-700 hover:text-zinc-200 hover:border-zinc-600
       transition-colors duration-150
       cursor-pointer"
```

Icon: `ChevronDown` 14px, `text-zinc-500`.

---

**Active state** (mode selected, e.g., label: "AF4 ▾"):

```
class="inline-flex items-center gap-1.5 h-8 px-3 rounded-md
       text-sm font-medium
       bg-blue-950 text-blue-300
       border border-blue-700
       hover:bg-blue-900 hover:text-blue-200
       transition-colors duration-150
       cursor-pointer
       relative"
```

Left-border accent: achieved via `border-l-2 border-l-blue-500` replacing the uniform border, or a `::before` pseudo-element. Use the border approach:

```
class="... border border-blue-700 border-l-2 border-l-blue-500"
```

Icon: `ChevronDown` 14px, `text-blue-400`.

FVP active state adds the progress string inline: label becomes `"FVP — 7 of 23 ▾"`. At narrow widths (< 768px), truncate to `"FVP ▾"` and move the counter to a tooltip.

---

**Hover state** (covered above per idle/active). Transition: `transition-colors duration-150`.

---

**Focus state (keyboard):**

```
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-blue-500
focus-visible:ring-offset-2
focus-visible:ring-offset-zinc-900
```

Applied to both idle and active states.

---

**ARIA:**

```html
<button
  role="button"
  aria-haspopup="listbox"
  aria-expanded="false|true"
  aria-label="TMS mode: Review (inactive)"   <!-- idle -->
  aria-label="TMS mode: AF4 (active)"        <!-- active -->
>
```

---

### 3. Mode Selector Popover — Component Spec

**Trigger:** The TMS mode pill button (`aria-haspopup="listbox"`).

**Dimensions:**

- Width: `w-72` (288px) — fixed, not fluid
- Max height: `max-h-80`, overflow-y auto if needed (won't be needed with 5 options)
- Border radius: `rounded-lg`
- Shadow: `shadow-xl`
- Background: `bg-zinc-900 border border-zinc-700`
- Padding: `p-1` (around the option list)

**Position:** Below the pill, left-aligned to the pill's left edge.

```
top: calc(100% + 6px)   /* 6px gap below pill */
left: 0
z-index: 50
```

Implemented via Radix UI `Popover` or shadcn `Popover` with `align="start"` and `sideOffset={6}`.

---

**Each mode option layout:**

```
┌─────────────────────────────────────────────┐
│  [●] AF4                              [1]   │
│      Autofocus 4 — prompted review          │
└─────────────────────────────────────────────┘
```

- Left: 8px colored dot (mode accent color) — visible only when this mode is active; otherwise transparent (preserves alignment)
- Mode name: `text-sm font-medium text-zinc-100`
- Short description: `text-xs text-zinc-400 mt-0.5`
- Right: keyboard hint badge `text-xs font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded`

Option container:

```
class="flex items-start gap-3 px-3 py-2.5 rounded-md cursor-pointer
       transition-colors duration-100"
```

**Mode accent colors (dot + active border):**

| Mode | Color |
|------|-------|
| AF4 | `bg-violet-500` |
| DIT | `bg-amber-500` |
| FVP | `bg-blue-500` |
| Standard | `bg-emerald-500` |
| None | `bg-zinc-500` |

**Keyboard hints:**

| Mode | Key |
|------|-----|
| None | `0` |
| AF4 | `1` |
| DIT | `2` |
| FVP | `3` |
| Standard | `4` |

---

**Selected/active option treatment:**

```
class="... bg-zinc-800 text-zinc-100"
```

Plus the colored dot is visible (`opacity-100`). A `aria-selected="true"` checkmark icon (`Check` 14px, `text-blue-400`) appears to the far right, replacing the keyboard hint badge.

---

**Hover treatment:**

```
class="... hover:bg-zinc-800 hover:text-zinc-100"
```

Keyboard hint badge remains visible on hover (only replaced by checkmark when selected).

---

**Keyboard navigation:**

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move focus between options (wraps) |
| `Enter` | Activate focused option, close popover |
| `1`–`4` | Activate corresponding mode, close popover |
| `0` | Select None, close popover |
| `Escape` | Close popover, return focus to pill, no mode change |
| `Tab` | Close popover, move focus to next toolbar element |

Focus management: on open, focus moves to the currently active option (or first option if none active). On close, focus returns to the pill button.

---

**ARIA:**

```html
<div
  role="listbox"
  aria-label="TMS review mode"
  aria-activedescendant="tms-option-af4"
>
  <div
    role="option"
    id="tms-option-none"
    aria-selected="false"
  >None</div>
  <div
    role="option"
    id="tms-option-af4"
    aria-selected="true"
  >AF4</div>
  <!-- ... -->
</div>
```

---

**Animation:**

Open: `opacity-0 translate-y-1` → `opacity-100 translate-y-0`, `duration-150 ease-out`.
Close: `opacity-100 translate-y-0` → `opacity-0 translate-y-1`, `duration-100 ease-in`.

Using Radix `data-[state=open]` / `data-[state=closed]` attributes:

```
class="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1
       data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1
       duration-150"
```

> **⚠️ `prefers-reduced-motion` (Lead SDE):** Wrap the animation classes in a `motion-safe:` Tailwind variant so users with `prefers-reduced-motion: reduce` get an instant show/hide instead of the slide. Replace the above with:
> ```
> class="motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:slide-in-from-top-1
>        motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:slide-out-to-top-1
>        duration-150"
> ```
> This is a HIGH priority accessibility requirement (flagged by ui-ux-pro-max). See also T-11.

---

### 4. Active Review Mode — Visual Treatment

The goal is "you are in a session" without hijacking the entire view. The task list stays readable; only the current candidate is spotlit.

---

**Candidate task highlight (AF4, DIT, FVP current candidate):**

```
class="relative pl-3
       border-l-2 border-l-blue-500
       bg-blue-950/30"
```

- Left border: `border-l-2 border-l-blue-500` (2px, blue-500)
- Background tint: `bg-blue-950/30` — subtle, does not obscure task content
- Transition in: `transition-all duration-200` when a new candidate is surfaced

Mode-specific accent colors for the left border:

| Mode | Border color |
|------|-------------|
| AF4 | `border-l-violet-500` |
| DIT | `border-l-amber-500` |
| FVP | `border-l-blue-500` |

Background tint follows the same hue: `bg-violet-950/30`, `bg-amber-950/30`, `bg-blue-950/30`.

Non-candidate tasks in an active session receive a subtle dimming:

```
class="opacity-60 transition-opacity duration-200"
```

This creates a natural spotlight without hiding tasks.

---

**FVP progress indicator:**

Placed inline in the toolbar, immediately to the left of the TMS mode pill (or as part of the pill label at narrow widths).

At wide widths, it renders as a separate read-only chip:

```html
<span
  class="inline-flex items-center h-8 px-2.5 rounded-md
         text-xs font-mono text-blue-300
         bg-blue-950/50 border border-blue-800"
  aria-live="polite"
  aria-label="FVP progress: 7 of 23"
>
  FVP — 7 of 23
</span>
```

When filters are active: `FVP — 7 of 23 (filtered)` — the `(filtered)` suffix is `text-zinc-400`.

At `< 768px`: the progress chip is hidden; the count is appended to the pill label: `"FVP 7/23 ▾"`.

---

**"Filtered" badge:**

When a TMS mode is active AND one or more filters are active, a badge appears adjacent to the progress chip (or pill, if no chip):

```html
<span
  class="inline-flex items-center gap-1 h-5 px-1.5 rounded
         text-xs font-medium
         bg-amber-950/60 text-amber-400 border border-amber-800"
  aria-label="Queue is filtered"
>
  <FilterIcon size={10} />
  Filtered
</span>
```

---

**"Not in current FVP session" label on non-snapshot tasks:**

Rendered as an inline badge on the task row, right-aligned, after the task title:

```html
<span
  class="ml-2 text-xs text-zinc-500 italic whitespace-nowrap"
  aria-label="This task was added after the FVP session started"
>
  Not in session
</span>
```

For FVP candidates surfaced outside the current filter (Scenario 2), the task row gets a distinct treatment — rendered above the normal list with a separator:

```html
<div class="border-t border-dashed border-zinc-700 pt-2 mb-1">
  <span class="text-xs text-zinc-500 px-3">FVP candidate · outside current filter</span>
</div>
```

---

### 5. Inline Notices & Banners

All notices use a consistent base:

```
class="flex items-start gap-3 px-4 py-3 rounded-lg text-sm
       border transition-all duration-200"
```

---

**"View changed — DIT candidate pool updated" banner:**

- Placement: top of the task list, below the toolbar, above the first task row
- Style: informational

```
class="... bg-zinc-800/80 text-zinc-300 border-zinc-700"
```

- Left icon: `RefreshCw` 16px, `text-zinc-400`
- Auto-dismiss: 4 seconds, with a `×` close button for early dismiss
- Animation: slides down from toolbar (`translate-y-[-8px]` → `translate-y-0`, 200ms), fades out on dismiss

```html
<div role="status" aria-live="polite" aria-atomic="true">
  View changed — DIT candidate pool updated.
</div>
```

---

**"No FVP candidates match the current filter" notice:**

- Placement: replaces the task list content area (empty state treatment)
- Style: warning

```
class="... bg-amber-950/40 text-amber-300 border-amber-800/60"
```

- Icon: `AlertTriangle` 16px, `text-amber-400`
- Body: "No FVP candidates match the current filter."
- Sub-text: `text-xs text-zinc-400` — "Remove filters or end the session."
- Two action buttons: `[Clear Filters]` (secondary) `[End Session]` (ghost/destructive)
- Does NOT auto-dismiss — requires user action

```html
<div role="alert" aria-live="assertive">
  No FVP candidates match the current filter.
</div>
```

---

**"Queue complete" notice:**

- Placement: top of the task list (same slot as view-changed banner)
- Style: success

```
class="... bg-emerald-950/50 text-emerald-300 border-emerald-800/60"
```

- Icon: `CheckCircle2` 16px, `text-emerald-400`
- Body: "Queue complete — all candidates reviewed."
- Auto-dismiss: 6 seconds. No manual close needed (non-critical).
- On dismiss, mode resets to None and scroll returns to top.

```html
<div role="status" aria-live="polite" aria-atomic="true">
  Queue complete — all candidates reviewed.
</div>
```

---

**Phase 2 nudge banner in Focus tab:**

- Placement: top of the Focus tab content, above the existing Review Queue UI
- Style: informational, dismissible, persistent across sessions until dismissed

```
class="flex items-center justify-between gap-4
       px-4 py-3 mb-4 rounded-lg
       bg-blue-950/60 text-blue-200 border border-blue-800
       text-sm"
```

- Left: `Info` icon 16px + text: "Review Queue is moving to All Tasks."
- CTA link: `[Take me there →]` — `text-blue-400 underline underline-offset-2 hover:text-blue-300`
- Right: `×` dismiss button (`aria-label="Dismiss notice"`)
- Dismissal is persisted to localStorage so it doesn't reappear after page reload.

---

### 6. Confirmation Dialog — Mode Switch

**When shown:** Switching from any in-progress mode (FVP with ≥1 comparison made, AF4/DIT with ≥1 candidate surfaced) to a different mode. Switching to None never requires confirmation.

**Dialog dimensions:** `max-w-sm w-full` — compact, not a full modal.

**Layout:**

```
┌──────────────────────────────────────────┐
│  Switch to AF4?                          │
│                                          │
│  Your FVP progress (18 of 30) will be   │
│  lost. This cannot be undone.            │
│                                          │
│              [Cancel]  [Switch to AF4]   │
└──────────────────────────────────────────┘
```

- Title: `text-base font-semibold text-zinc-100`
- Body: `text-sm text-zinc-400 mt-2`
- Progress detail (FVP only): `text-sm text-zinc-300 font-medium` — e.g., "18 of 30 comparisons"
- Button row: `flex justify-end gap-2 mt-5`

**Button styles:**

Cancel (secondary):
```
class="h-9 px-4 rounded-md text-sm font-medium
       bg-zinc-800 text-zinc-300 border border-zinc-700
       hover:bg-zinc-700 hover:text-zinc-100
       focus-visible:ring-2 focus-visible:ring-blue-500"
```

Confirm switch (destructive primary):
```
class="h-9 px-4 rounded-md text-sm font-medium
       bg-red-600 text-white
       hover:bg-red-500
       focus-visible:ring-2 focus-visible:ring-red-500"
```

**ARIA:**

```html
<dialog
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="mode-switch-title"
  aria-describedby="mode-switch-desc"
>
```

**Focus management:** On open, focus moves to the Cancel button (safe default). Tab cycles between Cancel and Confirm. Escape triggers Cancel. On close, focus returns to the TMS mode pill.

---

### 7. Accessibility Checklist

**Interactive elements:**

| Element | aria-label | role | Keyboard |
|---------|-----------|------|----------|
| TMS mode pill (idle) | `"TMS mode: Review (inactive)"` | `button` | `Enter`/`Space` to open, `R` shortcut |
| TMS mode pill (active) | `"TMS mode: AF4 (active)"` | `button` | `Enter`/`Space` to open, `Escape` to exit mode |
| Mode selector popover | `"TMS review mode"` | `listbox` | `↑`/`↓`/`Enter`/`Escape`/`0`–`4` |
| Each mode option | mode name + description | `option` | `Enter` to select |
| Dismiss banner `×` | `"Dismiss notice"` | `button` | `Enter`/`Space` |
| Confirm switch button | `"Confirm switch to AF4"` | `button` | `Enter`/`Space` |
| Cancel button | `"Cancel mode switch"` | `button` | `Enter`/`Space`/`Escape` |

**Live regions:**

| Region | `aria-live` | `aria-atomic` | Content |
|--------|------------|--------------|---------|
| FVP progress chip | `polite` | `true` | "FVP progress: N of M" — updates after each comparison |
| Queue complete notice | `polite` | `true` | "Queue complete — all candidates reviewed." |
| View changed banner | `polite` | `true` | "View changed — DIT candidate pool updated." |
| No candidates notice | `assertive` | `true` | "No FVP candidates match the current filter." |
| Mode activation | `polite` | `true` | Hidden `<span class="sr-only">` — "AF4 mode activated." |
| Mode exit | `polite` | `true` | Hidden `<span class="sr-only">` — "Review mode exited." |

**Focus management:**

- Popover open: focus moves to active option (or first option)
- Popover close (Escape): focus returns to pill button
- Dialog open: focus moves to Cancel button
- Dialog close: focus returns to pill button
- Mode exit via Escape: focus stays on pill button; scroll restored

**Keyboard-only session guarantee:** A complete AF4 session — open popover (`R`), select mode (`1`), navigate tasks (existing shortcuts), exit (`Escape`) — requires zero mouse interaction.

**Color contrast:** All text/background combinations meet WCAG AA (4.5:1 for normal text, 3:1 for large text). `text-zinc-400` on `bg-zinc-900` = 5.9:1. `text-blue-300` on `bg-blue-950` = 6.2:1. `text-amber-400` on `bg-amber-950/60` — verify at implementation time; use `text-amber-300` if contrast fails.

---

### 8. Component Hierarchy

**New components:**

| Component | Path | Notes |
|-----------|------|-------|
| `TMSModePill` | `features/tms/components/TMSModePill.tsx` | Pill button + popover trigger. Renders idle or active state. |
| `TMSModePopover` | `features/tms/components/TMSModePopover.tsx` | `role="listbox"` popover. Renders 5 options with descriptions + keyboard hints. |
| `TMSModeOption` | `features/tms/components/TMSModeOption.tsx` | Single `role="option"` row. Accepts mode config, selected state, onSelect. |
| `FVPProgressChip` | `features/tms/components/FVPProgressChip.tsx` | Read-only progress display. `aria-live="polite"`. |
| `FilteredBadge` | `features/tms/components/FilteredBadge.tsx` | Amber badge shown when mode + filters are both active. |
| `TMSInlineNotice` | `features/tms/components/TMSInlineNotice.tsx` | Shared notice/banner component. Accepts `variant: "info" | "warning" | "success"`, `autoDismiss?: number`, `onDismiss`. |
| `ModeSwitchDialog` | `features/tms/components/ModeSwitchDialog.tsx` | `role="alertdialog"`. Confirmation for in-progress mode switches. |
| `TMSCandidateRow` | `features/tms/components/TMSCandidateRow.tsx` | Wrapper that applies left-border accent + background tint to the current candidate task row. |

**Modified existing components:**

| Component | Change |
|-----------|--------|
| `AllTasksToolbar` | Add `TMSModePill` + `FVPProgressChip` to right control group. Add `FilteredBadge` when mode + filters active. |
| `TaskList` | Wrap current candidate row with `TMSCandidateRow`. Apply `opacity-60` to non-candidate rows when a mode is active. Render `TMSInlineNotice` at list top for view-changed / queue-complete / no-candidates states. |
| `TaskRow` | Add "Not in session" badge slot for FVP non-snapshot tasks. Add "FVP candidate · outside current filter" separator treatment. |
| `KeyboardShortcutsOverlay` | Add `R` shortcut entry under a new "Review Mode" section. |

---

## UX Writing Section

> Voice: direct, efficient, no fluff. Sentence case throughout. Active voice. Max ~50 chars per line where practical.
> Tone key: informational = neutral/calm, destructive = serious/clear, completion = encouraging but brief.

---

### 1. TMS Mode Pill Labels

#### Pill label text

| State | Label text | Notes |
|-------|-----------|-------|
| Idle | `Review` | No chevron in copy — chevron is a UI element |
| AF4 active | `AF4` | Mode name only; chevron rendered separately |
| DIT active | `DIT` | |
| FVP active (no progress) | `FVP` | Used at narrow widths (< 768px) |
| FVP active (with progress) | `FVP — 7 of 23` | Full-width only; `7` and `23` are runtime values |
| Standard active | `Standard` | |

> Rationale: "Review" signals purpose without being prescriptive. Power users know AF4/DIT/FVP by acronym — no expansion needed in the pill.

---

#### Tooltips

| State | Tooltip text |
|-------|-------------|
| Idle pill | `Select a review mode (Shift+R)` |
| AF4 active | `AF4 active — press Escape to exit` |
| DIT active | `DIT active — press Escape to exit` |
| FVP active | `FVP active — press Escape to exit` |
| Standard active | `Standard mode active — press Escape to exit` |
| FVP active, narrow width | `FVP — 7 of 23 · press Escape to exit` |

> Note: Shortcut shown as `Shift+R` in tooltip (not `R`) because `r` is taken by `task.reinsert`. See §7 for shortcut overlay copy.

---

#### aria-labels

| State | `aria-label` value |
|-------|-------------------|
| Idle | `TMS mode: Review (inactive)` |
| AF4 active | `TMS mode: AF4 (active)` |
| DIT active | `TMS mode: DIT (active)` |
| FVP active | `TMS mode: FVP (active)` |
| FVP active with progress | `TMS mode: FVP (active, 7 of 23)` |
| Standard active | `TMS mode: Standard (active)` |

---

### 2. Mode Selector Popover

#### Popover header

| Element | Copy |
|---------|------|
| Header / `aria-label` on listbox | `Review mode` |

> No visible header needed — the pill label provides context. The `aria-label` on the `role="listbox"` element is sufficient for screen readers.

---

#### Mode options

Each option has: name, short description (≤ 45 chars), keyboard hint.

| Mode | Name | Short description | Key hint label |
|------|------|-------------------|---------------|
| None | `None` | `Default view, no review mode active` | `0` |
| AF4 | `AF4` | `Prompted review, one task at a time` | `1` |
| DIT | `DIT` | `Schedule tasks for today or tomorrow` | `2` |
| FVP | `FVP` | `Snapshot-based: list fixed at session start` | `3` |
| Standard | `Standard` | `Sorted review, no prompts` | `4` |

> Descriptions are intentionally terse — these are power users. No need to spell out "Autofocus 4" in the popover; the acronym is the identity. If a tooltip or help link is added later, that's the place for full names.

> FVP description now surfaces the snapshot caveat inline ("list fixed at session start") — this is the Risk 2 mitigation. The original "Compare and surface your top task" was accurate but omitted the most surprising behavior. 45 chars, fits the constraint.

---

#### Section grouping

No section headers needed. Five options is a flat list — grouping adds noise. If modes are ever split into "algorithmic" vs. "sort-based" categories in a future version, add a divider with:

| Divider label | Copy |
|--------------|------|
| Algorithmic modes | `Prompted review` |
| Sort modes | `Sorted view` |

(Not in scope for this version.)

---

### 3. Active Session Notices

#### "View changed" banner (DIT/AF4 — Nested/Flat toggle)

| Element | Copy |
|---------|------|
| Banner text | `View changed — candidate pool updated.` |
| `aria-live` content (same) | `View changed — candidate pool updated.` |

> Matches the design spec's suggested text. Kept as-is — it's already tight and accurate.

---

#### "No candidates match filter" notice (FVP empty state)

| Element | Copy |
|---------|------|
| Heading / primary text | `No FVP candidates match the current filter.` |
| Sub-text | `Remove filters or end the session.` |
| Clear filters button | `Clear filters` |
| End session button | `End session` |

> "Clear filters" is the safe action; "End session" is the destructive one. Button order (safe left, destructive right) matches the confirmation dialog pattern. No "Cancel" needed — the notice itself is the persistent state.

---

#### "Queue complete" success notice

| Element | Copy |
|---------|------|
| Notice text | `Queue complete — all candidates reviewed.` |

> Brief, factual, slightly encouraging via "complete." No exclamation mark — the app voice is calm.

---

#### "Not in current session" label (non-snapshot FVP tasks)

| Element | Copy |
|---------|------|
| Inline badge on task row | `Not in session` |
| Full `aria-label` on badge | `This task was added after the FVP session started` |

> "Not in session" is compact enough for a badge. The aria-label gives screen reader users the full context.

---

#### FVP candidate outside current filter — separator label

| Element | Copy |
|---------|------|
| Separator label | `FVP candidate · outside current filter` |

> Matches design spec. The middle dot (`·`) is a visual separator, not punctuation — acceptable in this context.

---

### 4. Confirmation Dialog — Mode Switch

#### FVP variant (switching away from in-progress FVP)

| Element | Copy |
|---------|------|
| Title | `Switch to {ModeName}?` |
| Body | `Your FVP progress ({N} of {M}) will be lost. This can't be undone.` |
| Confirm button | `Switch to {ModeName}` |
| Cancel button | `Cancel` |

> `{ModeName}`, `{N}`, `{M}` are runtime values. "This can't be undone" is the standard destructive-action signal — serious, not alarmist.

Example rendered (switching to AF4 at 18 of 30):
- Title: `Switch to AF4?`
- Body: `Your FVP progress (18 of 30) will be lost. This can't be undone.`
- Confirm: `Switch to AF4`

---

#### AF4/DIT variant (switching away from in-progress AF4 or DIT)

| Element | Copy |
|---------|------|
| Title | `Switch to {ModeName}?` |
| Body | `Your current {CurrentMode} session will end. This can't be undone.` |
| Confirm button | `Switch to {ModeName}` |
| Cancel button | `Cancel` |

Example rendered (switching from DIT to FVP):
- Title: `Switch to FVP?`
- Body: `Your current DIT session will end. This can't be undone.`
- Confirm: `Switch to FVP`

---

#### Switching to FVP from another mode

| Element | Copy |
|---------|------|
| Title | `Switch to FVP?` |
| Body | `Your current {CurrentMode} session will end. FVP will snapshot the current task list. This can't be undone.` |
| Confirm button | `Switch to FVP` |
| Cancel button | `Cancel` |

> The FVP snapshot behavior is worth surfacing here since it's a meaningful side effect of the switch. One sentence, no jargon.

---

#### Cancel button (all variants)

`Cancel` — consistent across all dialog variants. No need for "Keep {Mode}" — "Cancel" is universally understood as "do nothing."

---

### 5. Phase 2 Nudge Banner (Focus tab)

| Element | Copy |
|---------|------|
| Banner text | `Review Queue is moving to All Tasks.` |
| CTA link text | `Take me there →` |
| Dismiss button `aria-label` | `Dismiss this notice` |

> "Moving to" is accurate for Phase 2 (it hasn't moved yet). In Phase 3, this banner is removed entirely — no need for a "has moved" variant.
> The arrow in the CTA (`→`) is a conventional affordance for navigation links. Acceptable here.

---

### 6. Phase 3 One-Time Tooltip (migrated users)

| Element | Copy |
|---------|------|
| Tooltip text | `Review Queue moved here. Select a mode to start a session.` |

> Two sentences: orientation ("moved here") + action ("select a mode"). Under 60 chars. No "new!" or "check it out" — the voice is direct.

---

### 7. Keyboard Shortcut Help Overlay

#### New section header

| Element | Copy |
|---------|------|
| Section header | `Review mode` |

---

#### Shortcut entries

| Action | Key | Description |
|--------|-----|-------------|
| Open mode selector | `Shift+R` | `Open the review mode selector` |
| Exit review mode | `Escape` | `Exit the active review mode` |

> `Shift+R` (not `r`) — `r` is reserved for `task.reinsert`. This must be reflected in the overlay and in any onboarding copy. If the engineering team implements a different key, update this entry.

> "Open the review mode selector" is descriptive enough without being verbose. "Exit the active review mode" clarifies that Escape only exits when a mode is active — it doesn't conflict with other Escape behaviors (e.g., closing the popover) because those are contextual.

---

### 8. Empty State (no tasks in queue)

#### All tasks filtered out (mode active, filters applied, zero results)

| Element | Copy |
|---------|------|
| Heading | `No tasks match the current filters.` |
| Sub-text | `Adjust or clear your filters to continue.` |

---

#### All tasks completed (hide-completed is on, mode active)

| Element | Copy |
|---------|------|
| Heading | `All done — no tasks to review.` |
| Sub-text | `Turn off "Hide completed" to see finished tasks.` |

> "All done" is a mild completion signal. The sub-text is instructional, not congratulatory — power users don't need cheerleading.

---

### 9. Screen Reader Announcements (`sr-only` live region)

These are injected into a hidden `aria-live="polite" aria-atomic="true"` region on mode change. They supplement the visual pill label change, which screen readers may not announce reliably.

| Trigger | Announcement text |
|---------|------------------|
| AF4 activated | `AF4 mode activated.` |
| DIT activated | `DIT mode activated.` |
| FVP activated | `FVP mode activated. Candidate list snapshotted.` |
| Standard activated | `Standard mode activated.` |
| Any mode exited (Escape or None selected) | `Review mode exited.` |
| FVP progress update | `FVP progress: {N} of {M}.` |
| Queue complete | `Queue complete. All candidates reviewed.` |

> FVP activation announcement includes "Candidate list snapshotted" — this is the one piece of FVP behavior that is non-obvious and worth surfacing to screen reader users who may not see the popover description.
> Progress updates use `aria-live="polite"` so they don't interrupt the user mid-action. The FVP progress chip already has `aria-live="polite"` per the UI/UX spec — this `sr-only` region is a fallback for narrow-width layouts where the chip is hidden.

---

### Copy Strings Reference (for implementation)

```ts
// tms-copy.ts — single source of truth for all TMS UI strings

export const TMS_COPY = {
  pill: {
    idle: 'Review',
    active: {
      AF4: 'AF4',
      DIT: 'DIT',
      FVP: 'FVP',
      Standard: 'Standard',
    },
    fvpProgress: (n: number, m: number) => `FVP — ${n} of ${m}`,
    fvpProgressNarrow: (n: number, m: number) => `FVP ${n}/${m}`,
  },

  tooltip: {
    idle: 'Select a review mode (Shift+R)',
    active: {
      AF4: 'AF4 active — press Escape to exit',
      DIT: 'DIT active — press Escape to exit',
      FVP: 'FVP active — press Escape to exit',
      Standard: 'Standard mode active — press Escape to exit',
    },
    fvpProgressNarrow: (n: number, m: number) =>
      `FVP — ${n} of ${m} · press Escape to exit`,
  },

  ariaLabel: {
    idle: 'TMS mode: Review (inactive)',
    active: {
      AF4: 'TMS mode: AF4 (active)',
      DIT: 'TMS mode: DIT (active)',
      FVP: 'TMS mode: FVP (active)',
      Standard: 'TMS mode: Standard (active)',
    },
    fvpWithProgress: (n: number, m: number) =>
      `TMS mode: FVP (active, ${n} of ${m})`,
  },

  popover: {
    listboxLabel: 'Review mode',
    options: {
      None:     { name: 'None',     description: 'Default view, no review mode active',      key: '0' },
      AF4:      { name: 'AF4',      description: 'Prompted review, one task at a time',       key: '1' },
      DIT:      { name: 'DIT',      description: 'Schedule tasks for today or tomorrow',      key: '2' },
      FVP:      { name: 'FVP',      description: 'Snapshot-based: list fixed at session start', key: '3' },
      Standard: { name: 'Standard', description: 'Sorted review, no prompts',                 key: '4' },
    },
  },

  notices: {
    viewChanged: 'View changed — candidate pool updated.',
    noFvpCandidates: {
      heading: 'No FVP candidates match the current filter.',
      subtext: 'Remove filters or end the session.',
      clearFilters: 'Clear filters',
      endSession: 'End session',
    },
    queueComplete: 'Queue complete — all candidates reviewed.',
    notInSession: 'Not in session',
    notInSessionAriaLabel: 'This task was added after the FVP session started',
    fvpOutsideFilter: 'FVP candidate · outside current filter',
  },

  confirmDialog: {
    // FVP → any mode
    fvpTitle: (toMode: string) => `Switch to ${toMode}?`,
    fvpBody: (n: number, m: number) =>
      `Your FVP progress (${n} of ${m}) will be lost. This can't be undone.`,
    fvpConfirm: (toMode: string) => `Switch to ${toMode}`,

    // AF4/DIT → any mode (not FVP)
    genericTitle: (toMode: string) => `Switch to ${toMode}?`,
    genericBody: (fromMode: string) =>
      `Your current ${fromMode} session will end. This can't be undone.`,
    genericConfirm: (toMode: string) => `Switch to ${toMode}`,

    // any mode → FVP
    toFvpBody: (fromMode: string) =>
      `Your current ${fromMode} session will end. FVP will snapshot the current task list. This can't be undone.`,
    toFvpConfirm: 'Switch to FVP',

    cancel: 'Cancel',
  },

  nudgeBanner: {
    text: 'Review Queue is moving to All Tasks.',
    cta: 'Take me there →',
    dismissAriaLabel: 'Dismiss this notice',
  },

  migrationTooltip:
    'Review Queue moved here. Select a mode to start a session.',

  shortcuts: {
    sectionHeader: 'Review mode',
    openSelector: { key: 'Shift+R', description: 'Open the review mode selector' },
    exitMode:     { key: 'Escape',  description: 'Exit the active review mode' },
  },

  emptyState: {
    filtered: {
      heading: 'No tasks match the current filters.',
      subtext: 'Adjust or clear your filters to continue.',
    },
    allCompleted: {
      heading: 'All done — no tasks to review.',
      subtext: 'Turn off "Hide completed" to see finished tasks.',
    },
  },

  srAnnouncements: {
    activated: {
      AF4: 'AF4 mode activated.',
      DIT: 'DIT mode activated.',
      FVP: 'FVP mode activated. Candidate list snapshotted.',
      Standard: 'Standard mode activated.',
    },
    exited: 'Review mode exited.',
    fvpProgress: (n: number, m: number) => `FVP progress: ${n} of ${m}.`,
    queueComplete: 'Queue complete. All candidates reviewed.',
  },
} as const;
```

---

## Engineering Section

### 1. Architecture Overview

#### TMS mode selection and the existing lifecycle

`tmsStore` already owns `activeSystem` and the four system states. `TMSHost.tsx` already implements the full activation lifecycle: deactivate current → `setActiveSystem` → activate new → `setSystemState`. This logic is **not rebuilt** — `TMSModePill` calls a new hook `useTMSModeSelector` that delegates directly to the same `handleSwitch` logic extracted from `TMSHost`.

The key change is the **entry point**: instead of the Focus tab's `TMSHost` rendering, the pill in `GlobalTasksHeader` becomes the trigger. `TMSHost` itself is kept for the Focus tab during Phase 1 coexistence; in Phase 3 it is removed behind the feature flag.

#### FVP snapshot state

FVP snapshot lives in `tmsStore` as part of the FVP system state — specifically a new field `snapshotTaskIds: string[]` added to the FVP state shape. This is the right home because:
- It must survive re-renders (React state would not)
- It is already persisted with the rest of TMS state under `task-management-tms`
- The FVP handler already reads/writes FVP system state via `applySystemStateDelta`

The snapshot is written at activation time by a new `fvpSnapshotService.ts` (pure function: takes `Task[]`, returns `string[]`). **`useTMSModeSelector` writes `snapshotTaskIds` via `applySystemStateDelta` immediately after calling `executeTMSSwitch` — not the FVP handler's `onActivate`.** The handler's `onActivate` receives the already-filtered task list but does not call `applySystemStateDelta` for the snapshot; that responsibility belongs to the hook so the snapshot is taken from the hook's current `filteredTasks` at the moment the user activates FVP. The handler's `onActivate` is reserved for algorithm-internal initialization (e.g., resetting `markedOrder`). No store import inside the handler (arch rule #2).

#### Filter composition pipeline

```
useDataStore tasks
  → filterStore predicates   (existing filterPredicates.ts)
  → handler.getOrderedTasks  (existing TMS handler interface)
  → visible rows             (consumed by TaskList / GlobalTasksView)
```

A new hook `useTMSOrderedTasks(filteredTasks: Task[]): Task[]` encapsulates this. It reads `tmsStore.activeSystem` and the active system state, calls `getTMSHandler(activeSystem).getOrderedTasks(filteredTasks, systemState)`, and returns the result. `GlobalTasksView` (or wherever filtered tasks are currently assembled) calls this hook after applying filters.

Filters always run first. The TMS handler never receives unfiltered tasks. This is enforced structurally — the hook accepts already-filtered tasks as its input parameter.

#### Feature flag for Focus tab removal (Phase 3)

A single boolean flag `ENABLE_FOCUS_TAB` lives in `features/tms/flags.ts`:

```ts
// features/tms/flags.ts
export const ENABLE_FOCUS_TAB =
  process.env.NEXT_PUBLIC_ENABLE_FOCUS_TAB === 'true';
```

The Focus tab nav item and `TMSHost` render are gated on this flag. Default: `false` (tab hidden) from Phase 3 onward. Flipping the env var re-enables it without a code deploy. Flag cleanup (deleting the file and all references) happens in the sprint after Phase 3 stabilizes.

The nudge banner (Phase 2) is gated on a separate flag `ENABLE_TMS_NUDGE_BANNER` so it can be turned off independently.

#### What is NOT changing

- Handler algorithms (`dit`, `af4`, `fvp`, `standard`) — zero changes
- `tmsStore` persistence key (`task-management-tms`) — unchanged
- `appStore` persistence key (`task-management-settings`) — unchanged
- The `TimeManagementSystemHandler` interface — unchanged
- `features/tms/registry.ts` — unchanged
- Existing Focus tab behavior during Phase 1 — fully preserved

`needsAttentionSort` in `appStore` is **removed** (the pill replaces it). See §4 and Architectural Decision AD-4.

---

### 2. New Files

#### `features/tms/copy/tms-copy.ts`
- **Purpose:** Single source of truth for all TMS UI strings (the `TMS_COPY` object from the UX Writing section)
- **Key exports:** `TMS_COPY`
- **Imports:** nothing (pure data)
- **Test file:** `features/tms/copy/tms-copy.test.ts` — verifies all template functions return correct strings for boundary inputs (n=0, n=m, n>m)

#### `features/tms/flags.ts`
- **Purpose:** Feature flag constants for Focus tab and nudge banner
- **Key exports:** `ENABLE_FOCUS_TAB`, `ENABLE_TMS_NUDGE_BANNER`
- **Imports:** nothing
- **Test file:** none (constants only)

#### `features/tms/services/fvpSnapshotService.ts`
- **Purpose:** Pure function that takes a filtered `Task[]` and returns `string[]` of task IDs to snapshot
- **Key exports:** `buildFvpSnapshot(tasks: Task[]): string[]`, `isTaskInSnapshot(taskId: string, snapshot: string[]): boolean`
- **Imports:** `Task` type only
- **Test file:** `features/tms/services/fvpSnapshotService.test.ts`

#### `features/tms/hooks/useTMSModeSelector.ts`
- **Purpose:** Encapsulates mode-switch logic for the pill. Reads `tmsStore`, calls the `TMSHost`-style activation lifecycle, manages confirmation dialog state, manages scroll-position save/restore.
- **Key exports:** `useTMSModeSelector()` → `{ activeSystem, switchMode, pendingSwitch, confirmSwitch, cancelSwitch, isConfirmDialogOpen }`
- **Imports:** `tmsStore`, `getTMSHandler`, `fvpSnapshotService`, `filterStore` (read-only for snapshot input)

  > **⚠️ Arch rule #2 clarification (Lead SDE):** `useTMSModeSelector` is a React hook — it lives in the UI layer, not the domain/service layer. Arch rule #2 prohibits store imports in *services, handlers, and utilities*. Hooks are UI-layer orchestrators and may import stores directly. The `filterStore` import here is read-only (snapshot input only) and is acceptable. **Decision: document this explicitly.** If `useTMSModeSelector` is ever extracted into a pure service, the store import must be removed and the snapshot task array passed in as a parameter instead.
- **Test file:** `features/tms/hooks/useTMSModeSelector.test.ts`

#### `features/tms/hooks/useTMSOrderedTasks.ts`
- **Purpose:** Applies TMS ordering to an already-filtered task list. Pure derivation — no side effects.
- **Key exports:** `useTMSOrderedTasks(filteredTasks: Task[]): Task[]`
- **Imports:** `tmsStore` (read-only), `getTMSHandler`
- **Test file:** `features/tms/hooks/useTMSOrderedTasks.test.ts`

#### `features/tms/hooks/useFVPSessionState.ts`
- **Purpose:** Derives FVP-specific display state: progress counts, which tasks are in-snapshot, which are outside current filter.
- **Key exports:** `useFVPSessionState(visibleTasks: Task[])` → `{ progress, total, isFiltered, isInSnapshot, isOutsideFilter }`
- **Imports:** `tmsStore` (read-only)
- **Test file:** `features/tms/hooks/useFVPSessionState.test.ts`

#### `features/tms/components/TMSModePill.tsx`
- **Purpose:** Pill button + popover trigger. Renders idle or active state. Delegates all logic to `useTMSModeSelector`.
- **Key exports:** `TMSModePill`
- **Imports:** `useTMSModeSelector`, `TMSModePopover`, `FVPProgressChip`, `FilteredBadge`, `TMS_COPY`
- **Test file:** `features/tms/components/TMSModePill.test.tsx`

#### `features/tms/components/TMSModePopover.tsx`
- **Purpose:** `role="listbox"` popover with 5 mode options. Handles `↑`/`↓`/`0–4`/`Enter`/`Escape` keyboard nav.
- **Key exports:** `TMSModePopover`
- **Imports:** `TMSModeOption`, `TMS_COPY`, Radix `Popover`
- **Test file:** `features/tms/components/TMSModePopover.test.tsx`

#### `features/tms/components/TMSModeOption.tsx`
- **Purpose:** Single `role="option"` row — mode name, description, key hint, active dot.
- **Key exports:** `TMSModeOption`
- **Imports:** `TMS_COPY`
- **Test file:** covered by `TMSModePopover.test.tsx` (rendered via popover)

#### `features/tms/components/FVPProgressChip.tsx`
- **Purpose:** Read-only `aria-live="polite"` chip showing "FVP — N of M". Hidden at `< 768px`.
- **Key exports:** `FVPProgressChip`
- **Imports:** `TMS_COPY`
- **Test file:** `features/tms/components/FVPProgressChip.test.tsx`

#### `features/tms/components/FilteredBadge.tsx`
- **Purpose:** Amber badge shown when a TMS mode is active and filters are also active.
- **Key exports:** `FilteredBadge`
- **Imports:** `TMS_COPY`
- **Test file:** covered by `TMSModePill.test.tsx`

#### `features/tms/components/TMSInlineNotice.tsx`
- **Purpose:** Shared notice/banner. Accepts `variant: 'info' | 'warning' | 'success'`, `autoDismiss?: number`, `onDismiss?`, `actions?`.
- **Key exports:** `TMSInlineNotice`
- **Imports:** nothing domain-specific
- **Test file:** `features/tms/components/TMSInlineNotice.test.tsx`

#### `features/tms/components/ModeSwitchDialog.tsx`
- **Purpose:** `role="alertdialog"` confirmation for in-progress mode switches. Receives `fromMode`, `toMode`, `fvpProgress?`, `onConfirm`, `onCancel` as props — no store access.
- **Key exports:** `ModeSwitchDialog`
- **Imports:** `TMS_COPY`, Radix `AlertDialog`
- **Test file:** `features/tms/components/ModeSwitchDialog.test.tsx`

#### `features/tms/components/TMSCandidateRow.tsx`
- **Purpose:** Wrapper that applies left-border accent + background tint to the current candidate task row. Accepts `mode` and `isCandidate` props.
- **Key exports:** `TMSCandidateRow`
- **Imports:** nothing domain-specific
- **Test file:** `features/tms/components/TMSCandidateRow.test.tsx`

#### `features/tms/components/NudgeBanner.tsx`
- **Purpose:** Phase 2 dismissible banner in the Focus tab. Persists dismissal to localStorage. Gated on `ENABLE_TMS_NUDGE_BANNER`.
- **Key exports:** `NudgeBanner`
- **Imports:** `TMS_COPY`, `ENABLE_TMS_NUDGE_BANNER`
- **Test file:** `features/tms/components/NudgeBanner.test.tsx`

---

### 3. Modified Files

#### `GlobalTasksHeader.tsx`
- **What changes:** Remove the `needsAttentionSort` button. Add `<TMSModePill />` to the right control group between filter controls and `<AddTaskButton />`. Add `<FVPProgressChip />` when `activeSystem === 'fvp'`. Add `<FilteredBadge />` when mode is active and any filter is active.
- **Why:** This is the core UI change — the pill replaces the old toggle.
- **Test impact:** Update existing `GlobalTasksHeader.test.tsx` — remove `needsAttentionSort` button assertions, add pill render assertions.

#### `appStore.ts`
- **What changes:** Remove `needsAttentionSort: boolean` and `setNeedsAttentionSort`. See AD-4.
- **Why:** The pill in `tmsStore` replaces this toggle entirely.
- **Test impact:** Remove all `needsAttentionSort` assertions from `appStore.test.ts`. Grep for all consumers of `needsAttentionSort` and `setNeedsAttentionSort` — update each (expected: only `GlobalTasksHeader` and its test).

#### `GlobalTasksView.tsx` (or equivalent task list assembly component)
- **What changes:** After assembling filtered tasks, pipe through `useTMSOrderedTasks`. Pass `orderedTasks` to `TaskList`. Pass `activeSystem` and per-task snapshot/candidate metadata down to `TaskList`.
- **Why:** TMS ordering must happen after filtering, before render.
- **Test impact:** Update integration tests to assert TMS ordering is applied after filters.

#### `TaskList.tsx` / `TaskRow.tsx`
- **What changes:**
  - Wrap current candidate row with `TMSCandidateRow` (applies accent + tint).
  - Apply `opacity-60` class to non-candidate rows when a mode is active.
  - Render `TMSInlineNotice` at list top for view-changed / queue-complete / no-candidates states.
  - Add "Not in session" badge slot on `TaskRow` for FVP non-snapshot tasks.
  - Add "FVP candidate · outside current filter" separator treatment above out-of-filter candidates.
- **Why:** Visual session state must be reflected in the task list.
- **Test impact:** Update `TaskList.test.tsx` and `TaskRow.test.tsx` — add tests for candidate highlight, opacity dimming, notice rendering, badge rendering.

#### `features/keyboard/types.ts`
- **What changes:** Add `'tms.openModeSelector'` to the `ShortcutAction` union type.
- **Why:** New keyboard action needs a type-safe identifier.
- **Test impact:** Type-only change; no test update needed, but verify `shortcutService.test.ts` still compiles.

#### `features/keyboard/services/shortcutService.ts`
- **What changes:** Add `'tms.openModeSelector': { key: 'shift+r', label: 'Open review mode selector' }` to `getDefaultShortcutMap()`.
- **Why:** Registers the default binding. `Shift+R` avoids the `r` conflict with `task.reinsert`.
- **Test impact:** Update `shortcutService.test.ts` — assert `getDefaultShortcutMap()` contains `tms.openModeSelector` with key `shift+r`, and that `task.reinsert` still maps to `r`.

#### `features/keyboard/hooks/useGlobalShortcuts.ts`
- **What changes:** Register handler for `tms.openModeSelector` that calls `openModeSelector()` from `useTMSModeSelector` — but only when focus is not inside a text input.
- **Why:** Wires the keyboard shortcut to the pill's open action.
- **Test impact:** Update `useGlobalShortcuts.test.ts` — assert shortcut fires when focus is on body, does not fire when focus is in an input.

#### `features/keyboard/components/ShortcutHelpOverlay.tsx`
- **What changes:** Add a "Review mode" section with two entries: `Shift+R` / "Open the review mode selector" and `Escape` / "Exit the active review mode".
- **Why:** Users need to discover the shortcut.
- **Test impact:** Update `ShortcutHelpOverlay.test.tsx` — assert "Review mode" section and both entries render.

---

### 4. State Changes

#### `tmsStore` — FVP system state extension

The FVP system state type gains one field:

```ts
interface FVPSystemState {
  // existing fields ...
  snapshotTaskIds: string[];   // NEW — task IDs captured at FVP activation
}
```

Written by `useTMSModeSelector` at activation time via `applySystemStateDelta('fvp', { snapshotTaskIds })`. Read by `useFVPSessionState` and `useTMSOrderedTasks`. Cleared by `clearSystemState('fvp')` on deactivation — existing behavior.

No new top-level `tmsStore` fields. No persistence key change.

#### `appStore` — field removal

`needsAttentionSort: boolean` and `setNeedsAttentionSort` are **removed**. The persisted `task-management-settings` blob will have a stale `needsAttentionSort` key in existing localStorage — this is harmless (Zustand ignores unknown keys on rehydration) but worth noting in the migration comment.

#### `ShortcutAction` — new entry

```ts
// features/keyboard/types.ts
type ShortcutAction =
  | ... // existing
  | 'tms.openModeSelector'  // NEW
```

#### Feature flags

```ts
// features/tms/flags.ts
export const ENABLE_FOCUS_TAB =
  process.env.NEXT_PUBLIC_ENABLE_FOCUS_TAB === 'true';

export const ENABLE_TMS_NUDGE_BANNER =
  process.env.NEXT_PUBLIC_ENABLE_TMS_NUDGE_BANNER === 'true';
```

Both default to `false` in production builds unless the env var is explicitly set.

---

### 5. TDD Task Breakdown

#### Phase A: Foundation — pure logic, no UI

| ID | Title | Files changed | Test file(s) | Test cases | Deps | Size |
|----|-------|--------------|-------------|-----------|------|------|
| T-01 | Add `tms.openModeSelector` ShortcutAction | `features/keyboard/types.ts` | `shortcutService.test.ts` | Type compiles; existing actions unchanged | — | S |
| T-02 | Register `Shift+R` default binding | `features/keyboard/services/shortcutService.ts` | `shortcutService.test.ts` | `getDefaultShortcutMap()` has `tms.openModeSelector → shift+r`; `task.reinsert` still maps to `r`; total binding count increments by 1 | T-01 | S |
| T-03 | Write `tms-copy.ts` | `features/tms/copy/tms-copy.ts` | `features/tms/copy/tms-copy.test.ts` | `fvpProgress(0,0)` → `'FVP — 0 of 0'`; `fvpProgress(7,23)` → `'FVP — 7 of 23'`; `fvpProgressNarrow(7,23)` → `'FVP 7/23'`; all static strings are non-empty; `confirmDialog.fvpBody(0,0)` includes "0 of 0"; `srAnnouncements.activated.FVP` includes "snapshotted" | — | S |
| T-04 | Write `fvpSnapshotService.ts` | `features/tms/services/fvpSnapshotService.ts` | `features/tms/services/fvpSnapshotService.test.ts` | `buildFvpSnapshot([])` → `[]`; returns IDs of all input tasks; `isTaskInSnapshot` true/false cases; completed tasks included (snapshot is ID-only, completion is checked at render time) | — | S |
| T-05 | Write `flags.ts` | `features/tms/flags.ts` | none (constants) | — | — | S |
| T-06 | Extend FVP system state type with `snapshotTaskIds` | `tmsStore.ts` (type only, no logic) | `tmsStore.test.ts` | FVP state initialises with `snapshotTaskIds: []`; `applySystemStateDelta('fvp', { snapshotTaskIds: ['a','b'] })` merges correctly; `clearSystemState('fvp')` resets to `[]` | — | S |
| T-07 | Remove `needsAttentionSort` from `appStore` | `appStore.ts` | `appStore.test.ts`, `GlobalTasksHeader.test.tsx` | Store no longer exposes `needsAttentionSort`; `setNeedsAttentionSort` removed; existing persisted blob with stale key rehydrates without error | — | S |

#### Phase B: Core UI — pill, popover, mode switching

| ID | Title | Files changed | Test file(s) | Test cases | Deps | Size |
|----|-------|--------------|-------------|-----------|------|------|
| T-08 | Write `useTMSModeSelector` hook | `features/tms/hooks/useTMSModeSelector.ts` | `features/tms/hooks/useTMSModeSelector.test.ts` | Switching from `none` to `af4` calls `setActiveSystem('af4')`; switching from in-progress FVP to AF4 sets `isConfirmDialogOpen=true` before switching; `confirmSwitch` completes the switch; `cancelSwitch` leaves active system unchanged; switching to `none` never opens dialog; scroll position saved on activate, restored on deactivate | T-04, T-06 | M |
| T-09 | Write `ModeSwitchDialog` | `features/tms/components/ModeSwitchDialog.tsx` | `features/tms/components/ModeSwitchDialog.test.tsx` | Renders FVP variant with progress "(18 of 30)"; renders generic variant without progress; confirm button label matches `toMode`; Escape triggers `onCancel`; focus lands on Cancel button on open; focus returns to trigger on close | T-03 | M |
| T-10 | Write `TMSModeOption` | `features/tms/components/TMSModeOption.tsx` | covered by T-11 | — | T-03 | S |
| T-11 | Write `TMSModePopover` | `features/tms/components/TMSModePopover.tsx` | `features/tms/components/TMSModePopover.test.tsx` | Renders 5 options; pressing `1` calls `onSelect('af4')`; pressing `0` calls `onSelect('none')`; `↓` moves focus to next option (wraps); `↑` moves focus to previous (wraps); `Escape` calls `onClose` without calling `onSelect`; `Enter` on focused option calls `onSelect`; active option has `aria-selected="true"` | T-10 | M |
| T-12 | Write `FVPProgressChip` | `features/tms/components/FVPProgressChip.tsx` | `features/tms/components/FVPProgressChip.test.tsx` | Renders "FVP — 7 of 23"; has `aria-live="polite"`; `aria-label` includes "7 of 23"; renders "(filtered)" suffix when `isFiltered=true` | T-03 | S |
| T-13 | Write `FilteredBadge` | `features/tms/components/FilteredBadge.tsx` | covered by T-15 | — | T-03 | S |
| T-14 | Write `TMSModePill` | `features/tms/components/TMSModePill.tsx` | `features/tms/components/TMSModePill.test.tsx` | Idle state renders "Review" label; active AF4 state renders "AF4" label; `aria-haspopup="listbox"`; `aria-expanded` toggles on click; clicking opens `TMSModePopover`; `ModeSwitchDialog` renders when `isConfirmDialogOpen=true`; `FVPProgressChip` renders only when `activeSystem === 'fvp'`; `FilteredBadge` renders when mode active + filters active | T-08, T-09, T-11, T-12, T-13 | L |
| T-15 | Wire `TMSModePill` into `GlobalTasksHeader` | `GlobalTasksHeader.tsx` | `GlobalTasksHeader.test.tsx` | Pill renders in toolbar; old `needsAttentionSort` button absent; pill is between filter controls and Add Task button; small-screen snapshot shows icon-only pill | T-07, T-14 | M |

#### Phase C: Task List Integration — ordering, candidate highlight, notices

| ID | Title | Files changed | Test file(s) | Test cases | Deps | Size |
|----|-------|--------------|-------------|-----------|------|------|
| T-16 | Write `useTMSOrderedTasks` hook | `features/tms/hooks/useTMSOrderedTasks.ts` | `features/tms/hooks/useTMSOrderedTasks.test.ts` | `activeSystem='none'` returns input unchanged; `activeSystem='af4'` returns `handler.getOrderedTasks(tasks, state)` result; handler receives already-filtered tasks (not raw store tasks); memoises — same input reference returns same output reference | T-06 | M |
| T-17 | Write `useFVPSessionState` hook | `features/tms/hooks/useFVPSessionState.ts` | `features/tms/hooks/useFVPSessionState.test.ts` | `isInSnapshot('id-in-snap')` → true; `isInSnapshot('id-not-in-snap')` → false; `isOutsideFilter('id-in-snap-but-filtered')` → true when task is in snapshot but not in visibleTasks; progress = count of snapshot IDs that are still in visibleTasks and not completed; `isFiltered` true when `snapshotTaskIds.length !== visibleTasks.length` | T-06 | M |
| T-18 | Write `TMSCandidateRow` | `features/tms/components/TMSCandidateRow.tsx` | `features/tms/components/TMSCandidateRow.test.tsx` | Applies mode-specific border class when `isCandidate=true`; applies background tint when `isCandidate=true`; renders children unchanged when `isCandidate=false`; AF4/DIT/FVP each get correct accent color class | — | S |
| T-19 | Write `TMSInlineNotice` | `features/tms/components/TMSInlineNotice.tsx` | `features/tms/components/TMSInlineNotice.test.tsx` | Renders info/warning/success variants with correct classes; `autoDismiss=4000` calls `onDismiss` after 4s (use fake timers); dismiss button calls `onDismiss` immediately; `role="status"` for info/success, `role="alert"` for warning; action buttons render when `actions` prop provided | T-03 | M |
| T-20 | Apply TMS ordering in `GlobalTasksView` | `GlobalTasksView.tsx` (or equivalent) | integration test in `GlobalTasksView.test.tsx` | With `activeSystem='af4'`, task list order matches `handler.getOrderedTasks` output; with `activeSystem='none'`, order is unchanged; filter change re-runs ordering with new filtered set | T-16 | M |
| T-21 | Candidate highlight + dimming in `TaskList` | `TaskList.tsx` | `TaskList.test.tsx` | Current candidate row has `TMSCandidateRow` wrapper; non-candidate rows have `opacity-60` class when mode active; no dimming when `activeSystem='none'`; "view changed" notice renders after Nested/Flat toggle while mode active; "queue complete" notice renders and auto-dismisses | T-18, T-19, T-20 | L |
| T-22 | FVP "Not in session" badge + outside-filter separator in `TaskRow` | `TaskRow.tsx` | `TaskRow.test.tsx` | Badge renders when `isNotInFvpSession=true`; badge absent when `isNotInFvpSession=false`; separator renders above task when `isOutsideFvpFilter=true`; separator absent otherwise | T-17 | M |
| T-23 | "No FVP candidates" empty state | `GlobalTasksView.tsx` or `TaskList.tsx` | existing integration test | Notice renders when `activeSystem='fvp'` and all snapshot tasks are outside current filter; "Clear filters" button clears `filterStore`; "End session" button calls `switchMode('none')` | T-17, T-19 | M |

#### Phase D: Keyboard

| ID | Title | Files changed | Test file(s) | Test cases | Deps | Size |
|----|-------|--------------|-------------|-----------|------|------|
| T-24 | Register `tms.openModeSelector` in `useGlobalShortcuts` | `features/keyboard/hooks/useGlobalShortcuts.ts` | `features/keyboard/hooks/useGlobalShortcuts.test.ts` | `Shift+R` on body calls `openModeSelector()`; `Shift+R` while focus is in `<input>` does NOT call `openModeSelector()`; `Shift+R` while focus is in `<textarea>` does NOT call `openModeSelector()` | T-02, T-08 | S |
| T-25 | `Escape` exits active mode via global shortcut | `features/keyboard/hooks/useGlobalShortcuts.ts` | `features/keyboard/hooks/useGlobalShortcuts.test.ts` | `Escape` while mode active and no popover open calls `switchMode('none')`; `Escape` while popover open closes popover (handled by popover, not global handler — assert global handler does NOT fire) | T-08 | S |
| T-26 | Add "Review mode" section to `ShortcutHelpOverlay` | `features/keyboard/components/ShortcutHelpOverlay.tsx` | `features/keyboard/components/ShortcutHelpOverlay.test.tsx` | "Review mode" section header renders; `Shift+R` entry renders with description "Open the review mode selector"; `Escape` entry renders with description "Exit the active review mode" | T-02, T-03 | S |

#### Phase E: Rollout

| ID | Title | Files changed | Test file(s) | Test cases | Deps | Size |
|----|-------|--------------|-------------|-----------|------|------|
| T-27 | Write `NudgeBanner` (Phase 2) | `features/tms/components/NudgeBanner.tsx` | `features/tms/components/NudgeBanner.test.tsx` | Renders when `ENABLE_TMS_NUDGE_BANNER=true`; does not render when flag false; dismiss button sets localStorage key; does not render after dismissal (localStorage key present); CTA link points to All Tasks route | T-05, T-03 | M |
| T-28 | Gate Focus tab on `ENABLE_FOCUS_TAB` flag | Navigation component + `TMSHost` render site | existing nav tests | Focus tab nav item absent when `ENABLE_FOCUS_TAB=false`; present when `true`; `TMSHost` not mounted when flag false | T-05 | S |
| T-29 | Phase 3 one-time migration tooltip | `features/tms/components/TMSModePill.tsx` or a wrapper | `TMSModePill.test.tsx` | Tooltip renders for users who have a `hadFocusTab` localStorage marker; does not render after first dismissal; does not render for users without the marker | T-14 | S |

---

### 6. E2E Test Plan

File: `e2e/tms-consolidation.spec.ts`

| # | Scenario | Steps | Assertion |
|---|----------|-------|-----------|
| E-01 | Pill renders in All Tasks toolbar | Load app, navigate to All Tasks | Pill with label "Review" is visible in toolbar |
| E-02 | Open popover via click | Click pill | Popover opens; 5 options visible (None, AF4, DIT, FVP, Standard) |
| E-03 | Open popover via `Shift+R` | Focus body, press `Shift+R` | Popover opens |
| E-04 | `Shift+R` suppressed in input | Click inline add row, press `Shift+R` | Popover does NOT open |
| E-05 | Select AF4 via keyboard `1` | Open popover, press `1` | Popover closes; pill label becomes "AF4"; first task row has candidate highlight border |
| E-06 | Select FVP via keyboard `3` | Open popover, press `3` | Pill label becomes "FVP — 0 of N"; progress chip visible |
| E-07 | FVP progress increments | Activate FVP; interact with FVP (advance comparison) | Progress chip updates to "FVP — 1 of N" |
| E-08 | FVP snapshot excludes post-activation tasks | Activate FVP; add new task via inline add | New task row shows "Not in session" badge; progress total unchanged |
| E-09 | Filter + TMS: FilteredBadge appears | Activate AF4; apply a project filter | "Filtered" badge appears adjacent to pill |
| E-10 | Escape exits mode | Activate AF4; press `Escape` | Pill returns to "Review" label; candidate highlight gone; scroll position restored |
| E-11 | Confirmation dialog on mid-session switch | Activate FVP; advance 1 comparison; open popover; press `1` (AF4) | Confirmation dialog appears with "Switch to AF4?" title |
| E-12 | Confirm switch discards FVP state | (continue E-11) click "Switch to AF4" | Dialog closes; pill shows "AF4"; FVP progress chip gone |
| E-13 | Cancel switch preserves FVP state | (repeat E-11) click "Cancel" | Dialog closes; pill still shows "FVP — 1 of N" |
| E-14 | Switching to None never shows dialog | Activate AF4; open popover; press `0` | No dialog; mode exits immediately |
| E-15 | Queue complete notice | Activate Standard with 1 task visible; exhaust queue | "Queue complete" notice appears; mode resets to None after 6s |
| E-16 | All Tasks features work during TMS session | Activate AF4; use inline add, toggle Nested/Flat, apply filter | All actions succeed; AF4 session remains active |
| E-17 | Nested mode: subtask not in AF4 pool | Activate AF4 in Nested mode (parent collapsed) | Subtask rows not highlighted as candidates |
| E-18 | Flat toggle updates DIT pool with banner | Activate DIT in Nested mode; toggle to Flat | "View changed — candidate pool updated" banner appears |
| E-19 | Phase 2 nudge banner in Focus tab | Set `ENABLE_TMS_NUDGE_BANNER=true`; navigate to Focus tab | Nudge banner visible; CTA navigates to All Tasks |
| E-20 | Focus tab hidden in Phase 3 | Set `ENABLE_FOCUS_TAB=false` | Focus tab nav item absent; navigating to Focus tab URL redirects to All Tasks |

---

### 7. Architectural Decisions

#### AD-1: Where FVP snapshot lives — `tmsStore` FVP state vs. React state

**Decision: `tmsStore` FVP system state (`snapshotTaskIds: string[]`).**

React state would be lost on unmount (e.g., navigating away and back mid-session). `tmsStore` is already persisted under `task-management-tms` and already owns all FVP state. Adding `snapshotTaskIds` to the FVP state shape is a minimal, consistent extension. **`useTMSModeSelector` writes `snapshotTaskIds` via `applySystemStateDelta` at activation time** (not the FVP handler's `onActivate` — see §1 Architecture Overview for the resolution of this ambiguity); `clearSystemState('fvp')` resets it on deactivation — no new store methods needed.

Rejected: a separate `useState` in `GlobalTasksView` — would not survive navigation. Rejected: a new top-level `tmsStore` field outside system state — breaks the existing per-system state encapsulation.

#### AD-2: How `GlobalTasksView` gets TMS-ordered tasks — hook vs. prop drilling

**Decision: `useTMSOrderedTasks(filteredTasks)` hook called inside `GlobalTasksView`.**

`GlobalTasksView` already assembles the filtered task list. Calling `useTMSOrderedTasks` there keeps the pipeline in one place: filter → TMS order → pass to `TaskList`. Prop-drilling the ordered list from a parent would require touching more components and obscures where the ordering happens. The hook is a pure derivation (no side effects), so it is safe to call in render.

Rejected: calling the hook inside `TaskList` — `TaskList` should receive already-ordered rows, not be responsible for ordering. Rejected: computing order in `tmsStore` — violates arch rule #1 (no business logic in stores).

#### AD-3: Confirmation dialog trigger — in `TMSModePill` vs. in a hook

**Decision: Dialog state lives in `useTMSModeSelector`; `TMSModePill` renders `ModeSwitchDialog` based on hook state.**

`useTMSModeSelector` is the right place to decide whether a switch requires confirmation (it has access to current system state and progress). `TMSModePill` is a dumb consumer — it renders the dialog when `isConfirmDialogOpen` is true and passes `confirmSwitch`/`cancelSwitch` callbacks. This keeps the component free of business logic (arch rule #1 spirit applied to components) and makes the confirmation logic unit-testable without rendering the full pill.

Rejected: putting dialog open/close state directly in `TMSModePill` — mixes UI state with the "should we confirm?" decision. Rejected: a separate `useModeSwitchConfirmation` hook — unnecessary indirection for logic that naturally belongs in `useTMSModeSelector`.

#### AD-4: `needsAttentionSort` — keep or remove from `appStore`

**Decision: Remove entirely.**

`needsAttentionSort` was the old "Review Queue" toggle — a boolean sort modifier. The new TMS mode selector in `tmsStore` fully replaces its purpose. Keeping it would create two overlapping mechanisms for "review mode" state. The field is removed from `appStore`; any component that read it is updated to read `tmsStore.activeSystem` instead.

Migration note: existing `task-management-settings` blobs in localStorage will have a stale `needsAttentionSort` key. Zustand's `persist` middleware ignores unknown keys on rehydration — no migration script needed. Add a comment in `appStore.ts` noting the removal for future reference.

---

### 8. Engineering Acceptance Criteria

These complement the PM and Power User lists. They focus on correctness, performance, and no regressions.

- [ ] `useTMSOrderedTasks` is called with already-filtered tasks — verified by unit test that mocks `getTMSHandler` and asserts the mock receives the filtered (not raw) task array.
- [ ] FVP `snapshotTaskIds` is written exactly once per activation — verified by unit test asserting `applySystemStateDelta` is called once with `snapshotTaskIds` during `useTMSModeSelector` activation of FVP.
- [ ] `buildFvpSnapshot` is a pure function — same input always produces same output, no store access — verified by unit test with no mocks.
- [ ] `needsAttentionSort` has zero references in the codebase after T-07 — verified by `grep -r needsAttentionSort src/` returning no results.
- [ ] `task.reinsert` shortcut (`r`) is unaffected — verified by `shortcutService.test.ts` asserting `r` still maps to `task.reinsert` after T-02.
- [ ] `Shift+R` does not fire when focus is inside any element matching `input, textarea, [contenteditable]` — verified by `useGlobalShortcuts.test.ts`.
- [ ] Switching modes never leaves `tmsStore` in a state where two systems are simultaneously "active" — verified by unit test asserting `activeSystem` is always a single value after any sequence of `switchMode` calls.
- [ ] `ModeSwitchDialog` receives no store imports — it is a pure presentational component accepting only props — verified by static import analysis (no `useTMSStore`, `useAppStore`, etc. in the file).
- [ ] `TMSInlineNotice` auto-dismiss uses `setTimeout` and is tested with `vi.useFakeTimers()` — no real timers in tests.
- [ ] `npx next build` passes after all Phase B changes — catches any SWC/Webpack issues from new `.tsx` files.
- [ ] All 20 E2E scenarios in `e2e/tms-consolidation.spec.ts` pass in CI before Phase 1 ships.
- [ ] No existing Playwright e2e tests regress — run full `e2e/` suite after Phase C.
- [ ] `ENABLE_FOCUS_TAB=false` (default) does not cause a runtime error when the Focus tab URL is visited — redirect to All Tasks is handled gracefully.
- [ ] FVP progress chip updates are announced via `aria-live="polite"` — verified by RTL `getByRole('status')` assertion after a progress update.
- [ ] The "No FVP candidates" notice uses `role="alert"` (`aria-live="assertive"`) — verified by RTL assertion.

---

## Open Questions / RFCs

> **Status: All resolved from codebase inspection.**

---

### OQ-1: Does `GlobalTasksView` exist as a named component? ✅ RESOLVED

**Answer:** Yes. `features/tasks/components/GlobalTasksView.tsx` exists and already assembles filtered tasks. `needsAttentionSort` is read directly inside it. T-20 proceeds as written — pipe `useTMSOrderedTasks` after the existing filter pipeline inside `GlobalTasksView`.

---

### OQ-2: Is `handleSwitch` extractable from `TMSHost`? ✅ RESOLVED

**Answer:** `handleSwitch` is a closure inside `TMSHost`. It calls `handler.onDeactivate` → `setActiveSystem` → `getTMSHandler(newId)` → `newHandler.onActivate` → `setSystemState`. This logic must be extracted to `features/tms/services/tmsSwitchService.ts` before T-08. Add **T-00b** as a pre-Phase A task.

**Resolution:** Extract `executeTMSSwitch(fromId, toId, tasks, systemStates): { newActiveSystem, systemStateUpdates }` as a pure function. Both `TMSHost` and `useTMSModeSelector` call it and apply the returned deltas via store actions.

> **⚠️ Arch rule #4 note (Lead SDE):** The original signature used `tmsStoreState` (the entire store blob). That violates arch rule #4 — no whole-blob interfaces. The parameter is narrowed to `systemStates: Record<TMSSystemId, SystemState>` — only the per-system state map, not the full store. `fromId` and `toId` are already separate params; `tasks` is the filtered task array needed by `onActivate`. Nothing else from the store is required by the switch logic.

---

### OQ-3: How does `useGlobalShortcuts` guard against text inputs? ✅ RESOLVED

**Answer:** Two layers: (1) `react-hotkeys-hook` is called with `{ enableOnFormTags: false }` which suppresses shortcuts in `<input>`, `<textarea>`, `<select>`. (2) An additional `isInputContext(document.activeElement)` check from `features/keyboard/services/inputContext.ts` guards each handler. T-24 uses the same pattern — register with `hotkeyOpts` and wrap the handler body with `if (!isInputContext(document.activeElement))`.

---

### OQ-4: What constitutes "in-progress" for AF4/DIT confirmation? ✅ RESOLVED

**Answer:** AF4 already tracks `markedTasks: string[]` and `markedOrder: string[]` in system state. DIT tracks `todayTasks: string[]` and `tomorrowTasks: string[]`. "In-progress" = `markedOrder.length > 0` for AF4, `todayTasks.length > 0 || tomorrowTasks.length > 0` for DIT. No new `candidatesSurfaced` counter needed. `useTMSModeSelector` reads these from `tmsStore.state.systemStates` to decide whether to show the confirmation dialog.

---

### OQ-5: Where is the scroll container? ✅ RESOLVED

**Answer:** `GlobalTasksContainer.tsx` wraps `GlobalTasksView` in `<div className="flex-1 overflow-auto">`. This `div` is the scroll container — not `window`. `useTMSModeSelector` needs a `scrollContainerRef: RefObject<HTMLElement>` passed from `GlobalTasksContainer`. Scroll position is saved as `scrollContainerRef.current.scrollTop` on mode activation and restored on exit.

---

### OQ-6: Should `Standard` mode require a confirmation dialog? ✅ RESOLVED

**Answer:** No. Standard is a sort order with no session state. Switching away is always immediate (same as switching to None). Confirmed by the fact that Standard's system state is `{}` — nothing to lose.

---

### OQ-7: Phase 3 redirect for static export? ✅ RESOLVED

**Answer:** Client-side redirect. The Focus tab page component checks `ENABLE_FOCUS_TAB`; if false, renders `null` and calls `router.replace('/all-tasks')` on mount. Compatible with Next.js static export.

---

### OQ-1: Does `GlobalTasksView` exist as a named component, or is the filtered-task assembly inline in a page?

**Question:** The task breakdown assumes a `GlobalTasksView.tsx` component that assembles filtered tasks and passes them to `TaskList`. If this logic is currently inline in a page component or split differently, T-20 needs to be adjusted.

**Options:**
1. `GlobalTasksView` exists as a standalone component — T-20 proceeds as written.
2. Filtering is inline in a page — extract a `GlobalTasksView` component first (pre-task before T-20).
3. Filtering is in a hook (e.g., `useFilteredTasks`) — `useTMSOrderedTasks` chains after it; no new component needed.

**Recommended resolution:** Engineering to grep for where `filterStore` selectors are consumed alongside the task list render. If no `GlobalTasksView` exists, add a pre-task T-00 to extract the assembly into a named component before T-16/T-20.

**Owner:** Engineering

---

### OQ-2: Does `TMSHost.tsx` export `handleSwitch` in a reusable form, or is it private to the component?

**Question:** `useTMSModeSelector` needs to replicate the `handleSwitch` lifecycle (deactivate → setActiveSystem → activate → setSystemState). If `handleSwitch` is currently a closure inside `TMSHost`, it must be extracted to a shared utility before T-08.

**Options:**
1. Extract `handleSwitch` to `features/tms/services/tmsSwitchService.ts` — both `TMSHost` and `useTMSModeSelector` import it.
2. Duplicate the logic in `useTMSModeSelector` — simpler short-term, creates drift risk.
3. `useTMSModeSelector` calls `TMSHost`'s exposed imperative handle via `useImperativeHandle` — overly complex.

**Recommended resolution:** Option 1. Extract to `tmsSwitchService.ts` as a pure function `switchTMSMode(fromId, toId, currentState, tasks): { newActiveSystem, newSystemState }` that returns state deltas. Both `TMSHost` and `useTMSModeSelector` call it and apply the deltas via store actions. Add this as task T-00b (pre-Phase A).

**Owner:** Engineering

---

### OQ-3: How does `useGlobalShortcuts` currently guard against firing shortcuts in text inputs?

**Question:** The existing `task.reinsert` shortcut (`r`) presumably already has this guard. T-24 needs to use the same mechanism rather than inventing a new one.

**Options:**
1. `react-hotkeys-hook` is called with `{ enableOnFormTags: false }` (the default) — the guard is automatic; T-24 just registers the shortcut normally.
2. There is a custom `isTypingInInput()` guard function — T-24 reuses it.
3. The guard is ad-hoc per shortcut — T-24 adds its own check.

**Recommended resolution:** Engineering to check `useGlobalShortcuts.ts` before T-24. If `react-hotkeys-hook` default behavior handles it, no extra work. If a custom guard exists, reuse it. Document the finding in a comment in `useGlobalShortcuts.ts`.

**Owner:** Engineering

---

### OQ-4: What constitutes "in-progress state" for AF4 and DIT — when does the confirmation dialog trigger?

**Question:** The PM/Power User sections say confirmation is required when switching from "in-progress" AF4 or DIT. But AF4 and DIT don't have a progress counter like FVP. The trigger condition needs a precise definition.

**Options:**
1. "In-progress" = `activeSystem !== 'none'` — any active session triggers confirmation, even if zero candidates have been surfaced.
2. "In-progress" = at least one candidate has been surfaced (requires tracking a `candidatesSurfaced: number` counter in system state).
3. "In-progress" = the session has been active for more than N seconds (fragile, not recommended).

**Recommended resolution:** Option 2. Add `candidatesSurfaced: number` to AF4 and DIT system state, incremented by the handler each time a new candidate is surfaced. `useTMSModeSelector` checks `candidatesSurfaced > 0` before opening the dialog. This is consistent with FVP's "comparisons made" concept and avoids spurious dialogs when a user accidentally activates a mode and immediately wants to switch.

**Owner:** Engineering (with PM sign-off on the UX implication — switching immediately after activation should not require confirmation)

---

### OQ-5: Scroll position save/restore — where is the scroll container?

**Question:** `useTMSModeSelector` needs to save scroll position on mode activation and restore it on exit. The scroll container for the task list needs to be identified — it may be `window`, a named `div`, or a virtualized list container.

**Options:**
1. Scroll container is `window` — use `window.scrollY` / `window.scrollTo`.
2. Scroll container is a specific DOM element — need a `ref` passed to or obtained by the hook.
3. Task list uses a virtualized scroller (e.g., `react-virtual`) — scroll restoration goes through the virtualizer's API.

**Recommended resolution:** Engineering to inspect `TaskList.tsx` before T-08. If it's `window`, the hook handles it directly. If it's a DOM ref, `useTMSModeSelector` should accept an optional `scrollContainerRef: RefObject<HTMLElement>` parameter. Document the finding before implementing T-08.

**Owner:** Engineering

---

### OQ-6: Should `Standard` mode require a confirmation dialog when switching away?

**Question:** The Power User section says confirmation is required when switching from "in-progress" AF4/DIT/FVP. Standard mode is described as "sorted review, no prompts" — it has no candidate surfacing mechanic. Should switching away from Standard ever show a dialog?

**Options:**
1. No — Standard is a sort order, not a session. Switching away is always immediate (same as switching to None).
2. Yes — treat Standard like AF4/DIT for consistency; show dialog if `candidatesSurfaced > 0`.

**Recommended resolution:** Option 1. Standard has no session state to lose. Switching away is always immediate. This is consistent with the PM spec ("Switching to None never requires confirmation") and the fact that Standard is described as a sort, not a prompted review.

**Owner:** PM to confirm; Engineering to implement per PM decision.

---

### OQ-7: Redirect behavior for Focus tab deep-links in Phase 3 — client-side or server-side?

**Question:** Phase 3 requires that navigation to the Focus tab URL redirects to All Tasks. This is a Next.js app with static export. The redirect mechanism needs to be defined.

**Options:**
1. Client-side redirect in the Focus tab page component — check `ENABLE_FOCUS_TAB` flag, call `router.replace('/all-tasks')` on mount.
2. Next.js `redirects` in `next.config.js` — only works for server-rendered or middleware-enabled deployments; may not work with static export.
3. Remove the Focus tab route entirely in Phase 3 — 404 for old URLs, which is acceptable if no external deep-links exist.

**Recommended resolution:** Option 1 for static export compatibility. The Focus tab page component checks `ENABLE_FOCUS_TAB`; if false, renders `null` and calls `router.replace` to All Tasks. This is testable and works with static export. If the app ever moves to SSR, migrate to `next.config.js` redirects.

**Owner:** Engineering

---

## Power User Review Notes

Changes made during the power user review pass, and the reasoning behind each.

---

### 1. `R` → `Shift+R` throughout (all sections)

**Problem:** The keyboard table in the Interaction Requirements section, Scenarios 1–3, the PM Acceptance Criteria, the Power User Acceptance Criteria, and the Risk 1 mitigation all used bare `` `R` `` as the shortcut for opening the mode selector. The UX Writing section and T-02 in TASKS.md correctly used `Shift+R`. This was a direct conflict — `r` is already bound to `task.reinsert`.

**Fix:** Updated every occurrence of bare `` `R` `` (in the context of opening the mode selector) to `` `Shift+R` `` across the spec. Added an explicit note in the keyboard table: "`r` (unmodified) remains bound to `task.reinsert` — no conflict."

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (keyboard table, Scenarios 1/2/3, PM AC, Power User AC, Risk 1 mitigation).

---

### 2. T-07 `onReinsertTask` guard — clarified which modes allow reinsert

**Problem:** T-07 said the guard changes to `tmsStore.activeSystem !== 'none'` but gave no rationale, leaving implementers to wonder whether DIT and Standard should be excluded. The original guard was tied to `needsAttentionSort` (a binary toggle), so the semantics weren't obvious.

**Fix:** Kept the guard as `activeSystem !== 'none'` (correct) and added explicit test cases for AF4, DIT, and `none`. Added a note explaining that all non-none modes support reinsert — DIT has a "do it tomorrow" mechanic, Standard is a sorted review, and AF4/FVP are the primary use cases. The guard is intentionally broad.

**Files changed:** TASKS.md (T-07).

---

### 3. T-08 `useTMSModeSelector` — scroll ref must be passed in, not created inside the hook

**Problem:** T-08 said scroll position is "saved/restored via `scrollContainerRef`" but didn't specify how the hook gets the ref. A hook can't own a DOM ref that points to a container rendered by a parent component. The ref must be created in `GlobalTasksContainer` and passed down. T-15 mentioned the wiring but T-08's signature was silent on it, which would lead to an implementer creating the ref inside the hook (wrong) or guessing the API.

**Fix:** Made the hook signature explicit: `useTMSModeSelector(scrollContainerRef: React.RefObject<HTMLElement>)`. Added a test case asserting the ref is passed as a parameter. Updated T-15 to spell out the full prop-threading chain: `GlobalTasksContainer` → `GlobalTasksHeader` → `TMSModePill` → `useTMSModeSelector`.

**Files changed:** TASKS.md (T-08, T-15).

---

### 4. T-08 `isPopoverOpen` must be exposed in the return value

**Problem:** T-25 required that `Escape` does NOT exit the active mode when the popover is open (the popover handles its own Escape). But `useGlobalShortcuts` had no way to know whether the popover was open — `isModePopoverOpen` wasn't in the `UseGlobalShortcutsOptions` interface, and `useTMSModeSelector`'s return value didn't expose `isPopoverOpen`. This would have caused a real bug: pressing `Escape` to close the popover would also exit the active mode.

**Fix:** Added `isPopoverOpen` to `useTMSModeSelector`'s return value (T-08). Added `isModePopoverOpen: boolean` to `UseGlobalShortcutsOptions` (T-25). Added a test case in T-25 asserting the global handler checks this flag before firing `onExitMode`. Added a note that `isModePopoverOpen` is sourced from `useTMSModeSelector` and threaded into `useGlobalShortcuts` at the call site.

**Files changed:** TASKS.md (T-08, T-25). Added E2E scenario E-22.

---

### 5. T-21 queue exhaustion — detection logic was unassigned

**Problem:** T-21 said "queue complete notice renders when queue exhausted; mode resets to none" but didn't specify *who* detects exhaustion or *how*. `useTMSOrderedTasks` returns an empty array when the queue is empty, but nothing was watching for the transition from non-empty → empty and triggering the notice + mode reset. This logic would have been silently omitted or duplicated.

**Fix:** Added explicit detection logic to T-21: `GlobalTasksView` watches `orderedTasks.length` via a `useEffect`; when it transitions from `> 0` to `0` while `activeSystem !== 'none'`, it fires the "queue complete" notice and calls `switchMode('none')` after the dismiss delay. Added a concrete test case covering this transition.

**Files changed:** TASKS.md (T-21). Added E2E scenario E-21.

---

### 6. T-21 "View changed" banner — trigger was unspecified

**Problem:** T-21 listed "view changed notice renders after Nested/Flat toggle while mode active" as a test case but didn't say what component watches the toggle or how the notice is triggered. Without this, the implementer has no clear hook to attach the logic to.

**Fix:** Added to T-21: `GlobalTasksView` watches `globalTasksDisplayMode` via a `useEffect`; when it changes while `activeSystem !== 'none'`, it sets a `viewChangedNotice` boolean. Added a concrete test case: render with `activeSystem='dit'`, toggle `globalTasksDisplayMode`, assert the notice appears.

**Files changed:** TASKS.md (T-21).

---

### 7. DIT `todayTasks` filtering and AF4 `markedOrder` cleanup — missing handler behaviors

**Problem:** Two mid-session state correctness issues were not covered by any task:

- **DIT:** When DIT is active, completed tasks should not appear in the `todayTasks` candidate pool. The spec was silent on whether the DIT handler filters these itself or whether `GlobalTasksView` pre-filters before passing to the handler.
- **AF4:** When a task is completed mid-session, its ID should be removed from `markedOrder`. If it isn't, AF4's internal state references a completed task that will never surface, causing silent state drift.

**Fix:** Added both as explicit test cases in T-21, with a note that the implementer must verify whether the handler or the view layer owns the filtering. These are not new tasks — they're correctness checks that belong in the integration test for T-21 since that's where the handler receives its input.

**Files changed:** TASKS.md (T-21).

---

### 8. Verification checklist — added `isModePopoverOpen` grep check

Added a grep check to the verification checklist confirming `isModePopoverOpen` is threaded from `useTMSModeSelector` to the `useGlobalShortcuts` call site. Updated E2E count from 20 to 22.

**Files changed:** TASKS.md (Verification Checklist).

---

## PM Review Notes

Changes made during the PM review pass. Each item identifies the gap, the fix, and which file(s) were updated.

---

### 1. Missing AC: scroll restore, queue-complete, sr-only announcements, empty states

**Gap:** Four user-facing behaviors described in detail in the spec had no corresponding PM Acceptance Criteria:
- Scroll position restore on mode exit (described in Interaction Requirements)
- "Queue complete" notice + auto-reset to None on queue exhaustion (described in Edge Cases and §5 Inline Notices)
- Screen reader `aria-live` announcements on mode activation/exit (described in §9 SR Announcements)
- Empty state copy variants — filtered vs. all-completed (described in §8 Empty State)

**Fix:** Added four new AC items to the PM Acceptance Criteria section covering all four behaviors.

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Acceptance Criteria).

---

### 2. Success metrics are not measurable given the app's architecture

**Gap:** All 5 metrics reference event counts, DAU, and session completion rates. The app is localStorage-only with no analytics backend. Metrics 1–4 cannot be measured as written.

**Fix:** Added a `⚠️ Measurability note` callout above the metrics list explaining the constraint and providing a practical fallback: treat metrics 1–4 as qualitative signals until analytics are confirmed; metric 5 (support tickets) is the only currently measurable gate.

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Success Metrics).

---

### 3. Phase 3 gate criteria is not measurable

**Gap:** The gate "Focus subtab usage drops below 20% of Phase 1 baseline" requires event tracking that doesn't exist. The time-based fallback ("after 3 weeks regardless") was buried as a secondary condition.

**Fix:** Added a `⚠️ Gate measurability note` immediately after the gate criteria, promoting the 3-week time-based fallback as the operative gate and defining a concrete qualitative threshold (no critical bugs, ≤5 complaints).

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Rollout Plan — gate criteria).

---

### 4. `hadFocusTab` localStorage marker — nothing sets it (T-29b added)

**Gap:** T-29 reads `hadFocusTab` from localStorage to decide whether to show the Phase 3 migration tooltip. No task wrote this key. The tooltip would never appear for any user — the Phase 3 migration UX would be silently broken.

**Fix:** Added **T-29b** — a new S-sized task that writes `hadFocusTab=true` to localStorage when the Focus tab page mounts (while `ENABLE_FOCUS_TAB=true`). Depends on T-28. Added to dependency graph.

**Files changed:** TASKS.md (new T-29b, dependency graph).

---

### 5. Phase 2 nudge banner — no task wires it into the Focus tab page (T-27b added)

**Gap:** T-27 creates `NudgeBanner.tsx`. T-28 gates the Focus tab nav item. Neither task adds the banner to the Focus tab page content. The component would be built but never rendered.

**Fix:** Added **T-27b** — a new S-sized task that imports and renders `NudgeBanner` at the top of the Focus tab page component, above the existing Review Queue UI. Depends on T-27. Added to dependency graph. Added a Phase 2 verification checklist.

**Files changed:** TASKS.md (new T-27b, dependency graph, new Phase 2 verification checklist).

---

### 6. `showReinsertButton` prop not covered by T-07 or T-20

**Gap:** `GlobalTasksView` passes `showReinsertButton={needsAttentionSort}` to `TaskList`. T-07 removes `needsAttentionSort` but neither T-07 nor T-20 explicitly stated what replaces this prop. An implementer could leave the prop as `undefined` (silently disabling the reinsert button for all modes) or forget to update it entirely.

**Fix:** Added an explicit note and test case to T-07: `showReinsertButton` must be updated to `showReinsertButton={activeSystem !== 'none'}` in the same task. Added a grep check to the Phase 1 verification checklist confirming the prop is updated at the call site.

**Files changed:** TASKS.md (T-07, Phase 1 verification checklist).

---

### 7. Risk 2 mitigation gap — FVP snapshot caveat missing from popover description

**Gap:** Risk 2 says "UX copy in the FVP mode description (in the popover) explicitly states: 'Candidate list is fixed at session start.'" But the popover description in `tms-copy.ts` was `'Compare and surface your top task'` — no snapshot caveat. The mitigation was documented but not implemented in the copy strings.

**Fix:** Updated the FVP popover description to `'Snapshot-based: list fixed at session start'` in both the mode options table and the `tms-copy.ts` reference block. Added a test case to T-03 asserting `popover.options.FVP.description` contains "session start."

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (mode options table, `tms-copy.ts` reference block), TASKS.md (T-03 test cases).

---

### 8. T-28 redirect test case was missing

**Gap:** T-28 said "Navigating to Focus tab URL when flag is `false` calls `router.replace` to All Tasks" but gave no test case for it — just a bullet. The OQ-7 resolution (client-side redirect via `router.replace` on mount) was documented in the spec but not reflected in T-28's test cases.

**Fix:** Expanded T-28's test cases to include an explicit redirect test: render the Focus tab page with `ENABLE_FOCUS_TAB=false` and assert `router.replace` was called with the All Tasks route. Added a Phase 3 verification checklist item for the redirect.

**Files changed:** TASKS.md (T-28, new Phase 3 verification checklist).

---

### 9. Dependency graph updated

Added T-27b and T-29b to the dependency graph with their correct upstream dependencies. Split the single verification checklist into three phase-gated checklists (Phase 1, Phase 2, Phase 3).

**Files changed:** TASKS.md (dependency graph, verification checklists).

---

## UI/UX Review Notes

Changes made during the UI/UX design review pass. Each item identifies the gap, the fix, and which file(s) were updated.

---

### 1. `TMSInlineNotice` action buttons — style spec was missing

**Gap:** Section 5 specifies the "No FVP candidates" notice has `[Clear Filters]` and `[End Session]` action buttons, but gave no style spec for them. The confirmation dialog button styles (§6) exist but are not the right reference — those are in a modal context with destructive intent. The notice buttons are inline, contextual actions.

**Fix:** Added explicit button styles to Section 5 under the "No FVP candidates" notice. `[Clear filters]` is a secondary/ghost button (safe action, left); `[End session]` is a ghost destructive button (right). Both are `h-7 px-3 text-xs rounded-md` to stay compact inside the notice. Styles:

```
/* Clear filters — safe secondary */
class="h-7 px-3 rounded-md text-xs font-medium
       bg-transparent text-amber-300 border border-amber-700
       hover:bg-amber-950/60 hover:text-amber-200
       focus-visible:ring-2 focus-visible:ring-amber-500"

/* End session — ghost destructive */
class="h-7 px-3 rounded-md text-xs font-medium
       bg-transparent text-zinc-400 border border-zinc-700
       hover:bg-zinc-800 hover:text-zinc-200
       focus-visible:ring-2 focus-visible:ring-zinc-500"
```

Button order: `[Clear filters]` left, `[End session]` right — safe action first, consistent with the confirmation dialog pattern. The `actions` prop on `TMSInlineNotice` accepts `{ label: string; onClick: () => void; variant: 'secondary' | 'ghost-destructive' }[]` so the styles are driven by variant, not hardcoded per notice.

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Section 5 — "No FVP candidates" notice), TASKS.md (T-19 — `actions` prop variant type).

---

### 2. `FVPProgressChip` responsive behavior was unspecified

**Gap:** Section 1 (Toolbar Layout) says the TMS pill collapses to icon-only at `< 768px`. Section 4 says the progress chip is "hidden at `< 768px`" and the count moves into the pill label. But there was no spec for what happens to `FVPProgressChip` at intermediate widths (768px–900px) where the chip and pill coexist but toolbar space is tight, nor was the chip's own min-width or truncation behavior defined.

**Fix:** Added responsive spec to Section 4 (`FVPProgressChip`):
- At `≥ 768px`: chip renders in full — `"FVP — 7 of 23"`. Min-width: `w-24` to prevent layout jitter as numbers change.
- At `< 768px`: chip is hidden (`hidden md:inline-flex`). The count is appended to the pill label as `"FVP 7/23 ▾"` (using `fvpProgressNarrow`). The pill's max-width at narrow sizes is `max-w-[96px]` with `truncate` to prevent overflow if the count is large (e.g., "FVP 99/999 ▾").
- The chip never truncates at wide widths — numbers are short enough that overflow is not a concern.

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Section 4 — FVP progress indicator), TASKS.md (T-12 — added narrow-width hide test case).

---

### 3. `FilteredBadge` responsive behavior was unspecified

**Gap:** The `FilteredBadge` had no responsive spec. At narrow widths where the toolbar is already tight (pill collapsed to icon-only, progress chip hidden), the badge could overflow or wrap.

**Fix:** Added to Section 4 (`FilteredBadge`):
- At `≥ 768px`: badge renders in full — icon + "Filtered" label.
- At `< 768px`: badge is hidden (`hidden md:inline-flex`). The filter state is communicated via the pill's icon changing from `ChevronDown` to a `FilterIcon` (12px) when a mode is active and filters are on. The pill's `aria-label` already includes the active mode name; add `aria-label="TMS mode: AF4 (active, filtered)"` when both conditions are true.

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Section 4 — "Filtered" badge), TASKS.md (T-13 — added narrow-width behavior note; T-14 — added `aria-label` filtered variant test case).

---

### 4. `TMSInlineNotice` animation spec was missing

**Gap:** The popover has a detailed open/close animation spec (Section 3). The candidate row highlight has `transition-all duration-200` (Section 4). But `TMSInlineNotice` had no animation spec — only the "View changed" banner mentioned a slide-down animation in passing, and the "Queue complete" and "No FVP candidates" notices had none.

**Fix:** Added a unified animation spec to Section 5 (Inline Notices & Banners), applied to all `TMSInlineNotice` variants:

**Enter:** Slides down from above + fades in.
```
animate-in fade-in-0 slide-in-from-top-2 duration-200 ease-out
```

**Exit (auto-dismiss or manual):** Fades out + slides up.
```
animate-out fade-out-0 slide-out-to-top-2 duration-150 ease-in
```

The "No FVP candidates" notice (non-dismissible) only has an enter animation — no exit animation since it persists until user action. When the user clears filters or ends the session, the notice disappears instantly (no exit animation needed; the list content change is the visual feedback).

> **⚠️ `prefers-reduced-motion` (Lead SDE):** All animation classes above must be wrapped in `motion-safe:` Tailwind variants. Users with `prefers-reduced-motion: reduce` should see instant appear/disappear. The `autoDismiss` timer still fires — only the CSS transition is suppressed. See T-19.

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Section 5 — base notice spec), TASKS.md (T-19 — added animation class test case).

---

### 5. `TMSCandidateRow` — Standard mode render behavior was unspecified

**Gap:** Section 8 (Component Hierarchy) and T-18 both describe `TMSCandidateRow` accepting a `mode` prop. The spec covers AF4 (`border-l-violet-500`), DIT (`border-l-amber-500`), and FVP (`border-l-blue-500`). But Standard mode is described as "no candidate highlighting" in the mid-session state indicators (§ Interaction Requirements). `TMSCandidateRow` accepts `mode='standard'` — what does it render?

**Fix:** Added explicit Standard mode behavior to Section 4 (Active Review Mode) and T-18:

`mode='standard'` with `isCandidate=true`: renders children with **no** left-border accent and **no** background tint. The `TMSCandidateRow` wrapper is still used (for structural consistency) but applies no visual treatment. Non-candidate rows also receive **no** `opacity-60` dimming when `activeSystem='standard'` — Standard is a sort order, not a spotlight review.

This means `TMSCandidateRow` with `mode='standard'` is effectively a passthrough. The `isCandidate` prop is still respected for future extensibility but has no visual effect in Standard mode.

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Section 4 — candidate highlight, Section 8 — TMSCandidateRow notes), TASKS.md (T-18 — added Standard mode test cases; T-21 — added no-dimming-in-standard test case).

---

### 6. `TMSModePill` disabled state was unspecified

**Gap:** The pill has idle/active/hover/focus states. When a `ModeSwitchDialog` is open, the pill is still technically interactive — a user could click it again, opening the popover while the dialog is also open. This creates a layered modal situation that is not handled.

**Fix:** Added a `disabled` state to Section 2 (TMS Mode Pill):

**Disabled state** (confirmation dialog is open):
```
class="... opacity-50 cursor-not-allowed pointer-events-none"
aria-disabled="true"
```

The pill is disabled (`pointer-events-none`) while `isConfirmDialogOpen=true`. This prevents the popover from opening while the dialog is active. The `aria-disabled="true"` attribute communicates the state to screen readers without removing the element from the tab order (so focus management from the dialog back to the pill still works).

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Section 2 — TMS Mode Pill disabled state), TASKS.md (T-14 — added disabled state test case; T-09 — added note that pill is disabled while dialog is open).

---

### 7. Focus management gaps — `TMSInlineNotice` dismiss and post-auto-dismiss

**Gap:** Section 7 (Accessibility Checklist) covers focus management for the popover and dialog. But two cases were missing:
1. When the user clicks the `×` dismiss button on a `TMSInlineNotice`, where does focus go?
2. When the "Queue complete" notice auto-dismisses (no user action), where does focus go?

**Fix:** Added to Section 7 (Accessibility Checklist — Focus management):

- **Notice dismiss button (`×`):** On click, focus moves to the first focusable element in the task list (the first task row, or the Add Task button if the list is empty). This is the natural reading-order destination after the notice disappears. Implemented via `onDismiss` callback calling `firstTaskRef.current?.focus()`.
- **Auto-dismiss (Queue complete notice):** No focus movement. The notice auto-dismisses after 6 seconds; if the user has not interacted with it, their focus is presumably elsewhere in the task list. Moving focus programmatically on auto-dismiss would be disruptive. The `aria-live="polite"` region already announces the dismissal to screen readers.
- **Auto-dismiss (View changed notice):** Same — no focus movement on auto-dismiss.

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Section 7 — Focus management table), TASKS.md (T-19 — added focus-on-dismiss test case).

---

### 8. Toolbar density — no max-width or overflow strategy defined

**Gap:** Section 1 (Toolbar Layout) defines the DOM order and spacing but does not address what happens when all conditional elements are visible simultaneously: `[Nested/Flat] [Hide Completed] ··· [FVP — 7 of 23] [Filtered] [AF4 ▾] [+ Add Task]`. At 768px–900px viewport widths, this is 6 elements in a single row. No max-width concern or overflow strategy was documented.

**Fix:** Added a toolbar density note to Section 1:

**Worst-case toolbar (FVP active + filters active, wide viewport):**
```
[Nested/Flat] [Hide Completed]  ···  [FVP — 7 of 23] [Filtered] [FVP ▾] [+ Add Task]
```
Total approximate width: `~520px` at comfortable spacing. This fits within a 768px viewport with `px-4` padding on each side (leaving `~688px` usable). No overflow issue at `≥ 768px`.

**At 768px–900px:** The progress chip (`w-24`) and filtered badge (`w-16`) are both visible. The pill collapses to icon-only (`w-8`). Total right-group width: `~56px` (chip) + `~8px` (gap) + `~40px` (badge) + `~8px` (gap) + `~32px` (pill) + `~8px` (gap) + `~80px` (Add Task) = `~232px`. Left group: `~160px`. Spacer absorbs the rest. No overflow.

**At `< 768px`:** Chip and badge are hidden. Right group: `~32px` (pill icon) + `~8px` (gap) + `~80px` (Add Task) = `~120px`. No overflow.

**Conclusion:** No max-width concern at any defined breakpoint. No overflow strategy needed beyond the existing responsive collapse rules.

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Section 1 — Toolbar Layout, new "Toolbar density" subsection).

---

### 9. Transition when mode changes — task list reorder animation

**Gap:** When switching from AF4 to DIT (or any mode change that reorders the task list), the list re-orders. No transition or animation spec existed for this reorder. An instant reorder on a 40-task list is jarring — tasks jump positions with no visual continuity.

**Fix:** Added a reorder transition spec to Section 4 (Active Review Mode):

**Task list reorder on mode change:** The reorder is **instant** — no animated reorder. Rationale:
1. Animated list reorders (FLIP animations) require keyed list items and a layout animation library (e.g., Framer Motion). This is not in the current stack for this feature.
2. The mode change is a deliberate user action (they selected a new mode). The instant reorder is expected, not surprising.
3. The scroll-to-top behavior on mode activation provides a clear visual reset signal — the user sees the list from the top in the new order.

If animated reorders are desired in a future iteration, the `TMSCandidateRow` wrapper already provides a per-row `transition-all duration-200` that can be extended. For now, the transition is: instant reorder + scroll-to-top + the new candidate row's `transition-all duration-200` highlight appearing.

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Section 4 — new "Task list reorder" subsection).

---

### 10. Dark mode only — light mode not addressed

**Gap:** All color tokens in the spec use dark-mode values (`zinc-900`, `blue-950`, `amber-950`, etc.). The spec never states whether the app supports light mode. If it does, every color spec in Sections 2–6 needs a light-mode counterpart. If it doesn't, this should be explicitly documented to prevent implementers from adding `dark:` variants unnecessarily.

**Fix:** Added a note to Section 2 (TMS Mode Pill) and Section 7 (Accessibility Checklist):

**Light mode:** This app is **dark-theme only**. No `dark:` Tailwind variants are needed. All color specs in this document are the canonical values — do not add light-mode counterparts. If light mode support is added in a future sprint, a separate design pass is required for all TMS components.

This is consistent with the existing codebase (per MEMORY.md: "Dark theme" is a P0 core identity preference).

**Files changed:** REVIEW-QUEUE-CONSOLIDATION.md (Section 2 — note added after base dimensions; Section 7 — note added to Color contrast entry).

---

## Lead SDE Review Notes

Engineering review pass against the completed PM, Power User, UI/UX, and UX Writing sections. All findings are applied in-place to both files; this section records the issue, the decision, and where the fix landed.

---

### 1. `useTMSModeSelector` imports `filterStore` — arch rule #2 clarified

**Issue:** The Engineering §2 new-files table lists `filterStore` as an import of `useTMSModeSelector`. Arch rule #2 says "no direct store imports in domain logic." Is this a violation?

**Decision:** No violation. `useTMSModeSelector` is a React hook — it lives in the UI layer, not the service/handler/utility layer that rule #2 targets. Hooks are UI-layer orchestrators and may import stores directly. The `filterStore` read is narrow (snapshot input only at FVP activation time) and does not bleed business logic into the store.

**Documented constraint:** If `useTMSModeSelector` is ever extracted into a pure service, the `filterStore` import must be removed and the snapshot task array passed in as a parameter. Added a callout to the §2 new-files entry and to T-08.

---

### 2. `tmsSwitchService.ts` signature — arch rule #4 violation fixed

**Issue:** OQ-2 resolution specified `executeTMSSwitch(fromId, toId, tasks, tmsStoreState)` where `tmsStoreState` is the entire store blob. Arch rule #4 prohibits whole-blob interfaces.

**Fix:** Narrowed the fourth parameter to `systemStates: Record<TMSSystemId, SystemState>` — only the per-system state map. `fromId`, `toId`, and `tasks` are already separate params; nothing else from the store is needed by the switch logic. Updated OQ-2 resolution text and T-00a with the corrected signature and explicit test cases for exact input/output shapes.

---

### 3. FVP snapshot writer — contradiction resolved

**Issue:** §1 Architecture Overview said "The handler's `onActivate` calls this service" (i.e., the FVP handler writes `snapshotTaskIds`). AD-1 said the same. But `useTMSModeSelector` is the only component with access to the current `filteredTasks` at activation time — the handler receives tasks as a parameter from the hook, so it *could* write the snapshot, but that would require the handler to call `applySystemStateDelta` internally, which imports the store (arch rule #2 violation). These two statements were contradictory.

**Decision:** `useTMSModeSelector` writes `snapshotTaskIds` via `applySystemStateDelta` immediately after `executeTMSSwitch` returns. The FVP handler's `onActivate` handles algorithm-internal initialization only (e.g., resetting `markedOrder`). This keeps the handler store-free (arch rule #2) and makes the snapshot write explicit and traceable.

**Updated:** §1 Architecture Overview, AD-1, T-08 test cases, and the §6 engineering invariants checklist item that referenced `applySystemStateDelta` being called once during activation.

---

### 4. `useTMSOrderedTasks` memoization — reference stability risk

**Issue:** T-16 specifies "same `filteredTasks` reference + same `activeSystem` → same output reference" as a memo guarantee. `useMemo` compares by reference equality. If `GlobalTasksView` derives `filteredTasks` via an inline `.filter()` call (common pattern), a new array is produced on every render and the memo never hits — the guarantee is vacuous.

**Risk level:** Performance regression, not a correctness bug. But it defeats the stated purpose of the memo and could cause unnecessary re-renders of the entire task list on every keystroke or state update.

**Fix:** Added a note to T-16 requiring the implementer to verify that `GlobalTasksView` wraps its filter derivation in `useMemo` before T-20 ships. Added a verification checklist item: `grep -r "\.filter(" features/tasks/components/GlobalTasksView` and confirm the result is memoised. If not, T-20 must add the `useMemo` wrapper.

---

### 5. `GlobalTasksView` `useEffect` for queue exhaustion — 6-second window documented

**Issue:** T-21 specifies that `GlobalTasksView` calls `switchMode('none')` after a 6-second delay (the auto-dismiss duration). During those 6 seconds, `activeSystem` is still non-`none` but `orderedTasks` is empty. The spec was silent on whether this intermediate state is intentional or a bug.

**Decision:** Intentional. The 6-second window is the "Queue complete" notice display period — the user needs to see it before the mode resets. During this window: `orderedTasks` is `[]`, `TMSCandidateRow` has nothing to highlight, the pill still shows the active mode name. This is correct behavior. Added an explicit note to T-21 and a requirement to document this in a code comment at the `useEffect` call site so future maintainers don't "fix" it.

---

### 6. `scrollContainerRef` threading — placement decision documented

**Issue:** T-15 specified the ref threading chain (`GlobalTasksContainer` → `GlobalTasksHeader` → `TMSModePill` → `useTMSModeSelector`) but did not explain *why* the ref is created in `GlobalTasksContainer` rather than, say, passed via React context or created inside `TMSModePill`.

**Decision:** `GlobalTasksContainer` is the correct owner — it renders the `overflow-auto` scroll div that the ref must point to. A context-based approach was considered and rejected: the prop chain is only 3 levels deep and the ref is consumed by exactly one component. Added a decision note to T-15. If the chain grows beyond 3 levels in a future refactor, migrate to context.

**Also noted:** `GlobalTasksHeader` currently has no `scrollContainerRef` prop. Adding it is a prop interface change. T-15 already covers this, but implementers should be aware it touches the `GlobalTasksHeaderProps` type.

---

### 7. `tmsSwitchService.ts` test cases — made concrete

**Issue:** T-00a's original test cases were vague: "returns correct `newActiveSystem` and calls `onActivate`." No exact input/output shapes were specified, making the tests easy to write incorrectly (e.g., asserting the wrong return shape).

**Fix:** Replaced with concrete test cases specifying exact inputs, exact return shapes (`{ newActiveSystem, systemStateUpdates }`), ordering guarantees (deactivate before activate), and what is *not* in the service (DIT toast logic stays in `TMSHost`). Also added a test for the `systemStateUpdates` containing only changed systems, not the full state map.

---

### 8. `useGlobalShortcuts` interface change — call site grep required

**Issue:** T-24 and T-25 together add 4 new props to `UseGlobalShortcutsOptions` (`onOpenModeSelector`, `onExitMode`, `isModeActive`, `isModePopoverOpen`). This is a breaking change. The spec assumed there is only one call site but did not verify it.

**Fix:** Added a `⚠️ Breaking interface change` note to both T-24 and T-25 requiring a `grep -r "useGlobalShortcuts(" features/ src/` before implementation to find all call sites. Added a verification checklist item to the Phase 1 checklist. Also noted that T-24 and T-25 should be implemented in the same pass to avoid two separate breaking changes to the same interface.

---

### 9. `TMSInlineNotice` `actions` prop type — made explicit

**Issue:** T-19 mentioned `actions` prop renders action buttons with `variant: 'secondary' | 'ghost-destructive'` (added by the UI/UX review) but did not specify the full prop shape. An implementer could infer different shapes (e.g., `{ label, onClick, variant }` vs. `{ text, handler, type }`).

**Fix:** Updated T-19 with the full action item type: `{ label: string; onClick: () => void; variant: 'secondary' | 'ghost-destructive' }[]`. This matches the UI/UX review's intent and is consistent with how `ModeSwitchDialog` handles its button pair.

---

### 10. `prefers-reduced-motion` — HIGH priority accessibility gap

**Issue:** The spec adds CSS animations to two places: (1) `TMSModePopover` open/close (§3), and (2) `TMSInlineNotice` enter/exit (§5 / UI/UX review note 4). Neither had a `prefers-reduced-motion` check. The ui-ux-pro-max skill flags this as HIGH priority.

**Fix:**
- **Popover (§3, T-11):** All animation classes wrapped in `motion-safe:` Tailwind variant. Updated the spec's animation code block and added a T-11 test case asserting `motion-safe:animate-in` is present (not bare `animate-in`).
- **`TMSInlineNotice` (§5 UI/UX review, T-19):** All animation classes wrapped in `motion-safe:`. Added a T-19 test case: render with `prefers-reduced-motion: reduce` mocked; assert the component still renders and `onDismiss` still fires after `autoDismiss` — only the CSS transition is suppressed, not the timer logic.

**Scope:** The candidate row `transition-all duration-200` highlight (§4) is a color/border transition, not a motion animation — `prefers-reduced-motion` does not apply to color transitions. No change needed there.

---

### Summary of TASKS.md changes

| Task | Change |
|------|--------|
| T-00a | Replaced vague test cases with concrete input/output shapes; corrected `tmsSwitchService` signature (arch rule #4) |
| T-08 | Added arch rule #2 clarification note; added FVP snapshot writer resolution; added snapshot-write test case |
| T-11 | Added `prefers-reduced-motion` test case (`motion-safe:` prefix) |
| T-15 | Added `scrollContainerRef` placement decision note |
| T-16 | Added `useMemo` reference stability warning and verification step |
| T-19 | Specified full `actions` prop type; updated animation classes to `motion-safe:`; added reduced-motion test case |
| T-21 | Added 6-second window documentation requirement |
| T-24 | Added breaking interface change warning; call site grep requirement |
| T-25 | Added breaking interface change warning; implement-in-same-pass note |
| Phase 1 checklist | Added `useGlobalShortcuts` call site grep; added `filteredTasks` memo grep |

### Summary of REVIEW-QUEUE-CONSOLIDATION.md changes

| Section | Change |
|---------|--------|
| §1 Architecture Overview | Resolved FVP snapshot writer contradiction; added `filterStore` arch rule #2 clarification |
| §2 New Files (`useTMSModeSelector`) | Added arch rule #2 callout with documented constraint |
| §3 Mode Selector Popover (animation) | Wrapped animation classes in `motion-safe:` |
| §5 Inline Notices (animation) | Wrapped animation classes in `motion-safe:`; added `prefers-reduced-motion` note |
| AD-1 | Updated to reflect hook (not handler) writes snapshot |
| OQ-2 resolution | Corrected `tmsStoreState` → `systemStates` (arch rule #4) |
