import { describe, it, expect } from 'vitest';
import {
  Priority,
  ViewMode,
  TimeManagementSystem,
  type UUID,
  type ISODateString,
  type Project,
  type Task,
  type Section,
  type Column,
  type TaskDependency,
  type TMSState,
  type AppSettings,
  type AppState,
  type Comment,
  type Attachment
} from './index';

describe('Core Type Definitions', () => {
  describe('Enums', () => {
    it('should define Priority enum with correct values', () => {
      expect(Priority.NONE).toBe('none');
      expect(Priority.LOW).toBe('low');
      expect(Priority.MEDIUM).toBe('medium');
      expect(Priority.HIGH).toBe('high');
    });

    it('should define ViewMode enum with correct values', () => {
      expect(ViewMode.LIST).toBe('list');
      expect(ViewMode.BOARD).toBe('board');
      expect(ViewMode.CALENDAR).toBe('calendar');
    });

    it('should define TimeManagementSystem enum with correct values', () => {
      expect(TimeManagementSystem.NONE).toBe('none');
      expect(TimeManagementSystem.DIT).toBe('dit');
      expect(TimeManagementSystem.AF4).toBe('af4');
      expect(TimeManagementSystem.FVP).toBe('fvp');
    });
  });

  describe('Type Aliases', () => {
    it('should accept UUID as string', () => {
      const uuid: UUID = '123e4567-e89b-12d3-a456-426614174000';
      expect(typeof uuid).toBe('string');
    });

    it('should accept ISODateString as string', () => {
      const isoDate: ISODateString = '2024-01-01T00:00:00.000Z';
      expect(typeof isoDate).toBe('string');
    });
  });

  describe('Interface Structures', () => {
    it('should create a valid Project object', () => {
      const project: Project = {
        id: '1',
        name: 'Test Project',
        description: 'A test project',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(project.id).toBe('1');
      expect(project.name).toBe('Test Project');
      expect(project.viewMode).toBe(ViewMode.LIST);
    });

    it('should create a valid Task object', () => {
      const task: Task = {
        id: '1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        columnId: null,
        description: 'Test task',
        notes: 'Some notes',
        assignee: 'John Doe',
        priority: Priority.HIGH,
        tags: ['urgent', 'bug'],
        dueDate: new Date().toISOString(),
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(task.description).toBe('Test task');
      expect(task.priority).toBe(Priority.HIGH);
      expect(task.tags).toHaveLength(2);
    });

    it('should create a valid Section object', () => {
      const section: Section = {
        id: '1',
        projectId: 'project-1',
        name: 'To Do',
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(section.name).toBe('To Do');
      expect(section.order).toBe(0);
    });

    it('should create a valid Column object', () => {
      const column: Column = {
        id: '1',
        projectId: 'project-1',
        name: 'In Progress',
        order: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(column.name).toBe('In Progress');
      expect(column.order).toBe(1);
    });

    it('should create a valid TaskDependency object', () => {
      const dependency: TaskDependency = {
        id: '1',
        blockingTaskId: 'task-1',
        blockedTaskId: 'task-2',
        createdAt: new Date().toISOString()
      };

      expect(dependency.blockingTaskId).toBe('task-1');
      expect(dependency.blockedTaskId).toBe('task-2');
    });

    it('should create a valid TMSState object', () => {
      const tmsState: TMSState = {
        activeSystem: TimeManagementSystem.DIT,
        dit: {
          todayTasks: ['task-1', 'task-2'],
          tomorrowTasks: ['task-3'],
          lastDayChange: new Date().toISOString()
        },
        af4: {
          markedTasks: [],
          markedOrder: []
        },
        fvp: {
          dottedTasks: [],
          currentX: null,
          selectionInProgress: false
        }
      };

      expect(tmsState.activeSystem).toBe(TimeManagementSystem.DIT);
      expect(tmsState.dit.todayTasks).toHaveLength(2);
      expect(tmsState.af4.markedTasks).toHaveLength(0);
    });

    it('should create a valid AppSettings object', () => {
      const settings: AppSettings = {
        activeProjectId: 'project-1',
        timeManagementSystem: TimeManagementSystem.NONE,
        showOnlyActionableTasks: false,
        theme: 'system'
      };

      expect(settings.activeProjectId).toBe('project-1');
      expect(settings.theme).toBe('system');
    });

    it('should create a valid AppState object', () => {
      const appState: AppState = {
        projects: [],
        tasks: [],
        sections: [],
        columns: [],
        dependencies: [],
        tmsState: {
          activeSystem: TimeManagementSystem.NONE,
          dit: {
            todayTasks: [],
            tomorrowTasks: [],
            lastDayChange: new Date().toISOString()
          },
          af4: {
            markedTasks: [],
            markedOrder: []
          },
          fvp: {
            dottedTasks: [],
            currentX: null,
            selectionInProgress: false
          }
        },
        settings: {
          activeProjectId: null,
          timeManagementSystem: TimeManagementSystem.NONE,
          showOnlyActionableTasks: false,
          theme: 'system'
        },
        version: '1.0.0'
      };

      expect(appState.version).toBe('1.0.0');
      expect(appState.projects).toHaveLength(0);
      expect(appState.settings.theme).toBe('system');
    });

    it('should create a valid Comment object', () => {
      const comment: Comment = {
        id: '1',
        taskId: 'task-1',
        author: 'John Doe',
        content: 'This is a comment',
        createdAt: new Date().toISOString()
      };

      expect(comment.author).toBe('John Doe');
      expect(comment.content).toBe('This is a comment');
    });

    it('should create a valid Attachment object', () => {
      const attachment: Attachment = {
        id: '1',
        taskId: 'task-1',
        filename: 'document.pdf',
        url: 'https://example.com/document.pdf',
        size: 1024,
        createdAt: new Date().toISOString()
      };

      expect(attachment.filename).toBe('document.pdf');
      expect(attachment.size).toBe(1024);
    });
  });

  describe('Optional Fields', () => {
    it('should allow optional fields in Project', () => {
      const project: Project = {
        id: '1',
        name: 'Test',
        description: '',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        color: '#FF0000',
        icon: '📁'
      };

      expect(project.color).toBe('#FF0000');
      expect(project.icon).toBe('📁');
    });

    it('should allow optional fields in Task', () => {
      const task: Task = {
        id: '1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        columnId: null,
        description: 'Test',
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
        comments: [],
        attachments: [],
        customFields: { customField1: 'value1' }
      };

      expect(task.comments).toHaveLength(0);
      expect(task.customFields?.customField1).toBe('value1');
    });

    it('should allow optional fields in AppSettings', () => {
      const settings: AppSettings = {
        activeProjectId: null,
        timeManagementSystem: TimeManagementSystem.NONE,
        showOnlyActionableTasks: false,
        theme: 'dark',
        notifications: true,
        defaultPriority: Priority.MEDIUM
      };

      expect(settings.notifications).toBe(true);
      expect(settings.defaultPriority).toBe(Priority.MEDIUM);
    });
  });

  describe('Null Values', () => {
    it('should allow null for nullable Task fields', () => {
      const task: Task = {
        id: '1',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: null,
        columnId: null,
        description: 'Test',
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

      expect(task.parentTaskId).toBeNull();
      expect(task.sectionId).toBeNull();
      expect(task.columnId).toBeNull();
      expect(task.dueDate).toBeNull();
      expect(task.completedAt).toBeNull();
    });

    it('should allow null for nullable AppSettings fields', () => {
      const settings: AppSettings = {
        activeProjectId: null,
        timeManagementSystem: TimeManagementSystem.NONE,
        showOnlyActionableTasks: false,
        theme: 'system'
      };

      expect(settings.activeProjectId).toBeNull();
    });

    it('should allow null for nullable FVP currentX', () => {
      const tmsState: TMSState = {
        activeSystem: TimeManagementSystem.FVP,
        dit: {
          todayTasks: [],
          tomorrowTasks: [],
          lastDayChange: new Date().toISOString()
        },
        af4: {
          markedTasks: [],
          markedOrder: []
        },
        fvp: {
          dottedTasks: [],
          currentX: null,
          selectionInProgress: false
        }
      };

      expect(tmsState.fvp.currentX).toBeNull();
    });
  });
});
