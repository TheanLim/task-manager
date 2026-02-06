import { describe, it, expect } from 'vitest';
import { DependencyResolverImpl } from './dependencyResolver';
import { Task, TaskDependency, Priority, UUID } from '@/types';

describe('DependencyResolver', () => {
  const resolver = new DependencyResolverImpl();

  // Helper function to create a minimal task
  const createTask = (id: UUID, completed: boolean = false): Task => ({
    id,
    projectId: 'project-1',
    parentTaskId: null,
    sectionId: null,
    columnId: null,
    description: `Task ${id}`,
    notes: '',
    assignee: '',
    priority: Priority.NONE,
    tags: [],
    dueDate: null,
    completed,
    completedAt: completed ? new Date().toISOString() : null,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Helper function to create a dependency
  const createDependency = (id: UUID, blockingTaskId: UUID, blockedTaskId: UUID): TaskDependency => ({
    id,
    blockingTaskId,
    blockedTaskId,
    createdAt: new Date().toISOString(),
  });

  describe('getBlockingTasks', () => {
    it('returns empty array when task has no blocking tasks', () => {
      const dependencies: TaskDependency[] = [];
      const result = resolver.getBlockingTasks('task-1', dependencies);
      expect(result).toEqual([]);
    });

    it('returns blocking task IDs for a blocked task', () => {
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
        createDependency('dep-2', 'task-C', 'task-B'),
      ];
      const result = resolver.getBlockingTasks('task-B', dependencies);
      expect(result).toEqual(['task-A', 'task-C']);
    });

    it('does not return tasks that the specified task blocks', () => {
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
      ];
      const result = resolver.getBlockingTasks('task-A', dependencies);
      expect(result).toEqual([]);
    });
  });

  describe('getBlockedTasks', () => {
    it('returns empty array when task blocks no other tasks', () => {
      const dependencies: TaskDependency[] = [];
      const result = resolver.getBlockedTasks('task-1', dependencies);
      expect(result).toEqual([]);
    });

    it('returns blocked task IDs for a blocking task', () => {
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
        createDependency('dep-2', 'task-A', 'task-C'),
      ];
      const result = resolver.getBlockedTasks('task-A', dependencies);
      expect(result).toEqual(['task-B', 'task-C']);
    });

    it('does not return tasks that block the specified task', () => {
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
      ];
      const result = resolver.getBlockedTasks('task-B', dependencies);
      expect(result).toEqual([]);
    });
  });

  describe('isTaskBlocked', () => {
    it('returns false when task has no dependencies', () => {
      const tasks = [createTask('task-A')];
      const dependencies: TaskDependency[] = [];
      const result = resolver.isTaskBlocked('task-A', tasks, dependencies);
      expect(result).toBe(false);
    });

    it('returns false when all blocking tasks are completed', () => {
      const tasks = [
        createTask('task-A', true),
        createTask('task-B', false),
      ];
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
      ];
      const result = resolver.isTaskBlocked('task-B', tasks, dependencies);
      expect(result).toBe(false);
    });

    it('returns true when at least one blocking task is incomplete', () => {
      const tasks = [
        createTask('task-A', false),
        createTask('task-B', false),
      ];
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
      ];
      const result = resolver.isTaskBlocked('task-B', tasks, dependencies);
      expect(result).toBe(true);
    });

    it('returns true when any blocking task is incomplete (multiple blockers)', () => {
      const tasks = [
        createTask('task-A', true),
        createTask('task-B', false),
        createTask('task-C', false),
      ];
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-C'),
        createDependency('dep-2', 'task-B', 'task-C'),
      ];
      const result = resolver.isTaskBlocked('task-C', tasks, dependencies);
      expect(result).toBe(true);
    });
  });

  describe('hasCircularDependency', () => {
    it('returns false when no circular dependency exists', () => {
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
      ];
      const result = resolver.hasCircularDependency('task-B', 'task-C', dependencies);
      expect(result).toBe(false);
    });

    it('detects direct circular dependency (A blocks B, B blocks A)', () => {
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
      ];
      const result = resolver.hasCircularDependency('task-B', 'task-A', dependencies);
      expect(result).toBe(true);
    });

    it('detects indirect circular dependency (A blocks B, B blocks C, C blocks A)', () => {
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
        createDependency('dep-2', 'task-B', 'task-C'),
      ];
      const result = resolver.hasCircularDependency('task-C', 'task-A', dependencies);
      expect(result).toBe(true);
    });

    it('detects longer circular dependency chains', () => {
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
        createDependency('dep-2', 'task-B', 'task-C'),
        createDependency('dep-3', 'task-C', 'task-D'),
      ];
      const result = resolver.hasCircularDependency('task-D', 'task-A', dependencies);
      expect(result).toBe(true);
    });

    it('returns false for complex graph without cycles', () => {
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
        createDependency('dep-2', 'task-A', 'task-C'),
        createDependency('dep-3', 'task-B', 'task-D'),
        createDependency('dep-4', 'task-C', 'task-D'),
      ];
      const result = resolver.hasCircularDependency('task-D', 'task-E', dependencies);
      expect(result).toBe(false);
    });

    it('handles self-referencing dependency', () => {
      const dependencies: TaskDependency[] = [];
      const result = resolver.hasCircularDependency('task-A', 'task-A', dependencies);
      expect(result).toBe(true);
    });
  });

  describe('getActionableTasks', () => {
    it('returns all tasks when no dependencies exist', () => {
      const tasks = [
        createTask('task-A'),
        createTask('task-B'),
        createTask('task-C'),
      ];
      const dependencies: TaskDependency[] = [];
      const result = resolver.getActionableTasks(tasks, dependencies);
      expect(result).toHaveLength(3);
      expect(result).toEqual(tasks);
    });

    it('excludes tasks blocked by incomplete tasks', () => {
      const tasks = [
        createTask('task-A', false),
        createTask('task-B', false),
      ];
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
      ];
      const result = resolver.getActionableTasks(tasks, dependencies);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-A');
    });

    it('includes tasks blocked by completed tasks', () => {
      const tasks = [
        createTask('task-A', true),
        createTask('task-B', false),
      ];
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
      ];
      const result = resolver.getActionableTasks(tasks, dependencies);
      expect(result).toHaveLength(2);
    });

    it('handles complex dependency chains correctly', () => {
      const tasks = [
        createTask('task-A', false),
        createTask('task-B', false),
        createTask('task-C', false),
        createTask('task-D', false),
      ];
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
        createDependency('dep-2', 'task-B', 'task-C'),
        createDependency('dep-3', 'task-A', 'task-D'),
      ];
      const result = resolver.getActionableTasks(tasks, dependencies);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-A');
    });

    it('returns empty array when all tasks are blocked', () => {
      const tasks = [
        createTask('task-A', false),
        createTask('task-B', false),
      ];
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
        createDependency('dep-2', 'task-B', 'task-A'),
      ];
      const result = resolver.getActionableTasks(tasks, dependencies);
      expect(result).toHaveLength(0);
    });

    it('handles multiple independent dependency chains', () => {
      const tasks = [
        createTask('task-A', false),
        createTask('task-B', false),
        createTask('task-C', false),
        createTask('task-D', false),
      ];
      const dependencies = [
        createDependency('dep-1', 'task-A', 'task-B'),
        createDependency('dep-2', 'task-C', 'task-D'),
      ];
      const result = resolver.getActionableTasks(tasks, dependencies);
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id).sort()).toEqual(['task-A', 'task-C']);
    });
  });
});
