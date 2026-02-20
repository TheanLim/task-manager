# Extending the Automations Feature

Step-by-step guides for common extension scenarios. All paths are relative to `features/automations/`.

## Adding a New Trigger Type

1. **Schema** (`schemas.ts`): Add the new value to `TriggerTypeSchema` enum
2. **Metadata** (`services/preview/ruleMetadata.ts`): Add to `TRIGGER_META` with category, label, `needsSection`
3. **Rule Engine** (`services/evaluation/ruleEngine.ts`): Add matching logic in `evaluateRules()`
4. **Domain Events**: Ensure the relevant event is emitted from `stores/dataStore.ts`
5. **UI — Trigger Step** (`components/wizard/RuleDialogStepTrigger.tsx`): Add the trigger option
6. **Preview** (`services/preview/rulePreviewService.ts`): Update `buildTriggerParts()`
7. **Wizard validation**: If the trigger needs a section, `useWizardState.ts` validation handles it automatically via `TRIGGER_META.needsSection`. If it's a section-level trigger that should skip filters, add it to the `sectionLevelTriggers` array in `useWizardState.ts`
8. **Section references**: If the trigger carries a `sectionId`, verify `services/rules/sectionReferenceCollector.ts` handles it
9. **Tests**: Property test in `ruleEngine.test.ts`, schema tests, preview tests

## Adding a New Action Type

1. **Schema** (`schemas.ts`): Add the new value to `ActionTypeSchema` enum
2. **Metadata** (`services/preview/ruleMetadata.ts`): Add to `ACTION_META` with category, label, capability flags
3. **Action Handler** (`services/execution/actionHandlers.ts`): Create a handler implementing `ActionHandler` (execute, describe, undo) and register in `ACTION_HANDLER_REGISTRY`
4. **UI — Action Step** (`components/wizard/RuleDialogStepAction.tsx`): Add the action option
5. **Preview** (`services/preview/rulePreviewService.ts`): Update `buildActionParts()`
6. **Save Service** (`services/rules/ruleSaveService.ts`): If the action has new fields, update `buildActionObject()` to include them
7. **Tests**: Handler tests in `actionHandlers.test.ts`, preview tests, schema tests

## Adding a New Filter Type

1. **Schema** (`schemas.ts`): Add a new entry to the `CardFilterSchema` discriminated union
2. **Predicate** (`services/evaluation/filterPredicates.ts`): Add logic to `filterPredicateMap`. Use `createNegatedFilter('positive_key')` for negated counterparts
3. **Section references**: If the filter carries a `sectionId`, update `services/rules/sectionReferenceCollector.ts`
4. **UI — Filter Row** (`components/FilterRow.tsx`): Add rendering for the new filter's controls
5. **UI — Filter Step** (`components/wizard/RuleDialogStepFilters.tsx`): Add to the "+ Add filter" dropdown
6. **Preview** (`services/preview/formatters.ts`): Update `formatFilterDescription()`
7. **Tests**: Predicate property tests, schema round-trip tests, UI tests

## Adding a New Date Option

1. **Schema** (`schemas.ts`): Add the new value to `RelativeDateOptionSchema` enum
2. **Calculation** (`services/evaluation/dateCalculations.ts`): If the option follows an existing pattern (`day_of_month_N`, `next_<weekday>`, `<ordinal>_<weekday>_of_month`), the data-driven parser handles it automatically. Otherwise add a new branch
3. **UI** (`components/DateOptionSelect.tsx`): Add to the appropriate group
4. **Tests**: Date calculation tests with property-based verification

## Adding a New Scheduled Trigger Type

1. **Schema** (`schemas.ts`): Add to `ScheduledTriggerTypeSchema`. Add a new variant to `TriggerSchema` with `schedule`, `lastEvaluatedAt`, `sectionId: z.null()`
2. **Schedule Config**: If needed, add a schema to `ScheduleConfigSchema` discriminated union
3. **Evaluator** (`services/scheduler/scheduleEvaluator.ts`): Add a pure `evaluate*Schedule()` function and a case in `evaluateScheduledRules()`
4. **Metadata** (`services/preview/ruleMetadata.ts`): Add to `TRIGGER_META` with `category: 'scheduled'`, `needsSchedule: true`
5. **Rule Engine** (`services/evaluation/ruleEngine.ts`): The `schedule.fired` branch dispatches by `triggerType` — new types are matched automatically
6. **UI — Config Component**: Create a new `components/schedule/MyNewConfig.tsx` component (follow `IntervalConfig.tsx` as a template). Then add a routing branch in `ScheduleConfigPanel.tsx`
7. **Preview** (`services/preview/scheduleDescriptions.ts`): Update `describeSchedule()` and `computeNextRunDescription()`
8. **Tests**: Property tests for evaluator, schema round-trip tests, component tests

## Wiring a New Data Store Mutation

When adding a mutation to `stores/dataStore.ts` that should trigger automations:

1. Capture `previousValues` BEFORE the mutation
2. Wrap in `automationService.beginBatch()` / `automationService.endBatch()`
3. Call `emitDomainEvent()` with correct event type, changes, previousValues
4. Set `depth: 0` for user-initiated events

```typescript
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

| File | What It Does |
|------|-------------|
| `stores/dataStore.ts` | Instantiates AutomationService, wraps mutations in batch mode, calls detectBrokenRules on section delete |
| `app/page.tsx` | Wires toast notifications via callback, includes Undo button logic |
| `lib/serviceContainer.ts` | Creates singletons: RuleExecutor, AutomationService, SchedulerService, BulkScheduleService |
| `features/projects/services/projectService.ts` | Cascade-deletes automation rules on project delete |
| `features/projects/services/sectionService.ts` | Calls `detectBrokenRules` on section delete |
| `features/projects/components/ProjectView.tsx` | Renders AutomationTab and RuleDialog (from `wizard/`) |
| `features/sharing/services/shareService.ts` | Serializes/imports automation rules |
| `features/tasks/components/TaskList.tsx` | Renders SectionContextMenuItem in section header |
| `features/tasks/components/TaskBoard.tsx` | Renders SectionContextMenuItem in column header |

## Testing Checklist

- [ ] Zod schema validates the new data shape (round-trip property test)
- [ ] Service-layer logic has unit tests with edge cases
- [ ] Property-based tests verify universal invariants (fast-check, 100+ iterations)
- [ ] Component tests verify UI rendering and interactions
- [ ] `npx vitest run` — all pass
- [ ] `npm run lint` — no issues
- [ ] If `.tsx` files changed, `npx next build` — catches SWC/Webpack errors
- [ ] If constructor optional params changed, grep ALL call sites (steering rule #6)
