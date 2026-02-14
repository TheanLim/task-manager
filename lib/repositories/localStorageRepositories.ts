import type { UUID, Project, Task, Section, TaskDependency } from '@/types';
import type {
  ProjectRepository,
  TaskRepository,
  SectionRepository,
  DependencyRepository,
  SubscriptionCallback,
  Unsubscribe,
} from './types';
import { LocalStorageBackend } from './localStorageBackend';

export class LocalStorageProjectRepository implements ProjectRepository {
  constructor(private backend: LocalStorageBackend) {}

  findById(id: UUID): Project | undefined {
    return this.backend.getEntities('projects').find((p) => p.id === id);
  }

  findAll(): Project[] {
    return this.backend.getEntities('projects');
  }

  create(item: Project): void {
    const projects = [...this.backend.getEntities('projects'), item];
    this.backend.setEntities('projects', projects);
  }

  update(id: UUID, updates: Partial<Project>): void {
    const projects = this.backend.getEntities('projects').map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    this.backend.setEntities('projects', projects);
  }

  delete(id: UUID): void {
    const projects = this.backend.getEntities('projects').filter((p) => p.id !== id);
    this.backend.setEntities('projects', projects);
  }

  subscribe(callback: SubscriptionCallback<Project>): Unsubscribe {
    return this.backend.onEntityChange('projects', () => {
      callback(this.backend.getEntities('projects'));
    });
  }
}

export class LocalStorageTaskRepository implements TaskRepository {
  constructor(private backend: LocalStorageBackend) {}

  findById(id: UUID): Task | undefined {
    return this.backend.getEntities('tasks').find((t) => t.id === id);
  }

  findAll(): Task[] {
    return this.backend.getEntities('tasks');
  }

  findByProjectId(projectId: UUID): Task[] {
    return this.backend.getEntities('tasks').filter((t) => t.projectId === projectId);
  }

  findByParentTaskId(parentTaskId: UUID): Task[] {
    return this.backend.getEntities('tasks').filter((t) => t.parentTaskId === parentTaskId);
  }

  create(item: Task): void {
    const tasks = [...this.backend.getEntities('tasks'), item];
    this.backend.setEntities('tasks', tasks);
  }

  update(id: UUID, updates: Partial<Task>): void {
    const tasks = this.backend.getEntities('tasks').map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    this.backend.setEntities('tasks', tasks);
  }

  delete(id: UUID): void {
    const tasks = this.backend.getEntities('tasks').filter((t) => t.id !== id);
    this.backend.setEntities('tasks', tasks);
  }

  subscribe(callback: SubscriptionCallback<Task>): Unsubscribe {
    return this.backend.onEntityChange('tasks', () => {
      callback(this.backend.getEntities('tasks'));
    });
  }
}

export class LocalStorageSectionRepository implements SectionRepository {
  constructor(private backend: LocalStorageBackend) {}

  findById(id: UUID): Section | undefined {
    return this.backend.getEntities('sections').find((s) => s.id === id);
  }

  findAll(): Section[] {
    return this.backend.getEntities('sections');
  }

  findByProjectId(projectId: UUID | null): Section[] {
    return this.backend.getEntities('sections').filter((s) => s.projectId === projectId);
  }

  create(item: Section): void {
    const sections = [...this.backend.getEntities('sections'), item];
    this.backend.setEntities('sections', sections);
  }

  update(id: UUID, updates: Partial<Section>): void {
    const sections = this.backend.getEntities('sections').map((s) =>
      s.id === id ? { ...s, ...updates } : s
    );
    this.backend.setEntities('sections', sections);
  }

  delete(id: UUID): void {
    const sections = this.backend.getEntities('sections').filter((s) => s.id !== id);
    this.backend.setEntities('sections', sections);
  }

  subscribe(callback: SubscriptionCallback<Section>): Unsubscribe {
    return this.backend.onEntityChange('sections', () => {
      callback(this.backend.getEntities('sections'));
    });
  }
}

export class LocalStorageDependencyRepository implements DependencyRepository {
  constructor(private backend: LocalStorageBackend) {}

  findById(id: UUID): TaskDependency | undefined {
    return this.backend.getEntities('dependencies').find((d) => d.id === id);
  }

  findAll(): TaskDependency[] {
    return this.backend.getEntities('dependencies');
  }

  findByBlockingTaskId(taskId: UUID): TaskDependency[] {
    return this.backend.getEntities('dependencies').filter((d) => d.blockingTaskId === taskId);
  }

  findByBlockedTaskId(taskId: UUID): TaskDependency[] {
    return this.backend.getEntities('dependencies').filter((d) => d.blockedTaskId === taskId);
  }

  create(item: TaskDependency): void {
    const deps = [...this.backend.getEntities('dependencies'), item];
    this.backend.setEntities('dependencies', deps);
  }

  update(id: UUID, updates: Partial<TaskDependency>): void {
    const deps = this.backend.getEntities('dependencies').map((d) =>
      d.id === id ? { ...d, ...updates } : d
    );
    this.backend.setEntities('dependencies', deps);
  }

  delete(id: UUID): void {
    const deps = this.backend.getEntities('dependencies').filter((d) => d.id !== id);
    this.backend.setEntities('dependencies', deps);
  }

  subscribe(callback: SubscriptionCallback<TaskDependency>): Unsubscribe {
    return this.backend.onEntityChange('dependencies', () => {
      callback(this.backend.getEntities('dependencies'));
    });
  }
}
