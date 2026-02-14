---
name: rules
description: Non-negotiable project rules 
inclusion: always
---

# Architecture Rules

## Anti-Patterns

1. **No business logic in Zustand stores** — Stores are UI state + read-through caches only. Cascade deletes, default entity creation, ordering rules go in the service layer.
2. **No direct store imports in domain logic** — Services, handlers, and utilities must not import `useTMSStore`, `useDataStore`, etc. Pass state in, return state deltas out.
3. **No hand-rolled validation** — Use Zod schemas for runtime validation. Do not write manual `typeof` / `Array.isArray` checks for domain entities.
4. **No whole-blob storage interfaces** — Use per-entity repository interfaces with granular CRUD, not `load(): AppState` / `save(state: AppState)`.
5. **No inline entity construction in components** — Centralize `new Date().toISOString()` and `uuidv4()` calls in services, not scattered across UI code.

## Impact Analysis Before Changes

Before modifying any function or interface, use code-cerebro to analyze its callers (`analyze_caller_tree`) and callees (`analyze_call_tree`). Verify all call sites are accounted for. After the change, re-check to confirm nothing was missed.

## Steering Doc Maintenance

Update `.kiro/steering/` docs in the same pass when a change:
- Contradicts or invalidates existing steering guidance
- Introduces new patterns, conventions, or architectural decisions worth preserving
- Renders examples or references in steering docs stale

After editing any steering file, run `wc -l` to verify it stays within limits: `always` ≤ 30, `auto` ≤ 60, `manual` ≤ 80.
