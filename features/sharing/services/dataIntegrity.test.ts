import { describe, it, expect, beforeEach } from 'vitest';
import { ShareService } from './shareService';
import { importFromJSON, validateAppState } from '@/features/sharing/services/importExport';
import { AppState, Priority, ViewMode, TimeManagementSystem } from '@/types';

// Fixed UUIDs for deterministic tests
const PROJ_1 = '10000000-0000-4000-8000-000000000001';
const PROJ_2 = '10000000-0000-4000-8000-000000000002';
const TASK_1 = '20000000-0000-4000-8000-000000000001';
const TASK_2 = '20000000-0000-4000-8000-000000000002';
const TASK_3 = '20000000-0000-4000-8000-000000000003';
const DEP_1 = '30000000-0000-4000-8000-000000000001';
const DEP_2 = '30000000-0000-4000-8000-000000000002';

describe('Data Integrity - Export/Import/Share', () => {
  let shareService: ShareService;
  let testState: AppState;

  beforeEach(() => {
    shareService = new ShareService();

    // Create comprehensive test state with all data types
    testState = {
      projects: [
        {
          id: PROJ_1,
          name: 'Test Project 1',
          description: 'Description with special chars: <>&"\'',
          viewMode: ViewMode.LIST,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: PROJ_2,
          name: 'Test Project 2',
          description: 'Unicode test: 你好世界 🌍',
          viewMode: ViewMode.BOARD,
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-04T00:00:00.000Z',
        }
      ],
      tasks: [
        {
          id: TASK_1,
          projectId: PROJ_1,
          parentTaskId: null,
          sectionId: 'section-1',
          description: 'Parent task with special chars: <>&"\'',
          notes: 'Notes with newlines\nand tabs\t',
          assignee: 'user@example.com',
          priority: Priority.HIGH,
          tags: ['urgent', 'bug', 'frontend'],
          dueDate: '2024-12-31T23:59:59.999Z',
          completed: false,
          completedAt: null,
          order: 0,
          createdAt: '2024-01-05T00:00:00.000Z',
          updatedAt: '2024-01-06T00:00:00.000Z',
        },
        {
          id: TASK_2,
          projectId: PROJ_1,
          parentTaskId: TASK_1,
          sectionId: 'section-1',
          description: 'Subtask with unicode: 你好 🎉',
          notes: '',
          assignee: '',
          priority: Priority.MEDIUM,
          tags: [],
          dueDate: null,
          completed: true,
          completedAt: '2024-01-07T12:34:56.789Z',
          order: 0,
          createdAt: '2024-01-08T00:00:00.000Z',
          updatedAt: '2024-01-09T00:00:00.000Z',
        },
        {
          id: TASK_3,
          projectId: PROJ_2,
          parentTaskId: null,
          sectionId: null,
          description: 'Task without section',
          notes: 'Long notes with multiple paragraphs.\n\nParagraph 2.\n\nParagraph 3.',
          assignee: 'another@example.com',
          priority: Priority.LOW,
          tags: ['enhancement', 'documentation'],
          dueDate: '2025-06-15T00:00:00.000Z',
          completed: false,
          completedAt: null,
          order: 1,
          createdAt: '2024-01-10T00:00:00.000Z',
          updatedAt: '2024-01-11T00:00:00.000Z',
        }
      ],
      sections: [
        {
          id: 'section-1',
          projectId: PROJ_1,
          name: 'To Do',
          order: 0,
          collapsed: false,
          createdAt: '2024-01-12T00:00:00.000Z',
          updatedAt: '2024-01-13T00:00:00.000Z',
        },
        {
          id: 'section-2',
          projectId: PROJ_1,
          name: 'In Progress',
          order: 1,
          collapsed: true,
          createdAt: '2024-01-14T00:00:00.000Z',
          updatedAt: '2024-01-15T00:00:00.000Z',
        },
        {
          id: 'section-3',
          projectId: PROJ_2,
          name: 'Done',
          order: 0,
          collapsed: false,
          createdAt: '2024-01-16T00:00:00.000Z',
          updatedAt: '2024-01-17T00:00:00.000Z',
        }
      ],
      dependencies: [
        {
          id: DEP_1,
          blockingTaskId: TASK_1,
          blockedTaskId: TASK_3,
          createdAt: '2024-01-18T00:00:00.000Z',
        },
        {
          id: DEP_2,
          blockingTaskId: TASK_2,
          blockedTaskId: TASK_3,
          createdAt: '2024-01-19T00:00:00.000Z',
        }
      ],
      tmsState: {
        activeSystem: TimeManagementSystem.DIT,
        dit: {
          todayTasks: [TASK_1, TASK_2],
          tomorrowTasks: [TASK_3],
          lastDayChange: '2024-01-20T00:00:00.000Z',
        },
        af4: {
          markedTasks: [TASK_1],
          markedOrder: [TASK_1],
        },
        fvp: {
          dottedTasks: [TASK_2, TASK_3],
          currentX: TASK_2,
          selectionInProgress: true,
        }
      },
      settings: {
        activeProjectId: PROJ_1,
        timeManagementSystem: TimeManagementSystem.DIT,
        showOnlyActionableTasks: true,
        theme: 'dark',
      },
      version: '1.0.0'
    };
  });

  describe('Serialize to JSON', () => {
    it('should serialize all data fields correctly', () => {
      const json = shareService.serializeState(testState);
      const exported = JSON.parse(json);

      expect(exported.projects).toHaveLength(2);
      expect(exported.projects[0]).toMatchObject(testState.projects[0]);
      expect(exported.projects[1]).toMatchObject(testState.projects[1]);
      expect(exported.tasks).toHaveLength(3);
      expect(exported.tasks[0]).toMatchObject(testState.tasks[0]);
      expect(exported.sections).toHaveLength(3);
      expect(exported.dependencies).toHaveLength(2);
      expect(exported.tmsState).toMatchObject(testState.tmsState);
      expect(exported.settings).toMatchObject(testState.settings);
      expect(exported.version).toBe('1.0.0');
      expect(exported.exportedAt).toBeDefined();
    });

    it('should preserve special characters', () => {
      const json = shareService.serializeState(testState);
      const exported = JSON.parse(json);

      expect(exported.projects[0].description).toBe('Description with special chars: <>&"\'');
      expect(exported.tasks[0].description).toBe('Parent task with special chars: <>&"\'');
    });

    it('should preserve unicode characters', () => {
      const json = shareService.serializeState(testState);
      const exported = JSON.parse(json);

      expect(exported.projects[1].description).toBe('Unicode test: 你好世界 🌍');
      expect(exported.tasks[1].description).toBe('Subtask with unicode: 你好 🎉');
    });

    it('should preserve null values', () => {
      const json = shareService.serializeState(testState);
      const exported = JSON.parse(json);

      expect(exported.tasks[0].parentTaskId).toBeNull();
      expect(exported.tasks[0].completedAt).toBeNull();
      expect(exported.tasks[1].dueDate).toBeNull();
      expect(exported.tasks[2].sectionId).toBeNull();
    });

    it('should preserve empty arrays', () => {
      const json = shareService.serializeState(testState);
      const exported = JSON.parse(json);

      expect(exported.tasks[1].tags).toEqual([]);
    });

    it('should preserve boolean values', () => {
      const json = shareService.serializeState(testState);
      const exported = JSON.parse(json);

      expect(exported.tasks[0].completed).toBe(false);
      expect(exported.tasks[1].completed).toBe(true);
      expect(exported.sections[0].collapsed).toBe(false);
      expect(exported.sections[1].collapsed).toBe(true);
      expect(exported.settings.showOnlyActionableTasks).toBe(true);
    });
  });

  describe('Import from JSON', () => {
    it('should import all data fields correctly', () => {
      const json = JSON.stringify(testState);
      const imported = importFromJSON(json);

      expect(imported).toEqual(testState);
    });

    it('should validate imported data structure', () => {
      const json = JSON.stringify(testState);
      const imported = importFromJSON(json);

      expect(validateAppState(imported)).toBe(true);
    });

    it('should reject invalid JSON', () => {
      expect(() => {
        importFromJSON('invalid json {');
      }).toThrow();
    });

    it('should reject incomplete data structure', () => {
      const incomplete = {
        projects: [],
        tasks: [],
        // Missing sections, dependencies, tmsState, settings
      };

      expect(() => {
        importFromJSON(JSON.stringify(incomplete));
      }).toThrow();
    });
  });

  describe('Round-trip: Serialize -> Import', () => {
    it('should preserve all data through serialize/import cycle', () => {
      const json = shareService.serializeState(testState);
      const imported = importFromJSON(json);

      expect(imported.projects).toEqual(testState.projects);
      expect(imported.tasks).toEqual(testState.tasks);
      expect(imported.sections).toEqual(testState.sections);
      expect(imported.dependencies).toEqual(testState.dependencies);
      expect(imported.tmsState).toEqual(testState.tmsState);
      expect(imported.settings).toEqual(testState.settings);
      expect(imported.version).toEqual(testState.version);
    });

    it('should handle multiple import cycles', () => {
      let current = testState;

      for (let i = 0; i < 5; i++) {
        const json = JSON.stringify(current);
        current = importFromJSON(json);
      }

      expect(current.projects).toEqual(testState.projects);
      expect(current.tasks).toEqual(testState.tasks);
      expect(current.sections).toEqual(testState.sections);
      expect(current.dependencies).toEqual(testState.dependencies);
    });
  });

  describe('Share URL: Serialize -> Encode -> Decode', () => {
    it('should preserve data through serialization', () => {
      const json = shareService.serializeState(testState);
      const serialized = JSON.parse(json);

      expect(serialized.projects).toEqual(testState.projects);
      expect(serialized.tasks).toEqual(testState.tasks);
      expect(serialized.sections).toEqual(testState.sections);
      expect(serialized.dependencies).toEqual(testState.dependencies);
      expect(serialized.tmsState).toEqual(testState.tmsState);
      expect(serialized.settings).toEqual(testState.settings);
    });

    it('should handle base64url encoding/decoding correctly', () => {
      const sampleCompressed = [-128, -64, 0, 64, 127, -1, 1, -2];

      const encoded = shareService.encodeForURL(sampleCompressed);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');

      const decoded = shareService.decodeFromURL(encoded);
      expect(decoded).toEqual(sampleCompressed);
    });

    it('should handle edge case byte values', () => {
      const edgeCases = [-128, -127, -1, 0, 1, 126, 127];

      const encoded = shareService.encodeForURL(edgeCases);
      const decoded = shareService.decodeFromURL(encoded);

      expect(decoded).toEqual(edgeCases);
    });
  });

  describe('Data Loss Detection', () => {
    it('should detect all entity counts in serialized output', () => {
      const json = shareService.serializeState(testState);
      const exported = JSON.parse(json);

      expect(exported.projects.length).toBe(testState.projects.length);
      expect(exported.tasks.length).toBe(testState.tasks.length);
      expect(exported.sections.length).toBe(testState.sections.length);
      expect(exported.dependencies.length).toBe(testState.dependencies.length);
      expect(exported.tmsState).toBeDefined();
      expect(exported.tmsState.dit.todayTasks).toEqual(testState.tmsState.dit.todayTasks);
      expect(exported.settings).toBeDefined();
      expect(exported.settings.activeProjectId).toBe(testState.settings.activeProjectId);
    });
  });

  describe('Empty State Handling', () => {
    it('should handle empty state serialization', () => {
      const emptyState: AppState = {
        projects: [],
        tasks: [],
        sections: [],
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

      const json = shareService.serializeState(emptyState);
      const exported = JSON.parse(json);

      expect(exported.projects).toEqual([]);
      expect(exported.tasks).toEqual([]);
      expect(exported.sections).toEqual([]);
      expect(exported.dependencies).toEqual([]);
    });
  });
});
