import type { UUID } from '@/types';
import type { TaskRepository, DependencyRepository } from '@/lib/repositories/types';

export class TaskService {
  constructor(
    private taskRepo: TaskRepository,
    private depRepo: DependencyRepository
  ) {}

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
      this.taskRepo.delete(allIds[i]);
    }
  }

  /**
   * Update a task's completion status. When completing, cascade to all
   * subtasks. When uncompleting, only uncomplete the specific task.
   */
  cascadeComplete(taskId: UUID, completed: boolean): void {
    const now = new Date().toISOString();

    this.taskRepo.update(taskId, {
      completed,
      completedAt: completed ? now : null,
    });

    if (completed) {
      // Cascade completion to all descendants
      const descendantIds = this.collectDescendantIds(taskId);
      for (const id of descendantIds) {
        this.taskRepo.update(id, {
          completed: true,
          completedAt: now,
        });
      }
    }
  }
}
