# Automations Feature

Rule-based automation engine that executes actions when domain events occur. Users create "if this, then that" rules scoped to a project — when a trigger fires and optional filters pass, the system executes the configured action.

## Quick Reference

| Concept | Location |
|---------|----------|
| Data model & Zod schemas | `schemas.ts`, `types.ts` |
| Domain event pub/sub | `events.ts` (re-exports from `lib/events/`) |
| Rule evaluation (pure) | `services/ruleEngine.ts` |
| Action execution | `services/ruleExecutor.ts` |
| Undo snapshot management | `services/undoService.ts` |
| Orchestrator | `services/automationService.ts` |
| Date calculations | `services/dateCalculations.ts` |
| Filter predicates | `services/filterPredicates.ts` |
| Repository (localStorage) | `repositories/localStorageAutomationRuleRepository.ts` |
| React hook | `hooks/useAutomationRules.ts` |
| Rule creation wizard | `components/RuleDialog.tsx` |
| Rule list UI | `components/AutomationTab.tsx`, `components/RuleCard.tsx` |

## Architecture Overview

```
User Action (move task, complete task, etc.)
    │
    ▼
Data Store (stores/dataStore.ts)
    │  emitDomainEvent()
    │  wrapped in beginBatch() / endBatch()
    ▼
AutomationService.handleEvent()
    │
    ├─ evaluateRules() — pure function, matches triggers + filters
    │
    ├─ RuleExecutor.executeActions() — applies actions via repositories
    │     └─ Pushes execution log entry (last 20 kept)
    │
    ├─ Captures undo snapshot (in-memory, 10s expiry, depth 0 only)
    │
    ├─ Dedup check (ruleId:entityId:actionType)
    │
    ├─ Cascade: new events → recursive handleEvent() up to depth 5
    │
    └─ Toast notification (batch-aggregated or individual)
```

## Trigger Types

| Trigger | Event | Section Required |
|---------|-------|-----------------|
| `card_moved_into_section` | `task.updated` (sectionId changed) | Yes |
| `card_moved_out_of_section` | `task.updated` (sectionId changed) | Yes |
| `card_marked_complete` | `task.updated` (completed: false→true) | No |
| `card_marked_incomplete` | `task.updated` (completed: true→false) | No |
| `card_created_in_section` | `task.created` | Yes |
| `section_created` | `section.created` | No |
| `section_renamed` | `section.updated` (name changed) | No |

## Action Types

| Action | What It Does |
|--------|-------------|
| `move_card_to_top_of_section` | Sets task.sectionId, order = min - 1 |
| `move_card_to_bottom_of_section` | Sets task.sectionId, order = max + 1 |
| `mark_card_complete` | Calls TaskService.cascadeComplete(true) |
| `mark_card_incomplete` | Calls TaskService.cascadeComplete(false) |
| `set_due_date` | Calculates date from RelativeDateOption, sets task.dueDate |
| `remove_due_date` | Sets task.dueDate = null |
| `create_card` | Creates a new task in the target section |

## Filter System

Filters are optional conditions evaluated after trigger matching but before action execution. Multiple filters use AND logic. Empty filters array matches all tasks.

Categories: section membership (`in_section`, `not_in_section`), date presence (`has_due_date`, `no_due_date`), relative date ranges (`due_today`, `due_this_week`, etc.) and their negations (`not_due_today`, `not_due_this_week`, etc.), comparison (`due_in_less_than`, `due_in_more_than`, `due_in_exactly`, `due_in_between` with N days/working_days), and overdue status (`is_overdue`).

## Storage

- Rules persist to `localStorage['task-management-automations']` as a flat JSON array
- Separate from the main app state (`task-management-data`) to avoid bloating Zustand persist
- The repository has its own subscription mechanism for reactive UI updates
- Schema migrations run on load (adds missing fields with defaults)

## Loop Protection

1. Max cascade depth: 5 (configurable via AutomationService constructor)
2. Dedup set: `ruleId:entityId:actionType` keys prevent the same action from firing twice in one cascade chain
3. Depth resets for each new user-initiated action (depth 0)
4. Subtask exclusion: `evaluateRules` skips events where the entity's `parentTaskId` is non-null

## Key Design Decisions

See [DECISIONS.md](./DECISIONS.md) for rationale behind architectural choices.

## Extending This Feature

See [EXTENDING.md](./EXTENDING.md) for how to add new triggers, actions, filters, or UI components.

## Known Limitations

- Undo only supports the most recent execution (single-level, 10s window, in-memory only)
- Undo for mark_complete/incomplete includes cascade-reverting subtasks via `subtaskSnapshots`
- Max 20 execution log entries per rule (trimmed on push)
- Automations only fire on top-level tasks — subtask events are skipped by the rule engine
- No scheduled/timer-based triggers (deferred to Phase 5+)
- No multi-action rules or conditional branching (deferred)
- No global cross-project rules (deferred)
- Drag-and-drop reordering uses @dnd-kit — e2e testing of drag is unreliable
