# Task Data Flows

## Creating a Task

```
UI (TaskDialog) → TaskService.create(data) → dataStore.addTask(task)
    │                    │
    │                    └─ Static factory: generates UUID, timestamps, defaults
    │
    ├─ taskRepo.create(task)
    ├─ emitDomainEvent({ type: 'task.created', ... })
    └─ Zustand state update → re-render
```

Entity construction uses `TaskService.create()` (static factory) to generate ID, timestamps, and defaults. The data store handles persistence and event emission.

## Deleting a Task (Cascade)

```
UI → dataStore action → TaskService.cascadeDelete(taskId)
    │
    ├─ 1. collectDescendantIds(taskId) — recursive DFS via taskRepo.findByParentTaskId()
    │     Returns flat list: [taskId, child1, grandchild1, child2, ...]
    │
    ├─ 2. Delete orphaned dependencies
    │     depRepo.findAll() → delete any dep where blockingTaskId OR blockedTaskId ∈ idSet
    │
    ├─ 3. Delete tasks bottom-up (reverse order of collected IDs)
    │     for i = allIds.length-1 → 0:
    │       taskRepo.delete(allIds[i])
    │       emitEvent({ type: 'task.deleted', previousValues: { ...task } })
    │
    └─ Bottom-up order ensures children are removed before parents
```

## Completing a Task (Cascade)

```
UI → TaskService.completionUpdate(completed) → dataStore.updateTask()
    │
    ├─ Static helper generates { completed, completedAt } with timestamp
    │
    ├─ If parent task (parentTaskId === null):
    │   ├─ Update target task via completionUpdate()
    │   └─ For each subtask: update via completionUpdate()
    │
    └─ Notify TMS handler if time management system is active
```

Note: This UI-level cascade in `page.tsx` is separate from `TaskService.cascadeComplete()` (which uses repositories + emits domain events for automations). The UI cascade is intentional for subtask completion from the main view — subtask completion bypasses automation rules by design.

## Reinserting a Task

```
UI → dataStore action → TaskService.reinsertTask(taskId)
    │
    ├─ taskRepo.findById(taskId)
    │
    ├─ If parent task (parentTaskId == null):
    │   └─ taskRepo.update(taskId, { lastActionAt: now })
    │       UI sorts by effective last action time → task moves to bottom
    │
    └─ If subtask (parentTaskId != null):
        ├─ taskRepo.update(taskId, { lastActionAt: now })
        └─ taskRepo.update(parentTaskId, { lastActionAt: now })
            Bubbles parent to bottom of its section too
```

No `order` field changes — positioning is driven entirely by `lastActionAt` timestamps.

## Adding a Dependency

```
UI (DependencyDialog) → DependencyService.addDependency(dep, tasks)
    │
    ├─ depRepo.findAll() — get existing dependency graph
    ├─ resolver.hasCircularDependency(blockingId, blockedId, existingDeps)
    │   └─ BFS from blockedId → if it reaches blockingId, throw Error
    └─ depRepo.create(dep)
```

## Filtering Tasks (useFilteredTasks)

```
tasks (input)
    │
    ├─ searchQuery → description, tags, assignee match
    ├─ priorityFilter → exact priority match
    ├─ dateRangeFilter → dueDate within range
    ├─ completionFilter → completed/active/all
    └─ showOnlyActionableTasks → DependencyResolverImpl.getActionableTasks()
        Filters out tasks blocked by incomplete dependencies
    │
    ▼
filtered tasks (output)
```

## Auto-Hide Flow

```
tasks + allTasks + AutoHideFilterOptions
    │
    ├─ threshold → getThresholdMs() → null means "never hide"
    │
    ├─ Nested mode:
    │   ├─ Parent tasks: hidden if completed && completedAt age ≥ threshold
    │   └─ Subtasks: follow parent visibility (active parent → always visible)
    │
    └─ Flat mode:
        ├─ Each task evaluated independently
        └─ Exception: subtask with active parent → always visible
    │
    ▼
{ visible: Task[], autoHidden: Task[] }
```

## Debugging Tips

| Symptom | Check |
|---------|-------|
| Task not disappearing after delete | Verify `collectDescendantIds` found all children — check `parentTaskId` linkage |
| Subtasks not completing with parent | Confirm `cascadeComplete` is called with `completed: true`, not a direct repo update |
| Reinserted task not moving to bottom | Check that the view sorts by `getEffectiveLastActionTime()`, not by `order` |
| Dependency not saving | Look for "Circular dependency detected" error — BFS found a cycle |
| Completed task still visible | Check auto-hide threshold setting and that `completedAt` is set (not just `completed: true`) |
| Actionable filter too aggressive | Verify dependency data is loaded — `useDataStore().dependencies` must be populated |
| Auto-hide hiding subtasks of active parent | Bug — active parent exception should prevent this in both modes |
