# Fallback Mechanisms

Three fallback mechanisms ensure robust multi-tab coordination across browsers and edge cases.

## 1. localStorage Unavailable

**Problem**: localStorage may be disabled (private browsing, quota exceeded, security policies).

**Solution**: Treat the tab as active with no coordination. Display a warning via `store.setWarning()`.

## 2. Storage Event Fallback Polling

**Problem**: Some browsers don't reliably fire `storage` events.

**Solution**: Poll localStorage every 2s when in read-only mode. Compare current values against last-known values for `ACTIVE_TAB_ID` and `HEARTBEAT`. Trigger `syncFromStorage()` on change.

Polling stops when the tab becomes active (via promotion or force takeover).

## 3. Election Retry with Exponential Backoff

**Problem**: Multiple tabs may attempt promotion simultaneously, causing election failures.

**Solution**: Retry up to 3 times with exponential backoff (100ms, 200ms, 400ms). Total max wait: 700ms.

## 4. Hidden Tab Guard

**Problem**: Browser throttles timers in hidden tabs, causing the active tab's heartbeat to appear stale. The read-only tab then incorrectly promotes itself.

**Solution**: `checkActiveTabStatus()` skips promotion when `document.hidden` is true. Only visible tabs can promote. When the active tab becomes visible again, it immediately refreshes its heartbeat.

## 5. Stale Session Recovery

**Problem**: If the active tab's ID is left in localStorage from a previous session (e.g. browser crash, no `beforeunload`), new tabs see it and enter read-only mode indefinitely.

**Solution**: `attemptBecomeActive()` checks heartbeat freshness. If the existing active tab's heartbeat is stale or missing, the new tab claims active immediately instead of waiting for the 30s timeout.

## 6. React Strict Mode Safety

**Problem**: React strict mode mounts → unmounts → remounts components. If `cleanup()` clears localStorage on unmount, the active tab ID is briefly removed, and other tabs promote themselves.

**Solution**: `cleanup()` only stops timers and removes event listeners. localStorage is only cleared in `handleBeforeUnload()`, which fires on actual page close — not on React remounts.

## 7. Event Listener Bind Fix

**Problem**: `addEventListener` and `removeEventListener` with `.bind(this)` create different function references, so listeners are never actually removed. With strict mode, ghost listeners accumulate.

**Solution**: Event handlers are bound once in the constructor and stored as instance properties (`boundHandleBeforeUnload`, `boundHandleVisibilityChange`), ensuring proper removal.

## Tests

```bash
npm test -- lib/tab-sync/fallback.test.ts --run
```
