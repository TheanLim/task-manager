import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  UUID,
  Project,
  Task,
  Section,
  TaskDependency,
} from '@/types';
import { emitDomainEvent, subscribeToDomainEvents } from '@/lib/events';
import type { AutomationRule } from '@/features/automations/types';
import {
  projectRepository,
  taskRepository,
  sectionRepository,
  dependencyRepository,
  automationRuleRepository,
  taskService,
  projectService,
  sectionService,
  automationService,
} from '@/lib/serviceContainer';

// Re-export for consumers that import from dataStore
export {
  localStorageBackend,
  projectRepository,
  taskRepository,
  sectionRepository,
  dependencyRepository,
  automationRuleRepository,
  taskService,
  projectService,
  sectionService,
  dependencyService,
  automationService,
} from '@/lib/serviceContainer';

// Data Store Interface
interface DataStore {
  // State
  projects: Project[];
  tasks: Task[];
  sections: Section[];
  dependencies: TaskDependency[];
  automationRules: AutomationRule[];
  
  // Project Actions
  addProject: (project: Project) => void;
  updateProject: (id: UUID, updates: Partial<Project>) => void;
  deleteProject: (id: UUID) => void;
  
  // Task Actions
  addTask: (task: Task) => void;
  updateTask: (id: UUID, updates: Partial<Task>) => void;
  deleteTask: (id: UUID) => void;
  
  // Section Actions
  addSection: (section: Section) => void;
  updateSection: (id: UUID, updates: Partial<Section>) => void;
  deleteSection: (id: UUID) => void;
  toggleSectionCollapsed: (id: UUID) => void;
  
  // Dependency Actions
  addDependency: (dependency: TaskDependency) => void;
  deleteDependency: (id: UUID) => void;
  
  // Selectors
  getProjectById: (id: UUID) => Project | undefined;
  getTasksByProjectId: (projectId: UUID) => Task[];
  getSubtasks: (parentId: UUID) => Task[];
  getSectionsByProjectId: (projectId: UUID | null) => Section[];
  getUnlinkedSections: () => Section[];
}

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      // Initial State
      projects: [],
      tasks: [],
      sections: [],
      dependencies: [],
      automationRules: [],
      
      // Project Actions — delegate to services/repositories
      // Subscriptions handle state updates automatically
      addProject: (project) => {
        projectService.createWithDefaults(project);
      },
      
      updateProject: (id, updates) => {
        projectRepository.update(id, { ...updates, updatedAt: new Date().toISOString() });
      },
      
      deleteProject: (id) => {
        projectService.cascadeDelete(id);
      },
      
      // Task Actions
      addTask: (task) => {
        taskRepository.create(task);
        // Emit task.created domain event (wrapped in batch for aggregated toasts)
        automationService.beginBatch();
        emitDomainEvent({
          type: 'task.created',
          entityId: task.id,
          projectId: task.projectId || '',
          changes: { ...task },
          previousValues: {},
          depth: 0,
        });
        automationService.endBatch();
      },
      
      updateTask: (id, updates) => {
        // Capture previous values before mutation
        const previousTask = taskRepository.findById(id);
        if (!previousTask) return;
        
        const updatedTask = { ...updates, updatedAt: new Date().toISOString() };
        taskRepository.update(id, updatedTask);
        
        // Emit task.updated domain event (wrapped in batch for aggregated toasts)
        automationService.beginBatch();
        emitDomainEvent({
          type: 'task.updated',
          entityId: id,
          projectId: previousTask.projectId || '',
          changes: updatedTask,
          previousValues: previousTask,
          depth: 0,
        });
        automationService.endBatch();
      },
      
      deleteTask: (id) => {
        // Capture task data before deletion for event emission
        const taskToDelete = taskRepository.findById(id);
        if (!taskToDelete) return;
        
        taskService.cascadeDelete(id);
        
        // Emit task.deleted domain event (wrapped in batch for aggregated toasts)
        // Note: taskService.cascadeDelete also emits events, but only if emitEvent callback is wired (task 10.1)
        automationService.beginBatch();
        emitDomainEvent({
          type: 'task.deleted',
          entityId: id,
          projectId: taskToDelete.projectId || '',
          changes: {},
          previousValues: { ...taskToDelete },
          depth: 0,
        });
        automationService.endBatch();
      },
      
      // Section Actions
      addSection: (section) => {
        sectionRepository.create(section);
        // Emit section.created domain event (wrapped in batch for aggregated toasts)
        automationService.beginBatch();
        emitDomainEvent({
          type: 'section.created',
          entityId: section.id,
          projectId: section.projectId || '',
          changes: { ...section },
          previousValues: {},
          depth: 0,
        });
        automationService.endBatch();
      },
      
      updateSection: (id, updates) => {
        // Capture previous values before mutation
        const previousSection = sectionRepository.findById(id);
        if (!previousSection) return;
        
        const updatedSection = { ...updates, updatedAt: new Date().toISOString() };
        sectionRepository.update(id, updatedSection);
        
        // Emit section.updated domain event (wrapped in batch for aggregated toasts)
        automationService.beginBatch();
        emitDomainEvent({
          type: 'section.updated',
          entityId: id,
          projectId: previousSection.projectId || '',
          changes: updatedSection,
          previousValues: previousSection,
          depth: 0,
        });
        automationService.endBatch();
      },
      
      deleteSection: (id) => {
        sectionService.cascadeDelete(id);
      },
      
      toggleSectionCollapsed: (id) => {
        const section = sectionRepository.findById(id);
        if (!section) return;
        sectionRepository.update(id, {
          collapsed: !section.collapsed,
          updatedAt: new Date().toISOString(),
        });
      },
      
      // Dependency Actions
      addDependency: (dependency) => {
        dependencyRepository.create(dependency);
      },
      
      deleteDependency: (id) => {
        dependencyRepository.delete(id);
      },
      
      // Selectors — read from cached state
      getProjectById: (id) => get().projects.find(p => p.id === id),
      
      getTasksByProjectId: (projectId) => 
        get().tasks.filter(t => t.projectId === projectId && !t.parentTaskId),
      
      getSubtasks: (parentId) => {
        const subtasks = get().tasks.filter(t => t.parentTaskId === parentId);
        // Sort by order to ensure correct display
        return subtasks.sort((a, b) => a.order - b.order);
      },
      
      getSectionsByProjectId: (projectId) => 
        get().sections.filter(s => s.projectId === projectId),
      
      getUnlinkedSections: () =>
        get().sections.filter(s => s.projectId === null)
    }),
    {
      name: 'task-management-data',
      version: 1
    }
  )
);

// --- Subscribe to repositories and sync cached state ---
projectRepository.subscribe((projects) => {
  useDataStore.setState({ projects });
});

taskRepository.subscribe((tasks) => {
  useDataStore.setState({ tasks });
});

sectionRepository.subscribe((sections) => {
  useDataStore.setState({ sections });
});

dependencyRepository.subscribe((dependencies) => {
  useDataStore.setState({ dependencies });
});

// Subscribe automationRuleRepository to sync state to Zustand store (Requirement 8.4)
automationRuleRepository.subscribe((automationRules) => {
  useDataStore.setState({ automationRules });
});

// Subscribe automationService to domain events (Requirement 8.2)
subscribeToDomainEvents((event) => {
  automationService.handleEvent(event);
});
