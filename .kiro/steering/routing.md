---
inclusion: always
---
# Agent Routing & Subsystem Index

## Subsystem Index

| Subsystem | Steering Doc | Key Paths |
|-----------|-------------|-----------|
| Architecture rules | `rules.md` | `lib/`, `stores/`, `features/` |
| Testing | `testing.md` | `**/*.test.ts`, `**/*.test.tsx`, `vitest.config.ts` |
| Cross-feature safety | `cross-feature.md` | `lib/serviceContainer.ts`, `lib/events/`, `lib/repositories/`, `lib/schemas.ts` |
| Automations | `automations.md` | `features/automations/` |
| Tasks & Projects | `tasks.md` | `features/tasks/`, `features/projects/` |
| Sharing | `sharing.md` | `features/sharing/` |
| Keyboard navigation | `keyboard.md` | `features/keyboard/` |
| TMS (time mgmt) | `tms.md` | `features/tms/` |
| Stores & State | `stores.md` | `stores/`, `lib/repositories/` |

## Post-Change Triggers

After modifying files in these paths, review the corresponding docs:

| After modifying... | Check |
|--------------------|-------|
| `lib/serviceContainer.ts` | Cross-feature safety — constructor signatures, DI wiring |
| `lib/schemas.ts` | Cross-feature safety — localStorage, import/export, share URLs |
| `lib/events/**` | Cross-feature safety — domain event types, automation triggers |
| `lib/repositories/types.ts` | Cross-feature safety — all repo implementations + test mocks |
| `features/automations/services/**` | Automations steering doc |
| `features/tasks/services/**` | Tasks steering doc |

## Agent Growth Triggers

When any of these patterns occur, use `agent-factory` to create a new domain subagent:
- You make the same category of mistake twice in a subsystem (e.g., forgot Zod validation, broke a naming convention)
- A code review catches 3+ issues in the same domain area
- You spend significant time exploring a subsystem before making changes (the knowledge should be codified)
- A subsystem has no steering doc AND no subagent but is HIGH priority in subsystem-map.json

When a subsystem grows complex enough that its patterns don't fit in the constitution, use `context-factory` to create a fileMatch steering doc.

## Post-Feature Checklist

After structural changes:
- [ ] Update relevant fileMatch steering docs
- [ ] Update subsystem-map.json if files added/renamed
- [ ] Update constitution.md if new conventions introduced
