# Sharing Feature — Design Decisions

## LZMA Compression for URL Sharing

**Decision**: Use LZMA (via `lzma_worker.js` loaded as a `<script>` tag) at compression level 1.

**Why**: Application state as JSON can be large. LZMA provides significantly better compression ratios than gzip/deflate for structured text, keeping share URLs within browser limits. Level 1 (fast) balances compression ratio with speed for interactive use.

**Trade-off**: Adds a runtime dependency on a global `window.LZMA` object loaded via script injection. The library is loaded lazily on first share/load operation.

**URL length thresholds**: >2000 chars triggers a caution warning (some services truncate), >8000 chars triggers an error (browser limits).

## ShareService Accepts Optional automationRuleRepository

**Decision**: `ShareService` constructor takes an optional `AutomationRuleRepository` parameter. Automation rules are only exported/imported when this dependency is explicitly provided.

**Why**: ShareService lives in `features/sharing/` and must not hard-depend on `features/automations/`. Making the repo optional keeps the dependency boundary clean — callers that don't care about automations can use ShareService without it. The `includeAutomations` option (default `true`) provides runtime control.

**Consequence**: Callers that want automation rule import/export must pass the repository at construction time. The hook `handleLoadSharedState` creates a new `ShareService(undefined, automationRuleRepository)` specifically for the import step.

## Import Validates Section References for Automation Rules

**Decision**: On import, each automation rule's section references (trigger, action, filters) are checked against the set of section IDs present in the imported data. Rules referencing missing sections are marked `enabled: false` with `brokenReason: 'section_deleted'`.

**Why**: Automation rules reference sections by ID. If a rule references a section that doesn't exist in the imported dataset (e.g., partial export, or sections were deleted before sharing), executing that rule would fail silently or produce unexpected behavior. Marking them as broken makes the problem visible to the user while preserving the rule for manual repair.

**Implementation**: `validateImportedRules()` in `features/automations/services/ruleImportExport.ts` handles the validation. It collects all section IDs from trigger, action, and filter fields, then checks each against the available set.

## Deduplication on Import (Merge Mode)

**Decision**: Merge mode deduplicates entities by ID. Existing entities are preserved; only entities with new IDs are added. Existing duplicates within the current dataset are also cleaned.

**Why**: Without deduplication, repeated imports would create duplicate projects, tasks, sections, and dependencies. ID-based dedup is deterministic and avoids the complexity of content-based matching. The merge also opportunistically cleans pre-existing duplicates in the user's data.

**Reporting**: The merge result message reports three counts — added items, skipped duplicates (from import), and cleaned duplicates (pre-existing) — so the user understands exactly what happened.
