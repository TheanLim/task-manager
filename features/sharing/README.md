# Sharing Feature

Export/import application state via LZMA-compressed URLs, JSON file import/export, and replace/merge workflows.

## Quick Reference

| File | Role |
|---|---|
| `services/shareService.ts` | `ShareService` — serialize, compress (LZMA), encode (base64url), generate URL, import automation rules |
| `services/importExport.ts` | `importFromJSON()` and `validateAppState()` — JSON parsing + Zod validation for data import |
| `services/deduplicateData.ts` | Pure `deduplicateEntities()` and `countDuplicates()` — ID-based dedup for merge workflows |
| `hooks/useSharedStateLoader.ts` | `useSharedStateLoader` — detects `#share=` in URL on mount/hashchange, loads shared state |
| `components/ShareButton.tsx` | UI trigger for generating a share URL |
| `components/SharedStateDialog.tsx` | Replace/merge/cancel dialog when user has existing data |
| `components/ImportExportMenu.tsx` | Dropdown menu for JSON export/import + share button |
| `types/lzma.d.ts` | Type declaration for the LZMA compression library |
| `index.ts` | Barrel export — public API for external consumers |

## Architecture

```
┌──────────────────────────────────────────────────┐
│  ShareService                                    │
│                                                  │
│  generateShareURL(state?, options?)              │
│    1. serializeState() → JSON (+ exportedAt)     │
│    2. compressState() → LZMA byte array          │
│    3. encodeForURL() → base64url string          │
│    4. Build URL: origin/path#share=<encoded>     │
│    5. checkURLLength() → warning levels          │
│                                                  │
│  loadSharedState()                               │
│    1. extractHashData() → encoded string         │
│    2. decodeFromURL() → signed byte array        │
│    3. decompressState() → JSON string            │
│    4. JSON.parse + validateState()               │
│                                                  │
│  importAutomationRules(payload, options?)         │
│    1. Extract sections + rules from payload      │
│    2. validateImportedRules() — mark broken      │
│    3. Create each rule via automationRuleRepo    │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  useSharedStateLoader                            │
│                                                  │
│  On mount + hashchange:                          │
│    • Wait 100ms for Zustand hydration            │
│    • Call shareService.loadSharedState()          │
│    • If user has existing data → onSharedState   │
│      Loaded (show dialog)                        │
│    • If no data → handleLoadSharedState(replace) │
│                                                  │
│  handleLoadSharedState(state, mode, callback)    │
│    • replace: replaceAll() on all repositories   │
│    • merge: deduplicate + add new entities       │
│    • cancel: just clear URL hash                 │
│    • Then import automation rules if included    │
│    • Clear #share= from URL                      │
└──────────────────────────────────────────────────┘
```

## Import/Export Flow

`ImportExportMenu` handles JSON file export/import:
- Export: reads current state from Zustand stores, serializes to JSON, downloads as `.json`
- Import (replace): `importFromJSON()` validates, then `repository.replaceAll()` for each entity type
- Import (merge): `deduplicateEntities()` cleans existing data, filters new entities by ID, writes merged result via `repository.replaceAll()`
