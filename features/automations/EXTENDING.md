# Extending the Automations Feature

Step-by-step guides for common extension scenarios.

## Adding a New Trigger Type

1. **Schema** (`schemas.ts`): Add the new value to `TriggerTypeSchema` enum
2. **Rule Engine** (`services/ruleEngine.ts`): Add matching logic in `evaluateRules()` — determine which event type and field changes correspond to the new trigger
3. **Domain Events**: Ensure the relevant domain event is emitted from `stores/dataStore.ts` (or the appropriate service). The event must include `changes` and `previousValues`
4. **UI — Trigger Step** (`components/RuleDialogStepTrigger.tsx`): Add the trigger option to the appropriate group (Card Move, Card Change, Section Change)
5. **Preview** (`services/rulePreviewService.ts`): Add the trigger to `TRIGGER_META` array and update `buildPreviewParts()` for the natural language sentence
6. **Tests**: Add property test in `ruleEngine.test.ts`, update schema tests, update preview tests

## Adding a New Action Type

1. **Schema** (`schemas.ts`): Add the new value to `ActionTypeSchema` enum
2. **Rule Executor** (`services/ruleExecutor.ts`): Add a new `private executeXxx()` method and wire it into the `switch` in `executeAction()`. Use `emitTaskUpdatedEvent()` for the domain event and `executeMoveToSection()` if the action involves moving tasks
3. **Undo** (`services/automationService.ts`): Add the new action type to the `switch` in `performUndo()`. Capture the appropriate `previousState` fields in `buildUndoSnapshot()`
4. **UI — Action Step** (`components/RuleDialogStepAction.tsx`): Add the action option to the appropriate group (Move, Status, Dates, Create)
5. **Preview** (`services/rulePreviewService.ts`): Add the action to `ACTION_META` array and update `buildPreviewParts()`
6. **Execution Log** (`services/ruleExecutor.ts`): Update `getActionDescription()` for the human-readable log entry
7. **Tests**: Add executor tests, undo tests, preview tests, schema tests

## Adding a New Filter Type

1. **Schema** (`schemas.ts`): Add a new entry to the `CardFilterSchema` discriminated union
2. **Predicate** (`services/filterPredicates.ts`): Add the evaluation logic to `filterPredicateMap`. For date-range filters that need a negated counterpart, use `createNegatedFilter('positive_key')` instead of writing the negation by hand
3. **UI — Filter Row** (`components/FilterRow.tsx`): Add rendering for the new filter type's controls
4. **UI — Filter Step** (`components/RuleDialogStepFilters.tsx`): Add the filter to the "+ Add filter" dropdown menu
5. **Preview** (`services/rulePreviewService.ts`): Update `formatFilterDescription()` for the natural language description
6. **Tests**: Add predicate property tests, schema round-trip tests, UI tests

## Adding a New Date Option

1. **Schema** (`schemas.ts`): Add the new value to `RelativeDateOptionSchema` enum
2. **Calculation** (`services/dateCalculations.ts`): Add the calculation logic in `calculateRelativeDate()`
3. **UI** (`components/DateOptionSelect.tsx`): Add the option to the appropriate group in the select dropdown
4. **Tests**: Add date calculation tests with property-based verification

## Wiring a New Data Store Mutation

When adding a new mutation to `stores/dataStore.ts` that should trigger automations:

1. Capture `previousValues` BEFORE the mutation
2. Wrap the domain event emission in `automationService.beginBatch()` / `automationService.endBatch()`
3. Call `emitDomainEvent()` with the correct event type, changes, and previousValues
4. Set `depth: 0` for user-initiated events

```typescript
// Example pattern:
myNewMutation: (id, updates) => {
  const previous = repository.findById(id);
  if (!previous) return;
  
  repository.update(id, updates);
  
  automationService.beginBatch();
  emitDomainEvent({
    type: 'task.updated',
    entityId: id,
    projectId: previous.projectId || '',
    changes: updates,
    previousValues: previous,
    depth: 0,
  });
  automationService.endBatch();
},
```

## Integration Points Outside This Feature

These files outside `features/automations/` have automation-related code:

| File | What It Does |
|------|-------------|
| `stores/dataStore.ts` | Instantiates AutomationService, wraps mutations in batch mode, calls detectBrokenRules on section delete, subscribes to domain events |
| `app/page.tsx` | Wires toast notifications via `setRuleExecutionCallback`, includes Undo button logic |
| `features/projects/services/projectService.ts` | Cascade-deletes automation rules on project delete |
| `features/projects/components/ProjectView.tsx` | Manages section context menu → RuleDialog state, passes onShowToast to AutomationTab |
| `features/projects/components/ProjectTabs.tsx` | Renders automation rule count badge and max-rules warning icon |
| `features/sharing/services/shareService.ts` | Serializes/imports automation rules in export/import flow |
| `features/sharing/components/ShareButton.tsx` | Passes automationRuleRepository to ShareService, shows "Include automations" checkbox |
| `features/sharing/components/SharedStateDialog.tsx` | Shows automation rule count and "Include automations" checkbox on import |
| `features/sharing/hooks/useSharedStateLoader.ts` | Calls ShareService.importAutomationRules on shared state load |
| `features/tasks/components/TaskList.tsx` | Renders SectionContextMenuItem in section header dropdown |
| `features/tasks/components/TaskBoard.tsx` | Renders SectionContextMenuItem in column header dropdown |

## Testing Checklist

When extending, ensure:

- [ ] Zod schema validates the new data shape (round-trip property test)
- [ ] Service-layer logic has unit tests with edge cases
- [ ] Property-based tests verify universal invariants (fast-check, 100+ iterations)
- [ ] Component tests verify UI rendering and interactions
- [ ] Existing tests still pass (`npx vitest run`)
- [ ] Lint passes (`npm run lint`)
- [ ] If you modified a constructor's optional params, grep ALL call sites (steering rule #6)
