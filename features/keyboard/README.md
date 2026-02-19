# Keyboard Feature

Grid-based keyboard navigation and customizable shortcuts for the task list.

## Quick Reference

| File | Role |
|---|---|
| `types.ts` | `ShortcutAction`, `ShortcutBinding`, `ShortcutMap`, `GridCoord`, `MoveDirection` |
| `schemas.ts` | Zod schemas for shortcut bindings (used in merge validation) |
| `services/shortcutService.ts` | Default bindings (24 actions), merge logic, conflict detection, key resolution |
| `services/gridNavigationService.ts` | Pure `moveActiveCell()` + `computeVisibleRows()` for flattened task tree |
| `stores/keyboardNavStore.ts` | Zustand store — `focusedTaskId` + `activeCell` (no business logic) |
| `hooks/useKeyboardNavigation.ts` | Grid-level keydown handler, cell props, focus restoration, row highlighting |
| `hooks/useGlobalShortcuts.ts` | App-level shortcuts via `react-hotkeys-hook` (new task, search, help, task actions) |
| `components/ShortcutHelpOverlay.tsx` | `?` overlay showing all bindings |
| `components/ShortcutSettings.tsx` | UI for customizing shortcut bindings |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  shortcutService                                    │
│  • getDefaultShortcutMap() → 24 default bindings    │
│  • mergeShortcutMaps(defaults, persisted)           │
│  • detectConflicts(map) → ShortcutConflict[]        │
│  • resolveShortcut(key, map, context)               │
│  • isInputContext(el) — suppresses in inputs         │
└──────────────┬──────────────────────────────────────┘
               │ ShortcutMap
       ┌───────┴───────┐
       ▼               ▼
┌──────────────┐ ┌──────────────────────┐
│ useGlobal    │ │ useKeyboardNavigation │
│ Shortcuts    │ │                      │
│              │ │ • onTableKeyDown     │
│ n → new task │ │ • Arrow/Vim/gg/G/[]  │
│ / → search   │ │ • Space → toggle     │
│ ? → help     │ │ • Enter → open       │
│ e → edit     │ │ • getCellProps()     │
│ x → delete   │ │ • focus restoration  │
│ a → subtask  │ │ • row highlighting   │
│ Ctrl+Enter   │ └──────────┬───────────┘
│ Escape       │            │
└──────────────┘            ▼
                  ┌──────────────────────┐
                  │ gridNavigationService │
                  │ • moveActiveCell()    │
                  │ • computeVisibleRows()│
                  └──────────┬───────────┘
                             │ GridCoord
                             ▼
                  ┌──────────────────────┐
                  │ keyboardNavStore      │
                  │ • focusedTaskId       │
                  │ • activeCell          │
                  └──────────────────────┘
```

## Shortcut Categories

Shortcuts are scoped by category to avoid conflicts:

| Category | Fires when | Examples |
|---|---|---|
| Navigation | Grid is focused | Arrow keys, h/j/k/l, gg, G, `[`, `]`, Ctrl+d/u |
| Global | Not in an input context | `n`, `/`, `?` |
| Task Actions | Grid focused + not in input | `e`, `x`, `a`, Space, Enter |

`isInputContext()` checks for `<input>`, `<textarea>`, `contenteditable`, `role="combobox"`, and `data-keyboard-trap`.

## Shortcut Customization Flow

1. User opens ShortcutSettings (via "Edit shortcuts…" in help overlay)
2. User rebinds a key → persisted partial `ShortcutMap` saved to localStorage
3. On load, `mergeShortcutMaps(defaults, persisted)` fills in missing actions from defaults
4. Each persisted entry is validated against `ShortcutBindingSchema` (Zod) — invalid entries are silently dropped
5. `detectConflicts()` warns if two actions share the same key

## Grid Navigation Details

- `computeVisibleRows()` flattens the task tree respecting section collapse and subtask expansion (`expandedTaskIds`)
- `moveActiveCell()` is a pure function — clamps row/column to grid bounds, supports 12 directions including half-page scroll
- Focus restoration: when a task is deleted/filtered, the hook recovers to the nearest visible row by index
- Row highlighting: `data-kb-active` attribute applied to the focused `<tr>`, auto-fades after 2 seconds
- Vim chord: `gg` uses a 300ms timeout between keypresses
- Section skip: `[`/`]` jump to previous/next section start index; fall back to up/down if no sections exist
