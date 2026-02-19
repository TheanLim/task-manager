import { describe, it, expect, vi } from 'vitest';
import { importFromJSON, ImportError, validateAppState } from './importExport';
import { AppState, Priority, ViewMode, TimeManagementSystem } from '@/types';

const PROJECT_1_ID = '550e8400-e29b-41d4-a716-446655440001';
const TASK_1_ID = '550e8400-e29b-41d4-a716-446655440011';
const TASK_2_ID = '550e8400-e29b-41d4-a716-446655440012';
const SECTION_1_ID = 'section-todo';
const DEP_1_ID = '550e8400-e29b-41d4-a716-446655440021';
const PROJECT_2_ID = '550e8400-e29b-41d4-a716-446655440002';

const createValidAppState = (): AppState => ({
  projects: [{
    id: PROJECT_1_ID,
    name: 'Test Project',
    description: 'A test project',
    viewMode: ViewMode.LIST,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }],
  tasks: [{
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
    updatedAt: new Date().toISOString(),
  }],
  sections: [],
  dependencies: [],
  tmsState: {
    activeSystem: TimeManagementSystem.NONE,
    dit: { todayTasks: [], tomorrowTasks: [], lastDayChange: new Date().toISOString() },
    af4: { markedTasks: [], markedOrder: [] },
    fvp: { dottedTasks: [], currentX: null, selectionInProgress: false },
  },
  settings: {
    activeProjectId: null,
    timeManagementSystem: TimeManagementSystem.NONE,
    showOnlyActionableTasks: false,
    theme: 'system',
  },
  version: '1.0.0',
});

describe('importFromJSON', () => {
  it('should import valid JSON successfully', () => {
    const state = createValidAppState();
    const imported = importFromJSON(JSON.stringify(state));
    expect(imported).toEqual(state);
  });

  it('should throw ImportError for invalid JSON', () => {
    expect(() => importFromJSON('invalid json')).toThrow(ImportError);
    expect(() => importFromJSON('invalid json')).toThrow('Invalid JSON format');
  });

  it('should throw ImportError for invalid state structure', () => {
    expect(() => importFromJSON(JSON.stringify({ invalid: 'data' }))).toThrow(ImportError);
    expect(() => importFromJSON(JSON.stringify({ invalid: 'data' }))).toThrow('Invalid import data');
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
      updatedAt: new Date().toISOString(),
    });

    const imported = importFromJSON(JSON.stringify(state));
    expect(imported.tasks).toHaveLength(2);
    expect(imported.tasks[1].parentTaskId).toBe(TASK_1_ID);
    expect(imported.tasks[1].priority).toBe(Priority.HIGH);
  });

  it('should maintain data integrity through export/import cycle', () => {
    const state = createValidAppState();
    const json = JSON.stringify({ ...state, exportedAt: new Date().toISOString() });
    const imported = importFromJSON(json);

    expect(imported.projects).toEqual(state.projects);
    expect(imported.tasks).toEqual(state.tasks);
    expect(imported.tmsState).toEqual(state.tmsState);
    expect(imported.settings).toEqual(state.settings);
  });
});

describe('validateAppState', () => {
  it('should validate a complete valid state', () => {
    expect(validateAppState(createValidAppState())).toBe(true);
  });

  it('should reject null or undefined', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(validateAppState(null)).toBe(false);
    expect(validateAppState(undefined)).toBe(false);
    spy.mockRestore();
  });

  it('should reject non-object values', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(validateAppState('string')).toBe(false);
    expect(validateAppState(123)).toBe(false);
    expect(validateAppState(true)).toBe(false);
    spy.mockRestore();
  });

  it('should reject state missing required fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = createValidAppState();

    const { projects, ...withoutProjects } = state;
    expect(validateAppState(withoutProjects)).toBe(false);

    const { tasks, ...withoutTasks } = state;
    expect(validateAppState(withoutTasks)).toBe(false);

    const { tmsState, ...withoutTMS } = state;
    expect(validateAppState(withoutTMS)).toBe(false);

    const { settings, ...withoutSettings } = state;
    expect(validateAppState(withoutSettings)).toBe(false);
    spy.mockRestore();
  });

  it('should reject state with invalid structures', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = createValidAppState();

    expect(validateAppState({ ...state, projects: [{ invalid: 'project' }] })).toBe(false);
    expect(validateAppState({ ...state, tasks: [{ invalid: 'task' }] })).toBe(false);
    expect(validateAppState({ ...state, tmsState: { invalid: 'tms' } })).toBe(false);
    expect(validateAppState({ ...state, settings: { invalid: 'settings' } })).toBe(false);
    spy.mockRestore();
  });

  it('should validate state with empty arrays', () => {
    const state = createValidAppState();
    state.projects = [];
    state.tasks = [];
    state.sections = [];
    state.dependencies = [];
    expect(validateAppState(state)).toBe(true);
  });

  it('should validate state with multiple items', () => {
    const state = createValidAppState();
    state.projects.push({
      id: PROJECT_2_ID, name: 'Another', description: '',
      viewMode: ViewMode.BOARD, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    state.sections.push({
      id: SECTION_1_ID, projectId: PROJECT_1_ID, name: 'Section 1',
      order: 0, collapsed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    state.dependencies.push({
      id: DEP_1_ID, blockingTaskId: TASK_1_ID, blockedTaskId: TASK_2_ID, createdAt: new Date().toISOString(),
    });
    expect(validateAppState(state)).toBe(true);
  });
});
