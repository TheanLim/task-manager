# Architecture Decisions — lib/

## 1. Single LocalStorageBackend, no legacy StorageAdapter

**Decision**: Removed `storage.ts` (`LocalStorageAdapter` class). All persistence goes through `LocalStorageBackend` via repositories. Import/validation extracted to standalone functions in `importExport.ts`.

**Why**: `LocalStorageAdapter` and `LocalStorageBackend` were near-identical implementations of the same dual-write logic. Bug fixes had to be applied twice. The class-based `StorageAdapter` interface (`load()/save()`) violated the "no whole-blob storage interfaces" architecture rule.

**What replaced it**:
- `importFromJSON(json)` — standalone function in `features/sharing/services/importExport.ts`, Zod validation + parse
- `validateAppState(state)` — standalone function in `features/sharing/services/importExport.ts`, `AppStateSchema.safeParse`
- `ImportExportMenu` replace mode uses `repository.replaceAll()` instead of `storage.save()`

**Trade-off**: `ImportExportMenu` replace mode no longer triggers a page reload — it writes through repositories which notify Zustand subscribers. This is cleaner but means the UI updates reactively instead of via full reload.

## 2. Dual-write to 4 localStorage keys

**Decision**: `LocalStorageBackend.save()` writes to both a unified key and 3 separate Zustand persist keys.

**Why**: Backward compatibility with Zustand's built-in `persist` middleware. The Zustand stores (`dataStore`, `appStore`, `tmsStore`) each have their own persist key. The unified key is for the repository layer.

**Known fragility**: If one write fails mid-operation (e.g., quota exceeded after 2 of 4 writes), state becomes inconsistent. Worth revisiting if we ever drop Zustand persist.

## 3. Import validation uses Zod, not hand-rolled checks

**Decision**: `importFromJSON` delegates entirely to `AppStateSchema.safeParse()`. No manual `typeof` or `Array.isArray` checks.

**Why**: Architecture rule #3 — use Zod schemas for runtime validation. Single source of truth for what constitutes valid state.

## 4. deduplicateData is pure — no store imports

**Decision**: `deduplicateEntities()` and `countDuplicates()` in `features/sharing/services/deduplicateData.ts` accept entity collections as parameters and return results. They do not import `useDataStore`.

**Why**: Architecture rule #2 — domain logic must not import stores. The previous `deduplicateDataStore()` called `useDataStore.getState()` and `useDataStore.setState()` directly, coupling utility logic to the store layer. Callers (e.g., `ImportExportMenu` merge mode) now pass data in and write results through repositories.

**What changed**: Old API `deduplicateDataStore()` / `checkForDuplicates()` → new API `deduplicateEntities(collections)` / `countDuplicates(collections)`. `ImportExportMenu` (now in `features/sharing/components/`) merge mode routes through `repository.replaceAll()` instead of `useDataStore.setState()`.

## 5. ImportExportMenu merge mode writes through repositories

**Decision**: Merge mode uses `deduplicateEntities()` for dedup, then writes the merged result via `repository.replaceAll()` for each entity type.

**Why**: The previous implementation called `useDataStore.setState()` directly, bypassing repository subscriptions and the `LocalStorageBackend`. This could leave the backend out of sync with the Zustand store. Writing through repositories ensures the same write path as replace mode.


## 6. Inline entity construction extracted to service layer

**Status**: Resolved.

**Issue**: `app/page.tsx` `handleProjectSubmit` and `handleTaskSubmit` constructed entities inline with `uuidv4()` and `new Date().toISOString()`, violating architecture rule #5.

**Resolution**: Added static factory methods:
- `ProjectService.create(data)` — generates ID and timestamps for new projects
- `TaskService.create(data)` — generates ID, timestamps, and defaults (completed: false) for new tasks
- `TaskService.completionUpdate(completed)` — generates completion state with timestamp

`app/page.tsx` now calls these factories instead of constructing entities inline. The `uuidv4` import was removed from page.tsx.
