import type { UUID, Project, Task, Section, TaskDependency } from '@/types';

export type SubscriptionCallback<T> = (items: T[]) => void;
export type Unsubscribe = () => void;

export interface Repository<T extends { id: string }> {
  findById(id: UUID): T | undefined;
  findAll(): T[];
  create(item: T): void;
  update(id: UUID, updates: Partial<T>): void;
  delete(id: UUID): void;
  replaceAll(items: T[]): void;
  subscribe(callback: SubscriptionCallback<T>): Unsubscribe;
}

export interface TaskRepository extends Repository<Task> {
  findByProjectId(projectId: UUID): Task[];
  findByParentTaskId(parentTaskId: UUID): Task[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ProjectRepository extends Repository<Project> {}

export interface SectionRepository extends Repository<Section> {
  findByProjectId(projectId: UUID | null): Section[];
}

export interface DependencyRepository extends Repository<TaskDependency> {
  findByBlockingTaskId(taskId: UUID): TaskDependency[];
  findByBlockedTaskId(taskId: UUID): TaskDependency[];
}
