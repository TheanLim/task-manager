# Multi-Tab Synchronization Module

Coordinates multiple browser tabs to prevent localStorage race conditions. Only one tab can edit at a time — others are read-only and auto-sync changes.

## How It Works

1. First tab opens → becomes active, starts heartbeat (every 2s)
2. Second tab opens → sees active tab with fresh heartbeat → enters read-only mode
3. Active tab closes → `beforeunload` clears localStorage → read-only tab detects no active tab → promotes itself
4. Active tab crashes → heartbeat goes stale after 30s → read-only tab promotes itself
5. User clicks "Take control" → force takeover regardless of existing active tab

## Key Design Decisions

- **30s heartbeat timeout**: Browsers heavily throttle timers in hidden tabs. A short timeout (5s) causes false stale detections when switching between tabs in the same window.
- **Hidden tabs can't promote**: Only visible tabs attempt promotion. Prevents ping-pong when switching tabs.
- **Stale check on init**: `attemptBecomeActive()` checks heartbeat freshness. If a stale active tab ID is left from a previous session, the new tab claims active immediately.
- **React strict mode safe**: `cleanup()` only stops timers/listeners. localStorage is only cleared in `beforeunload`, not on React unmount.
- **Cross-tab data sync**: `TabSyncProvider` listens for `storage` events on Zustand persist keys and rehydrates stores in read-only tabs.

## Architecture

```
TabSyncProvider (React)
  ├── TabCoordinator (core logic)
  │   ├── Heartbeat (active tab sends every 2s)
  │   ├── Monitoring (read-only tab checks every 2s)
  │   ├── Election (timestamp-based with retry + backoff)
  │   └── Fallback polling (2s, for unreliable storage events)
  ├── useTabSyncStore (Zustand)
  │   ├── isActiveTab / isReadOnly / canEdit
  │   └── setActiveStatus / syncFromStorage
  ├── ReadOnlyBanner (yellow, with "Take control" button)
  └── ActiveTabIndicator (green, auto-hides after 3s)
```

## Files

| File | Purpose |
|------|---------|
| `types.ts` | TypeScript interfaces |
| `constants.ts` | localStorage keys, default config (2s heartbeat, 30s timeout, 2s monitor) |
| `utils.ts` | Tab ID generation, heartbeat serialization, guarded storage |
| `store.ts` | Zustand store for tab sync state |
| `TabCoordinator.ts` | Core coordination logic |
| `index.ts` | Public exports |

## Usage

The module is used via `TabSyncProvider` in `app/layout.tsx`. Individual components check `canEdit` from `useTabSyncStore()` to disable interactive elements in read-only mode.

```typescript
import { useTabSyncStore } from '@/lib/tab-sync/store';

function MyComponent() {
  const { canEdit } = useTabSyncStore();
  return <button disabled={!canEdit}>Edit</button>;
}
```

## Tests

```bash
npm test -- lib/tab-sync                          # Core + fallback tests
npm test -- components/TabSyncProvider.test.tsx    # UI integration tests
```
