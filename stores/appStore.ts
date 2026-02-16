import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, TimeManagementSystem, UUID } from '@/types';
import type { AutoHideThreshold } from '@/lib/schemas';
import type { ShortcutAction, ShortcutMap } from '@/features/keyboard/types';

// Column identifiers for the task table (excluding 'name' which is always first)
export type TaskColumnId = 'dueDate' | 'priority' | 'assignee' | 'tags' | 'project';

// Sortable column identifiers (includes 'name' and 'lastAction' for All Tasks page sorting)
export type SortableColumnId = 'name' | TaskColumnId | 'lastAction';

export type SortDirection = 'asc' | 'desc';

export const DEFAULT_COLUMN_ORDER: TaskColumnId[] = ['dueDate', 'priority', 'assignee', 'tags'];

// App Store Interface
interface AppStore {
  settings: AppSettings;
  projectTabs: Record<UUID, string>; // Map of projectId to active tab
  globalTasksDisplayMode: 'nested' | 'flat'; // Display mode for global tasks view
  columnOrder: TaskColumnId[]; // Persisted column order (excludes 'name' which is always first)
  sortColumn: SortableColumnId | null; // Currently sorted column, null = default order
  sortDirection: SortDirection; // Sort direction
  needsAttentionSort: boolean; // Whether "Needs Attention" sort is active on All Tasks page
  hideCompletedTasks: boolean; // Whether to hide completed tasks in All Tasks Normal mode
  autoHideThreshold: AutoHideThreshold; // Time threshold for auto-hiding completed tasks
  showRecentlyCompleted: boolean; // Whether to show recently auto-hidden completed tasks
  keyboardShortcuts: Partial<ShortcutMap>; // User overrides only (not the full map)
  
  setActiveProject: (projectId: UUID | null) => void;
  setTimeManagementSystem: (system: TimeManagementSystem) => void;
  setShowOnlyActionableTasks: (show: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setProjectTab: (projectId: UUID, tab: string) => void;
  getProjectTab: (projectId: UUID) => string;
  setGlobalTasksDisplayMode: (mode: 'nested' | 'flat') => void;
  setColumnOrder: (order: TaskColumnId[]) => void;
  toggleSort: (column: SortableColumnId) => void;
  clearSort: () => void;
  setNeedsAttentionSort: (active: boolean) => void;
  setHideCompletedTasks: (hide: boolean) => void;
  setAutoHideThreshold: (threshold: AutoHideThreshold) => void;
  setShowRecentlyCompleted: (show: boolean) => void;
  setKeyboardShortcut: (action: ShortcutAction, key: string) => void;
  resetKeyboardShortcuts: () => void;
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
      columnOrder: DEFAULT_COLUMN_ORDER,
      sortColumn: null,
      sortDirection: 'asc' as SortDirection,
      needsAttentionSort: false,
      hideCompletedTasks: false,
      autoHideThreshold: '24h' as AutoHideThreshold,
      showRecentlyCompleted: false,
      keyboardShortcuts: {},
      
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
      
      setGlobalTasksDisplayMode: (mode) => set({ globalTasksDisplayMode: mode }),
      
      setColumnOrder: (order) => set({ columnOrder: order }),
      
      toggleSort: (column) => set((state) => {
        if (state.sortColumn === column) {
          // Same column: toggle direction, or clear if already desc
          if (state.sortDirection === 'asc') {
            return { sortDirection: 'desc' as SortDirection, needsAttentionSort: false };
          }
          // Already desc, clear the sort
          return { sortColumn: null, sortDirection: 'asc' as SortDirection, needsAttentionSort: false };
        }
        // New column: set ascending, disable needs attention
        return { sortColumn: column, sortDirection: 'asc' as SortDirection, needsAttentionSort: false };
      }),
      
      clearSort: () => set({ sortColumn: null, sortDirection: 'asc' as SortDirection }),
      
      setNeedsAttentionSort: (active) => set({
        needsAttentionSort: active,
        // Clear column sort when enabling needs attention
        ...(active ? { sortColumn: null, sortDirection: 'asc' as SortDirection } : {}),
      }),
      
      setHideCompletedTasks: (hide) => set({ hideCompletedTasks: hide }),
      
      setAutoHideThreshold: (threshold) => set({ autoHideThreshold: threshold }),
      
      setShowRecentlyCompleted: (show) => set({ showRecentlyCompleted: show }),
      
      setKeyboardShortcut: (action, key) => set((state) => ({
        keyboardShortcuts: {
          ...state.keyboardShortcuts,
          [action]: { ...state.keyboardShortcuts[action], key } as ShortcutMap[ShortcutAction],
        },
      })),
      
      resetKeyboardShortcuts: () => set({ keyboardShortcuts: {} }),
    }),
    {
      name: 'task-management-settings',
      version: 1
    }
  )
);
