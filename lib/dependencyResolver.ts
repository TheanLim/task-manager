import { UUID, Task, TaskDependency } from '@/types';

/**
 * Interface for resolving task dependencies and determining task actionability
 */
export interface DependencyResolver {
  /**
   * Check if a task is blocked by any incomplete tasks
   * @param taskId - The ID of the task to check
   * @param tasks - All tasks in the system
   * @param dependencies - All task dependencies
   * @returns true if the task is blocked by at least one incomplete task
   */
  isTaskBlocked(taskId: UUID, tasks: Task[], dependencies: TaskDependency[]): boolean;
  
  /**
   * Get all tasks that block the specified task
   * @param taskId - The ID of the task
   * @param dependencies - All task dependencies
   * @returns Array of task IDs that block the specified task
   */
  getBlockingTasks(taskId: UUID, dependencies: TaskDependency[]): UUID[];
  
  /**
   * Get all tasks that are blocked by the specified task
   * @param taskId - The ID of the task
   * @param dependencies - All task dependencies
   * @returns Array of task IDs that are blocked by the specified task
   */
  getBlockedTasks(taskId: UUID, dependencies: TaskDependency[]): UUID[];
  
  /**
   * Check if creating a dependency would create a circular dependency
   * Uses BFS to detect cycles in the dependency graph
   * @param blockingTaskId - The task that would block
   * @param blockedTaskId - The task that would be blocked
   * @param dependencies - All existing task dependencies
   * @returns true if the dependency would create a cycle
   */
  hasCircularDependency(
    blockingTaskId: UUID,
    blockedTaskId: UUID,
    dependencies: TaskDependency[]
  ): boolean;
  
  /**
   * Get all tasks that are not blocked by any incomplete tasks
   * @param tasks - All tasks to filter
   * @param dependencies - All task dependencies
   * @returns Array of tasks that can be worked on (not blocked)
   */
  getActionableTasks(tasks: Task[], dependencies: TaskDependency[]): Task[];
}

/**
 * Implementation of the DependencyResolver interface
 */
export class DependencyResolverImpl implements DependencyResolver {
  isTaskBlocked(taskId: UUID, tasks: Task[], dependencies: TaskDependency[]): boolean {
    const blockingTaskIds = this.getBlockingTasks(taskId, dependencies);
    
    if (blockingTaskIds.length === 0) {
      return false;
    }
    
    // Task is blocked if any blocking task is incomplete
    return blockingTaskIds.some(blockingId => {
      const blockingTask = tasks.find(t => t.id === blockingId);
      return blockingTask && !blockingTask.completed;
    });
  }
  
  getBlockingTasks(taskId: UUID, dependencies: TaskDependency[]): UUID[] {
    return dependencies
      .filter(dep => dep.blockedTaskId === taskId)
      .map(dep => dep.blockingTaskId);
  }
  
  getBlockedTasks(taskId: UUID, dependencies: TaskDependency[]): UUID[] {
    return dependencies
      .filter(dep => dep.blockingTaskId === taskId)
      .map(dep => dep.blockedTaskId);
  }
  
  hasCircularDependency(
    blockingTaskId: UUID,
    blockedTaskId: UUID,
    dependencies: TaskDependency[]
  ): boolean {
    // Use BFS to check if blockedTaskId blocks blockingTaskId (directly or indirectly)
    const visited = new Set<UUID>();
    const queue: UUID[] = [blockedTaskId];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current)) {
        continue;
      }
      
      visited.add(current);
      
      if (current === blockingTaskId) {
        return true; // Found a cycle
      }
      
      // Add all tasks that current blocks
      const blocked = this.getBlockedTasks(current, dependencies);
      queue.push(...blocked);
    }
    
    return false;
  }
  
  getActionableTasks(tasks: Task[], dependencies: TaskDependency[]): Task[] {
    return tasks.filter(task => !this.isTaskBlocked(task.id, tasks, dependencies));
  }
}
