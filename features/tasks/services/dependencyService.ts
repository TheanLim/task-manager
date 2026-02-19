import type { TaskDependency, Task } from '@/lib/schemas';
import type { DependencyRepository } from '@/lib/repositories/types';
import type { DependencyResolver } from '@/features/tasks/services/dependencyResolver';

export class DependencyService {
  constructor(
    private depRepo: DependencyRepository,
    private resolver: DependencyResolver
  ) {}

  /**
   * Add a dependency after verifying it won't create a circular dependency.
   * Throws if the dependency would introduce a cycle in the dependency graph.
   */
  addDependency(dep: TaskDependency, tasks: Task[]): void {
    const existingDeps = this.depRepo.findAll();

    if (
      this.resolver.hasCircularDependency(
        dep.blockingTaskId,
        dep.blockedTaskId,
        existingDeps
      )
    ) {
      throw new Error(
        `Circular dependency detected: task ${dep.blockedTaskId} already blocks task ${dep.blockingTaskId} directly or indirectly`
      );
    }

    this.depRepo.create(dep);
  }
}
