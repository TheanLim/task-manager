import { AppState, Project, Task, Section, TaskDependency, TMSState, AppSettings, TimeManagementSystem } from '@/types';

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
        console.error('Validation failed for state:', {
          hasProjects: Array.isArray((state as Record<string, unknown>).projects),
          hasTasks: Array.isArray((state as Record<string, unknown>).tasks),
          hasSections: Array.isArray((state as Record<string, unknown>).sections),
          hasDependencies: Array.isArray((state as Record<string, unknown>).dependencies),
          hasTmsState: !!(state as Record<string, unknown>).tmsState,
          hasSettings: !!(state as Record<string, unknown>).settings,
          tmsState: (state as Record<string, unknown>).tmsState,
          settings: (state as Record<string, unknown>).settings
        });
        throw new StorageError('Invalid state structure in localStorage');
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
      
      if (!this.validateState(parsed)) {
        throw new ImportError('Invalid import data structure');
      }
      
      return parsed;
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
   * Validate that an unknown value is a valid AppState
   */
  validateState(state: unknown): state is AppState {
    if (!state || typeof state !== 'object') {
      console.error('Validation failed: state is not an object');
      return false;
    }
    
    const s = state as Record<string, unknown>;
    
    // Check required top-level fields
    if (!Array.isArray(s.projects)) {
      console.error('Validation failed: projects is not an array');
      return false;
    }
    if (!Array.isArray(s.tasks)) {
      console.error('Validation failed: tasks is not an array');
      return false;
    }
    if (!Array.isArray(s.sections)) {
      console.error('Validation failed: sections is not an array');
      return false;
    }
    if (!Array.isArray(s.dependencies)) {
      console.error('Validation failed: dependencies is not an array');
      return false;
    }
    if (!s.tmsState || typeof s.tmsState !== 'object') {
      console.error('Validation failed: tmsState is invalid');
      return false;
    }
    if (!s.settings || typeof s.settings !== 'object') {
      console.error('Validation failed: settings is invalid', s.settings);
      return false;
    }
    if (typeof s.version !== 'string') {
      console.error('Validation failed: version is not a string');
      return false;
    }
    
    // Validate projects
    if (!this.validateProjects(s.projects)) {
      console.error('Validation failed: invalid project structure');
      return false;
    }
    
    // Validate tasks
    if (!this.validateTasks(s.tasks)) {
      console.error('Validation failed: invalid task structure');
      return false;
    }
    
    // Validate sections
    if (!this.validateSections(s.sections)) {
      console.error('Validation failed: invalid section structure');
      return false;
    }
    
    // Validate dependencies
    if (!this.validateDependencies(s.dependencies)) {
      console.error('Validation failed: invalid dependency structure');
      return false;
    }
    
    // Validate TMS state
    if (!this.validateTMSState(s.tmsState)) {
      console.error('Validation failed: invalid TMS state structure');
      return false;
    }
    
    // Validate settings
    if (!this.validateSettings(s.settings)) {
      console.error('Validation failed: invalid settings structure', s.settings);
      return false;
    }
    
    return true;
  }
  
  private validateProjects(projects: unknown): projects is Project[] {
    if (!Array.isArray(projects)) return false;
    
    return projects.every(p => 
      p && typeof p === 'object' &&
      typeof p.id === 'string' &&
      typeof p.name === 'string' &&
      typeof p.description === 'string' &&
      typeof p.viewMode === 'string' &&
      typeof p.createdAt === 'string' &&
      typeof p.updatedAt === 'string'
    );
  }
  
  private validateTasks(tasks: unknown): tasks is Task[] {
    if (!Array.isArray(tasks)) return false;
    
    return tasks.every(t => 
      t && typeof t === 'object' &&
      typeof t.id === 'string' &&
      (typeof t.projectId === 'string' || t.projectId === null) &&
      (t.parentTaskId === null || typeof t.parentTaskId === 'string') &&
      (t.sectionId === null || typeof t.sectionId === 'string') &&
      typeof t.description === 'string' &&
      typeof t.notes === 'string' &&
      typeof t.assignee === 'string' &&
      typeof t.priority === 'string' &&
      Array.isArray(t.tags) &&
      (t.dueDate === null || typeof t.dueDate === 'string') &&
      typeof t.completed === 'boolean' &&
      (t.completedAt === null || typeof t.completedAt === 'string') &&
      typeof t.order === 'number' &&
      typeof t.createdAt === 'string' &&
      typeof t.updatedAt === 'string'
    );
  }
  
  private validateSections(sections: unknown): sections is Section[] {
    if (!Array.isArray(sections)) return false;
    
    return sections.every(s => 
      s && typeof s === 'object' &&
      typeof s.id === 'string' &&
      (typeof s.projectId === 'string' || s.projectId === null) &&
      typeof s.name === 'string' &&
      typeof s.order === 'number' &&
      typeof s.collapsed === 'boolean' &&
      typeof s.createdAt === 'string' &&
      typeof s.updatedAt === 'string'
    );
  }
  
  private validateDependencies(dependencies: unknown): dependencies is TaskDependency[] {
    if (!Array.isArray(dependencies)) return false;
    
    return dependencies.every(d => 
      d && typeof d === 'object' &&
      typeof d.id === 'string' &&
      typeof d.blockingTaskId === 'string' &&
      typeof d.blockedTaskId === 'string' &&
      typeof d.createdAt === 'string'
    );
  }
  
  private validateTMSState(tmsState: unknown): tmsState is TMSState {
    if (!tmsState || typeof tmsState !== 'object') {
      console.error('TMS validation: not an object', tmsState);
      return false;
    }
    
    const t = tmsState as Record<string, unknown>;
    
    if (typeof t.activeSystem !== 'string') {
      console.error('TMS validation: activeSystem is not a string', t.activeSystem);
      return false;
    }
    
    // Validate DIT state
    if (!t.dit || typeof t.dit !== 'object') {
      console.error('TMS validation: dit is invalid', t.dit);
      return false;
    }
    const dit = t.dit as Record<string, unknown>;
    if (!Array.isArray(dit.todayTasks)) {
      console.error('TMS validation: dit.todayTasks is not an array', dit.todayTasks);
      return false;
    }
    if (!Array.isArray(dit.tomorrowTasks)) {
      console.error('TMS validation: dit.tomorrowTasks is not an array', dit.tomorrowTasks);
      return false;
    }
    if (typeof dit.lastDayChange !== 'string') {
      console.error('TMS validation: dit.lastDayChange is not a string', dit.lastDayChange);
      return false;
    }
    
    // Validate AF4 state
    if (!t.af4 || typeof t.af4 !== 'object') {
      console.error('TMS validation: af4 is invalid', t.af4);
      return false;
    }
    const af4 = t.af4 as Record<string, unknown>;
    if (!Array.isArray(af4.markedTasks)) {
      console.error('TMS validation: af4.markedTasks is not an array', af4.markedTasks);
      return false;
    }
    if (!Array.isArray(af4.markedOrder)) {
      console.error('TMS validation: af4.markedOrder is not an array', af4.markedOrder);
      return false;
    }
    
    // Validate FVP state
    if (!t.fvp || typeof t.fvp !== 'object') {
      console.error('TMS validation: fvp is invalid', t.fvp);
      return false;
    }
    const fvp = t.fvp as Record<string, unknown>;
    if (!Array.isArray(fvp.dottedTasks)) {
      console.error('TMS validation: fvp.dottedTasks is not an array', fvp.dottedTasks);
      return false;
    }
    if (fvp.currentX !== null && typeof fvp.currentX !== 'string') {
      console.error('TMS validation: fvp.currentX is invalid', fvp.currentX);
      return false;
    }
    if (typeof fvp.selectionInProgress !== 'boolean') {
      console.error('TMS validation: fvp.selectionInProgress is not a boolean', fvp.selectionInProgress);
      return false;
    }
    
    return true;
  }
  
  private validateSettings(settings: unknown): settings is AppSettings {
    if (!settings || typeof settings !== 'object') return false;
    
    const s = settings as Record<string, unknown>;
    
    if (s.activeProjectId !== null && typeof s.activeProjectId !== 'string') return false;
    if (typeof s.timeManagementSystem !== 'string') return false;
    if (typeof s.showOnlyActionableTasks !== 'boolean') return false;
    if (typeof s.theme !== 'string') return false;
    
    return true;
  }
}
