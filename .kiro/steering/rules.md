---
name: rules
description: Non-negotiable project rules 
inclusion: always
---

# Architecture Rules

## Anti-Patterns

1. **No business logic in Zustand stores** — Stores are UI state + read-through caches only. Cascade deletes, default entity creation, ordering rules go in the service layer.
2. **No direct store imports in domain logic** — Services, handlers, and utilities must not import `useTMSStore`, `useDataStore`, etc. Pass state in, return state deltas out.
3. **No hand-rolled validation** — Use Zod schemas for runtime validation. Do not write manual `typeof` / `Array.isArray` checks for domain entities. Keep ID schemas as `z.string().min(1)` (not `.uuid()`) since section IDs and seed data use non-UUID formats.
4. **No whole-blob storage interfaces** — Use per-entity repository interfaces with granular CRUD, not `load(): AppState` / `save(state: AppState)`.
5. **No inline entity construction in components** — Centralize `new Date().toISOString()` and `uuidv4()` calls in services, not scattered across UI code.
6. **Trace all call sites when adding optional parameters** — When adding optional parameters to constructors or functions, grep for ALL existing call sites (`new ClassName(`, `functionName(`) and verify each one passes the new parameter where needed. Optional params that default to `undefined` cause silent degradation.


