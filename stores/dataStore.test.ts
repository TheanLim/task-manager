import { describe, it, expect, beforeEach } from 'vitest';
import { useDataStore } from './dataStore';
import type { Project, Task, Section, TaskDependency } from '@/types';
import { Priority, ViewMode } from '@/types';

describe('useDataStore', () => {
  // Helper to reset store before each test
  beforeEach(() => {
    useDataStore.setState({
      projects: [],
      tasks: [],
      sections: [],
      dependencies: []
    });
  });

  describe('Project CRUD Operations', () => {
    it('should add a project to the store', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      useDataStore.getState().addProject(project);
      
      const projects = useDataStore.getState().projects;
      expect(projects).toHaveLength(1);
      expect(projects[0]).toEqual(project);
    });

    it('should update a project', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      useDataStore.getState().addProject(project);
      useDataStore.getState().updateProject('project-1', { name: 'Updated Project' });
      
      const updatedProject = useDataStore.getState().getProjectById('project-1');
      expect(updatedProject?.name).toBe('Updated Project');
    });

    it('should delete a project and cascade to tasks', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        description: '',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const task: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        columnId: null,
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
        updatedAt: new Date().toISOString()
      };

      useDataStore.getState().addProject(project);
      useDataStore.getState().addTask(task);
      
      expect(useDataStore.getState().projects).toHaveLength(1);
      expect(useDataStore.getState().tasks).toHaveLength(1);
      
      useDataStore.getState().deleteProject('project-1');
      
      expect(useDataStore.getState().projects).toHaveLength(0);
      expect(useDataStore.getState().tasks).toHaveLength(0);
    });

    it('should delete project and cascade to subtasks', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        description: '',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const parentTask: Task = {
        id: 'task-1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        columnId: null,
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
        updatedAt: new Date().toISOString()
      };

      const subtask: Task = {
        id: 'task-2',
        projectId: 'project-1',
        parentTaskId: 'task-1',
        sectionId: null,
        columnId: null,
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
        updatedAt: new Date().toISOString()
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
        columnId: null,
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
        updatedAt: new Date().toISOString()
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
        columnId: null,
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
        updatedAt: new Date().toISOString()
      };

      useDataStore.getState().addTask(task);
      useDataStore.getState().updateTask('task-1', { 
        description: 'Updated Task',
        priority: Priority.HIGH 
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
        columnId: null,
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
        updatedAt: new Date().toISOString()
      };

      const subtask: Task = {
        id: 'task-2',
        projectId: 'project-1',
        parentTaskId: 'task-1',
        sectionId: null,
        columnId: null,
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
        updatedAt: new Date().toISOString()
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
        columnId: null,
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
        updatedAt: new Date().toISOString()
      };

      const subtask1: Task = {
        id: 'task-2',
        projectId: 'project-1',
        parentTaskId: 'task-1',
        sectionId: null,
        columnId: null,
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
        updatedAt: new Date().toISOString()
      };

      const subtask2: Task = {
        id: 'task-3',
        projectId: 'project-1',
        parentTaskId: 'task-2',
        sectionId: null,
        columnId: null,
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
        updatedAt: new Date().toISOString()
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
        updatedAt: new Date().toISOString()
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
        updatedAt: new Date().toISOString()
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
        updatedAt: new Date().toISOString()
      };

      const section: Section = {
        id: 'section-1',
        projectId: 'project-1',
        name: 'In Progress',
        order: 1,
        collapsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
        updatedAt: new Date().toISOString()
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
        updatedAt: new Date().toISOString()
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
        updatedAt: new Date().toISOString()
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
        createdAt: new Date().toISOString()
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
        createdAt: new Date().toISOString()
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
        columnId: null,
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
        updatedAt: new Date().toISOString()
      };

      const task2: Task = {
        id: 'task-2',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        columnId: null,
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
        updatedAt: new Date().toISOString()
      };

      const dependency: TaskDependency = {
        id: 'dep-1',
        blockingTaskId: 'task-1',
        blockedTaskId: 'task-2',
        createdAt: new Date().toISOString()
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
        updatedAt: new Date().toISOString()
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
        columnId: null,
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
        updatedAt: new Date().toISOString()
      };

      const task2: Task = {
        id: 'task-2',
        projectId: 'project-2',
        parentTaskId: null,
        sectionId: null,
        columnId: null,
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
        updatedAt: new Date().toISOString()
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
        columnId: null,
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
        updatedAt: new Date().toISOString()
      };

      const subtask: Task = {
        id: 'task-2',
        projectId: 'project-1',
        parentTaskId: 'task-1',
        sectionId: null,
        columnId: null,
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
        updatedAt: new Date().toISOString()
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
        updatedAt: new Date().toISOString()
      };

      const section2: Section = {
        id: 'section-2',
        projectId: 'project-2',
        name: 'Done',
        order: 0,
        collapsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      useDataStore.getState().addSection(section1);
      useDataStore.getState().addSection(section2);
      
      const projectSections = useDataStore.getState().getSectionsByProjectId('project-1');
      expect(projectSections).toHaveLength(1);
      expect(projectSections[0].id).toBe('section-1');
    });
  });
});
