import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, TimeManagementSystem, UUID } from '@/types';

// App Store Interface
interface AppStore {
  settings: AppSettings;
  projectTabs: Record<UUID, string>; // Map of projectId to active tab
  globalTasksDisplayMode: 'nested' | 'flat'; // Display mode for global tasks view
  
  setActiveProject: (projectId: UUID | null) => void;
  setTimeManagementSystem: (system: TimeManagementSystem) => void;
  setShowOnlyActionableTasks: (show: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setProjectTab: (projectId: UUID, tab: string) => void;
  getProjectTab: (projectId: UUID) => string;
  setGlobalTasksDisplayMode: (mode: 'nested' | 'flat') => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      settings: {
        activeProjectId: null,
        timeManagementSystem: TimeManagementSystem.NONE,
        showOnlyActionableTasks: false,
        theme: 'system'
      },
      projectTabs: {},
      globalTasksDisplayMode: 'nested',
      
      setActiveProject: (projectId) => set((state) => ({
        settings: { ...state.settings, activeProjectId: projectId }
      })),
      
      setTimeManagementSystem: (system) => set((state) => ({
        settings: { ...state.settings, timeManagementSystem: system }
      })),
      
      setShowOnlyActionableTasks: (show) => set((state) => ({
        settings: { ...state.settings, showOnlyActionableTasks: show }
      })),
      
      setTheme: (theme) => set((state) => ({
        settings: { ...state.settings, theme }
      })),
      
      setProjectTab: (projectId, tab) => set((state) => ({
        projectTabs: { ...state.projectTabs, [projectId]: tab }
      })),
      
      getProjectTab: (projectId) => {
        return get().projectTabs[projectId] || 'overview';
      },
      
      setGlobalTasksDisplayMode: (mode) => set({ globalTasksDisplayMode: mode })
    }),
    {
      name: 'task-management-settings',
      version: 1
    }
  )
);
