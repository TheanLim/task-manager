# features/ — Feature Modules

Each subdirectory is a self-contained feature with its own components, services, hooks, and types.

## Standard Feature Structure

```
features/<name>/
├── index.ts              # Barrel export — public API only
├── types.ts              # Feature-specific types
├── schemas.ts            # Zod schemas (if feature has validated entities)
├── components/           # React components + co-located tests
├── hooks/                # React hooks (if needed)
├── services/             # Business logic, pure functions, service classes
├── stores/               # Zustand stores (if feature has local state)
├── repositories/         # Feature-specific repos (if domain-specific persistence)
├── handlers/             # Strategy/handler objects (e.g., TMS)
├── README.md             # Feature overview
└── DECISIONS.md          # Architecture decisions log
```

## Conventions

- Every feature has `index.ts` (barrel), `README.md`, and `components/`.
- `hooks/`, `services/`, `stores/`, `repositories/`, `handlers/` are created only when needed.
- No loose `.ts` files at the feature root except `index.ts`, `types.ts`, `schemas.ts`.
- Tests are co-located with their source files.
- Cross-feature imports should go through barrel exports (`@/features/X`) when possible.

## Feature Inventory

| Feature | Purpose |
|---|---|
| `automations` | Rule-based automation engine — "if this, then that" rules scoped to projects |
| `keyboard` | Keyboard navigation, shortcuts, and shortcut customization |
| `projects` | Project CRUD, sections, and project-level views |
| `sharing` | URL sharing (LZMA), JSON import/export, deduplication |
| `tasks` | Task CRUD, hierarchy, dependencies, sorting, filtering, views |
| `tms` | Time management strategies (DIT, AF4, FVP) |

## Cross-Feature Dependencies

```
projects → tasks, automations, sharing
tasks    → automations (SectionContextMenuItem), keyboard
sharing  → automations (optional repo for rule import/export)
```

Domain events (`lib/events/`) are the primary decoupling mechanism between features.
