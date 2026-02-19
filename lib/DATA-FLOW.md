# Data Flow — lib/ Infrastructure

How data moves through the persistence and import/export layers.

## Write Path: UI → Repository → localStorage

```
Component calls dataStore.updateTask(id, updates)
  │
  ├─ dataStore captures previousValues from taskRepository.findById(id)
  ├─ taskRepository.update(id, updates)
  │     └─ LocalStorageBackend.setEntities('tasks', [...])
  │           ├─ Updates in-memory state
  │           ├─ Writes to localStorage (4 keys: unified + 3 Zustand)
  │           └─ Notifies listeners for 'tasks' key
  │
  ├─ Repository subscription fires → useDataStore.setState({ tasks })
  │
  └─ dataStore emits domain event via lib/events (for automations)
```

## Read Path: localStorage → Backend → Repository → Store

```
App loads / LocalStorageBackend constructor
  │
  ├─ Try unified key: localStorage['task-management-app-state']
  │     └─ AppStateSchema.safeParse() → if valid, use it
  │
  ├─ Fallback: assemble from 3 Zustand keys
  │     ├─ localStorage['task-management-data']     → projects, tasks, sections, deps
  │     ├─ localStorage['task-management-tms']      → TMS state
  │     └─ localStorage['task-management-settings'] → app settings
  │     └─ AppStateSchema.safeParse() → if valid, use assembled state
  │
  └─ If all fail → return default empty state
```

## Import Path: JSON File → Repositories

```
User selects JSON file in ImportExportMenu (features/sharing/components/)
  │
  ├─ importFromJSON(text)  (features/sharing/services/importExport.ts)
  │     ├─ JSON.parse()
  │     └─ AppStateSchema.safeParse() → throws ImportError if invalid
  │
  ├─ Replace mode:
  │     ├─ projectRepository.replaceAll(data.projects)
  │     ├─ taskRepository.replaceAll(data.tasks)
  │     ├─ sectionRepository.replaceAll(data.sections)
  │     └─ dependencyRepository.replaceAll(data.dependencies)
  │
  └─ Merge mode:
        ├─ deduplicateEntities(currentState) (features/sharing/services/deduplicateData.ts)
        ├─ Filter imported entities to exclude existing IDs
        ├─ projectRepository.replaceAll([...deduplicated, ...new])
        ├─ taskRepository.replaceAll([...deduplicated, ...new])
        ├─ sectionRepository.replaceAll([...deduplicated, ...new])
        └─ dependencyRepository.replaceAll([...deduplicated, ...new])
```

## Export Path: Stores → JSON

```
User clicks Export in ImportExportMenu (features/sharing/components/)
  │
  ├─ Read current state from Zustand stores (in-memory)
  ├─ JSON.stringify with exportedAt timestamp
  └─ Download as .json file via Blob URL
```

## Share URL Path: State → LZMA → base64url → URL

```
ShareButton → ShareService.generateShareURL(currentState)
  │
  ├─ serializeState(state) → JSON with exportedAt + optional automationRules
  ├─ compressState(json) → LZMA byte array (mode 1)
  ├─ encodeForURL(bytes) → base64url string
  └─ Build URL: origin/path#share=<encoded>

Load: useSharedStateLoader detects #share= in URL
  │
  ├─ ShareService.loadSharedState()
  │     ├─ extractHashData() → encoded string
  │     ├─ decodeFromURL() → signed byte array
  │     ├─ decompressState() → JSON string
  │     └─ validateAppState(parsed) → AppState
  │
  └─ handleLoadSharedState(state, mode)
        ├─ replace: replaceAll() on all repositories
        └─ merge: deduplicate + add new
```
