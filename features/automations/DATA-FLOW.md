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
   ├─ evaluateRules(event, rules, context)          [services/evaluation/ruleEngine.ts]
   │     ├─ buildRuleIndex(rules) → Map<TriggerType, Rule[]>
   │     │     └─ Filters: enabled=true, brokenReason=null
   │     │     └─ Sorts: order ASC, createdAt ASC
   │     ├─ Matches card_moved_into_section triggers where sectionId = 'done-section'
   │     ├─ For each match: evaluateFilters()       [services/evaluation/filterPredicates.ts]
   │     └─ Returns RuleAction[] for passing rules
   ├─ Dedup filter: skip if "ruleId:taskId:actionType" already in set
   ├─ ruleExecutor.executeActions(filteredActions, event)  [services/execution/ruleExecutor.ts]
   │     ├─ For each action:
   │     │     ├─ getActionHandler(actionType)       [services/execution/actionHandlers.ts]
   │     │     ├─ handler.execute() → domain events
   │     │     ├─ Push execution log entry (trim to 20)
   │     │     ├─ Update rule metadata (executionCount++, lastExecutedAt)
   │     │     └─ Return domain event (depth + 1, triggeredByRule)
   │     └─ Returns newEvents[]
   ├─ Capture undo snapshot (depth 0 only)          [services/execution/undoService.ts]
   ├─ Collect toast data into batchContext (or emit immediately if not batched)
   └─ Recurse: for each newEvent → handleEvent(newEvent, dedupSet)

4. endBatch() fires
   ├─ Groups batchContext.executions by ruleId
   └─ Emits one onRuleExecuted callback per rule

5. app/page.tsx callback
   ├─ formatAutomationToastMessage(params)          [services/preview/toastMessageFormatter.ts]
   ├─ Looks up matching snapshot via getUndoSnapshots()
   │     (imported from services/execution/undoService)
   ├─ If found: shows toast with Undo button calling performUndoById(ruleId) (10s)
   └─ Otherwise shows basic toast (5s)
```

## End-to-End Flow: Scheduled Rule Fires

```
1. SchedulerService.tick()                          [services/scheduler/schedulerService.ts]
   ├─ ruleRepo.findAll() → all rules
   ├─ taskRepo.findAll() → all tasks
   └─ evaluateScheduledRules(nowMs, rules, tasks)   [services/scheduler/scheduleEvaluator.ts]
         ├─ For each enabled scheduled rule:
         │     ├─ scheduled_interval → evaluateIntervalSchedule()
         │     ├─ scheduled_cron → evaluateCronSchedule()
         │     ├─ scheduled_due_date_relative → evaluateDueDateRelativeSchedule()
         │     └─ scheduled_one_time → evaluateOneTimeSchedule()
         └─ Returns { rule, evaluation }[] for rules that should fire

2. For each fired rule:
   ├─ Update lastEvaluatedAt BEFORE callback (crash recovery ordering)
   ├─ Check catch-up policy (skip_missed → log "skipped" entry, don't fire)
   ├─ onRuleFired callback → routes to AutomationService.handleEvent()
   └─ Auto-disable one-time rules after firing

3. AutomationService receives synthetic schedule.fired event
   └─ Same flow as event triggers (step 3 above)
```

## Debugging: Rule Didn't Fire

Check in this order:

1. **Rule enabled?** — `rule.enabled === true` and `rule.brokenReason === null`
2. **Correct project?** — `ruleRepo.findByProjectId` only returns rules for the event's project
3. **Is it a subtask?** — `evaluateRules` skips events where `parentTaskId` is non-null
4. **Trigger matches?** — Check `evaluateRules()` in `services/evaluation/ruleEngine.ts`
5. **Section matches?** — `rule.trigger.sectionId` must equal the event's `changes.sectionId` (moved-into) or `previousValues.sectionId` (moved-out)
6. **Filters pass?** — All filters must return true (AND logic). Check `evaluateFilters()` in `services/evaluation/filterPredicates.ts`
7. **Dedup blocked?** — Same rule+entity+action combo already fired in this cascade chain
8. **Depth exceeded?** — `event.depth >= maxDepth` (default 5)
9. **Domain event emitted?** — Check that the data store mutation calls `emitDomainEvent()`

## Debugging: Scheduled Rule Didn't Fire

1. **Leader tab?** — Only the leader tab runs the scheduler. Check `services/scheduler/schedulerLeaderElection.ts`
2. **Schedule evaluation** — Check the pure evaluator in `services/scheduler/scheduleEvaluator.ts`
3. **lastEvaluatedAt stale?** — If the tab was backgrounded, catch-up runs on visibility change
4. **Catch-up policy** — `skip_missed` rules log a "skipped" entry instead of firing on catch-up
5. **One-time already fired?** — One-time rules auto-disable after firing. Check `enabled` and `lastEvaluatedAt`

## Debugging: Rule Fired But Action Failed

1. **Target entity exists?** — `taskRepo.findById(targetEntityId)` must return a task
2. **Target section exists?** — For move actions, `sectionRepo.findById(sectionId)` must return a section
3. **Date calculation valid?** — Check `calculateRelativeDate()` in `services/evaluation/dateCalculations.ts`
4. **Card title provided?** — For `create_card`, `action.params.cardTitle` must be non-empty
5. **Card dedup blocked?** — Check `shouldSkipCreateCard()` in `services/execution/createCardDedup.ts`

## Debugging: Toast Not Showing

1. **Callback wired?** — `automationService.setRuleExecutionCallback()` must be called in `app/page.tsx`
2. **Batch mode?** — Toasts emit after `endBatch()`. Missing `beginBatch()`/`endBatch()` causes individual toasts
3. **Depth 0?** — Toast notifications only fire for user-initiated events (depth 0)

## Debugging: Undo Not Working

1. **Snapshot exists?** — `getUndoSnapshots()` returns empty if all expired (>10s)
2. **Correct ruleId?** — `performUndoById(ruleId)` looks up by ruleId in the stack
3. **Depth 0?** — Snapshots only captured for user-initiated events
4. **Task still exists?** — Deleted task before clicking Undo → silent fail
5. **Stack cleared?** — `clearAllUndoSnapshots()` called at start of each new batch
6. **Subtasks not reverting?** — Check `snapshot.subtaskSnapshots` is populated

## Debugging: Import/Export Missing Rules

1. **Repository passed?** — `new ShareService(automationRuleRepository)` — constructor arg required
2. **Checkbox checked?** — "Include automations" checkbox defaults to true
3. **Section validation** — Rules referencing missing sections get `brokenReason: 'section_deleted'`. Uses `services/rules/sectionReferenceCollector.ts`

## localStorage Keys

| Key | Contents | Managed By |
|-----|----------|-----------|
| `task-management-data` | Projects, tasks, sections, dependencies | Zustand persist + LocalStorageBackend |
| `task-management-settings` | App settings, theme, keyboard shortcuts | Zustand persist (appStore) |
| `task-management-tms` | Time management system state (DIT, AF4, FVP) | Zustand persist (tmsStore) |
| `task-management-automations` | AutomationRule[] | LocalStorageAutomationRuleRepository |
