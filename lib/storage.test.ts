import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageAdapter, StorageError, ImportError } from './storage';
import { AppState, Priority, ViewMode, TimeManagementSystem } from '@/types';

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let mockLocalStorage: Record<string, string>;
  
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
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        viewMode: ViewMode.LIST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    tasks: [
      {
        id: 'task-1',
        projectId: 'project-1',
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
    
    it('should throw StorageError when loading invalid state structure from Zustand keys', () => {
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
      
      expect(() => adapter.load()).toThrow(StorageError);
      expect(() => adapter.load()).toThrow('Invalid state structure');
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
      state.tmsState.dit.todayTasks = ['task-1'];
      state.settings.activeProjectId = 'project-1';
      
      adapter.save(state);
      const json = adapter.exportToJSON();
      const parsed = JSON.parse(json);
      
      expect(parsed.tmsState.dit.todayTasks).toEqual(['task-1']);
      expect(parsed.settings.activeProjectId).toBe('project-1');
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
      expect(() => adapter.importFromJSON(json)).toThrow('Invalid import data structure');
    });
    
    it('should import state with all fields', () => {
      const state = createValidAppState();
      state.tasks.push({
        id: 'task-2',
        projectId: 'project-1',
        parentTaskId: 'task-1',
        sectionId: 'section-1',
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
      expect(imported.tasks[1].parentTaskId).toBe('task-1');
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
        id: 'project-2',
        name: 'Another Project',
        description: 'Description',
        viewMode: ViewMode.BOARD,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Add sections
      state.sections.push({
        id: 'section-1',
        projectId: 'project-1',
        name: 'Section 1',
        order: 0,
        collapsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Add dependencies
      state.dependencies.push({
        id: 'dep-1',
        blockingTaskId: 'task-1',
        blockedTaskId: 'task-2',
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
