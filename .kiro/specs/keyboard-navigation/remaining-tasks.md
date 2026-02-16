# Remaining Keyboard Navigation Tasks

## Completed

- [x] 1. Delete confirmation dialog for `x` shortcut
- [x] 2. Ctrl+Enter / Cmd+Enter to save inline edit
- [x] 3. Section-skip shortcuts `[` and `]`
- [x] 4. Keyboard hint in empty sections ("press n")

## Remaining (TDD — write e2e tests first, then implement)

- [x] 5. Fix delete via `x` — was deleting ALL tasks instead of just the focused one
  - Root cause: Zod schemas used `z.string().uuid()` for entity IDs, but the app generates non-UUID IDs (section IDs, seed data). The `LocalStorageBackend` Zod validation silently rejected the data and fell back to empty state, so any repository write (delete/update) operated on empty arrays, wiping everything.
  - Fix: Relaxed ID validation from `z.string().uuid()` to `z.string().min(1)` in `lib/schemas.ts`
  - _Req 5.4_

- [x] 6. Fix `n` shortcut section-awareness — task should go in the focused task's section
  - Same root cause as #5 — now that the backend loads data correctly, section-aware task creation works
  - _Req 4.1_

- [ ] 7. Subtask-aware navigation — expanded/collapsed distinction
  - Navigation currently uses flat task list; doesn't skip collapsed subtasks
  - Requires lifting `subtasksExpanded` state out of TaskRow
  - _Req 2.1, 2.2, 2.3_

- [ ] 8. Customizable shortcuts UI accessible from a menu
  - ShortcutSettings component built but not reachable from any UI entry point
  - Add "Customize shortcuts" link in help overlay or settings
  - _Req 6_
