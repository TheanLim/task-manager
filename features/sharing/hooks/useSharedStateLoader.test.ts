import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleLoadSharedState } from './useSharedStateLoader';
import { LocalStorageBackend } from '@/lib/repositories/localStorageBackend';
import {
  LocalStorageTaskRepository,
  LocalStorageProjectRepository,
  LocalStorageSectionRepository,
  LocalStorageDependencyRepository,
} from '@/lib/repositories/localStorageRepositories';
import type { AppState, Project, Task } from '@/lib/schemas';

// --- Test helpers ---

const NOW = '2026-02-14T00:00:00.000Z';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: crypto.randomUUID(),
    name: 'Test Project',
    description: '',
    viewMode: 'list',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    projectId: null,
    parentTaskId: null,
    sectionId: null,
    description: 'Test Task',
    notes: '',
    assignee: '',
    priority: 'none',
    tags: [],
    dueDate: null,
    completed: false,
    completedAt: null,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeSharedState(overrides: Partial<AppState> = {}): AppState {
  return {
    projects: [],
    tasks: [],
    sections: [],
    dependencies: [],
    tmsState: {
      activeSystem: 'none',
      dit: { todayTasks: [], tomorrowTasks: [], lastDayChange: NOW },
      af4: { markedTasks: [], markedOrder: [] },
      fvp: { dottedTasks: [], currentX: null, selectionInProgress: false },
    },
    settings: {
      activeProjectId: null,
      timeManagementSystem: 'none',
      showOnlyActionableTasks: false,
      theme: 'system',
    },
    version: '1.0.0',
    ...overrides,
  };
}

// We need to mock the dataStore module to provide test-scoped repositories
// backed by a fresh LocalStorageBackend instead of the singleton.
let testBackend: LocalStorageBackend;
let testProjectRepo: LocalStorageProjectRepository;
let testTaskRepo: LocalStorageTaskRepository;
let testSectionRepo: LocalStorageSectionRepository;
let testDependencyRepo: LocalStorageDependencyRepository;

let mockAutomationRuleRepo: { create: ReturnType<typeof vi.fn>; findAll: ReturnType<typeof vi.fn>; findByProjectId: ReturnType<typeof vi.fn> };

vi.mock('@/stores/dataStore', () => ({
  get projectRepository() { return testProjectRepo; },
  get taskRepository() { return testTaskRepo; },
  get sectionRepository() { return testSectionRepo; },
  get dependencyRepository() { return testDependencyRepo; },
  get automationRuleRepository() { return mockAutomationRuleRepo; },
}));

describe('handleLoadSharedState', () => {
  let onLoadResult: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    testBackend = new LocalStorageBackend();
    testProjectRepo = new LocalStorageProjectRepository(testBackend);
    testTaskRepo = new LocalStorageTaskRepository(testBackend);
    testSectionRepo = new LocalStorageSectionRepository(testBackend);
    testDependencyRepo = new LocalStorageDependencyRepository(testBackend);
    mockAutomationRuleRepo = { create: vi.fn(), findAll: vi.fn(() => []), findByProjectId: vi.fn(() => []) };
    onLoadResult = vi.fn();
    // Mock window.history.replaceState used by clearUrlHash
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  describe('replace mode', () => {
    it('should populate the backend internal state so subsequent mutations survive', () => {
      const project = makeProject();
      const task = makeTask({ projectId: project.id });
      const shared = makeSharedState({ projects: [project], tasks: [task] });

      handleLoadSharedState(shared, 'replace', onLoadResult);

      // The critical assertion: backend must have the data, not just Zustand
      expect(testBackend.getEntities('projects')).toEqual([project]);
      expect(testBackend.getEntities('tasks')).toEqual([task]);
    });

    it('should persist shared data to localStorage', () => {
      const project = makeProject();
      const shared = makeSharedState({ projects: [project] });

      handleLoadSharedState(shared, 'replace', onLoadResult);

      // Verify a fresh backend loading from localStorage sees the data
      const freshBackend = new LocalStorageBackend();
      expect(freshBackend.getEntities('projects')).toEqual([project]);
    });

    it('should notify repository subscribers so Zustand store updates', () => {
      const taskRepo = new LocalStorageTaskRepository(testBackend);
      const subscriberSpy = vi.fn();
      taskRepo.subscribe(subscriberSpy);

      const task = makeTask();
      const shared = makeSharedState({ tasks: [task] });

      handleLoadSharedState(shared, 'replace', onLoadResult);

      expect(subscriberSpy).toHaveBeenCalled();
      // Subscriber should receive the shared tasks
      expect(testBackend.getEntities('tasks')).toEqual([task]);
    });

    it('should survive a mutation after loading shared state (the original bug)', () => {
      // This is the exact scenario that was broken:
      // 1. Load shared state
      // 2. Mutate a task (e.g., drag reorder)
      // 3. Data should NOT disappear
      const project = makeProject();
      const task1 = makeTask({ projectId: project.id, order: 0 });
      const task2 = makeTask({ projectId: project.id, order: 1 });
      const shared = makeSharedState({
        projects: [project],
        tasks: [task1, task2],
      });

      handleLoadSharedState(shared, 'replace', onLoadResult);

      // Simulate a drag reorder via the repository (same path as real UI)
      const taskRepo = new LocalStorageTaskRepository(testBackend);
      taskRepo.update(task1.id, { order: 1 });
      taskRepo.update(task2.id, { order: 0 });

      // Both tasks should still exist with updated orders
      const tasks = testBackend.getEntities('tasks');
      expect(tasks).toHaveLength(2);
      expect(tasks.find(t => t.id === task1.id)?.order).toBe(1);
      expect(tasks.find(t => t.id === task2.id)?.order).toBe(0);

      // And the project should still be there
      expect(testBackend.getEntities('projects')).toHaveLength(1);
    });

    it('should call onLoadResult with success', () => {
      const shared = makeSharedState({ projects: [makeProject()] });

      handleLoadSharedState(shared, 'replace', onLoadResult);

      expect(onLoadResult).toHaveBeenCalledWith({
        message: 'Shared data loaded successfully!',
        type: 'success',
      });
    });

    it('should clear the URL hash', () => {
      const shared = makeSharedState();

      handleLoadSharedState(shared, 'replace', onLoadResult);

      expect(window.history.replaceState).toHaveBeenCalled();
    });
  });

  describe('merge mode', () => {
    it('should merge new items into the backend', () => {
      // Pre-populate backend with existing data
      const existingProject = makeProject({ name: 'Existing' });
      testBackend.setEntities('projects', [existingProject]);

      const newProject = makeProject({ name: 'From Share' });
      const shared = makeSharedState({ projects: [newProject] });

      handleLoadSharedState(shared, 'merge', onLoadResult);

      const projects = testBackend.getEntities('projects');
      expect(projects).toHaveLength(2);
      expect(projects.map(p => p.name)).toContain('Existing');
      expect(projects.map(p => p.name)).toContain('From Share');
    });

    it('should skip duplicate items by ID', () => {
      const project = makeProject({ name: 'Original' });
      testBackend.setEntities('projects', [project]);

      // Share the same project (same ID)
      const shared = makeSharedState({
        projects: [{ ...project, name: 'Duplicate' }],
      });

      handleLoadSharedState(shared, 'merge', onLoadResult);

      const projects = testBackend.getEntities('projects');
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Original'); // keeps existing, skips shared
    });

    it('should persist merged data to localStorage', () => {
      const existing = makeProject({ name: 'Existing' });
      testBackend.setEntities('projects', [existing]);

      const newProj = makeProject({ name: 'New' });
      const shared = makeSharedState({ projects: [newProj] });

      handleLoadSharedState(shared, 'merge', onLoadResult);

      const freshBackend = new LocalStorageBackend();
      expect(freshBackend.getEntities('projects')).toHaveLength(2);
    });

    it('should survive mutations after merge (the original bug)', () => {
      const existingTask = makeTask({ description: 'Existing', order: 0 });
      testBackend.setEntities('tasks', [existingTask]);

      const sharedTask = makeTask({ description: 'Shared', order: 1 });
      const shared = makeSharedState({ tasks: [sharedTask] });

      handleLoadSharedState(shared, 'merge', onLoadResult);

      // Mutate via repository
      const taskRepo = new LocalStorageTaskRepository(testBackend);
      taskRepo.update(existingTask.id, { order: 2 });

      // Both tasks should still exist
      const tasks = testBackend.getEntities('tasks');
      expect(tasks).toHaveLength(2);
      expect(tasks.find(t => t.id === sharedTask.id)).toBeDefined();
    });
  });

  describe('cancel mode', () => {
    it('should not modify the backend', () => {
      const shared = makeSharedState({ projects: [makeProject()] });

      handleLoadSharedState(shared, 'cancel', onLoadResult);

      expect(testBackend.getEntities('projects')).toEqual([]);
    });

    it('should not call onLoadResult', () => {
      const shared = makeSharedState();

      handleLoadSharedState(shared, 'cancel', onLoadResult);

      expect(onLoadResult).not.toHaveBeenCalled();
    });
  });

  describe('includeAutomations option', () => {
    it('should import automation rules by default when present in shared state', () => {
      const rule = {
        id: 'rule-1',
        name: 'Test Rule',
        projectId: 'proj-1',
        trigger: { type: 'card_moved_into_section', sectionId: 'sec-1' },
        action: { type: 'mark_complete' },
        enabled: true,
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
        filters: [],
        recentExecutions: [],
        brokenReason: null,
      };
      const shared = {
        ...makeSharedState({ sections: [{ id: 'sec-1', name: 'Done', projectId: 'proj-1', order: 0, createdAt: NOW, updatedAt: NOW }] as any }),
        automationRules: [rule],
      };

      handleLoadSharedState(shared as any, 'replace', onLoadResult);

      expect(mockAutomationRuleRepo.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'rule-1' }));
    });

    it('should skip automation rules when includeAutomations is false', () => {
      const rule = {
        id: 'rule-1',
        name: 'Test Rule',
        projectId: 'proj-1',
        trigger: { type: 'card_moved_into_section', sectionId: 'sec-1' },
        action: { type: 'mark_complete' },
        enabled: true,
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
        filters: [],
        recentExecutions: [],
        brokenReason: null,
      };
      const shared = {
        ...makeSharedState(),
        automationRules: [rule],
      };

      handleLoadSharedState(shared as any, 'replace', onLoadResult, { includeAutomations: false });

      expect(mockAutomationRuleRepo.create).not.toHaveBeenCalled();
    });

    it('should not call importAutomationRules in cancel mode', () => {
      const shared = {
        ...makeSharedState(),
        automationRules: [{ id: 'rule-1' }],
      };

      handleLoadSharedState(shared as any, 'cancel', onLoadResult);

      expect(mockAutomationRuleRepo.create).not.toHaveBeenCalled();
    });
  });
});
