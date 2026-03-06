<!-- v1 | last-verified: 2025-07-15 -->
# Keyboard Navigation System

Grid-based keyboard navigation for the task list table with 21 shortcut actions (16 customizable), vim-style keys, chord support (`gg`), and a shortcut settings UI with conflict detection. All navigation logic is pure-function — no DOM in the core, trivially testable.

## Overview

The keyboard system provides two layers: (1) grid navigation within the `<table role="grid">` via arrow/vim keys, and (2) global shortcuts that fire from anywhere outside input contexts. Shortcuts are stored as partial overrides in `appStore.keyboardShortcuts` and merged with defaults at read time via `mergeShortcutMaps()`. The system suppresses all shortcuts when focus is in an input, textarea, contenteditable, combobox, or `data-keyboard-trap` element.

## Shortcut Actions (21 Total)

### Navigation (10 actions, 6 non-customizable)

| Action | Default Key | Customizable | Description |
|--------|-------------|:------------:|-------------|
| `nav.up` | `ArrowUp` | ✗ | Move to row above |
| `nav.down` | `ArrowDown` | ✗ | Move to row below |
| `nav.left` | `ArrowLeft` | ✗ | Move to previous column |
| `nav.right` | `ArrowRight` | ✗ | Move to next column |
| `nav.gg` | `gg` (chord) | ✗ | Jump to first visible row |
| `nav.G` | `G` | ✓ | Jump to last visible row |
| `nav.sectionPrev` | `[` | ✓ | Jump to previous section header |
| `nav.sectionNext` | `]` | ✓ | Jump to next section header |
| `nav.halfPageDown` | `Ctrl+d` | ✓ | Move down half page |
| `nav.halfPageUp` | `Ctrl+u` | ✓ | Move up half page |

### Global (3 actions, all customizable)

| Action | Default Key | Description |
|--------|-------------|-------------|
| `global.newTask` | `n` | Create new task |
| `global.search` | `/` | Focus search input |
| `global.help` | `?` | Open shortcut help overlay |

### Task Actions (8 actions, 6 customizable)

| Action | Default Key | Customizable | Description |
|--------|-------------|:------------:|-------------|
| `task.edit` | `e` | ✓ | Edit focused task inline |
| `task.open` | `Enter` | ✓ | Open task detail panel |
| `task.toggleComplete` | `Space` | ✓ | Toggle completion status |
| `task.delete` | `x` | ✓ | Delete focused task |
| `task.addSubtask` | `a` | ✓ | Add subtask under focused task |
| `task.reinsert` | `r` | ✓ | Push task to bottom of review queue |
| `task.saveEdit` | `Ctrl+Enter` | ✗ | Save inline edit and close editor |
| `task.cancelEdit` | `Escape` | ✗ | Cancel inline edit |

## Architecture

### Data Flow

```
User presses key → onTableKeyDown (useKeyboardNavigation)
  → isInputContext check (suppress if in input)
  → matchesKey against shortcutMap entries
  → resolveDirection for arrow/vim keys
  → moveActiveCell (pure) → new GridCoord
  → updateActiveCell → local state + keyboardNavStore
  → showHighlight → data-kb-active attribute + 2s fade timer
```

### Shortcut Resolution Pipeline

```
Keyboard event → useGlobalShortcuts (react-hotkeys-hook)
  → toHotkeyFormat converts stored key → hotkey format
  → isInputContext guard
  → reads focusedTaskId from keyboardNavStore.getState()
  → fires callback (onNewTask, onEditTask, etc.)
```

### Shortcut Persistence

```
appStore.keyboardShortcuts: Partial<ShortcutMap>  (user overrides only)
  → mergeShortcutMaps(defaults, persisted) at read time
  → non-customizable actions skipped during merge
  → invalid entries (failing Zod) silently dropped
  → persisted to localStorage key "task-management-settings"
```

## Core Services

### gridNavigationService.ts

Two pure functions — no DOM, no state:

`moveActiveCell(coord, direction, bounds) → GridCoord` — Clamps movement to grid bounds. Supports 8 directions: up, down, left, right, firstRow, lastRow, halfPageDown, halfPageUp. Returns `taskId: null` (caller resolves from visible row list).

`computeVisibleRows(tasks, sections, expandedTaskIds) → VisibleRowDescriptor[]` — Flattens the task tree into a navigable row list. Logic: sort sections by order → group tasks by sectionId → skip collapsed sections → recursively add expanded subtasks. Section headers are NOT included as rows.

### shortcutService.ts

| Function | Purpose |
|----------|---------|
| `getDefaultShortcutMap()` | Returns all 21 default bindings |
| `mergeShortcutMaps(defaults, persisted)` | Overlay user overrides, skip non-customizable, Zod-validate |
| `detectConflicts(map)` | Returns `ShortcutConflict[]` for duplicate key bindings |
| `resolveShortcut(key, map, context)` | Category-scoped resolution: Navigation=grid, Global=!input, Task=grid+!input |
| `isShortcutCustomized(action, map)` | True if key differs from default |

### keyMappings.ts

Hardcoded direction maps for non-customizable keys:

```
VIM_KEY_MAP:   h→left, j→down, k→up, l→right
ARROW_KEY_MAP: ArrowUp→up, ArrowDown→down, ArrowLeft→left, ArrowRight→right
```

`resolveDirection(key, ctrl, shiftKey)` — Returns `MoveDirection | null` for arrow and vim keys only. Ctrl combos return null (handled via shortcut map instead).

### keyMatch.ts

`matchesKey(event, storedKey)` — Matches keyboard events against stored shortcut strings (e.g., `"Ctrl+Enter"`, `"Space"`, `"/"`). Handles: Ctrl matches both ctrlKey and metaKey (Mac), shifted chars (`?`, `!`) don't require explicit Shift modifier, `"Space"` matches `event.key === " "`.

### hotkeyFormat.ts

`toHotkeyFormat(key)` — Converts stored key format to react-hotkeys-hook format. Special mappings: `/` → `"slash"`, `?` → `"shift+slash"`, `G` → `"shift+g"`, `Ctrl+X` → `"ctrl+x, meta+x"` (Mac variant auto-added).

### inputContext.ts

`isInputContext(activeElement)` — Returns true for: `<input>`, `<textarea>`, `contenteditable="true"` (including nested via `.closest()`), `role="combobox"`, `data-keyboard-trap`.

## Hooks

### useKeyboardNavigation

The main hook wired into `TaskList.tsx`. Manages:

| Concern | Implementation |
|---------|---------------|
| Active cell state | `useState<GridCoord \| null>` — lazy init on first keypress |
| Global store sync | `keyboardNavStore.setFocusedTask()` called synchronously on every cell change |
| Focus recovery | When active task deleted/filtered: clamp to nearest row, refocus table (skips if dialog open) |
| Click-to-focus | Table click handler resolves `data-task-id` → row index → `updateActiveCell` |
| gg chord | `lastGPressTime` ref, 300ms window, early return on first `g` |
| Section skip | `[`/`]` find nearest section boundary in `sectionStartIndices`, fallback to up/down if no sections |
| Cell props | `getCellProps(row, col)` returns tabIndex, onFocus, ref, data attributes |

Returns: `{ activeCell, setActiveCell, getTabIndex, getCellProps, onTableKeyDown, savedCell }`

### useGlobalShortcuts

Wired in `app/page.tsx`. Uses `react-hotkeys-hook` for each shortcut action. Task-context shortcuts read `focusedTaskId` from `keyboardNavStore.getState()` (not closure) to avoid stale state after click-to-focus.

Vim fallback: `j,k,g,shift+g` — if table exists but doesn't have focus, re-focuses table and re-dispatches the key event so `onTableKeyDown` picks it up.

### useRowHighlight

Manages the `data-kb-active` attribute lifecycle on table rows:

```
Cell change → set data-kb-active on row → start 2s fade timer → remove attribute
Table blur → clear highlight (unless dialog open — avoids Radix flicker loop)
Table focus-in → re-apply highlight
```

```
FADE_DELAY: 2000ms
```

Critical: On focusout, checks for `[role="dialog"]` or `[role="alertdialog"]` before reclaiming focus — Radix sets `aria-hidden` on root and fighting for focus causes infinite flicker.

## Store

### keyboardNavStore (transient)

| Field | Type | Purpose |
|-------|------|---------|
| `focusedTaskId` | `string \| null` | Currently focused task ID |
| `activeCell` | `GridCoord \| null` | Full cell coordinate |
| `setFocusedTask` | `(taskId, cell) → void` | Setter for both fields |

Not persisted — resets on page load. Used by `page.tsx` to read focused task without prop threading.

## Components

### ShortcutHelpOverlay

Slide-in panel (`fixed right-0, w-[400px]`) showing all shortcuts grouped by category. Features:
- Platform-aware key display: `Ctrl` → `⌘` on Mac (except vim `Ctrl+d`/`Ctrl+u`)
- "Edit shortcuts…" link toggles to `ShortcutSettings` inline
- Escape closes (capture phase, highest priority) — settings first, then overlay
- Focus trap: captures previous focus on open, restores on close

### ShortcutSettings

Inline shortcut editor with key capture recording:
- Click a `<kbd>` to enter recording mode ("Press a key…")
- Captures next keydown (capture phase), builds key string from modifiers + key
- Conflict detection: amber badge on conflicting actions
- Per-shortcut reset: hover-reveal `↺` button (only when customized)
- "Reset to defaults" button clears all overrides

## Types

| Type | Location | Purpose |
|------|----------|---------|
| `ShortcutAction` | `types.ts` | Union of 21 action identifiers |
| `ShortcutBinding` | `types.ts` | `{ key, label, category, description, customizable? }` |
| `ShortcutMap` | `types.ts` | `Record<ShortcutAction, ShortcutBinding>` |
| `ShortcutConflict` | `types.ts` | `{ key, existingAction, newAction }` |
| `GridCoord` | `types.ts` | `{ row, column, taskId }` — stable identity for focus restoration |
| `MoveDirection` | `types.ts` | Union of 8 directions |
| `VisibleRowDescriptor` | `gridNavigationService.ts` | Internal: `{ taskId, parentTaskId, sectionId, isSectionHeader, depth }` |

## Zod Schemas

| Schema | Location | Purpose |
|--------|----------|---------|
| `ShortcutBindingSchema` | `schemas.ts` | Validates persisted shortcut overrides during merge |
| `ShortcutMapSchema` | `schemas.ts` | `z.record(z.string(), ShortcutBindingSchema)` |

## Critical Notes

- **Chord support is gg-only by design.** Generalizing chords would add 300ms input lag to every single-key shortcut. Modifier combos (`Ctrl+K`) cover the "more key space" use case without latency.
- **Non-customizable shortcuts (5):** Arrow keys, `gg`, `Ctrl+Enter`, `Escape` — OS-level conventions that should never be rebound.
- **Radix dialog flicker:** `useRowHighlight` and `useKeyboardNavigation` both check for open dialogs before reclaiming focus. Without this, Radix's `aria-hidden` on root causes infinite focus-fight loops.
- **Stale closure fix:** `useGlobalShortcuts` reads `focusedTaskId` from `keyboardNavStore.getState()` (not the hook closure) because the closure captures the value at hook registration time, missing click-to-focus updates.
- **Section skip fallback:** When `[`/`]` are pressed but no sections exist, they fall back to simple up/down movement instead of no-op.

## Integration Points

- **TaskList.tsx** — Wires `useKeyboardNavigation` with visible rows, column count, section indices, and Space/Enter callbacks
- **app/page.tsx** — Wires `useGlobalShortcuts` with task action callbacks (new, edit, delete, etc.) and renders `ShortcutHelpOverlay`
- **appStore** — Persists `keyboardShortcuts` (partial overrides) in `task-management-settings` localStorage key
- **computeVisibleRows** — Called by TaskList with `expandedTaskIds` lifted from TaskList state

## Testing

### Unit Tests

```bash
npm run test:run -- features/keyboard/
```

| Test File | Covers |
|-----------|--------|
| `gridNavigationService.test.ts` | `moveActiveCell` bounds clamping, `computeVisibleRows` with sections/subtasks |
| `shortcutService.test.ts` | Default map, merge, conflict detection, resolve, customization check |
| `keyMappings.test.ts` | Vim/arrow direction resolution |
| `keyMatch.test.ts` | Modifier combos, shifted chars, Space mapping |
| `hotkeyFormat.test.ts` | Key format conversion, Mac meta variants |
| `inputContext.test.ts` | Input/textarea/contenteditable/combobox detection |
| `useKeyboardNavigation.test.ts` | Hook integration: cell movement, focus recovery, gg chord |
| `useGlobalShortcuts.test.ts` | Global shortcut firing, input context suppression |
| `ShortcutHelpOverlay.test.tsx` | Overlay open/close, category grouping, Escape handling |
| `ShortcutSettings.test.tsx` | Key capture, conflict display, reset |

### E2E

```bash
npx playwright test e2e/keyboard-shortcuts.spec.ts
```

## Key Files

| File | Description |
|------|-------------|
| `features/keyboard/services/gridNavigationService.ts` | Pure grid movement + visible row computation |
| `features/keyboard/services/shortcutService.ts` | Default map, merge, conflict detection, resolution |
| `features/keyboard/services/keyMappings.ts` | Vim/arrow direction maps |
| `features/keyboard/services/keyMatch.ts` | Keyboard event → stored key matching |
| `features/keyboard/services/hotkeyFormat.ts` | Stored key → react-hotkeys-hook format |
| `features/keyboard/services/inputContext.ts` | Input context detection |
| `features/keyboard/hooks/useKeyboardNavigation.ts` | Main grid nav hook (TaskList) |
| `features/keyboard/hooks/useGlobalShortcuts.ts` | Global shortcut bindings (page.tsx) |
| `features/keyboard/hooks/useRowHighlight.ts` | Row highlight lifecycle (2s fade) |
| `features/keyboard/stores/keyboardNavStore.ts` | Transient focused task store |
| `features/keyboard/components/ShortcutHelpOverlay.tsx` | Help panel with platform-aware key display |
| `features/keyboard/components/ShortcutSettings.tsx` | Key capture + conflict detection UI |
| `features/keyboard/schemas.ts` | Zod schemas for shortcut validation |
| `features/keyboard/types.ts` | ShortcutAction, GridCoord, MoveDirection types |
| `features/keyboard/index.ts` | Barrel exports (public API) |

## References

### Source Files
- `features/keyboard/services/` — All 7 service modules
- `features/keyboard/hooks/` — 3 hooks (navigation, global shortcuts, row highlight)
- `features/keyboard/stores/keyboardNavStore.ts` — Transient nav state
- `features/keyboard/components/` — Help overlay + settings UI
- `stores/appStore.ts` — Persists keyboard shortcut overrides
- `features/tasks/components/TaskList.tsx` — Primary consumer of useKeyboardNavigation
- `app/page.tsx` — Primary consumer of useGlobalShortcuts

### Related Context Docs
- [stores.md](stores.md) — appStore persistence of keyboard shortcut overrides
- [e2e-tests.md](e2e-tests.md) — E2E coverage: `keyboard-shortcuts.spec.ts` (66 tests), `subtask-nav-and-settings.spec.ts` (23 tests)
