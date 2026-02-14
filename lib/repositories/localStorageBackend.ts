import { AppState, AppStateSchema } from '@/lib/schemas';
import type { Unsubscribe } from './types';

const STORAGE_KEY = 'task-management-app-state';
const DATA_KEY = 'task-management-data';
const TMS_KEY = 'task-management-tms';
const SETTINGS_KEY = 'task-management-settings';
const VERSION = '1.0.0';

function getDefaultTMSState(): AppState['tmsState'] {
  return {
    activeSystem: 'none',
    dit: {
      todayTasks: [],
      tomorrowTasks: [],
      lastDayChange: new Date().toISOString(),
    },
    af4: {
      markedTasks: [],
      markedOrder: [],
    },
    fvp: {
      dottedTasks: [],
      currentX: null,
      selectionInProgress: false,
    },
  };
}

function getDefaultSettings(): AppState['settings'] {
  return {
    activeProjectId: null,
    timeManagementSystem: 'none',
    showOnlyActionableTasks: false,
    theme: 'system',
  };
}

function getDefaultState(): AppState {
  return {
    projects: [],
    tasks: [],
    sections: [],
    dependencies: [],
    tmsState: getDefaultTMSState(),
    settings: getDefaultSettings(),
    version: VERSION,
  };
}

export class LocalStorageBackend {
  private state: AppState;
  private listeners: Map<string, Set<() => void>>;

  constructor() {
    this.listeners = new Map();
    this.state = this.load();
  }

  /**
   * Load AppState from localStorage, validating with Zod.
   * Tries the unified key first, then falls back to separate Zustand keys.
   * Returns default empty state if nothing is found or validation fails.
   */
  load(): AppState {
    if (typeof window === 'undefined') {
      return getDefaultState();
    }
    try {
      // Try unified key first
      const unifiedData = localStorage.getItem(STORAGE_KEY);
      if (unifiedData) {
        const parsed = JSON.parse(unifiedData);
        const result = AppStateSchema.safeParse(parsed);
        if (result.success) {
          return result.data;
        }
        console.error('Zod validation failed for unified key:', result.error.format());
      }

      // Fall back to separate Zustand persist keys
      const dataStr = localStorage.getItem(DATA_KEY);
      const tmsStr = localStorage.getItem(TMS_KEY);
      const settingsStr = localStorage.getItem(SETTINGS_KEY);

      if (!dataStr && !tmsStr && !settingsStr) {
        return getDefaultState();
      }

      const data = dataStr
        ? JSON.parse(dataStr)
        : { state: { projects: [], tasks: [], sections: [], dependencies: [] } };
      const tms = tmsStr
        ? JSON.parse(tmsStr)
        : { state: { state: getDefaultTMSState() } };
      const settingsData = settingsStr
        ? JSON.parse(settingsStr)
        : { state: { settings: getDefaultSettings() } };

      const assembled: AppState = {
        projects: data.state?.projects ?? [],
        tasks: data.state?.tasks ?? [],
        sections: data.state?.sections ?? [],
        dependencies: data.state?.dependencies ?? [],
        tmsState: tms.state?.state ?? getDefaultTMSState(),
        settings: settingsData.state?.settings ?? getDefaultSettings(),
        version: VERSION,
      };

      const result = AppStateSchema.safeParse(assembled);
      if (!result.success) {
        console.error('Zod validation failed for assembled state:', result.error.format());
        return getDefaultState();
      }

      return result.data;
    } catch (error) {
      console.error('Failed to load state from localStorage:', error);
      return getDefaultState();
    }
  }

  /**
   * Persist current state to localStorage.
   * Writes to both the unified key and the separate Zustand keys for backward compatibility.
   */
  save(): void {
    if (typeof window === 'undefined') return;
    try {
      // Unified key
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));

      // Separate Zustand persist keys
      localStorage.setItem(
        DATA_KEY,
        JSON.stringify({
          state: {
            projects: this.state.projects,
            tasks: this.state.tasks,
            sections: this.state.sections,
            dependencies: this.state.dependencies,
          },
          version: 1,
        }),
      );

      localStorage.setItem(
        TMS_KEY,
        JSON.stringify({
          state: { state: this.state.tmsState },
          version: 1,
        }),
      );

      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          state: {
            settings: this.state.settings,
            projectTabs: {},
          },
          version: 1,
        }),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new Error('localStorage quota exceeded');
      }
      throw error;
    }
  }

  /**
   * Get entities for a given top-level AppState key.
   */
  getEntities<K extends keyof AppState>(key: K): AppState[K] {
    return this.state[key];
  }

  /**
   * Set entities for a given top-level AppState key.
   * Persists to localStorage and notifies listeners for that key.
   */
  setEntities<K extends keyof AppState>(key: K, value: AppState[K]): void {
    this.state[key] = value;
    this.save();
    this.notify(key);
  }

  /**
   * Register a callback to be invoked whenever entities for the given key change.
   * Returns an unsubscribe function.
   */
  onEntityChange(key: string, callback: () => void): Unsubscribe {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Get the full current state (read-only snapshot).
   */
  getState(): AppState {
    return this.state;
  }
  /**
   * Reset the backend to default empty state.
   * Useful for testing to clear state between test runs.
   */
  reset(): void {
    this.state = getDefaultState();
    this.save();
    // Notify all listeners so subscribers get the empty state
    for (const key of this.listeners.keys()) {
      this.notify(key);
    }
  }

  private notify(key: string): void {
    const set = this.listeners.get(key);
    if (set) {
      for (const cb of set) {
        cb();
      }
    }
  }
}
