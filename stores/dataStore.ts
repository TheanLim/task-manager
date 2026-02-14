import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  UUID,
  Project,
  Task,
  Section,
  TaskDependency,
} from '@/types';
import { LocalStorageBackend } from '@/lib/repositories/localStorageBackend';
import {
  LocalStorageProjectRepository,
  LocalStorageTaskRepository,
  LocalStorageSectionRepository,
  LocalStorageDependencyRepository,
} from '@/lib/repositories/localStorageRepositories';
import { TaskService } from '@/features/tasks/services/taskService';
import { ProjectService } from '@/features/projects/services/projectService';
import { DependencyService } from '@/features/tasks/services/dependencyService';
import { DependencyResolverImpl } from '@/features/tasks/dependencyResolver';

// --- Repository & Service singletons ---
export const localStorageBackend = new LocalStorageBackend();
export const projectRepository = new LocalStorageProjectRepository(localStorageBackend);
export const taskRepository = new LocalStorageTaskRepository(localStorageBackend);
export const sectionRepository = new LocalStorageSectionRepository(localStorageBackend);
export const dependencyRepository = new LocalStorageDependencyRepository(localStorageBackend);

const dependencyResolver = new DependencyResolverImpl();
export const taskService = new TaskService(taskRepository, dependencyRepository);
export const projectService = new ProjectService(
  projectRepository,
  sectionRepository,
  taskService,
  taskRepository,
);
export const dependencyService = new DependencyService(dependencyRepository, dependencyResolver);

// Data Store Interface
interface DataStore {
  // State
  projects: Project[];
  tasks: Task[];
  sections: Section[];
  dependencies: TaskDependency[];
  
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
      },
      
      updateTask: (id, updates) => {
        taskRepository.update(id, { ...updates, updatedAt: new Date().toISOString() });
      },
      
      deleteTask: (id) => {
        taskService.cascadeDelete(id);
      },
      
      // Section Actions
      addSection: (section) => {
        sectionRepository.create(section);
      },
      
      updateSection: (id, updates) => {
        sectionRepository.update(id, { ...updates, updatedAt: new Date().toISOString() });
      },
      
      deleteSection: (id) => {
        // Reassign tasks from deleted section to "To Do" section, then delete
        const sectionToDelete = sectionRepository.findById(id);
        if (!sectionToDelete) return;
        
        const defaultSection = sectionRepository.findByProjectId(sectionToDelete.projectId)
          .find(s => s.name === 'To Do');
        
        // Reassign tasks that belong to this section
        const allTasks = taskRepository.findAll();
        for (const task of allTasks) {
          if (task.sectionId === id) {
            taskRepository.update(task.id, { sectionId: defaultSection?.id || null });
          }
        }
        
        sectionRepository.delete(id);
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
