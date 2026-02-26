# Dual-Write localStorage Corruption — Root Cause Analysis

## Executive Summary

Two independent persistence systems — Zustand's `persist` middleware and `LocalStorageBackend.save()` — write to the same three localStorage keys (`task-management-data`, `task-management-tms`, `task-management-settings`). Neither system is aware of the other's writes. Every repository mutation triggers `LocalStorageBackend.save()`, which overwrites all three Zustand keys with the backend's in-memory snapshot — a snapshot that is stale for TMS and settings state because those stores are owned by Zustand, not the backend.

---

## 1. Five-Whys Chain

### Why #1: TMS state is lost after creating a task

When a task is created, `taskRepository.create()` calls `LocalStorageBackend.setEntities('tasks', [...])`, which calls `this.save()`. The `save()` method writes to **all four** localStorage keys, including `task-management-tms`. It writes the backend's in-memory `this.state.tmsState`, which is a stale snapshot captured at construction time.

### Why #2: The backend's TMS state is stale

`LocalStorageBackend` loads state once in its constructor (`this.state = this.load()`). After that, only `setEntities()` updates `this.state` — and only for the key being set (e.g., `'tasks'`). Nobody ever calls `setEntities('tmsState', ...)` because TMS state is managed exclusively by `useTMSStore` (Zustand). The backend's `this.state.tmsState` is frozen at whatever was in localStorage when the page loaded.

### Why #3: Two systems own the same localStorage keys

The architecture has two independent write paths to the same keys:

| Writer | Keys Written | When |
|--------|-------------|------|
| Zustand `persist` (dataStore) | `task-management-data` | Every `set()` call in dataStore |
| Zustand `persist` (tmsStore) | `task-management-tms` | Every `set()` call in tmsStore |
| Zustand `persist` (appStore) | `task-management-settings` | Every `set()` call in appStore |
| `LocalStorageBackend.save()` | All 3 keys + unified key | Every `setEntities()` call |

The backend writes to all keys "for backward compatibility" (see `DECISIONS.md` #2), but it only has fresh data for the entity types it manages (projects, tasks, sections, dependencies). It writes stale data for TMS state and settings.

### Why #4: The backend was designed as a unified persistence layer but only partially adopted

The original design intended `LocalStorageBackend` to be the single source of truth, replacing Zustand's persist. But the migration was never completed:
- `dataStore` entities route through repositories → backend (fresh data ✓)
- `tmsStore` state is managed entirely by Zustand persist (backend never updated ✗)
- `appStore` settings are managed entirely by Zustand persist (backend never updated ✗)

The backend's `save()` method assumes it owns all state, but it only owns entity data.

### Why #5: No ownership boundary was enforced between the two persistence systems

There is no contract defining which system owns which localStorage keys. The backend writes to Zustand's keys, and Zustand writes to its own keys, with no coordination. The `save()` method was written to maintain "backward compatibility" but created an implicit coupling where any entity mutation clobbers unrelated state.

---

## 2. Data Flow Diagram — All Write Paths

```
┌─────────────────────────────────────────────────────────────────────┐
│                        localStorage                                  │
│                                                                      │
│  ┌──────────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │ task-management-data  │  │ task-mgmt-tms   │  │ task-mgmt-     │ │
│  │ {state:{projects,    │  │ {state:{state:  │  │  settings      │ │
│  │  tasks,sections,     │  │  TMSState},     │  │ {state:{       │ │
│  │  deps}, version:1}   │  │  version:2}     │  │  settings,     │ │
│  └──────────┬───────────┘  └────────┬────────┘  │  projectTabs}, │ │
│             │                       │            │  version:1}    │ │
│             │                       │            └───────┬────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ task-management-app-state (unified key)                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
        ▲ ▲ ▲                    ▲ ▲ ▲                    ▲ ▲ ▲
        │ │ │                    │ │ │                    │ │ │
        │ │ │                    │ │ │                    │ │ │
   ┌────┘ │ └────┐         ┌────┘ │ └────┐         ┌────┘ │ └────┐
   │      │      │         │      │      │         │      │      │
   W1     W2     R1        W1     W3     R2        W1     W4     R3
   │      │      │         │      │      │         │      │      │
   │      │      │         │      │      │         │      │      │

W1: LocalStorageBackend.save()
    — Writes ALL 4 keys on every setEntities() call
    — TMS + settings data is STALE (snapshot from constructor)
    — Triggered by: any repository.create/update/delete/replaceAll

W2: Zustand persist (dataStore)
    — Writes task-management-data on every set() call
    — Triggered by: repository subscriptions → useDataStore.setState()

W3: Zustand persist (tmsStore)
    — Writes task-management-tms on every set() call
    — Triggered by: TMS handler state changes (FVP, DIT, AF4)

W4: Zustand persist (appStore)
    — Writes task-management-settings on every set() call
    — Triggered by: settings changes (theme, active project, etc.)

R1/R2/R3: useCrossTabSync
    — Listens for StorageEvent on all 3 keys
    — Calls store.persist.rehydrate() to reload from localStorage
    — Only fires for OTHER tabs (same-tab writes don't trigger StorageEvent)
```

---

## 3. Race Condition Timeline

### Scenario A: Task creation clobbers TMS state (the reported bug)

```
Time  Actor                    Action                              localStorage[tms]
─────────────────────────────────────────────────────────────────────────────────────
T0    Page load                Backend constructor loads state      {state:{state:{activeSystem:'fvp',...}}, version:2}
      (constructor)            backend.state.tmsState = {fvp data}

T1    User activates FVP       tmsStore.setActiveSystem('fvp')      {state:{state:{activeSystem:'fvp', systemStates:{fvp:{...}}}}, version:2}
      (Zustand persist)        Zustand writes tms key               ← FRESH FVP state

T2    User marks task in FVP   tmsStore.applySystemStateDelta(...)   {state:{state:{activeSystem:'fvp', systemStates:{fvp:{...updated}}}}, version:2}
      (Zustand persist)        Zustand writes tms key               ← UPDATED FVP state

T3    User creates new task    taskRepository.create(task)
      (repository)             → backend.setEntities('tasks', [...])
                               → backend.save()
                               → Writes tms key with                {state:{state:{activeSystem:'fvp',...T0 snapshot}}, version:2}
                                 backend.state.tmsState             ← STALE! Reverts T1+T2 changes

T4    (same tick)              Zustand dataStore persist fires       (writes data key — no conflict here)
                               tmsStore does NOT fire               tms key still has stale T0 data

T5    User navigates to FVP    tmsStore reads from memory           Still has T2 state in memory (Zustand hasn't rehydrated)
      view                     FVP appears correct...

T6    User refreshes page      tmsStore.persist loads from          {state:{state:{activeSystem:'fvp',...T0 snapshot}}, version:2}
                               localStorage                         ← FVP progress LOST
```

### Scenario A (pre-hotfix variant): version:1 triggers migration

Before the hotfix, `save()` wrote `version: 1` to the TMS key. On next page load:

```
T6'   Page load                tmsStore.persist sees version:1
                               → Runs migrateTMSState(state, 1)
                               → Migration expects v1 shape (flat af4/dit/fvp keys)
                               → Gets v2 shape (nested systemStates)
                               → Produces corrupt/default state
                               → ALL TMS state reset to defaults
```

### Scenario B: Settings clobbered by entity mutation

```
T0    Page load                Backend loads settings snapshot
T1    User changes theme       appStore.setTheme('dark')            settings key: {state:{settings:{theme:'dark'},...}, version:1}
T2    User renames project     projectRepository.update(id, {name}) 
                               → backend.save()
                               → Writes settings key with           settings key: {state:{settings:{theme:'system'},...}, version:1}
                                 backend.state.settings             ← Theme reverted to 'system'!
T3    User refreshes           appStore loads from localStorage     Theme is 'system' again
```

### Scenario C: Cross-tab sync amplifies corruption

```
Tab A                                    Tab B
─────                                    ─────
T0  Both tabs loaded, backend has stale TMS snapshot

T1  User works in FVP (Tab A)
    tmsStore updates → writes tms key

T2                                       User creates task (Tab B)
                                         backend.save() → writes stale tms key
                                         StorageEvent fires to Tab A

T3  Tab A receives StorageEvent
    useCrossTabSync calls
    tmsStore.persist.rehydrate()
    → Loads STALE tms data from
      localStorage (written by Tab B)
    → Tab A's in-memory FVP state
      IMMEDIATELY reverts
    → User sees FVP progress vanish
      WITHOUT a page refresh
```

This is worse than Scenario A because the user doesn't even need to refresh — cross-tab sync actively pushes stale data into the live store.

---

## 4. All Affected Keys

| localStorage Key | Backend Writes? | Zustand Writes? | Dual-Write Conflict? | Severity |
|---|---|---|---|---|
| `task-management-data` | ✅ (fresh) | ✅ (fresh) | ⚠️ Redundant but not destructive* | Low |
| `task-management-tms` | ✅ (**STALE**) | ✅ (fresh) | 🔴 **Destructive** — backend overwrites fresh TMS state | Critical |
| `task-management-settings` | ✅ (**STALE**) | ✅ (fresh) | 🔴 **Destructive** — backend overwrites fresh settings | High |
| `task-management-app-state` | ✅ (partially stale) | ❌ | ⚠️ Unified key has stale TMS + settings | Medium |

*For `task-management-data`: Both writers produce the same data because repository mutations flow through the backend first, then Zustand's `setState` triggers persist. The data is identical, so the redundant write is wasteful but not destructive. However, there's a subtle ordering issue: the backend writes `version: 1` (hardcoded), matching Zustand's `version: 1`, so no migration conflict exists today. If `dataStore` ever adds a migration (version 2+), the same bug will surface.

---

## 5. Hidden Risks

### 5.1 Import/Export triggers full clobber

`ImportExportMenu` replace mode calls `replaceAll()` on all four repositories sequentially:
```typescript
projectRepository.replaceAll(data.projects);   // → save() writes all keys
taskRepository.replaceAll(data.tasks);          // → save() writes all keys
sectionRepository.replaceAll(data.sections);    // → save() writes all keys
dependencyRepository.replaceAll(data.dependencies); // → save() writes all keys
```

Each `replaceAll()` triggers `save()`, which writes stale TMS + settings data. That's **4 redundant overwrites** of the TMS and settings keys with stale data in a single import operation.

### 5.2 Rapid state changes cause write amplification

Every single entity mutation (create, update, delete) triggers `save()`, which writes **all 4 localStorage keys**. A cascade delete of a project with 50 tasks produces 50+ `save()` calls, each writing 4 keys = 200+ localStorage writes. Each one clobbers TMS and settings.

### 5.3 Quota exhaustion causes partial writes

`save()` writes 4 keys sequentially. If `localStorage.setItem()` throws `QuotaExceededError` after writing 2 of 4 keys, the state is split: some keys have new data, others have old data. The error is caught and re-thrown, but the partial writes are not rolled back.

### 5.4 Backend constructor load vs. Zustand hydration race

On page load, two things happen:
1. `LocalStorageBackend` constructor calls `this.load()` — reads from localStorage
2. Zustand stores hydrate from their respective keys via `persist` middleware

These happen in module initialization order (determined by import graph). If the backend loads before Zustand hydrates, and then a repository subscription fires before Zustand has finished hydrating, the backend could write stale data before Zustand has even loaded its fresh state.

### 5.5 The unified key (`task-management-app-state`) is always partially stale

The unified key contains the backend's full `this.state`, which includes stale TMS and settings. If the backend's `load()` method ever prefers the unified key over the separate keys (it does — it tries the unified key first), it will load stale TMS/settings data on the next page load, even if the separate Zustand keys have fresh data.

Current mitigation: The unified key is only preferred if it passes Zod validation. But since stale data is still structurally valid, validation won't catch it.

### 5.6 `backfillMovedToSectionAt` runs at module load

In `dataStore.ts`, `backfillMovedToSectionAt()` runs at import time. It calls `taskRepository.update()` for every task missing `movedToSectionAt`. Each update triggers `save()`, which clobbers TMS and settings. This runs before the app is even interactive.

### 5.7 Future version bumps will re-trigger the original bug

If `dataStore` or `appStore` ever bump their persist `version` (currently both at 1), the backend's hardcoded `version: 1` in `save()` will cause the same migration-loop bug that was hotfixed for TMS. The version numbers in `save()` are hardcoded constants, not derived from the stores' actual versions.

---

## 6. Root Cause Summary

The fundamental issue is **shared mutable state with no ownership protocol**. Two independent persistence systems (Zustand persist and LocalStorageBackend) write to the same localStorage keys without coordination. The backend assumes it owns all state, but it only has fresh data for entity collections (projects, tasks, sections, dependencies). TMS state and settings are owned by their respective Zustand stores, but the backend overwrites them with stale snapshots on every entity mutation.

The hotfix (changing `version: 1` to `version: 2` in the TMS key write) prevents the migration-loop symptom but does not fix the underlying data loss. Any TMS state change made after page load will be silently reverted the next time any entity is mutated through a repository.

---

## 7. Recommended Fix Directions

### Option A: Stop writing keys you don't own (minimal fix)

Remove the TMS and settings key writes from `LocalStorageBackend.save()`. Only write `task-management-data` and the unified key. Let Zustand persist own its keys exclusively.

**Pros**: Minimal change, eliminates the race condition.
**Cons**: Unified key becomes data-only (or needs a different strategy to stay complete). Backend `load()` fallback path that assembles from 3 keys still works.

### Option B: Make the backend the single source of truth (full migration)

Route TMS and settings mutations through the backend (via repositories or `setEntities`). Remove Zustand persist from `tmsStore` and `appStore`. Zustand stores become pure in-memory caches that subscribe to backend changes.

**Pros**: Single write path, no dual-write. Consistent with the repository pattern already used for entities.
**Cons**: Larger refactor. TMS store's migration logic would need to move to the backend.

### Option C: Read-before-write in save() (defensive fix)

Before writing TMS and settings keys, read the current values from localStorage and merge them with the backend's state, preferring the localStorage values for keys the backend doesn't own.

**Pros**: Preserves backward compatibility.
**Cons**: Adds complexity, doesn't eliminate the fundamental ownership ambiguity, and introduces its own race conditions (TOCTOU between read and write).
