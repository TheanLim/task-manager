import { AppState, TimeManagementSystem } from '@/types';
import { AppStateSchema } from '@/lib/schemas';

/**
 * Custom error for storage operations
 */
export class StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Custom error for import operations
 */
export class ImportError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ImportError';
  }
}

/**
 * Interface for storage adapters
 */
export interface StorageAdapter {
  /** Load state from storage */
  load(): AppState | null;
  
  /** Save state to storage */
  save(state: AppState): void;
  
  /** Clear all data from storage */
  clear(): void;
  
  /** Export state to JSON string */
  exportToJSON(): string;
  
  /** Import state from JSON string */
  importFromJSON(json: string): AppState;
  
  /** Validate that an unknown value is a valid AppState */
  validateState(state: unknown): state is AppState;
}

/**
 * LocalStorage implementation of StorageAdapter
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly STORAGE_KEY = 'task-management-app-state';
  private readonly DATA_KEY = 'task-management-data';
  private readonly TMS_KEY = 'task-management-tms';
  private readonly SETTINGS_KEY = 'task-management-settings';
  private readonly VERSION = '1.0.0';
  
  /**
   * Load state from localStorage
   * Returns null if no data exists or if data is corrupted
   */
  load(): AppState | null {
    try {
      // Try the unified key first (for backward compatibility)
      const unifiedData = localStorage.getItem(this.STORAGE_KEY);
      if (unifiedData) {
        const parsed = JSON.parse(unifiedData);
        if (this.validateState(parsed)) {
          return parsed;
        }
      }
      
      // Otherwise, load from separate Zustand stores
      const dataStr = localStorage.getItem(this.DATA_KEY);
      const tmsStr = localStorage.getItem(this.TMS_KEY);
      const settingsStr = localStorage.getItem(this.SETTINGS_KEY);
      
      console.log('Loading from Zustand keys:', {
        hasData: !!dataStr,
        hasTms: !!tmsStr,
        hasSettings: !!settingsStr
      });
      
      if (!dataStr && !tmsStr && !settingsStr) return null;
      
      const data = dataStr ? JSON.parse(dataStr) : { state: { projects: [], tasks: [], sections: [], dependencies: [] } };
      const tms = tmsStr ? JSON.parse(tmsStr) : { state: { state: this.getDefaultTMSState() } };
      const settingsData = settingsStr ? JSON.parse(settingsStr) : { state: { settings: this.getDefaultSettings() } };
      
      console.log('Parsed Zustand data:', {
        dataState: data.state,
        tmsState: tms.state,
        settingsState: settingsData.state
      });
      
      const state: AppState = {
        projects: data.state?.projects || [],
        tasks: data.state?.tasks || [],
        sections: data.state?.sections || [],
        dependencies: data.state?.dependencies || [],
        tmsState: tms.state?.state || this.getDefaultTMSState(),
        settings: settingsData.state?.settings || this.getDefaultSettings(),
        version: this.VERSION
      };
      
      console.log('Constructed state:', state);
      
      if (!this.validateState(state)) {
        console.error('Zod validation failed for constructed state');
        return null;
      }
      
      return state;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      console.error('Failed to load state:', error);
      return null;
    }
  }
  
  private getDefaultTMSState() {
    return {
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
    };
  }
  
  private getDefaultSettings() {
    return {
      activeProjectId: null,
      timeManagementSystem: TimeManagementSystem.NONE,
      showOnlyActionableTasks: false,
      theme: 'system' as const
    };
  }
  
  /**
   * Save state to localStorage
   * Saves to both unified key and separate Zustand keys for compatibility
   */
  save(state: AppState): void {
    try {
      // Save to unified key
      const serialized = JSON.stringify(state);
      localStorage.setItem(this.STORAGE_KEY, serialized);
      
      // Also save to separate Zustand keys for app compatibility
      const dataState = {
        state: {
          projects: state.projects,
          tasks: state.tasks,
          sections: state.sections,
          dependencies: state.dependencies
        },
        version: 1
      };
      
      const tmsState = {
        state: {
          state: state.tmsState
        },
        version: 1
      };
      
      const settingsState = {
        state: {
          settings: state.settings,
          projectTabs: {} // Initialize empty projectTabs
        },
        version: 1
      };
      
      localStorage.setItem(this.DATA_KEY, JSON.stringify(dataState));
      localStorage.setItem(this.TMS_KEY, JSON.stringify(tmsState));
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settingsState));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new StorageError('localStorage quota exceeded', error);
      }
      throw new StorageError('Failed to save state to localStorage', error);
    }
  }
  
  /**
   * Clear all data from localStorage
   * Clears both unified key and separate Zustand keys
   */
  clear(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.DATA_KEY);
    localStorage.removeItem(this.TMS_KEY);
    localStorage.removeItem(this.SETTINGS_KEY);
  }
  
  /**
   * Export current state to JSON string with metadata
   * Returns empty state structure if no data exists
   */
  exportToJSON(): string {
    let state = this.load();
    
    // If no state exists, create an empty but valid state
    if (!state) {
      state = {
        projects: [],
        tasks: [],
        sections: [],
        dependencies: [],
        tmsState: this.getDefaultTMSState(),
        settings: this.getDefaultSettings(),
        version: this.VERSION
      };
    }
    
    const exportData = {
      ...state,
      exportedAt: new Date().toISOString(),
      version: this.VERSION
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * Import state from JSON string
   * Throws ImportError if JSON is invalid or state structure is invalid
   */
  importFromJSON(json: string): AppState {
    try {
      const parsed = JSON.parse(json);
      
      const result = AppStateSchema.safeParse(parsed);
      if (!result.success) {
        throw new ImportError(
          `Invalid import data: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        );
      }
      
      return result.data as unknown as AppState;
    } catch (error) {
      if (error instanceof ImportError) {
        throw error;
      }
      if (error instanceof SyntaxError) {
        throw new ImportError('Invalid JSON format', error);
      }
      throw new ImportError('Failed to import data', error);
    }
  }
  
  /**
   * Validate that an unknown value is a valid AppState using Zod schema
   */
  validateState(state: unknown): state is AppState {
    const result = AppStateSchema.safeParse(state);
    if (!result.success) {
      console.error('Validation failed:', result.error.format());
      return false;
    }
    return true;
  }
}
