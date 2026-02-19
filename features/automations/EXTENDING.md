# Extending the Automations Feature

Step-by-step guides for common extension scenarios.

## Adding a New Trigger Type

1. **Schema** (`schemas.ts`): Add the new value to `TriggerTypeSchema` enum
2. **Metadata** (`services/ruleMetadata.ts`): Add the trigger to `TRIGGER_META` array with category, label, and `needsSection` flag
3. **Rule Engine** (`services/ruleEngine.ts`): Add matching logic in `evaluateRules()` — determine which event type and field changes correspond to the new trigger
4. **Domain Events**: Ensure the relevant domain event is emitted from `stores/dataStore.ts` (or the appropriate service). The event must include `changes` and `previousValues`
5. **UI — Trigger Step** (`components/RuleDialogStepTrigger.tsx`): Add the trigger option to the appropriate group (Card Move, Card Change, Section Change)
6. **Preview** (`services/rulePreviewService.ts`): Update `buildTriggerParts()` for the natural language sentence
7. **Section references**: If the new trigger carries a `sectionId`, verify `sectionReferenceCollector.ts` already handles it (it walks `trigger.sectionId` generically, so no change needed unless the field name differs)
8. **Tests**: Add property test in `ruleEngine.test.ts`, update schema tests, update preview tests

## Adding a New Action Type

1. **Schema** (`schemas.ts`): Add the new value to `ActionTypeSchema` enum
2. **Metadata** (`services/ruleMetadata.ts`): Add the action to `ACTION_META` array with category, label, and capability flags
3. **Action Handler** (`services/actionHandlers.ts`): Create a handler object implementing `ActionHandler` (execute, describe, undo) and register it in `ACTION_HANDLER_REGISTRY`. RuleExecutor, undoService, and description generation all pick it up automatically
4. **UI — Action Step** (`components/RuleDialogStepAction.tsx`): Add the action option to the appropriate group (Move, Status, Dates, Create)
5. **Preview** (`services/rulePreviewService.ts`): Update `buildActionParts()` for the natural language sentence
6. **Tests**: Add handler tests in `actionHandlers.test.ts`, preview tests, schema tests

## Adding a New Filter Type

1. **Schema** (`schemas.ts`): Add a new entry to the `CardFilterSchema` discriminated union
2. **Predicate** (`services/filterPredicates.ts`): Add the evaluation logic to `filterPredicateMap`. For date-range filters that need a negated counterpart, use `createNegatedFilter('positive_key')` instead of writing the negation by hand
3. **Section references**: If the new filter carries a `sectionId`, update `sectionReferenceCollector.ts` to include it (currently handles `in_section` and `not_in_section`)
4. **UI — Filter Row** (`components/FilterRow.tsx`): Add rendering for the new filter type's controls
5. **UI — Filter Step** (`components/RuleDialogStepFilters.tsx`): Add the filter to the "+ Add filter" dropdown menu
6. **Preview** (`services/rulePreviewService.ts`): Update `formatFilterDescription()` for the natural language description. This function is the single source of truth for filter-to-text mapping — used by both the preview sentence and the Review step badges.
7. **Tests**: Add predicate property tests, schema round-trip tests, UI tests

## Adding a New Date Option

1. **Schema** (`schemas.ts`): Add the new value to `RelativeDateOptionSchema` enum
2. **Calculation** (`services/dateCalculations.ts`): If the new option follows an existing pattern (e.g., `day_of_month_N`, `next_<weekday>`, `<ordinal>_<weekday>_of_month`), the data-driven parser in `calculateRelativeDate()` handles it automatically. Otherwise, add a new branch before the exhaustive check
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

## Adding a New Scheduled Trigger Type

Scheduled triggers differ from event triggers — they generate domain events (via SchedulerService) rather than responding to them.

1. **Schema** (`schemas.ts`): Add the new value to `ScheduledTriggerTypeSchema` (this automatically extends `TriggerTypeSchema`). Add a new variant to the `TriggerSchema` discriminated union with `schedule`, `lastEvaluatedAt`, and `sectionId: z.null()`
2. **Schedule Config**: If the trigger needs a new schedule kind, add a schema to `ScheduleConfigSchema` discriminated union
3. **Evaluator** (`services/scheduleEvaluator.ts`): Add a new `evaluate*Schedule()` pure function and a case in `evaluateScheduledRules()` switch
4. **Metadata** (`services/ruleMetadata.ts`): Add to `TRIGGER_META` with `category: 'scheduled'` and `needsSchedule: true`
5. **Rule Engine** (`services/ruleEngine.ts`): The `schedule.fired` branch already dispatches by `triggerType` — new scheduled triggers are matched automatically if they follow the interval/cron/due-date-relative pattern
6. **UI — Config Panel** (`components/ScheduleConfigPanel.tsx`): Add a new config sub-component for the trigger type
7. **Preview** (`services/rulePreviewService.ts`): Update `describeSchedule()` and `computeNextRunDescription()`
8. **Tests**: Add property tests for the evaluator, schema round-trip tests, and component tests
