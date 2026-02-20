# Keyboard Feature — Decision Log

## #1 Grid navigation is pure-function based
The `moveActiveCell()` function is pure — takes a coord, direction, and bounds, returns a new coord. No side effects, no DOM access. This makes it trivially testable with property-based tests.

## #2 VisibleRowDescriptor lives in gridNavigationService, not types.ts
`VisibleRowDescriptor` is an internal service type used only by `computeVisibleRows`. It's not part of the public API. The `VisibleRow` type that was in `types.ts` was dead code and was removed.

## #3 isInputContext extracted to its own module
`isInputContext()` is a DOM utility, not a shortcut concern. Both `useGlobalShortcuts` and `useKeyboardNavigation` need it. Canonical location: `services/inputContext.ts`.

## #4 Key-to-direction mapping extracted to keyMappings.ts
Vim/arrow/Home/End/Ctrl key resolution is pure data + pure function. Extracted from the 468-line `useKeyboardNavigation` hook to `services/keyMappings.ts`. The hook still handles stateful concerns (gg chord timeout, section skip with row context).

## #5 Row highlight extracted to useRowHighlight hook
The `data-kb-active` highlight lifecycle (show, auto-fade after 2s, clear on blur, re-apply on focus) is a self-contained concern. Extracted to `hooks/useRowHighlight.ts` to reduce `useKeyboardNavigation` from 468 to 356 lines.

## #6 Vim gg chord stays in the hook
The `gg` chord requires a `lastGPressTime` ref and an early return (wait for second `g`). This is inherently stateful and tied to the React event lifecycle, so it stays in `useKeyboardNavigation` rather than being extracted to `keyMappings.ts`.

## #7 Section skip [ ] stays in the hook
Section skip needs `activeCell.row` and `sectionStartIndices` context to find the target row. It also calls `updateActiveCell` and `showHighlight` directly. Too coupled to hook state to extract cleanly.

## #8 Services barrel added
`services/index.ts` barrel added for consistency with other features (automations has barrels for all sub-modules).
