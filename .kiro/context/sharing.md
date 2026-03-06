<!-- v1 | last-verified: 2025-07-15 -->
# Sharing System

URL sharing via LZMA compression, JSON file import/export, replace/merge workflows, and entity deduplication. Two sharing channels: compressed URL hash fragments (`#share=<base64url>`) and JSON file download/upload. Both channels validate with Zod (`AppStateSchema`) and route through repositories to keep backend + Zustand in sync.

## Overview

| Aspect | Detail |
|--------|--------|
| URL sharing | LZMA compress → base64url encode → `#share=` hash fragment |
| JSON export | Zustand in-memory state → `JSON.stringify` → `.json` blob download |
| JSON import | File read → `importFromJSON` (Zod parse) → replace or merge via repos |
| Merge strategy | Dedup existing by ID (Map), filter incoming by existing ID set, `replaceAll` merged |
| Automation rules | Separate channel — `importAutomationRules()` validates section refs, marks broken rules |
| Validation | `AppStateSchema.safeParse()` on every import path (URL and file) |

## URL Sharing Flow

```
Generate:
  ShareButton → ShareService.generateShareURL(state, { includeAutomations })
    → serializeState() → JSON (+ exportedAt, + optional automationRules)
    → compressState() → LZMA mode 1 (signed byte[])
    → encodeForURL() → unsigned bytes → base64 → base64url (no +/=)
    → Build: origin/path#share=<encoded>
    → checkURLLength() → warning levels

Load:
  useSharedStateLoader (mount + hashchange listener)
    → 100ms delay (Zustand hydration)
    → ShareService.loadSharedState()
      → extractHashData() → decode #share= prefix
      → decodeFromURL() → base64url → base64 → signed bytes
      → decompressState() → LZMA decompress → JSON string
      → JSON.parse → validateAppState()
    → hasExistingData? → SharedStateDialog (replace/merge/cancel)
    → !hasExistingData? → handleLoadSharedState(state, 'replace')
    → clearUrlHash() via history.replaceState
```

### URL Length Thresholds

| Length | Level | Behavior |
|--------|-------|----------|
| ≤2000 | `none` | No warning |
| 2001–8000 | `caution` | Warning toast about browser compat |
| >8000 | `error` | Error: suggest file export instead |

### Base64url Encoding

LZMA returns signed bytes (-128..127). Encoding: signed → unsigned (+256 if <0) → Uint8Array → binary string → btoa → replace `+`→`-`, `/`→`_`, strip `=`. Decoding reverses: add padding → atob → charCodeAt → signed (-256 if >127).

## JSON Import/Export

### Export Flow

```
ImportExportMenu.handleExport()
  → Read from Zustand stores (dataStore, appStore, tmsStore)
  → JSON.stringify with indent 2
  → Blob download: task-manager-backup-{YYYY-MM-DD}.json
```

Export does NOT include automation rules (unlike URL sharing). Only core AppState: projects, tasks, sections, dependencies, tmsState, settings, version, exportedAt.

### Import Flow

```
ImportExportMenu.handleImportClick() → hidden <input type="file" accept=".json">
  → file.text() → importFromJSON(text)
    → JSON.parse → AppStateSchema.safeParse()
    → throws ImportError on invalid JSON or schema failure
  → Show preview dialog (entity counts)
  → User picks Replace or Merge
```

### Replace Mode

```
repository.replaceAll(importData.{entity})  — for each of 4 entity types
```

Writes through repositories → backend + localStorage + Zustand all sync. No page reload needed.

### Merge Mode

```
1. Read current from dataStore (in-memory)
2. deduplicateEntities(current) → Map by ID → unique existing
3. Build existingIds Set per entity type
4. Filter imported: keep only IDs not in existingIds
5. replaceAll([...deduplicated, ...new]) per entity type
6. Toast: "Merged N items (X duplicates skipped, Y existing duplicates cleaned)"
```

Critical: Merge uses `deduplicateEntities()` on EXISTING data first (cleans pre-existing dupes), then filters incoming. Last-write-wins for same-ID entities in existing data (Map keeps last).

## Deduplication

Pure functions in `deduplicateData.ts`. No store imports — callers pass data in.

| Function | Input | Output |
|----------|-------|--------|
| `deduplicateEntities(collections)` | `{ projects, tasks, sections, dependencies }` | `{ deduplicated, removedCount }` |
| `countDuplicates(collections)` | Same | `{ projects, tasks, sections, dependencies, total }` |

Strategy: `new Map(items.map(i => [i.id, i]))` — last occurrence wins per ID.

## Automation Rule Import

Automation rules live in a separate storage key (`task-management-automations`) and require special handling during import.

### URL Sharing Path

```
ShareService.serializeState(state, { includeAutomations: true })
  → reads automationRuleRepo.findAll()
  → adds automationRules[] to export payload

handleLoadSharedState(state, mode, callback, { includeAutomations })
  → ShareService.importAutomationRules(payload, { includeAutomations })
    → validateImportedRules(rules, availableSectionIds)
      → Check trigger type validity (TriggerTypeSchema)
      → Reset lastEvaluatedAt to null for scheduled triggers
      → Check section references (trigger, filters, actions)
      → Mark broken: enabled=false, brokenReason='section_deleted' | 'unsupported_trigger'
    → automationRuleRepo.create(rule) for each validated rule
```

### JSON Import Path

JSON import does NOT handle automation rules. Only URL sharing includes them.

### Include Automations Checkbox

Both ShareButton and SharedStateDialog show an "Include automations" checkbox (default: checked). Controls whether rules are serialized/imported.

## Project-Scoped Sharing

ShareButton supports sharing a single project via `projectId` prop:

```
Filter: project tasks → project sections → deps where both tasks in project → TMS state filtered to project task IDs
```

TMS filtering: `filterTMSForProject()` keeps only task IDs belonging to the project across DIT (today/tomorrow), AF4 (marked/order), FVP (dotted/currentX).

## Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `ImportExportMenu` | Dropdown: Export, Import, Share All | None (reads stores directly) |
| `ShareButton` | URL share with options dialog | `projectId?`, `variant: 'dropdown' \| 'button'` |
| `SharedStateDialog` | Replace/Merge/Cancel for incoming shared data | `sharedState`, `currentState`, `onConfirm(mode, options)` |

### Integration in App Shell

```
app/page.tsx:
  - ImportExportMenu in header toolbar (always visible)
  - ShareButton embedded inside ImportExportMenu dropdown
  - useSharedStateLoader on mount → opens SharedStateDialog via useDialogManager
  - handleLoadSharedState called on dialog confirm
```

## Error Handling

| Error Type | Enum | When |
|------------|------|------|
| `COMPRESSION_FAILED` | LZMA compress error or init failure |
| `DECOMPRESSION_FAILED` | LZMA decompress error |
| `ENCODING_FAILED` | base64url encode failure |
| `INVALID_DATA` | base64url decode failure |
| `VALIDATION_FAILED` | Zod schema validation fails on import |
| `SERIALIZATION_FAILED` | JSON.stringify failure |
| `CLIPBOARD_FAILED` | Clipboard API unavailable |
| `URL_TOO_LONG` | URL exceeds 8000 chars |

`ShareError` extends `Error` with `type: ShareErrorType` and optional `cause`.
`ImportError` extends `Error` with optional `cause` — thrown by `importFromJSON`.

## LZMA Loading

LZMA loaded dynamically via `<script>` tag injection (`lzma_worker.js`). Respects `<base>` href for path resolution. Creates `window.LZMA` global. Loaded once, cached via `lzmaLoaded` flag. Browser-only — throws if `window` undefined.

Compression mode: `1` (fast, reasonable ratio). Sufficient for task data payloads.

## Public API (Barrel Exports)

```typescript
// Components
ShareButton, SharedStateDialog, ImportExportMenu

// Hooks
useSharedStateLoader, handleLoadSharedState

// Services
ShareService, importFromJSON, validateAppState, ImportError
deduplicateEntities, countDuplicates
```

## Testing

### Unit Tests

| Test File | Coverage |
|-----------|----------|
| `shareService.test.ts` | Serialize, encode/decode round-trip, URL length checks |
| `dataIntegrity.test.ts` | Full round-trip: serialize → import, special chars, unicode, nulls, empty state |
| `importExport.test.ts` | JSON parse, Zod validation, error cases |
| `deduplicateData.test.ts` | Dedup by ID, count duplicates |
| `projectSharing.test.ts` | Project-scoped sharing, TMS filtering |
| `useSharedStateLoader.test.ts` | Hook behavior, hash detection |

### E2E

`e2e/share-dialog.spec.ts` — end-to-end share dialog workflow.

### Manual Test Scenarios

1. Share URL: Generate → copy → paste in new tab → verify dialog shows → Replace → verify data
2. Merge: Have existing data → load share URL → Merge → verify no data loss, dupes skipped
3. JSON round-trip: Export → clear data → Import (Replace) → verify identical
4. Project share: Share single project → load → verify only that project's data
5. Automation rules: Share with automations → import → verify rules present, broken ones disabled

## Key Files

| File | Description |
|------|-------------|
| `features/sharing/services/shareService.ts` | Core: LZMA compress/decompress, URL encode/decode, serialize, clipboard |
| `features/sharing/services/importExport.ts` | JSON parse + Zod validation (`importFromJSON`, `validateAppState`) |
| `features/sharing/services/deduplicateData.ts` | Pure dedup functions (`deduplicateEntities`, `countDuplicates`) |
| `features/sharing/hooks/useSharedStateLoader.ts` | URL hash detection on mount + hashchange, orchestrates load flow |
| `features/sharing/components/ShareButton.tsx` | URL share UI with project-scoped support |
| `features/sharing/components/SharedStateDialog.tsx` | Replace/Merge/Cancel dialog for incoming data |
| `features/sharing/components/ImportExportMenu.tsx` | Dropdown menu: Export JSON, Import JSON, Share URL |
| `features/sharing/types/lzma.d.ts` | TypeScript declarations for LZMA module |
| `features/sharing/index.ts` | Barrel exports (public API) |
| `features/automations/services/rules/ruleImportExport.ts` | `validateImportedRules` — section ref validation for imported rules |

## References

### Source Files
- `features/sharing/services/shareService.ts` — LZMA compression, URL encoding, state serialization
- `features/sharing/services/importExport.ts` — JSON import with Zod validation
- `features/sharing/services/deduplicateData.ts` — Pure entity deduplication
- `features/sharing/hooks/useSharedStateLoader.ts` — URL hash loader hook
- `features/sharing/components/ShareButton.tsx` — Share URL generation UI
- `features/sharing/components/SharedStateDialog.tsx` — Replace/merge dialog
- `features/sharing/components/ImportExportMenu.tsx` — Export/import/share dropdown
- `features/automations/services/rules/ruleImportExport.ts` — Rule validation on import
- `app/page.tsx` — App shell integration (ImportExportMenu, SharedStateDialog, useSharedStateLoader)
- `app/hooks/useDialogManager.ts` — SharedStateDialog state management

### Related Context Docs
- [core-infrastructure.md](core-infrastructure.md) — Repository pattern, LocalStorageBackend, Zod schemas
- [stores.md](stores.md) — dataStore CRUD actions that sharing writes through
- [tms.md](tms.md) — TMS state export/import, filterTMSForProject() scoping
