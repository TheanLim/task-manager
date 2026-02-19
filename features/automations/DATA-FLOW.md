# Data Flow & Debugging Guide

How data moves through the automation system. Use this when debugging why a rule didn't fire, fired unexpectedly, or produced wrong results.

## End-to-End Flow: User Moves a Task

```
1. User drags task from "To Do" to "Done" (board view)
   └─ TaskBoard calls onTaskMove(taskId, sectionId)

2. Data store updateTask(id, { sectionId: 'done-section' })
   ├─ Captures previousTask = taskRepository.findById(id)
   ├─ taskRepository.update(id, { sectionId, updatedAt })
   ├─ automationService.beginBatch()
   ├─ emitDomainEvent({
   │     type: 'task.updated',
   │     entityId: taskId,
   │     changes: { sectionId: 'done-section' },
   │     previousValues: { sectionId: 'todo-section' },
   │     depth: 0
   │   })
   └─ automationService.endBatch()

3. Domain event subscriber → automationService.handleEvent(event)
   ├─ Depth check: 0 < 5 ✓
   ├─ ruleRepo.findByProjectId(projectId) → [rule1, rule2, ...]
   ├─ evaluateRules(event, rules, context)
   │     ├─ buildRuleIndex(rules) → Map<TriggerType, Rule[]>
   │     │     └─ Filters: enabled=true, brokenReason=null
   │     │     └─ Sorts: order ASC, createdAt ASC
   │     ├─ Matches card_moved_into_section triggers where sectionId = 'done-section'
   │     ├─ For each match: evaluateFilters(rule.filters, task, filterContext)
   │     └─ Returns RuleAction[] for passing rules
   ├─ Dedup filter: skip if "ruleId:taskId:actionType" already in set
   ├─ ruleExecutor.executeActions(filteredActions, event)
   │     ├─ For each action:
   │     │     ├─ Execute (e.g., mark_card_complete → taskService.cascadeComplete)
   │     │     ├─ Push execution log entry (trim to 20)
   │     │     ├─ Update rule metadata (executionCount++, lastExecutedAt)
   │     │     └─ Return domain event (depth + 1, triggeredByRule)
   │     └─ Returns newEvents[]
   ├─ Capture undo snapshot (depth 0 only, via undoService)
   ├─ Collect toast data into batchContext (or emit immediately if not batched)
   └─ Recurse: for each newEvent → handleEvent(newEvent, dedupSet)

4. endBatch() fires
   ├─ Groups batchContext.executions by ruleId
   └─ Emits one onRuleExecuted callback per rule

5. app/page.tsx callback
   ├─ formatAutomationToastMessage(params)
   ├─ Looks up matching snapshot via getUndoSnapshots().find(s => s.ruleId === params.ruleId)
   │     (imported from services/undoService)
   ├─ If found: shows toast with Undo button calling performUndoById(ruleId) (10s)
   └─ Otherwise shows basic toast (5s)
```

## Debugging: Rule Didn't Fire

Check in this order:

1. **Rule enabled?** — `rule.enabled === true` and `rule.brokenReason === null`
2. **Correct project?** — `ruleRepo.findByProjectId` only returns rules for the event's project
3. **Is it a subtask?** — `evaluateRules` skips events where the task's `parentTaskId` is non-null. Automations only fire on top-level tasks
4. **Trigger matches?** — The event type and field changes must match the trigger type. Check `evaluateRules()` in `ruleEngine.ts`
4. **Section matches?** — For section-based triggers, `rule.trigger.sectionId` must equal the event's `changes.sectionId` (for moved-into) or `previousValues.sectionId` (for moved-out)
5. **Filters pass?** — All filters must return true (AND logic). Check `evaluateFilters()` in `filterPredicates.ts`
6. **Dedup blocked?** — If the same rule+entity+action combo already fired in this cascade chain, it's skipped
7. **Depth exceeded?** — If `event.depth >= maxDepth` (default 5), the event is ignored
8. **Domain event emitted?** — Check that the data store mutation calls `emitDomainEvent()`. Missing `beginBatch()`/`endBatch()` won't prevent firing but will affect toast aggregation

## Debugging: Rule Fired But Action Failed

1. **Target entity exists?** — `taskRepo.findById(targetEntityId)` must return a task. Missing entities are silently skipped
2. **Target section exists?** — For move actions, `sectionRepo.findById(sectionId)` must return a section
3. **Date calculation valid?** — For `set_due_date`, check `calculateRelativeDate()` in `dateCalculations.ts`
4. **Card title provided?** — For `create_card`, `action.params.cardTitle` must be non-empty

## Debugging: Toast Not Showing

1. **Callback wired?** — `automationService.setRuleExecutionCallback()` must be called in `app/page.tsx`
2. **Batch mode?** — If the mutation is wrapped in `beginBatch()`/`endBatch()`, toasts emit after `endBatch()`. If not wrapped, they emit immediately
3. **Depth 0?** — Toast notifications only fire for user-initiated events (depth 0), not cascaded events

## Debugging: Undo Not Working

1. **Snapshot exists?** — `getUndoSnapshots()` returns empty if all expired (>10s) or no execution happened
2. **Correct ruleId?** — `performUndoById(ruleId)` looks up by ruleId in the stack. If the ruleId doesn't match, returns false
3. **Depth 0?** — Snapshots are only captured for user-initiated events
4. **Task still exists?** — If the user deleted the task before clicking Undo, the undo silently fails
5. **Stack cleared by new gesture?** — `clearAllUndoSnapshots()` is called at the start of each new batch execution. If the user triggers another action before clicking undo, previous snapshots are gone
6. **Subtasks not reverting?** — Check `snapshot.subtaskSnapshots` is populated. Subtask state is captured BEFORE `executeActions` runs

## Debugging: Import/Export Missing Rules

1. **Repository passed?** — `new ShareService(automationRuleRepository)` — the constructor arg must be the repo. If omitted, `serializeState` skips rules
2. **Checkbox checked?** — The "Include automations" checkbox defaults to true but can be unchecked
3. **Section validation on import** — Rules referencing sections not in the imported data get `brokenReason: 'section_deleted'`

## localStorage Keys

| Key | Contents | Managed By |
|-----|----------|-----------|
| `task-management-data` | Projects, tasks, sections, dependencies | Zustand persist + LocalStorageBackend |
| `task-management-settings` | App settings, theme, keyboard shortcuts | Zustand persist (appStore) |
| `task-management-tms` | Time management system state (DIT, AF4, FVP) | Zustand persist (tmsStore) |
| `task-management-automations` | AutomationRule[] | LocalStorageAutomationRuleRepository |
