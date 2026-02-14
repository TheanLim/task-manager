import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  useDataStore,
  localStorageBackend,
  projectRepository,
  taskRepository,
  sectionRepository,
  dependencyRepository,
} from './dataStore';
import type { Project, Task, Section, TaskDependency } from '@/types';
import { Priority, ViewMode } from '@/types';

describe('useDataStore', () => {
  // Reset backend (source of truth) before each test.
  // The repository subscriptions automatically sync the store state.
  beforeEach(() => {
    localStorageBackend.reset();
  });

  describe('Project CRUD Operations', () => {
    it('should add a project and create default sections', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addProject(project);

      const projects = useDataStore.getState().projects;
      expect(projects).toHaveLength(1);
      expect(projects[0]).toEqual(project);

      // addProject delegates to projectService.createWithDefaults,
      // which creates 3 default sections (To Do, Doing, Done)
      const sections = useDataStore.getState().sections;
      expect(sections).toHaveLength(3);
      expect(sections.map((s) => s.name)).toEqual(['To Do', 'Doing', 'Done']);
    });

    it('should update a project', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addProject(project);
      useDataStore.getState().updateProject('project-1', { name: 'Updated Project' });

      const updatedProject = useDataStore.getState().getProjectById('project-1');
      expect(updatedProject?.name).toBe('Updated Project');
    });

    it('should delete a project and cascade to tasks and sections', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        description: '',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const task: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        description: 'Test Task',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addProject(project);
      useDataStore.getState().addTask(task);

      expect(useDataStore.getState().projects).toHaveLength(1);
      expect(useDataStore.getState().tasks).toHaveLength(1);
      // addProject created 3 default sections
      expect(useDataStore.getState().sections).toHaveLength(3);

      useDataStore.getState().deleteProject('project-1');

      expect(useDataStore.getState().projects).toHaveLength(0);
      expect(useDataStore.getState().tasks).toHaveLength(0);
      expect(useDataStore.getState().sections).toHaveLength(0);
    });

    it('should delete project and cascade to subtasks', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        description: '',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const parentTask: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        description: 'Parent Task',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const subtask: Task = {
        id: 'task-2',
        projectId: 'project-1',
        parentTaskId: 'task-1',
        sectionId: null,
        description: 'Subtask',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addProject(project);
      useDataStore.getState().addTask(parentTask);
      useDataStore.getState().addTask(subtask);

      expect(useDataStore.getState().tasks).toHaveLength(2);

      useDataStore.getState().deleteProject('project-1');

      expect(useDataStore.getState().tasks).toHaveLength(0);
    });
  });

  describe('Task CRUD Operations', () => {
    it('should add a task to the store', () => {
      const task: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        description: 'Test Task',
        notes: '',
        assignee: '',
        priority: Priority.MEDIUM,
        tags: ['test'],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addTask(task);

      const tasks = useDataStore.getState().tasks;
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual(task);
    });

    it('should update a task', () => {
      const task: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        description: 'Test Task',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addTask(task);
      useDataStore.getState().updateTask('task-1', {
        description: 'Updated Task',
        priority: Priority.HIGH,
      });

      const updatedTask = useDataStore.getState().tasks[0];
      expect(updatedTask.description).toBe('Updated Task');
      expect(updatedTask.priority).toBe(Priority.HIGH);
    });

    it('should delete a task and its subtasks', () => {
      const parentTask: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        description: 'Parent Task',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const subtask: Task = {
        id: 'task-2',
        projectId: 'project-1',
        parentTaskId: 'task-1',
        sectionId: null,
        description: 'Subtask',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addTask(parentTask);
      useDataStore.getState().addTask(subtask);

      expect(useDataStore.getState().tasks).toHaveLength(2);

      useDataStore.getState().deleteTask('task-1');

      expect(useDataStore.getState().tasks).toHaveLength(0);
    });

    it('should delete nested subtasks recursively', () => {
      const parentTask: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        description: 'Parent Task',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const subtask1: Task = {
        id: 'task-2',
        projectId: 'project-1',
        parentTaskId: 'task-1',
        sectionId: null,
        description: 'Subtask 1',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const subtask2: Task = {
        id: 'task-3',
        projectId: 'project-1',
        parentTaskId: 'task-2',
        sectionId: null,
        description: 'Subtask 2 (nested)',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addTask(parentTask);
      useDataStore.getState().addTask(subtask1);
      useDataStore.getState().addTask(subtask2);

      expect(useDataStore.getState().tasks).toHaveLength(3);

      useDataStore.getState().deleteTask('task-1');

      expect(useDataStore.getState().tasks).toHaveLength(0);
    });
  });

  describe('Section CRUD Operations', () => {
    it('should add a section to the store', () => {
      const section: Section = {
        id: 'section-1',
        projectId: 'project-1',
        name: 'To Do',
        order: 0,
        collapsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addSection(section);

      const sections = useDataStore.getState().sections;
      expect(sections).toHaveLength(1);
      expect(sections[0]).toEqual(section);
    });

    it('should update a section', () => {
      const section: Section = {
        id: 'section-1',
        projectId: 'project-1',
        name: 'To Do',
        order: 0,
        collapsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addSection(section);
      useDataStore.getState().updateSection('section-1', { name: 'In Progress' });

      const updatedSection = useDataStore.getState().sections[0];
      expect(updatedSection.name).toBe('In Progress');
    });

    it('should delete a section and move tasks to default section', () => {
      const defaultSection: Section = {
        id: 'section-default',
        projectId: 'project-1',
        name: 'To Do',
        order: 0,
        collapsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const section: Section = {
        id: 'section-1',
        projectId: 'project-1',
        name: 'In Progress',
        order: 1,
        collapsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const task: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: 'section-1',
        description: 'Test Task',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addSection(defaultSection);
      useDataStore.getState().addSection(section);
      useDataStore.getState().addTask(task);

      expect(useDataStore.getState().sections).toHaveLength(2);
      expect(useDataStore.getState().tasks[0].sectionId).toBe('section-1');

      useDataStore.getState().deleteSection('section-1');

      expect(useDataStore.getState().sections).toHaveLength(1);
      expect(useDataStore.getState().tasks[0].sectionId).toBe('section-default');
    });

    it('should delete a section and set tasks to null if no default exists', () => {
      const section: Section = {
        id: 'section-1',
        projectId: 'project-1',
        name: 'In Progress',
        order: 0,
        collapsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const task: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: 'section-1',
        description: 'Test Task',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addSection(section);
      useDataStore.getState().addTask(task);

      useDataStore.getState().deleteSection('section-1');

      expect(useDataStore.getState().sections).toHaveLength(0);
      expect(useDataStore.getState().tasks[0].sectionId).toBeNull();
    });
  });

  describe('Dependency Operations', () => {
    it('should add a dependency to the store', () => {
      const dependency: TaskDependency = {
        id: 'dep-1',
        blockingTaskId: 'task-1',
        blockedTaskId: 'task-2',
        createdAt: new Date().toISOString(),
      };

      useDataStore.getState().addDependency(dependency);

      const dependencies = useDataStore.getState().dependencies;
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]).toEqual(dependency);
    });

    it('should delete a dependency', () => {
      const dependency: TaskDependency = {
        id: 'dep-1',
        blockingTaskId: 'task-1',
        blockedTaskId: 'task-2',
        createdAt: new Date().toISOString(),
      };

      useDataStore.getState().addDependency(dependency);
      expect(useDataStore.getState().dependencies).toHaveLength(1);

      useDataStore.getState().deleteDependency('dep-1');
      expect(useDataStore.getState().dependencies).toHaveLength(0);
    });

    it('should delete dependencies when task is deleted', () => {
      const task1: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        description: 'Task 1',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const task2: Task = {
        id: 'task-2',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        description: 'Task 2',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const dependency: TaskDependency = {
        id: 'dep-1',
        blockingTaskId: 'task-1',
        blockedTaskId: 'task-2',
        createdAt: new Date().toISOString(),
      };

      useDataStore.getState().addTask(task1);
      useDataStore.getState().addTask(task2);
      useDataStore.getState().addDependency(dependency);

      expect(useDataStore.getState().dependencies).toHaveLength(1);

      useDataStore.getState().deleteTask('task-1');

      expect(useDataStore.getState().dependencies).toHaveLength(0);
    });
  });

  describe('Selector Functions', () => {
    it('should get project by id', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        description: '',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addProject(project);

      const foundProject = useDataStore.getState().getProjectById('project-1');
      expect(foundProject).toEqual(project);
    });

    it('should get tasks by project id', () => {
      const task1: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        description: 'Task 1',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const task2: Task = {
        id: 'task-2',
        projectId: 'project-2',
        parentTaskId: null,
        sectionId: null,
        description: 'Task 2',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addTask(task1);
      useDataStore.getState().addTask(task2);

      const projectTasks = useDataStore.getState().getTasksByProjectId('project-1');
      expect(projectTasks).toHaveLength(1);
      expect(projectTasks[0].id).toBe('task-1');
    });

    it('should get subtasks by parent id', () => {
      const parentTask: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        description: 'Parent Task',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const subtask: Task = {
        id: 'task-2',
        projectId: 'project-1',
        parentTaskId: 'task-1',
        sectionId: null,
        description: 'Subtask',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addTask(parentTask);
      useDataStore.getState().addTask(subtask);

      const subtasks = useDataStore.getState().getSubtasks('task-1');
      expect(subtasks).toHaveLength(1);
      expect(subtasks[0].id).toBe('task-2');
    });

    it('should get sections by project id', () => {
      const section1: Section = {
        id: 'section-1',
        projectId: 'project-1',
        name: 'To Do',
        order: 0,
        collapsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const section2: Section = {
        id: 'section-2',
        projectId: 'project-2',
        name: 'Done',
        order: 0,
        collapsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addSection(section1);
      useDataStore.getState().addSection(section2);

      const projectSections = useDataStore.getState().getSectionsByProjectId('project-1');
      expect(projectSections).toHaveLength(1);
      expect(projectSections[0].id).toBe('section-1');
    });
  });

  describe('Store-Repository Synchronization', () => {
    it('should keep store state in sync with repository after task mutations', () => {
      const task: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        description: 'Test Task',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addTask(task);

      // Store state should match repository state
      expect(useDataStore.getState().tasks).toEqual(taskRepository.findAll());

      useDataStore.getState().updateTask('task-1', { description: 'Updated' });
      expect(useDataStore.getState().tasks).toEqual(taskRepository.findAll());

      useDataStore.getState().deleteTask('task-1');
      expect(useDataStore.getState().tasks).toEqual(taskRepository.findAll());
    });

    it('should keep store state in sync with repository after project mutations', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        description: '',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useDataStore.getState().addProject(project);

      expect(useDataStore.getState().projects).toEqual(projectRepository.findAll());
      expect(useDataStore.getState().sections).toEqual(sectionRepository.findAll());

      useDataStore.getState().deleteProject('project-1');
      expect(useDataStore.getState().projects).toEqual(projectRepository.findAll());
      expect(useDataStore.getState().sections).toEqual(sectionRepository.findAll());
    });

    it('should keep store state in sync with repository after dependency mutations', () => {
      const dependency: TaskDependency = {
        id: 'dep-1',
        blockingTaskId: 'task-1',
        blockedTaskId: 'task-2',
        createdAt: new Date().toISOString(),
      };

      useDataStore.getState().addDependency(dependency);
      expect(useDataStore.getState().dependencies).toEqual(dependencyRepository.findAll());

      useDataStore.getState().deleteDependency('dep-1');
      expect(useDataStore.getState().dependencies).toEqual(dependencyRepository.findAll());
    });
  });
});


// --- Property Test Configuration ---
const PROPERTY_CONFIG = { numRuns: 100 };

// --- Arbitraries for generating valid entities ---

const taskArbitrary: fc.Arbitrary<Task> = fc.record({
  id: fc.uuid(),
  projectId: fc.option(fc.uuid(), { nil: null }),
  parentTaskId: fc.constant(null),
  sectionId: fc.option(fc.string(), { nil: null }),
  description: fc.string({ minLength: 1, maxLength: 500 }),
  notes: fc.string(),
  assignee: fc.string(),
  priority: fc.constantFrom('none' as const, 'low' as const, 'medium' as const, 'high' as const),
  tags: fc.array(fc.string(), { maxLength: 5 }),
  dueDate: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  completed: fc.boolean(),
  completedAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  order: fc.integer(),
  createdAt: fc.date().map((d) => d.toISOString()),
  updatedAt: fc.date().map((d) => d.toISOString()),
});

const sectionArbitrary: fc.Arbitrary<Section> = fc.record({
  id: fc.string({ minLength: 1 }),
  projectId: fc.option(fc.string(), { nil: null }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  order: fc.integer(),
  collapsed: fc.boolean(),
  createdAt: fc.date().map((d) => d.toISOString()),
  updatedAt: fc.date().map((d) => d.toISOString()),
});

const dependencyArbitrary: fc.Arbitrary<TaskDependency> = fc.record({
  id: fc.uuid(),
  blockingTaskId: fc.uuid(),
  blockedTaskId: fc.uuid(),
  createdAt: fc.date().map((d) => d.toISOString()),
});

/**
 * Mutation type for store operations.
 */
type MutationType = 'create' | 'update' | 'delete';
const mutationTypeArbitrary = fc.constantFrom('create' as const, 'update' as const, 'delete' as const);

/**
 * Feature: architecture-refactor, Property 8: Store-repository synchronization
 *
 * For any mutation performed through a repository, the dataStore's cached state
 * for that entity type SHALL equal the repository's findAll() result after the
 * mutation completes.
 *
 * **Validates: Requirements 4.1, 4.5**
 */
describe('Property 8: Store-repository synchronization', () => {
  beforeEach(() => {
    localStorageBackend.reset();
  });

  it('tasks: store cache equals taskRepository.findAll() after random mutations', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(mutationTypeArbitrary, taskArbitrary), { minLength: 1, maxLength: 10 }),
        (mutations) => {
          localStorageBackend.reset();
          const createdIds: string[] = [];

          for (const [mutationType, task] of mutations) {
            switch (mutationType) {
              case 'create':
                useDataStore.getState().addTask(task);
                createdIds.push(task.id);
                break;
              case 'update':
                if (createdIds.length > 0) {
                  const targetId = createdIds[0];
                  useDataStore.getState().updateTask(targetId, { description: task.description });
                }
                break;
              case 'delete':
                if (createdIds.length > 0) {
                  const targetId = createdIds.shift()!;
                  useDataStore.getState().deleteTask(targetId);
                }
                break;
            }

            // After each mutation, store state must equal repository state
            expect(useDataStore.getState().tasks).toEqual(taskRepository.findAll());
          }
        },
      ),
      PROPERTY_CONFIG,
    );
  });

  it('sections: store cache equals sectionRepository.findAll() after random mutations', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(mutationTypeArbitrary, sectionArbitrary), { minLength: 1, maxLength: 10 }),
        (mutations) => {
          localStorageBackend.reset();
          const createdIds: string[] = [];

          for (const [mutationType, section] of mutations) {
            switch (mutationType) {
              case 'create':
                useDataStore.getState().addSection(section);
                createdIds.push(section.id);
                break;
              case 'update':
                if (createdIds.length > 0) {
                  const targetId = createdIds[0];
                  useDataStore.getState().updateSection(targetId, { name: section.name });
                }
                break;
              case 'delete':
                if (createdIds.length > 0) {
                  const targetId = createdIds.shift()!;
                  useDataStore.getState().deleteSection(targetId);
                }
                break;
            }

            expect(useDataStore.getState().sections).toEqual(sectionRepository.findAll());
          }
        },
      ),
      PROPERTY_CONFIG,
    );
  });

  it('dependencies: store cache equals dependencyRepository.findAll() after random mutations', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(mutationTypeArbitrary, dependencyArbitrary), { minLength: 1, maxLength: 10 }),
        (mutations) => {
          localStorageBackend.reset();
          const createdIds: string[] = [];

          for (const [mutationType, dep] of mutations) {
            switch (mutationType) {
              case 'create':
                useDataStore.getState().addDependency(dep);
                createdIds.push(dep.id);
                break;
              case 'delete':
                if (createdIds.length > 0) {
                  const targetId = createdIds.shift()!;
                  useDataStore.getState().deleteDependency(targetId);
                }
                break;
              default:
                // Dependencies only support create/delete
                break;
            }

            expect(useDataStore.getState().dependencies).toEqual(dependencyRepository.findAll());
          }
        },
      ),
      PROPERTY_CONFIG,
    );
  });

  it('projects: store cache equals projectRepository.findAll() after random mutations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            mutationTypeArbitrary,
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 200 }),
              description: fc.string(),
              viewMode: fc.constantFrom('list' as const, 'board' as const, 'calendar' as const),
              createdAt: fc.date().map((d) => d.toISOString()),
              updatedAt: fc.date().map((d) => d.toISOString()),
            }),
          ),
          { minLength: 1, maxLength: 5 },
        ),
        (mutations) => {
          localStorageBackend.reset();
          const createdIds: string[] = [];

          for (const [mutationType, project] of mutations) {
            switch (mutationType) {
              case 'create':
                useDataStore.getState().addProject(project);
                createdIds.push(project.id);
                break;
              case 'update':
                if (createdIds.length > 0) {
                  const targetId = createdIds[0];
                  useDataStore.getState().updateProject(targetId, { name: project.name });
                }
                break;
              case 'delete':
                if (createdIds.length > 0) {
                  const targetId = createdIds.shift()!;
                  useDataStore.getState().deleteProject(targetId);
                }
                break;
            }

            // After each mutation, both projects and sections must stay in sync
            // (addProject creates default sections, deleteProject cascades)
            expect(useDataStore.getState().projects).toEqual(projectRepository.findAll());
            expect(useDataStore.getState().sections).toEqual(sectionRepository.findAll());
          }
        },
      ),
      PROPERTY_CONFIG,
    );
  });
});
