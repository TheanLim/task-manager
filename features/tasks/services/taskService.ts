import { v4 as uuidv4 } from 'uuid';
import type { UUID, Priority } from '@/types';
import type { Task } from '@/lib/schemas';
import type { TaskRepository, DependencyRepository } from '@/lib/repositories/types';
import type { DomainEvent } from '@/features/automations/types';

/**
 * Returns the effective last action time for a task.
 * Falls back to createdAt when lastActionAt is null/undefined.
 */
export function getEffectiveLastActionTime(task: Task): string {
  return task.lastActionAt ?? task.createdAt;
}

export class TaskService {
  constructor(
    private taskRepo: TaskRepository,
    private depRepo: DependencyRepository,
    private emitEvent?: (event: DomainEvent) => void
  ) {}

  /**
   * Static factory: create a new Task with generated ID, timestamps, and defaults.
   */
  static create(data: {
    projectId: string | null;
    parentTaskId: string | null;
    sectionId: string | null;
    description: string;
    notes: string;
    assignee: string;
    priority: Priority;
    tags: string[];
    dueDate: string | null;
    order: number;
  }): Task {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      ...data,
      completed: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Static helper: generate completion state with timestamp.
   */
  static completionUpdate(completed: boolean): { completed: boolean; completedAt: string | null } {
    return {
      completed,
      completedAt: completed ? new Date().toISOString() : null,
    };
  }

  /**
   * Recursively collect all descendant task IDs for a given parent.
   */
  private collectDescendantIds(taskId: UUID): UUID[] {
    const children = this.taskRepo.findByParentTaskId(taskId);
    const ids: UUID[] = [];
    for (const child of children) {
      ids.push(child.id);
      ids.push(...this.collectDescendantIds(child.id));
    }
    return ids;
  }

  /**
   * Cascade-delete a task: remove all descendant subtasks, associated
   * dependencies, and the task itself.
   */
  cascadeDelete(taskId: UUID): void {
    const allIds = [taskId, ...this.collectDescendantIds(taskId)];
    const idSet = new Set(allIds);

    // Delete dependencies that reference any of the deleted tasks
    const allDeps = this.depRepo.findAll();
    for (const dep of allDeps) {
      if (idSet.has(dep.blockingTaskId) || idSet.has(dep.blockedTaskId)) {
        this.depRepo.delete(dep.id);
      }
    }

    // Delete tasks bottom-up (children first, root last)
    for (let i = allIds.length - 1; i >= 0; i--) {
      const taskToDelete = this.taskRepo.findById(allIds[i]);
      if (taskToDelete) {
        this.taskRepo.delete(allIds[i]);
        
        // Emit task.deleted event
        if (this.emitEvent) {
          this.emitEvent({
            type: 'task.deleted',
            entityId: taskToDelete.id,
            projectId: taskToDelete.projectId || '',
            changes: {},
            previousValues: { ...taskToDelete },
            depth: 0,
          });
        }
      }
    }
  }

  /**
   * Update a task's completion status. When completing, cascade to all
   * subtasks. When uncompleting, only uncomplete the specific task.
   */
  cascadeComplete(taskId: UUID, completed: boolean): void {
    const now = new Date().toISOString();

    // Get the task before updating to capture previous values
    const task = this.taskRepo.findById(taskId);
    if (task) {
      const previousValues = { ...task };
      
      this.taskRepo.update(taskId, {
        completed,
        completedAt: completed ? now : null,
      });

      // Emit task.updated event
      if (this.emitEvent) {
        this.emitEvent({
          type: 'task.updated',
          entityId: taskId,
          projectId: task.projectId || '',
          changes: {
            completed,
            completedAt: completed ? now : null,
          },
          previousValues: {
            completed: previousValues.completed,
            completedAt: previousValues.completedAt,
          },
          depth: 0,
        });
      }
    }

    if (completed) {
      // Cascade completion to all descendants
      const descendantIds = this.collectDescendantIds(taskId);
      for (const id of descendantIds) {
        const descendantTask = this.taskRepo.findById(id);
        if (descendantTask) {
          const previousValues = { ...descendantTask };
          
          this.taskRepo.update(id, {
            completed: true,
            completedAt: now,
          });

          // Emit task.updated event for each descendant
          if (this.emitEvent) {
            this.emitEvent({
              type: 'task.updated',
              entityId: id,
              projectId: descendantTask.projectId || '',
              changes: {
                completed: true,
                completedAt: now,
              },
              previousValues: {
                completed: previousValues.completed,
                completedAt: previousValues.completedAt,
              },
              depth: 0,
            });
          }
        }
      }
    }
  }

  /**
   * Reinsert a task: update its lastActionAt to now and reposition it.
   * - Parent tasks: update lastActionAt (sorting handles positioning)
   * - Subtasks: move to bottom of parent's subtask list, update both
   *   subtask and parent lastActionAt
   */
  reinsertTask(taskId: UUID): void {
    const task = this.taskRepo.findById(taskId);
    if (!task) return;

    const now = new Date().toISOString();

    if (task.parentTaskId == null) {
      // Parent task: just update lastActionAt — UI sorts by effective last action time
      this.taskRepo.update(taskId, { lastActionAt: now });
    } else {
      // Subtask: update timestamps only — do NOT change order field
      // so project views (which sort by order) remain unaffected.
      // The All Tasks page sorts subtasks by effective last action time.
      this.taskRepo.update(taskId, { lastActionAt: now });
      // Bubble parent to bottom of section
      this.taskRepo.update(task.parentTaskId, { lastActionAt: now });
    }
  }

}
