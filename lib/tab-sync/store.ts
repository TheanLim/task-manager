import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * State for tab synchronization
 */
export interface TabSyncState {
  /** Whether this tab is currently the active tab */
  isActiveTab: boolean;
  /** Whether this tab is in read-only mode */
  isReadOnly: boolean;
  /** Whether this tab can edit (inverse of isReadOnly) */
  canEdit: boolean;
  /** Timestamp of the last synchronization from storage */
  lastSyncTime: number | null;
  /** Warning message to display to the user, or null if no warning */
  warningMessage: string | null;
  /** Whether localStorage is available for multi-tab coordination */
  isLocalStorageAvailable: boolean;
}

/**
 * Actions for managing tab synchronization state
 */
export interface TabSyncActions {
  /**
   * Sets the active status of this tab
   * 
   * @param isActive - Whether this tab is active
   */
  setActiveStatus(isActive: boolean): void;
  
  /**
   * Synchronizes data from localStorage
   * 
   * Updates the lastSyncTime to track when data was last synced.
   * This method should be called when storage events are received.
   */
  syncFromStorage(): void;
  
  /**
   * Triggers a force takeover action
   * 
   * This method is called when the user explicitly requests to take control
   * via the "Take control" button. The actual takeover logic is handled by
   * the TabCoordinator, but this action updates the store state.
   */
  forceTakeover(): void;
  
  /**
   * Sets a warning message to display to the user
   * 
   * @param message - The warning message, or null to clear the warning
   */
  setWarning(message: string | null): void;
  
  /**
   * Sets whether localStorage is available
   * 
   * @param available - Whether localStorage is available
   */
  setLocalStorageAvailable(available: boolean): void;
}

/**
 * Combined store type
 */
export type TabSyncStore = TabSyncState & TabSyncActions;

/**
 * Zustand store for tab synchronization state
 * 
 * This store manages the state of tab synchronization, including whether
 * this tab is active, read-only, and when data was last synced.
 * 
 * The store uses the persist middleware to save lastSyncTime to localStorage,
 * but does not persist active/read-only status as those are managed by
 * the TabCoordinator.
 */
export const useTabSyncStore = create<TabSyncStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isActiveTab: false,
      isReadOnly: true,
      canEdit: false,
      lastSyncTime: null,
      warningMessage: null,
      isLocalStorageAvailable: true,
      
      // Actions
      setActiveStatus: (isActive: boolean) => {
        set({
          isActiveTab: isActive,
          isReadOnly: !isActive,
          canEdit: isActive,
        });
      },
      
      syncFromStorage: () => {
        set({
          lastSyncTime: Date.now(),
        });
      },
      
      forceTakeover: () => {
        // This action is a placeholder for UI components to call
        // The actual takeover logic is handled by TabCoordinator
        // The store state will be updated via setActiveStatus after takeover succeeds
      },
      
      setWarning: (message: string | null) => {
        set({
          warningMessage: message,
        });
      },
      
      setLocalStorageAvailable: (available: boolean) => {
        set({
          isLocalStorageAvailable: available,
        });
      },
    }),
    {
      name: 'tab-sync-storage',
      // Only persist lastSyncTime, not active/read-only status
      partialize: (state) => ({
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
);
