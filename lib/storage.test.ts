import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageAdapter, StorageError, ImportError } from './storage';
import { AppState, Priority, ViewMode, TimeManagementSystem } from '@/types';
import { v4 as uuidv4 } from 'uuid';

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let mockLocalStorage: Record<string, string>;
  
  // Fixed UUIDs for deterministic tests
  const PROJECT_1_ID = '550e8400-e29b-41d4-a716-446655440001';
  const PROJECT_2_ID = '550e8400-e29b-41d4-a716-446655440002';
  const TASK_1_ID = '550e8400-e29b-41d4-a716-446655440011';
  const TASK_2_ID = '550e8400-e29b-41d4-a716-446655440012';
  const SECTION_1_ID = 'section-todo';
  const DEP_1_ID = '550e8400-e29b-41d4-a716-446655440021';
  
  beforeEach(() => {
    adapter = new LocalStorageAdapter();
    mockLocalStorage = {};
    
    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: vi.fn(() => {
        mockLocalStorage = {};
      }),
      length: 0,
      key: vi.fn(() => null)
    } as Storage;
  });
  
  const createValidAppState = (): AppState => ({
    projects: [
      {
        id: PROJECT_1_ID,
        name: 'Test Project',
        description: 'A test project',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    tasks: [
      {
        id: TASK_1_ID,
        projectId: PROJECT_1_ID,
        parentTaskId: null,
        sectionId: null,
        description: 'Test task',
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
      }
    ],
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
  });
  
  describe('save and load', () => {
    it('should save and load state successfully', () => {
      const state = createValidAppState();
      
      adapter.save(state);
      const loaded = adapter.load();
      
      expect(loaded).toEqual(state);
    });
    
    it('should return null when no data exists', () => {
      const loaded = adapter.load();
      expect(loaded).toBeNull();
    });
    
    it('should throw StorageError when saving fails due to quota exceeded', () => {
      const state = createValidAppState();
      
      // Mock quota exceeded error
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        const error = new DOMException('Quota exceeded', 'QuotaExceededError');
        throw error;
      });
      
      expect(() => adapter.save(state)).toThrow(StorageError);
      expect(() => adapter.save(state)).toThrow('localStorage quota exceeded');
    });
    
    it('should throw StorageError when loading corrupted data', () => {
      mockLocalStorage['task-management-app-state'] = 'invalid json';
      
      const loaded = adapter.load();
      expect(loaded).toBeNull();
    });
    
    it('should return null when loading invalid state structure from Zustand keys', () => {
      // Set data that will fail validation (projects is not an array)
      mockLocalStorage['task-management-data'] = JSON.stringify({ 
        state: { 
          projects: 'not-an-array',
          tasks: [],
          sections: [],
          dependencies: []
        } 
      });
      mockLocalStorage['task-management-tms'] = JSON.stringify({ 
        state: {
          activeSystem: 'none',
          dit: { todayTasks: [], tomorrowTasks: [], lastDayChange: new Date().toISOString() },
          af4: { markedTasks: [], markedOrder: [] },
          fvp: { dottedTasks: [], currentX: null, selectionInProgress: false }
        }
      });
      mockLocalStorage['task-management-settings'] = JSON.stringify({ 
        state: {
          activeProjectId: null,
          timeManagementSystem: 'none',
          showOnlyActionableTasks: false,
          theme: 'system'
        }
      });
      
      const loaded = adapter.load();
      expect(loaded).toBeNull();
    });
  });
  
  describe('clear', () => {
    it('should clear data from localStorage', () => {
      const state = createValidAppState();
      adapter.save(state);
      
      adapter.clear();
      
      const loaded = adapter.load();
      expect(loaded).toBeNull();
    });
  });
  
  describe('exportToJSON', () => {
    it('should export state to JSON with metadata', () => {
      const state = createValidAppState();
      adapter.save(state);
      
      const json = adapter.exportToJSON();
      const parsed = JSON.parse(json);
      
      expect(parsed.projects).toEqual(state.projects);
      expect(parsed.tasks).toEqual(state.tasks);
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.version).toBe('1.0.0');
    });
    
    it('should export empty state when no data exists', () => {
      const json = adapter.exportToJSON();
      const parsed = JSON.parse(json);
      
      expect(parsed.projects).toEqual([]);
      expect(parsed.tasks).toEqual([]);
      expect(parsed.sections).toEqual([]);
      expect(parsed.dependencies).toEqual([]);
      expect(parsed.tmsState).toBeDefined();
      expect(parsed.tmsState.activeSystem).toBe('none');
      expect(parsed.settings).toBeDefined();
      expect(parsed.settings.timeManagementSystem).toBe('none');
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.version).toBe('1.0.0');
    });
    
    it('should export all data including TMS state and settings', () => {
      const state = createValidAppState();
      state.tmsState.dit.todayTasks = [TASK_1_ID];
      state.settings.activeProjectId = PROJECT_1_ID;
      
      adapter.save(state);
      const json = adapter.exportToJSON();
      const parsed = JSON.parse(json);
      
      expect(parsed.tmsState.dit.todayTasks).toEqual([TASK_1_ID]);
      expect(parsed.settings.activeProjectId).toBe(PROJECT_1_ID);
    });
  });
  
  describe('importFromJSON', () => {
    it('should import valid JSON successfully', () => {
      const state = createValidAppState();
      const json = JSON.stringify(state);
      
      const imported = adapter.importFromJSON(json);
      
      expect(imported).toEqual(state);
    });
    
    it('should throw ImportError for invalid JSON', () => {
      expect(() => adapter.importFromJSON('invalid json')).toThrow(ImportError);
      expect(() => adapter.importFromJSON('invalid json')).toThrow('Invalid JSON format');
    });
    
    it('should throw ImportError for invalid state structure', () => {
      const invalidState = { invalid: 'data' };
      const json = JSON.stringify(invalidState);
      
      expect(() => adapter.importFromJSON(json)).toThrow(ImportError);
      expect(() => adapter.importFromJSON(json)).toThrow('Invalid import data');
    });
    
    it('should import state with all fields', () => {
      const state = createValidAppState();
      state.tasks.push({
        id: TASK_2_ID,
        projectId: PROJECT_1_ID,
        parentTaskId: TASK_1_ID,
        sectionId: SECTION_1_ID,
        description: 'Subtask',
        notes: 'Some notes',
        assignee: 'John',
        priority: Priority.HIGH,
        tags: ['urgent', 'bug'],
        dueDate: new Date().toISOString(),
        completed: true,
        completedAt: new Date().toISOString(),
        order: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      const json = JSON.stringify(state);
      const imported = adapter.importFromJSON(json);
      
      expect(imported.tasks).toHaveLength(2);
      expect(imported.tasks[1].parentTaskId).toBe(TASK_1_ID);
      expect(imported.tasks[1].priority).toBe(Priority.HIGH);
    });
  });
  
  describe('validateState', () => {
    it('should validate a complete valid state', () => {
      const state = createValidAppState();
      expect(adapter.validateState(state)).toBe(true);
    });
    
    it('should reject null or undefined', () => {
      expect(adapter.validateState(null)).toBe(false);
      expect(adapter.validateState(undefined)).toBe(false);
    });
    
    it('should reject non-object values', () => {
      expect(adapter.validateState('string')).toBe(false);
      expect(adapter.validateState(123)).toBe(false);
      expect(adapter.validateState(true)).toBe(false);
    });
    
    it('should reject state missing required fields', () => {
      const state = createValidAppState();
      
      // Missing projects
      const { projects, ...withoutProjects } = state;
      expect(adapter.validateState(withoutProjects)).toBe(false);
      
      // Missing tasks
      const { tasks, ...withoutTasks } = state;
      expect(adapter.validateState(withoutTasks)).toBe(false);
      
      // Missing tmsState
      const { tmsState, ...withoutTMS } = state;
      expect(adapter.validateState(withoutTMS)).toBe(false);
      
      // Missing settings
      const { settings, ...withoutSettings } = state;
      expect(adapter.validateState(withoutSettings)).toBe(false);
    });
    
    it('should reject state with invalid project structure', () => {
      const state = createValidAppState();
      state.projects = [{ invalid: 'project' }] as any;
      
      expect(adapter.validateState(state)).toBe(false);
    });
    
    it('should reject state with invalid task structure', () => {
      const state = createValidAppState();
      state.tasks = [{ invalid: 'task' }] as any;
      
      expect(adapter.validateState(state)).toBe(false);
    });
    
    it('should reject state with invalid TMS state structure', () => {
      const state = createValidAppState();
      state.tmsState = { invalid: 'tms' } as any;
      
      expect(adapter.validateState(state)).toBe(false);
    });
    
    it('should reject state with invalid settings structure', () => {
      const state = createValidAppState();
      state.settings = { invalid: 'settings' } as any;
      
      expect(adapter.validateState(state)).toBe(false);
    });
    
    it('should validate state with empty arrays', () => {
      const state = createValidAppState();
      state.projects = [];
      state.tasks = [];
      state.sections = [];
      state.dependencies = [];
      
      expect(adapter.validateState(state)).toBe(true);
    });
    
    it('should validate state with multiple items', () => {
      const state = createValidAppState();
      
      // Add more projects
      state.projects.push({
        id: PROJECT_2_ID,
        name: 'Another Project',
        description: 'Description',
        viewMode: ViewMode.BOARD,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Add sections
      state.sections.push({
        id: SECTION_1_ID,
        projectId: PROJECT_1_ID,
        name: 'Section 1',
        order: 0,
        collapsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Add dependencies
      state.dependencies.push({
        id: DEP_1_ID,
        blockingTaskId: TASK_1_ID,
        blockedTaskId: TASK_2_ID,
        createdAt: new Date().toISOString()
      });
      
      expect(adapter.validateState(state)).toBe(true);
    });
  });
  
  describe('round trip', () => {
    it('should maintain data integrity through save/load cycle', () => {
      const state = createValidAppState();
      
      adapter.save(state);
      const loaded = adapter.load();
      
      expect(loaded).toEqual(state);
    });
    
    it('should maintain data integrity through export/import cycle', () => {
      const state = createValidAppState();
      adapter.save(state);
      
      const json = adapter.exportToJSON();
      const imported = adapter.importFromJSON(json);
      
      // Remove exportedAt and version fields added during export
      const { exportedAt, version, ...importedWithoutMeta } = imported as any;
      
      expect(importedWithoutMeta.projects).toEqual(state.projects);
      expect(importedWithoutMeta.tasks).toEqual(state.tasks);
      expect(importedWithoutMeta.tmsState).toEqual(state.tmsState);
      expect(importedWithoutMeta.settings).toEqual(state.settings);
    });
  });
});
