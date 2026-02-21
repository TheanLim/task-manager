# Keyboard Feature

Grid-based keyboard navigation and customizable shortcuts for the task list.

## Quick Reference

| File | Role |
|---|---|
| `types.ts` | `ShortcutAction`, `ShortcutBinding`, `ShortcutMap`, `GridCoord`, `MoveDirection` |
| `schemas.ts` | Zod schemas for shortcut bindings (used in merge validation) |
| `services/shortcutService.ts` | Default bindings (21 actions), merge logic, conflict detection, key resolution |
| `services/gridNavigationService.ts` | Pure `moveActiveCell()` + `computeVisibleRows()` for flattened task tree |
| `services/inputContext.ts` | `isInputContext()` — DOM utility for detecting input/textarea/contenteditable |
| `services/keyMappings.ts` | Non-customizable key-to-direction mapping (arrows, vim h/j/k/l) |
| `services/hotkeyFormat.ts` | Converts stored key strings to `react-hotkeys-hook` format (Ctrl→meta Mac variant) |
| `services/keyMatch.ts` | Matches keyboard events against stored key strings (for `onTableKeyDown`) |
| `services/index.ts` | Barrel re-exports for all services |
| `stores/keyboardNavStore.ts` | Zustand store — `focusedTaskId` + `activeCell` (no business logic) |
| `hooks/useKeyboardNavigation.ts` | Grid-level keydown handler, cell props, focus restoration, row click |
| `hooks/useRowHighlight.ts` | `data-kb-active` highlight lifecycle (show, fade, blur/focus) |
| `hooks/useGlobalShortcuts.ts` | App-level shortcuts via `react-hotkeys-hook` — all read from shortcut map |
| `components/ShortcutHelpOverlay.tsx` | `?` overlay showing all bindings |
| `components/ShortcutSettings.tsx` | UI for customizing shortcut bindings (non-customizable ones are greyed out) |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  shortcutService                                    │
│  • getDefaultShortcutMap() → 21 default bindings    │
│  • mergeShortcutMaps(defaults, persisted)           │
│  • detectConflicts(map) → ShortcutConflict[]        │
│  • resolveShortcut(key, map, context)               │
└──────────────┬──────────────────────────────────────┘
               │ ShortcutMap
       ┌───────┴───────┐
       ▼               ▼
┌──────────────┐ ┌──────────────────────┐
│ useGlobal    │ │ useKeyboardNavigation │
│ Shortcuts    │ │                      │
│ (all read    │ │ • onTableKeyDown     │
│  from map    │ │ • matchesKey() for   │
│  via toHot-  │ │   Space/Enter/[/]    │
│  keyFormat)  │ │ • resolveDirection() │
│              │ │   for arrows/vim     │
│ n,/,?,e,x,  │ │ • gg chord (300ms)   │
│ a,r,Ctrl+En │ │ • getCellProps()     │
│ ter,Escape   │ │ • focus restoration  │
└──────────────┘ └──────────┬───────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
          ┌──────────────┐ ┌──────────────────┐
          │ keyMappings  │ │ useRowHighlight   │
          │ • resolve    │ │ • data-kb-active  │
          │   Direction()│ │ • fade timer      │
          │ (arrows +    │ │ • blur/focus      │
          │  vim only)   │ └──────────────────┘
          └──────────────┘
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

  inputContext.ts ← shared DOM utility (used by both hooks)
  hotkeyFormat.ts ← stored key → react-hotkeys-hook format
  keyMatch.ts     ← keyboard event → stored key matching
```

## Shortcut Actions (21 total)

### Customizable (12 actions)
| Action | Default Key | Category | Description |
|---|---|---|---|
| `nav.sectionPrev` | `[` | Navigation | Jump to previous section |
| `nav.sectionNext` | `]` | Navigation | Jump to next section |
| `nav.G` | `G` | Navigation | Jump to last row |
| `nav.halfPageDown` | `Ctrl+d` | Navigation | Half page down |
| `nav.halfPageUp` | `Ctrl+u` | Navigation | Half page up |
| `global.newTask` | `n` | Global | Create a new task |
| `global.search` | `/` | Global | Focus search input |
| `global.help` | `?` | Global | Open shortcut help overlay |
| `task.edit` | `e` | Task Actions | Edit focused task inline |
| `task.open` | `Enter` | Task Actions | Open task detail panel |
| `task.toggleComplete` | `Space` | Task Actions | Toggle completion |
| `task.delete` | `x` | Task Actions | Delete focused task |
| `task.addSubtask` | `a` | Task Actions | Add subtask |
| `task.reinsert` | `r` | Task Actions | Reinsert task (Review Queue only) |
| `task.saveEdit` | `Ctrl+Enter` | Task Actions | Save inline edit |
| `task.cancelEdit` | `Escape` | Task Actions | Cancel inline edit |

### Non-customizable (5 actions)
| Action | Key | Reason |
|---|---|---|
| `nav.up/down/left/right` | Arrow keys | OS-level convention |
| `nav.gg` | `gg` | Two-key chord, can't be captured by single-key recording UI |

Vim h/j/k/l are hardcoded secondary aliases for arrow keys (not in the shortcut map).

## Shortcut Customization

All customizable shortcuts read from the `ShortcutMap`. The flow:

1. User opens ShortcutSettings (via "Edit shortcuts…" in help overlay)
2. Non-customizable shortcuts are greyed out with `cursor-default` and no `role="button"`
3. User clicks a customizable kbd → recording mode captures next keypress
4. Modifier combos (Ctrl+K, Alt+J) are supported — `handleKeyCapture` builds the key string
5. Persisted partial `ShortcutMap` saved to localStorage via `appStore`
6. On load, `mergeShortcutMaps(defaults, persisted)` fills missing actions from defaults
7. Non-customizable actions are skipped during merge (persisted overrides ignored)
8. Invalid entries (failing Zod validation) are silently dropped
9. `detectConflicts()` warns if two actions share the same key

### How customized keys reach the handlers

- `useGlobalShortcuts`: calls `toHotkeyFormat(shortcutMap[action].key)` → registers with `react-hotkeys-hook`. Ctrl combos produce both `ctrl+` and `meta+` variants for Mac.
- `onTableKeyDown`: calls `matchesKey(event, shortcutMap[action].key)` for Space, Enter, [, ], G, Ctrl+d, Ctrl+u.
- `resolveDirection`: only handles non-customizable keys (arrows, vim h/j/k/l). Does NOT read from the map.

## Grid Navigation Details

- `computeVisibleRows()` flattens the task tree respecting section collapse and subtask expansion
- `moveActiveCell()` is a pure function — clamps row/column to grid bounds, supports 8 directions
- Focus restoration: when a task is deleted/filtered, the hook recovers to the nearest visible row
- Row highlighting: `data-kb-active` attribute on the focused `<tr>`, auto-fades after 2s (`useRowHighlight`)
- Vim chord: `gg` uses a 300ms timeout between keypresses (hardcoded, not customizable)
- Section skip: reads `nav.sectionPrev`/`nav.sectionNext` from the map; falls back to up/down if no sections

## Reinsert Task

The `r` shortcut (`task.reinsert`) calls `taskService.reinsertTask()` which updates `lastActionAt` to push the task to the bottom of the Review Queue sort order. Only fires when `needsAttentionSort` is true in `appStore` (Review Queue mode on the All Tasks page). No-op in normal mode.
