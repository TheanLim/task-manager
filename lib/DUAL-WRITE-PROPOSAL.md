# Dual-Write localStorage Fix — Architectural Proposal

## Status: PROPOSAL — Pending Review

**Author**: Lead Architect  
**Date**: 2025-02-21  
**Related**: `lib/DUAL-WRITE-ANALYSIS.md` (root cause analysis)

---

## 1. Solution Comparison Matrix

### Option A: Stop Writing Keys You Don't Own

Remove TMS and settings key writes from `LocalStorageBackend.save()`. The backend only writes `task-management-data` (entity data it actually owns) and the unified key. Zustand persist remains the sole writer for `task-management-tms` and `task-management-settings`.

| Dimension | Assessment |
|---|---|
| Implementation effort | **S** — ~20 lines changed in `save()`, plus unified key strategy |
| Risk of regression | **Low** — Removes writes, doesn't change read paths or store behavior |
| Impact on import/export | **None** — Export reads from Zustand stores (in-memory). Import writes through repositories which only touch entity data. TMS/settings are not imported today. |
| Impact on cross-tab sync | **Positive** — Eliminates the stale-data-push scenario (Analysis §3C). Cross-tab sync continues to work via Zustand persist's own writes triggering `StorageEvent`. |
| Impact on e2e tests | **Minimal** — Tests that seed data via `localStorageBackend.reset()` still work because `reset()` can be updated to only clear entity keys. |
| Migration complexity | **None** — Existing localStorage data is structurally unchanged. Zustand stores continue reading their own keys. The unified key becomes entity-only, which is fine because `load()` falls back to separate keys. |
| Long-term maintainability | **Medium** — Two persistence systems still coexist (backend for entities, Zustand persist for stores). The ownership boundary is now explicit, but the dual system remains. |

### Option B: Single Source of Truth — Backend Owns Everything

Route TMS and settings mutations through the backend via new repositories (e.g., `TMSRepository`, `SettingsRepository`). Remove Zustand `persist` middleware from all three stores. Zustand stores become pure in-memory caches that subscribe to backend changes.

| Dimension | Assessment |
|---|---|
| Implementation effort | **L** — New repositories for TMS + settings, rewire all TMS/settings mutations, remove persist middleware, migrate `tmsStore` migration logic to backend, update cross-tab sync to use backend events |
| Risk of regression | **High** — Touching every store's persistence layer simultaneously. TMS migration logic (`migrateTMSState`) is tightly coupled to Zustand persist's version/migrate contract. |
| Impact on import/export | **Positive** — Export could read from backend instead of stores. Import could write TMS/settings through repositories too. |
| Impact on cross-tab sync | **Requires rewrite** — Current cross-tab sync relies on Zustand persist's `rehydrate()`. Without persist, we'd need a custom `StorageEvent` listener that reads from the backend and pushes to stores. |
| Impact on e2e tests | **High** — Every test that interacts with stores or seeds data needs updating. |
| Migration complexity | **Medium** — Need to handle the transition from Zustand persist keys to backend-managed keys. Existing users' data is in Zustand's format; backend would need to read it once and take over. |
| Long-term maintainability | **High** — Single write path, clear ownership. But the refactor is large and the TMS store's migration system is non-trivial to replicate. |

### Option C: Zustand-Only Persistence — Remove Backend's localStorage Writes

Remove `save()` from `LocalStorageBackend` entirely. The backend becomes a pure in-memory cache with no persistence. Zustand persist is the only system that writes to localStorage. The backend loads initial state from Zustand's keys on construction (read-only), and all subsequent persistence happens through Zustand's `persist` middleware reacting to `setState` calls triggered by repository subscriptions.

| Dimension | Assessment |
|---|---|
| Implementation effort | **M** — Remove `save()` calls, ensure `dataStore`'s persist middleware captures all entity mutations (it already does via repository subscriptions → `setState`), remove unified key writes, update `load()` to only read from Zustand keys |
| Risk of regression | **Medium** — The backend currently persists on every `setEntities()` call. Removing this means persistence depends entirely on Zustand's `setState` → persist pipeline. If a repository mutation doesn't trigger a subscription → `setState` → persist cycle, data is lost. Need to verify every write path. |
| Impact on import/export | **Needs adjustment** — `replaceAll()` currently persists via `save()`. Without it, persistence depends on the subscription → `setState` → persist chain. This works today (subscriptions fire on `setEntities`), but the timing becomes critical. |
| Impact on cross-tab sync | **Positive** — Only Zustand writes to localStorage, so `StorageEvent` always carries fresh data. No stale overwrites. |
| Impact on e2e tests | **Medium** — Tests using `localStorageBackend.reset()` would need to also reset Zustand stores, since the backend no longer persists. |
| Migration complexity | **Low** — Zustand keys remain unchanged. Unified key becomes dead (can be cleaned up). |
| Long-term maintainability | **Medium** — Zustand persist becomes the sole persistence layer, which is simpler. But the backend's role becomes ambiguous — it's an in-memory cache that loads from localStorage but doesn't write to it. This invites confusion about who owns persistence. |

### Option D: Scoped Save — Backend Only Writes What Changed

Modify `save()` to accept a scope parameter indicating which key was actually modified. Only write the affected localStorage key(s) instead of all four. `setEntities('tasks', [...])` would only write `task-management-data` and update the unified key's entity portion.

| Dimension | Assessment |
|---|---|
| Implementation effort | **S** — Add a `scope` parameter to `save()`, conditional writes based on scope |
| Risk of regression | **Low** — Narrows write scope, doesn't change read paths |
| Impact on import/export | **None** — `replaceAll()` calls `setEntities()` which would scope correctly |
| Impact on cross-tab sync | **Positive** — Same as Option A |
| Impact on e2e tests | **Minimal** |
| Migration complexity | **None** |
| Long-term maintainability | **Low-Medium** — Still has the dual-write for entity data (backend + Zustand persist both write `task-management-data`). The unified key still contains stale TMS/settings unless we stop writing those portions. Essentially converges to Option A with extra complexity. |

---

## 2. Recommended Approach: Option A — Stop Writing Keys You Don't Own

### Justification

Option A is the clear winner for this codebase. Here's why:

**It fixes the root cause directly.** The analysis identifies the problem as "shared mutable state with no ownership protocol." Option A establishes the ownership protocol: the backend owns entity keys, Zustand persist owns store keys. No ambiguity.

**Minimal blast radius.** The change is confined to `LocalStorageBackend.save()` and the unified key strategy. No store rewiring, no migration logic changes, no cross-tab sync rewrite. Every other option touches significantly more surface area.

**Aligns with existing architecture rules.** The project's rules say "no business logic in Zustand stores" and "per-entity repository interfaces with granular CRUD." Option A preserves this: repositories continue to own entity persistence through the backend, while Zustand persist handles UI state (TMS, settings) — which is exactly what Zustand persist was designed for.

**Option B is the "right" long-term answer but wrong timing.** Making the backend own everything is architecturally clean, but it's a large refactor that touches every store. The TMS store's migration system (`migrateTMSState`, version 2) is tightly coupled to Zustand persist's contract. Replicating this in the backend is non-trivial and error-prone. This refactor should happen when there's a compelling reason beyond fixing this bug (e.g., moving to IndexedDB, adding offline sync).

**Option C creates an identity crisis.** If the backend doesn't persist, what is it? An in-memory cache that loads from someone else's storage? This muddies the architecture. The backend's value is that it provides a clean repository interface over localStorage. Removing its writes undermines that.

**Option D converges to Option A.** Once you scope the writes, you realize the backend should never have been writing TMS/settings keys in the first place. The scoping logic adds complexity without adding value over simply removing the writes.

### What About the Unified Key?

The unified key (`task-management-app-state`) currently contains the full `AppState` including TMS and settings. Under Option A, the backend no longer has fresh TMS/settings data to write. Two sub-options:

**A1: Stop writing the unified key entirely.** The `load()` fallback path (assemble from 3 separate keys) becomes the primary path. The unified key becomes dead code that can be cleaned up.

**A2: Write entity-only data to the unified key.** The unified key becomes a backup of entity data only. `load()` always falls back to separate keys for TMS/settings.

**Recommendation: A1.** The unified key was created for "backward compatibility" (DECISIONS.md #2), but it's the backward compatibility that's causing the bug. The separate Zustand keys are the canonical source. The unified key adds no value and creates confusion. Remove it.

---

## 3. Implementation Plan

### Phase 1: Fix the Bug (Safe First)

#### Step 1.1: Remove TMS and settings writes from `save()`

**File**: `lib/repositories/localStorageBackend.ts`

**Change**: Modify `save()` to only write `task-management-data`. Remove writes to `TMS_KEY`, `SETTINGS_KEY`, and `STORAGE_KEY` (unified).

```typescript
// BEFORE (writes all 4 keys)
save(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    localStorage.setItem(DATA_KEY, JSON.stringify({ state: { ... }, version: 1 }));
    localStorage.setItem(TMS_KEY, JSON.stringify({ state: { state: this.state.tmsState }, version: 2 }));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ state: { settings: this.state.settings, projectTabs: {} }, version: 1 }));
  } catch (error) { ... }
}

// AFTER (writes only the entity data key)
save(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      DATA_KEY,
      JSON.stringify({
        state: {
          projects: this.state.projects,
          tasks: this.state.tasks,
          sections: this.state.sections,
          dependencies: this.state.dependencies,
        },
        version: 1,
      }),
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('localStorage quota exceeded');
    }
    throw error;
  }
}
```

**Verify**: 
- `npx vitest run` — all existing tests pass
- Manual: Change theme → create task → refresh → theme persists
- Manual: Activate FVP → mark tasks → create new task → refresh → FVP state persists

#### Step 1.2: Simplify `load()` to remove unified key path

**File**: `lib/repositories/localStorageBackend.ts`

**Change**: Remove the unified key (`STORAGE_KEY`) read path from `load()`. Always assemble state from the 3 separate Zustand keys. Remove the `STORAGE_KEY` and `VERSION` constants.

```typescript
// AFTER
load(): AppState {
  if (typeof window === 'undefined') return getDefaultState();
  try {
    const dataStr = localStorage.getItem(DATA_KEY);
    const tmsStr = localStorage.getItem(TMS_KEY);
    const settingsStr = localStorage.getItem(SETTINGS_KEY);

    if (!dataStr && !tmsStr && !settingsStr) return getDefaultState();

    const data = dataStr
      ? JSON.parse(dataStr)
      : { state: { projects: [], tasks: [], sections: [], dependencies: [] } };
    const tms = tmsStr
      ? JSON.parse(tmsStr)
      : { state: { state: getDefaultTMSState() } };
    const settingsData = settingsStr
      ? JSON.parse(settingsStr)
      : { state: { settings: getDefaultSettings() } };

    const assembled: AppState = {
      projects: data.state?.projects ?? [],
      tasks: data.state?.tasks ?? [],
      sections: data.state?.sections ?? [],
      dependencies: data.state?.dependencies ?? [],
      tmsState: tms.state?.state ?? getDefaultTMSState(),
      settings: settingsData.state?.settings ?? getDefaultSettings(),
      version: '1.0.0',
    };

    const result = AppStateSchema.safeParse(assembled);
    if (!result.success) {
      console.error('Zod validation failed for assembled state:', result.error.format());
      return getDefaultState();
    }
    return result.data;
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
    return getDefaultState();
  }
}
```

**Verify**: 
- `npx vitest run`
- Manual: Existing data loads correctly after refresh (no data loss)

#### Step 1.3: Clean up dead unified key from existing users' localStorage

**File**: `lib/repositories/localStorageBackend.ts`

**Change**: Add a one-time cleanup in the constructor that removes the stale unified key.

```typescript
constructor() {
  this.listeners = new Map();
  this.state = this.load();
  // One-time cleanup: remove stale unified key (see DUAL-WRITE-PROPOSAL.md)
  if (typeof window !== 'undefined') {
    localStorage.removeItem('task-management-app-state');
  }
}
```

**Verify**: 
- `npx vitest run`
- Manual: Check localStorage in DevTools — unified key is gone after page load

#### Step 1.4: Remove stale TMS/settings state from backend's in-memory state

**File**: `lib/repositories/localStorageBackend.ts`

**Change**: The backend's `AppState` type still includes `tmsState` and `settings` fields, but they're now read-only snapshots used only during `load()` assembly. Consider whether to narrow the type.

**Decision**: Keep the full `AppState` type for now. The `load()` method still assembles the full state (needed for Zod validation against `AppStateSchema`). The stale fields exist in memory but are never written back. This is acceptable for Phase 1. Phase 2 can narrow the type if desired.

**Verify**: `npx vitest run`

### Phase 2: Harden (Follow-Up)

#### Step 2.1: Remove redundant `task-management-data` dual-write

After Phase 1, both the backend's `save()` and Zustand persist (via `dataStore`) write to `task-management-data`. The writes are redundant but not destructive (same data, same version). To eliminate the redundancy:

**Option**: Remove Zustand persist from `dataStore` entirely. The backend's `save()` becomes the sole writer for entity data. `dataStore` becomes a pure in-memory cache populated by repository subscriptions.

**Trade-off**: Losing Zustand persist means losing its built-in `version` + `migrate` contract for `dataStore`. Currently `dataStore` is at version 1 with no migrations, so this is safe today. If entity schema migrations are needed later, they'd go in the backend's `load()`.

**Files**: `stores/dataStore.ts` (remove `persist` wrapper), `app/hooks/useCrossTabSync.ts` (remove `task-management-data` from `STORE_KEYS` — backend's `save()` triggers `StorageEvent` for cross-tab sync).

**Risk**: Medium. Requires verifying that the backend's `save()` → `StorageEvent` → cross-tab rehydration path works. Currently cross-tab sync calls `useDataStore.persist.rehydrate()`, which won't exist without persist. Would need a custom rehydration mechanism.

**Recommendation**: Defer to a separate PR. The dual-write for entity data is redundant but harmless. Fixing it is a nice-to-have, not a must-have.

#### Step 2.2: Add ownership documentation

**File**: `lib/DECISIONS.md`

**Change**: Update Decision #2 to reflect the new ownership model:

> **Decision #2 (REVISED)**: `LocalStorageBackend.save()` writes only to `task-management-data`. Zustand persist owns `task-management-tms` and `task-management-settings`. The unified key (`task-management-app-state`) has been removed.
>
> **Ownership protocol**:
> | localStorage Key | Owner | Writer |
> |---|---|---|
> | `task-management-data` | Backend + Zustand persist (redundant) | `LocalStorageBackend.save()` + `dataStore` persist |
> | `task-management-tms` | Zustand persist | `tmsStore` persist |
> | `task-management-settings` | Zustand persist | `appStore` persist |

#### Step 2.3: Add regression test

**File**: `lib/repositories/__tests__/localStorageBackend.test.ts` (new)

**Test**: After `setEntities('tasks', [...])`, verify that `localStorage.getItem('task-management-tms')` and `localStorage.getItem('task-management-settings')` were NOT modified. This prevents future regressions where someone adds writes back to `save()`.

```typescript
it('save() does not write to TMS or settings keys', () => {
  // Seed TMS and settings keys with known values
  localStorage.setItem('task-management-tms', JSON.stringify({ sentinel: 'tms' }));
  localStorage.setItem('task-management-settings', JSON.stringify({ sentinel: 'settings' }));

  // Trigger a save via entity mutation
  backend.setEntities('tasks', [mockTask]);

  // Verify TMS and settings keys were not touched
  expect(JSON.parse(localStorage.getItem('task-management-tms')!)).toEqual({ sentinel: 'tms' });
  expect(JSON.parse(localStorage.getItem('task-management-settings')!)).toEqual({ sentinel: 'settings' });
});

it('save() does not write the unified key', () => {
  backend.setEntities('tasks', [mockTask]);
  expect(localStorage.getItem('task-management-app-state')).toBeNull();
});
```

---

## 4. Migration Strategy

### Existing Users

**No migration function needed.** Here's why:

1. **Entity data** (`task-management-data`): Unchanged. The backend continues to write this key in the same format. Zustand persist continues to read it with the same version (1).

2. **TMS data** (`task-management-tms`): The backend stops writing this key. Zustand persist continues to own it. The data in localStorage is whatever Zustand last wrote — which is the fresh, correct data. No corruption.

3. **Settings data** (`task-management-settings`): Same as TMS. The backend stops writing, Zustand persist continues to own it. Fresh data preserved.

4. **Unified key** (`task-management-app-state`): Removed by the constructor cleanup (Step 1.3). This key was only used as a fallback in `load()`. Since we remove the fallback path, the key is dead. Removing it from localStorage is a cleanup, not a migration.

### Edge Case: User Has Stale Data from the Bug

If a user's TMS or settings key was already clobbered by the bug before this fix ships:

- **TMS**: The stale data is structurally valid (it's an older snapshot). Zustand persist will load it and the user will see their TMS state reverted to whatever it was at page load time before the last clobber. This is data loss that already happened — the fix prevents future loss but can't recover past loss.
- **Settings**: Same situation. Theme/active project may have reverted. The fix prevents future reverts.

**No automated recovery is possible** because the fresh data was overwritten in localStorage. The stale data is the only data that exists. Users who notice missing TMS state can re-configure it. This is acceptable given the alternative (a complex migration that tries to guess what the "right" state should be).

### The Unified Key Transition

The unified key (`task-management-app-state`) is removed in two steps:

1. **Step 1.2**: `load()` no longer reads from it. Even if it exists, it's ignored.
2. **Step 1.3**: Constructor removes it from localStorage on next page load.

This is safe because:
- The unified key was always a superset of the 3 separate keys
- The separate keys are always at least as fresh as the unified key (Zustand persist writes them on every `set()`)
- `load()` already had a fallback path that assembles from separate keys — we're just making it the only path

---

## 5. Risks and Mitigations

### Risk 1: Backend's `reset()` method no longer clears TMS/settings

**Scenario**: `reset()` calls `save()` after setting default state. After the fix, `save()` only writes entity data. TMS and settings keys in localStorage are not cleared.

**Impact**: Tests or features that call `reset()` expecting a full wipe won't clear TMS/settings.

**Mitigation**: Update `reset()` to explicitly clear all keys:

```typescript
reset(): void {
  this.state = getDefaultState();
  this.save(); // Clears entity data
  // Also clear keys we don't own, since reset() is a full wipe
  if (typeof window !== 'undefined') {
    localStorage.removeItem('task-management-tms');
    localStorage.removeItem('task-management-settings');
    localStorage.removeItem('task-management-app-state');
  }
  for (const key of this.listeners.keys()) {
    this.notify(key);
  }
}
```

### Risk 2: Future developer adds writes back to `save()`

**Scenario**: Someone adds TMS or settings writes to `save()` "for completeness" without understanding the ownership model.

**Mitigation**: 
- Regression test (Step 2.3) catches this immediately
- Decision #2 in `DECISIONS.md` documents the ownership protocol
- Code comment in `save()` explaining why only entity data is written

### Risk 3: `backfillMovedToSectionAt` still triggers many `save()` calls at startup

**Scenario**: The backfill runs at module load and calls `taskRepository.update()` for every task missing `movedToSectionAt`. Each update triggers `save()`. After the fix, these writes are harmless (only entity data), but they're still wasteful — N tasks = N full serializations of entity data.

**Impact**: Slow startup for users with many tasks.

**Mitigation**: This is a pre-existing performance issue, not introduced by this fix. However, it's worth noting for a follow-up optimization: batch the backfill into a single `replaceAll()` call instead of N individual `update()` calls.

### Risk 4: Cross-tab sync for entity data relies on backend's `save()` writing `task-management-data`

**Scenario**: Tab A creates a task → backend `save()` writes `task-management-data` → `StorageEvent` fires in Tab B → `useCrossTabSync` calls `useDataStore.persist.rehydrate()` → Tab B gets the new task.

**Impact**: After the fix, this path still works because `save()` still writes `task-management-data`. No change.

**Mitigation**: None needed. This is a non-risk, listed for completeness.

### Risk 5: Zustand persist and backend write `task-management-data` with different `version` values

**Scenario**: `dataStore` persist uses `version: 1`. Backend's `save()` also writes `version: 1`. If `dataStore` ever bumps to `version: 2` and adds a migration, the backend's `save()` would overwrite with `version: 1`, triggering the migration on every rehydrate.

**Impact**: Not immediate (both are at version 1 today), but a latent bug.

**Mitigation**: This is the redundant dual-write for entity data (Phase 2, Step 2.1). For Phase 1, add a code comment in `save()`:

```typescript
// IMPORTANT: This version must match dataStore's persist version.
// If dataStore bumps its version, update this too — or better yet,
// remove this redundant write (see DUAL-WRITE-PROPOSAL.md Phase 2).
version: 1,
```

### Risk 6: Export reads from Zustand stores, not backend

**Scenario**: `ImportExportMenu.handleExport()` reads `dataStore.projects`, `tmsStore.state`, `appStore.settings` — all from Zustand's in-memory state.

**Impact**: None. Export reads from memory, not localStorage. The fix doesn't change in-memory state. Export continues to work correctly.

**Mitigation**: None needed.

---

## 6. Order of Operations Summary

```
Phase 1 (ship together as one PR):
  1.1  Remove TMS/settings/unified writes from save()     ← fixes the bug
  1.2  Remove unified key read path from load()            ← simplifies load
  1.3  Add unified key cleanup in constructor              ← cleans up existing users
  1.4  Update reset() to clear all keys                   ← prevents test leakage
  
Phase 2 (separate follow-up PRs):
  2.1  [Optional] Remove Zustand persist from dataStore    ← eliminates redundant write
  2.2  Update DECISIONS.md with ownership protocol         ← documentation
  2.3  Add regression tests for save() scope               ← prevents future regression
```

Phase 1 steps are safe to ship together because they're all subtractive (removing writes, removing read paths). No new behavior is introduced. If something breaks, the rollback is to revert the PR — the old `save()` behavior is restored, and the worst case is the bug continues to exist (which is the current state).

Phase 2 items are independent and can be shipped in any order. Step 2.3 (regression tests) should ship soon after Phase 1 to lock in the fix.

---

## 7. Test Guardrails — Zero-Regression Test Plan

### 7.1 Current Coverage Gaps

| Area | Existing Tests | Gap |
|---|---|---|
| `LocalStorageBackend.save()` scope | None — no test verifies which keys `save()` writes | **Critical** — the root cause was undetected because no test asserted write scope |
| TMS state survives entity mutations | None — no test creates a task then checks TMS state | **Critical** — the exact bug scenario |
| Settings survive entity mutations | None — no test changes theme then creates a task | **Critical** — same class of bug |
| Cross-tab sync correctness | None — no unit or e2e test for `useCrossTabSync` | **Medium** — amplification vector |
| `reset()` clears all keys | None — `reset()` is used in `beforeEach` but not tested | **Low** — test infrastructure |
| Import/export preserves TMS state | None — no e2e test for import/export + TMS | **Medium** — import triggers `save()` |
| `backfillMovedToSectionAt` side effects | None — backfill runs at module load, no isolation test | **Low** — startup-only |

### 7.2 Unit Tests to Add

#### Test File: `lib/repositories/localStorageBackend.test.ts` (NEW)

Dedicated test file for `LocalStorageBackend` persistence behavior. The existing `localStorage.test.ts` tests repository CRUD but not the backend's write scope.

```
describe('LocalStorageBackend — write scope')
  ├── save() only writes task-management-data key
  │   - Seed TMS key with sentinel value
  │   - Seed settings key with sentinel value
  │   - Call setEntities('tasks', [...])
  │   - Assert TMS key unchanged (sentinel preserved)
  │   - Assert settings key unchanged (sentinel preserved)
  │   - Assert data key was updated with new tasks
  │
  ├── save() does not write the unified key (task-management-app-state)
  │   - Call setEntities('tasks', [...])
  │   - Assert unified key is null
  │
  ├── save() writes correct version for data key
  │   - Call setEntities('tasks', [...])
  │   - Parse data key, assert version matches dataStore persist version
  │
  ├── reset() clears all localStorage keys
  │   - Seed all 4 keys with data
  │   - Call reset()
  │   - Assert data key has empty arrays
  │   - Assert TMS key removed
  │   - Assert settings key removed
  │   - Assert unified key removed
  │
  ├── load() assembles state from separate Zustand keys
  │   - Seed data, TMS, settings keys with known values
  │   - Construct new backend
  │   - Assert backend.getState() has correct assembled state
  │
  ├── load() returns default state when no keys exist
  │   - Clear localStorage
  │   - Construct new backend
  │   - Assert backend.getState() equals getDefaultState()
  │
  └── constructor removes stale unified key
      - Seed unified key with data
      - Construct new backend
      - Assert unified key is null in localStorage
```

#### Test File: `lib/repositories/dualWriteGuardrail.test.ts` (NEW)

Integration test that simulates the exact bug scenario end-to-end within vitest (no browser needed).

```
describe('Dual-write guardrail — TMS state survives entity mutations')
  ├── TMS state is preserved after task creation via repository
  │   - Set up TMS store with FVP state (dottedTasks, scanPosition)
  │   - Create a task via taskRepository.create()
  │   - Read TMS localStorage key
  │   - Assert TMS state still has FVP data (not reset to defaults)
  │
  ├── TMS state is preserved after task update via repository
  │   - Same setup, call taskRepository.update()
  │   - Assert TMS key unchanged
  │
  ├── TMS state is preserved after task deletion via repository
  │   - Same setup, call taskRepository.delete()
  │   - Assert TMS key unchanged
  │
  ├── TMS state is preserved after project cascade delete
  │   - Set up TMS store with AF4 state
  │   - Create project + tasks, then delete project (cascade)
  │   - Assert TMS key still has AF4 data
  │
  ├── Settings are preserved after task creation via repository
  │   - Set theme to 'dark' via appStore
  │   - Create a task via taskRepository.create()
  │   - Read settings localStorage key
  │   - Assert theme is still 'dark'
  │
  ├── TMS state is preserved after replaceAll (import scenario)
  │   - Set up TMS store with DIT state
  │   - Call taskRepository.replaceAll([...])
  │   - Assert TMS key still has DIT data
  │
  └── TMS persist version is never downgraded by backend
      - Set TMS key with version: 2
      - Create a task via repository
      - Read TMS key, assert version is still 2 (not 1)
```

#### Test File: `features/tms/stores/tmsStore.test.ts` (EXTEND)

Add tests to the existing TMS store test file:

```
describe('TMS store persistence')
  ├── TMS state round-trips through localStorage correctly
  │   - Set activeSystem to 'fvp', add systemStates
  │   - Read localStorage key, parse, verify structure
  │   - Create new store instance, verify state matches
  │
  └── TMS persist version matches expected value (2)
      - Trigger a store write
      - Read localStorage key, assert version === 2
```

### 7.3 E2E Tests to Add

#### Test File: `e2e/tms-persistence.spec.ts` (NEW)

End-to-end tests that verify TMS state survives real user workflows.

```
describe('TMS state persistence across workflows')
  ├── FVP state survives task creation
  │   - Navigate to FVP, start preselection, dot a task
  │   - Navigate to main view, create a new task
  │   - Navigate back to FVP
  │   - Assert dotted task is still visible in Do Now section
  │
  ├── AF4 backlog state survives task creation
  │   - Set up AF4 with tasks in backlog (via localStorage seed)
  │   - Navigate to main view, create a new task
  │   - Navigate back to AF4
  │   - Assert backlog tasks are still present
  │
  ├── DIT today/tomorrow state survives task creation
  │   - Navigate to DIT, move a task to Today
  │   - Navigate to main view, create a new task
  │   - Navigate back to DIT
  │   - Assert task is still in Today zone
  │
  ├── Theme setting survives task creation
  │   - Change theme to dark
  │   - Create a new task
  │   - Refresh page
  │   - Assert theme is still dark (body has dark class)
  │
  ├── TMS state survives page refresh after task creation
  │   - Navigate to FVP, create state
  │   - Create a task from main view
  │   - Refresh page, navigate to FVP
  │   - Assert FVP state is preserved
  │
  └── TMS state survives rapid task mutations
      - Navigate to FVP, create state
      - Rapidly create 5 tasks from main view
      - Navigate back to FVP
      - Assert FVP state is preserved
```

#### Test File: `e2e/tms-system-switching.spec.ts` (EXTEND)

Add to existing system-switching tests:

```
  ├── TMS state survives creating a task while on a different TMS tab
  │   - Activate FVP, create state
  │   - Switch to DIT tab
  │   - (Task creation from main view would go here if possible)
  │   - Switch back to FVP
  │   - Assert FVP state preserved
```

### 7.4 Property-Based Tests

#### Test File: `lib/repositories/localStorage.test.ts` (EXTEND)

Add property-based tests to the existing file:

```
describe('Property: save() write isolation')
  └── For any sequence of entity mutations, TMS and settings keys are never modified
      - Arbitrary: sequence of (create|update|delete) × (task|project|section|dep)
      - Seed TMS key with random valid state
      - Seed settings key with random valid state
      - Execute mutation sequence
      - Assert TMS key === original seed
      - Assert settings key === original seed
```

### 7.5 Low-Level Task Plan

All tasks are ordered for safe incremental execution. Each task leaves tests green.

```
BEFORE-FIX TESTS (write these FIRST — they should FAIL on current code, proving the bug)
─────────────────────────────────────────────────────────────────────────────────────────

T1. Create lib/repositories/localStorageBackend.test.ts
    - Write "save() only writes task-management-data key" test
    - Write "save() does not write unified key" test
    - Write "save() writes correct version for data key" test
    - Write "reset() clears all localStorage keys" test
    - Write "load() assembles from separate keys" test
    - Write "load() returns defaults when empty" test
    - Write "constructor removes stale unified key" test
    - Run: npx vitest run lib/repositories/localStorageBackend.test.ts
    - Expected: save() scope tests FAIL (proving the bug exists)

T2. Create lib/repositories/dualWriteGuardrail.test.ts
    - Write "TMS state preserved after task creation" test
    - Write "TMS state preserved after task update" test
    - Write "TMS state preserved after task deletion" test
    - Write "TMS state preserved after project cascade delete" test
    - Write "Settings preserved after task creation" test
    - Write "TMS state preserved after replaceAll" test
    - Write "TMS persist version never downgraded" test
    - Run: npx vitest run lib/repositories/dualWriteGuardrail.test.ts
    - Expected: ALL FAIL (proving the dual-write bug)

FIX IMPLEMENTATION (make the failing tests pass)
─────────────────────────────────────────────────

T3. Modify lib/repositories/localStorageBackend.ts — save()
    - Remove TMS_KEY write
    - Remove SETTINGS_KEY write
    - Remove STORAGE_KEY (unified) write
    - Keep only DATA_KEY write
    - Run: npx vitest run lib/repositories/localStorageBackend.test.ts
    - Expected: save() scope tests now PASS

T4. Modify lib/repositories/localStorageBackend.ts — load()
    - Remove unified key (STORAGE_KEY) read path
    - Always assemble from 3 separate keys
    - Remove STORAGE_KEY and VERSION constants
    - Run: npx vitest run lib/repositories/localStorageBackend.test.ts
    - Expected: load() tests still PASS

T5. Modify lib/repositories/localStorageBackend.ts — constructor
    - Add localStorage.removeItem('task-management-app-state') cleanup
    - Run: npx vitest run lib/repositories/localStorageBackend.test.ts
    - Expected: constructor cleanup test PASSES

T6. Modify lib/repositories/localStorageBackend.ts — reset()
    - Add explicit removal of TMS, settings, and unified keys
    - Run: npx vitest run lib/repositories/localStorageBackend.test.ts
    - Expected: reset() test PASSES

T7. Run dual-write guardrail tests
    - Run: npx vitest run lib/repositories/dualWriteGuardrail.test.ts
    - Expected: ALL PASS (the fix resolved the dual-write)

POST-FIX VERIFICATION (full regression suite)
──────────────────────────────────────────────

T8. Run full unit test suite
    - Run: npx vitest run
    - Expected: ALL 1978+ tests pass
    - If failures: investigate — the fix should be purely subtractive

T9. Run lint and build
    - Run: npm run lint
    - Run: npx next build
    - Expected: clean

T10. Run all TMS e2e tests
     - Start dev server
     - Run: npx playwright test e2e/tms-*.spec.ts
     - Expected: 63 passed, 0 skipped

T11. Run full e2e suite
     - Run: npx playwright test
     - Expected: all pass (no regressions in non-TMS features)

T12. Create e2e/tms-persistence.spec.ts
     - Write "FVP state survives task creation" test
     - Write "DIT today/tomorrow state survives task creation" test
     - Write "Theme setting survives task creation" test
     - Write "TMS state survives page refresh after task creation" test
     - Run: npx playwright test e2e/tms-persistence.spec.ts
     - Expected: ALL PASS

T13. Extend lib/repositories/localStorage.test.ts
     - Add property-based "save() write isolation" test
     - Run: npx vitest run lib/repositories/localStorage.test.ts
     - Expected: ALL PASS (including new property test)

T14. Update documentation
     - Update lib/DECISIONS.md with ownership protocol
     - Update features/tms/DECISIONS.md if needed
     - No test run needed
```

### 7.6 Test Count Summary

| Category | New Tests | Files |
|---|---|---|
| Unit: Backend write scope | 7 | `lib/repositories/localStorageBackend.test.ts` (new) |
| Unit: Dual-write guardrail | 7 | `lib/repositories/dualWriteGuardrail.test.ts` (new) |
| Unit: TMS persistence | 2 | `features/tms/stores/tmsStore.test.ts` (extend) |
| E2E: TMS persistence | 6 | `e2e/tms-persistence.spec.ts` (new) |
| Property: Write isolation | 1 | `lib/repositories/localStorage.test.ts` (extend) |
| **Total new tests** | **23** | **5 files (3 new, 2 extended)** |

These 23 tests form a comprehensive guardrail that:
1. Proves the bug exists before the fix (T1, T2 fail on current code)
2. Proves the fix works (T3–T7 pass after the fix)
3. Prevents regression (T8–T11 full suite green)
4. Validates real user workflows (T12 e2e persistence tests)
5. Provides property-based coverage for future mutations (T13)
