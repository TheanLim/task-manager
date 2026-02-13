# TabCoordinator + Zustand Store Integration

## Overview

The TabCoordinator integrates with Zustand stores for reactive state management and cross-tab data synchronization.

## Store Integration

### Tab Sync Store (`store.ts`)

Manages tab coordination state:

```typescript
const { isActiveTab, isReadOnly, canEdit } = useTabSyncStore();
```

| State | Description |
|-------|-------------|
| `isActiveTab` | Whether this tab is active |
| `isReadOnly` | Whether this tab is read-only |
| `canEdit` | Whether editing is allowed (inverse of isReadOnly) |
| `lastSyncTime` | Timestamp of last storage sync |
| `warningMessage` | Warning text (e.g. localStorage unavailable) |
| `isLocalStorageAvailable` | Whether localStorage works |

### Cross-Tab Data Sync

`TabSyncProvider` listens for `storage` events on Zustand persist keys and rehydrates data stores in read-only tabs:

- `task-management-data` → `useDataStore` (projects, tasks, sections, dependencies)
- `task-management-settings` → `useAppStore` (app settings)

When the active tab makes changes, Zustand's persist middleware writes to localStorage, which fires a `storage` event in other tabs. The listener parses the new state and calls `setState()` to update the read-only tab's stores, triggering a React re-render.

## Guarded Storage

Prevents read-only tabs from writing:

```typescript
const guardedStorage = coordinator.getGuardedStorage();
guardedStorage.setItem('key', value);  // returns false if read-only
guardedStorage.canWrite();              // check before writing
```

## State Flow

1. **Init**: TabCoordinator calls `store.setActiveStatus(true/false)`
2. **Storage event**: TabCoordinator calls `store.syncFromStorage()`, TabSyncProvider rehydrates data stores
3. **Promotion**: TabCoordinator calls `store.setActiveStatus(true)` after winning election
4. **Force takeover**: `coordinator.forceTakeover()` → `store.setActiveStatus(true)`
5. **Dethroned**: `checkActiveTabStatus()` detects another tab took over → `store.setActiveStatus(false)`

## Configuration

Default values in `constants.ts`:

| Setting | Value | Purpose |
|---------|-------|---------|
| `heartbeatInterval` | 2000ms | How often active tab sends heartbeat |
| `heartbeatTimeout` | 30000ms | How long before heartbeat is considered stale |
| `monitorInterval` | 2000ms | How often read-only tab checks status |

The 30s timeout is intentionally generous to tolerate browser timer throttling in hidden tabs.
