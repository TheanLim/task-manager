import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  UUID,
  Project,
  Task,
  Section,
  TaskDependency,
} from '@/types';

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
  getSectionsByProjectId: (projectId: UUID) => Section[];
}

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      // Initial State
      projects: [],
      tasks: [],
      sections: [],
      dependencies: [],
      
      // Project Actions
      addProject: (project) => set((state) => {
        const now = new Date().toISOString();
        
        // Create default sections
        const defaultSections: Section[] = [
          {
            id: `${project.id}-section-todo`,
            projectId: project.id,
            name: 'To Do',
            order: 0,
            collapsed: false,
            createdAt: now,
            updatedAt: now
          },
          {
            id: `${project.id}-section-doing`,
            projectId: project.id,
            name: 'Doing',
            order: 1,
            collapsed: false,
            createdAt: now,
            updatedAt: now
          },
          {
            id: `${project.id}-section-done`,
            projectId: project.id,
            name: 'Done',
            order: 2,
            collapsed: false,
            createdAt: now,
            updatedAt: now
          }
        ];
        
        return {
          projects: [...state.projects, project],
          sections: [...state.sections, ...defaultSections]
        };
      }),
      
      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map(p => 
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        )
      })),
      
      deleteProject: (id) => set((state) => {
        // Cascading deletion: remove project and all associated tasks, sections
        const tasksToDelete = state.tasks.filter(t => t.projectId === id);
        const taskIdsToDelete = new Set(tasksToDelete.map(t => t.id));
        
        // Also need to delete subtasks of deleted tasks
        const getAllSubtaskIds = (parentId: UUID): UUID[] => {
          const subtasks = state.tasks.filter(t => t.parentTaskId === parentId);
          return [
            ...subtasks.map(t => t.id),
            ...subtasks.flatMap(t => getAllSubtaskIds(t.id))
          ];
        };
        
        tasksToDelete.forEach(task => {
          getAllSubtaskIds(task.id).forEach(id => taskIdsToDelete.add(id));
        });
        
        return {
          projects: state.projects.filter(p => p.id !== id),
          tasks: state.tasks.filter(t => !taskIdsToDelete.has(t.id)),
          sections: state.sections.filter(s => s.projectId !== id),
          dependencies: state.dependencies.filter(
            d => !taskIdsToDelete.has(d.blockingTaskId) && !taskIdsToDelete.has(d.blockedTaskId)
          )
        };
      }),
      
      // Task Actions
      addTask: (task) => set((state) => ({
        tasks: [...state.tasks, task]
      })),
      
      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map(t => 
          t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
        )
      })),
      
      deleteTask: (id) => set((state) => {
        const taskToDelete = state.tasks.find(t => t.id === id);
        if (!taskToDelete) return state;
        
        // Get all subtasks recursively
        const getSubtaskIds = (parentId: UUID): UUID[] => {
          const subtasks = state.tasks.filter(t => t.parentTaskId === parentId);
          return [
            ...subtasks.map(t => t.id),
            ...subtasks.flatMap(t => getSubtaskIds(t.id))
          ];
        };
        
        const idsToDelete = new Set([id, ...getSubtaskIds(id)]);
        
        return {
          tasks: state.tasks.filter(t => !idsToDelete.has(t.id)),
          dependencies: state.dependencies.filter(
            d => !idsToDelete.has(d.blockingTaskId) && !idsToDelete.has(d.blockedTaskId)
          )
        };
      }),
      
      // Section Actions
      addSection: (section) => set((state) => ({
        sections: [...state.sections, section]
      })),
      
      updateSection: (id, updates) => set((state) => ({
        sections: state.sections.map(s => 
          s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
        )
      })),
      
      deleteSection: (id) => set((state) => {
        // Find default section or create null assignment
        const sectionToDelete = state.sections.find(s => s.id === id);
        if (!sectionToDelete) return state;
        
        const defaultSection = state.sections.find(
          s => s.projectId === sectionToDelete.projectId && s.name === 'To Do'
        );
        
        return {
          sections: state.sections.filter(s => s.id !== id),
          tasks: state.tasks.map(t => 
            t.sectionId === id ? { ...t, sectionId: defaultSection?.id || null } : t
          )
        };
      }),
      
      toggleSectionCollapsed: (id) => set((state) => ({
        sections: state.sections.map(s =>
          s.id === id ? { ...s, collapsed: !s.collapsed, updatedAt: new Date().toISOString() } : s
        )
      })),
      
      // Dependency Actions
      addDependency: (dependency) => set((state) => ({
        dependencies: [...state.dependencies, dependency]
      })),
      
      deleteDependency: (id) => set((state) => ({
        dependencies: state.dependencies.filter(d => d.id !== id)
      })),
      
      // Selectors
      getProjectById: (id) => get().projects.find(p => p.id === id),
      
      getTasksByProjectId: (projectId) => 
        get().tasks.filter(t => t.projectId === projectId && !t.parentTaskId),
      
      getSubtasks: (parentId) => {
        const subtasks = get().tasks.filter(t => t.parentTaskId === parentId);
        // Sort by order to ensure correct display
        return subtasks.sort((a, b) => a.order - b.order);
      },
      
      getSectionsByProjectId: (projectId) => 
        get().sections.filter(s => s.projectId === projectId)
    }),
    {
      name: 'task-management-data',
      version: 1
    }
  )
);
