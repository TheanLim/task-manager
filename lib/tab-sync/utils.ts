import type { HeartbeatData } from './types';
import { STORAGE_KEYS } from './constants';

/**
 * Generates a unique identifier for a browser tab
 * Format: tab-{timestamp}-{random}
 * 
 * @returns A unique tab identifier string
 */
export function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Serializes heartbeat data to JSON string for localStorage storage
 * 
 * @param data - The heartbeat data to serialize
 * @returns JSON string representation of the heartbeat data
 */
export function serializeHeartbeat(data: HeartbeatData): string {
  return JSON.stringify(data);
}

/**
 * Deserializes heartbeat data from JSON string stored in localStorage
 * 
 * @param json - The JSON string to deserialize
 * @returns Parsed heartbeat data, or null if parsing fails
 */
export function deserializeHeartbeat(json: string): HeartbeatData | null {
  try {
    const parsed = JSON.parse(json);
    
    // Validate the parsed data has required fields
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.tabId === 'string' &&
      typeof parsed.timestamp === 'number'
    ) {
      return parsed as HeartbeatData;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if localStorage is available and functional
 * 
 * Tests localStorage by attempting to write and read a test value.
 * Returns false if localStorage is disabled, quota exceeded, or in private browsing mode.
 * 
 * @returns true if localStorage is available, false otherwise
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard function for validating data structure
 */
type Validator<T> = (data: unknown) => data is T;

/**
 * Safely reads an item from localStorage with validation and error recovery
 * 
 * Handles corrupted data by clearing invalid entries. Returns null if:
 * - The key doesn't exist
 * - The data cannot be parsed as JSON
 * - The data fails validation
 * 
 * @param key - The localStorage key to read
 * @param validator - Type guard function to validate the parsed data
 * @returns The validated data, or null if reading/validation fails
 */
export function safeGetItem<T>(key: string, validator: Validator<T>): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    
    const parsed = JSON.parse(item);
    if (validator(parsed)) {
      return parsed;
    }
    
    // Invalid data, clear it
    localStorage.removeItem(key);
    return null;
  } catch {
    // Parse error, clear corrupted data
    try {
      localStorage.removeItem(key);
    } catch {
      // Even cleanup failed, but we can still return null
    }
    return null;
  }
}

/**
 * Safely writes an item to localStorage with error handling
 * 
 * Handles quota exceeded errors and other localStorage write failures gracefully.
 * 
 * @param key - The localStorage key to write
 * @param value - The value to store (will be JSON stringified)
 * @returns true if write succeeded, false otherwise
 */
export function safeSetItem(key: string, value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    // Log error for debugging but don't throw
    console.error(`Failed to write to localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Safely removes an item from localStorage with error handling
 * 
 * @param key - The localStorage key to remove
 * @returns true if removal succeeded, false otherwise
 */
export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Failed to remove localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Checks if the current tab is the active tab
 * 
 * This is a utility function for write operation guards to ensure
 * only the active tab can write to localStorage.
 * 
 * @returns true if this tab is active, false otherwise
 */
export function isCurrentTabActive(): boolean {
  try {
    const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
    // If no active tab exists, we can't determine if we're active
    // In this case, we should not allow writes
    return activeTabId !== null;
  } catch {
    return false;
  }
}

/**
 * Guarded write operation to localStorage
 * 
 * Only allows writes if the current tab is the active tab.
 * This prevents race conditions by ensuring only one tab can write at a time.
 * 
 * @param key - The localStorage key to write
 * @param value - The value to store (will be JSON stringified)
 * @param tabId - The ID of the current tab (for verification)
 * @returns true if write succeeded, false if write was blocked or failed
 */
export function guardedWrite(key: string, value: unknown, tabId: string): boolean {
  try {
    const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
    
    // Only allow write if this tab is the active tab
    if (activeTabId !== tabId) {
      console.warn(`Write operation blocked: tab ${tabId} is not the active tab`);
      return false;
    }
    
    // Perform the write
    return safeSetItem(key, value);
  } catch (error) {
    console.error(`Guarded write failed for key "${key}":`, error);
    return false;
  }
}

/**
 * Creates a guarded localStorage wrapper for a specific tab
 * 
 * Returns an object with write methods that automatically check
 * if the tab is active before allowing writes.
 * 
 * @param tabId - The ID of the tab to create the wrapper for
 * @returns An object with guarded write methods
 */
export function createGuardedStorage(tabId: string) {
  return {
    /**
     * Sets an item in localStorage, but only if this tab is active
     * 
     * @param key - The localStorage key
     * @param value - The value to store
     * @returns true if write succeeded, false if blocked or failed
     */
    setItem(key: string, value: unknown): boolean {
      return guardedWrite(key, value, tabId);
    },
    
    /**
     * Gets an item from localStorage (always allowed)
     * 
     * @param key - The localStorage key
     * @returns The stored value, or null if not found
     */
    getItem(key: string): string | null {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    
    /**
     * Removes an item from localStorage, but only if this tab is active
     * 
     * @param key - The localStorage key
     * @returns true if removal succeeded, false if blocked or failed
     */
    removeItem(key: string): boolean {
      try {
        const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
        
        // Only allow removal if this tab is the active tab
        if (activeTabId !== tabId) {
          console.warn(`Remove operation blocked: tab ${tabId} is not the active tab`);
          return false;
        }
        
        return safeRemoveItem(key);
      } catch (error) {
        console.error(`Guarded remove failed for key "${key}":`, error);
        return false;
      }
    },
    
    /**
     * Checks if this tab can currently write to localStorage
     * 
     * @returns true if this tab is active and can write, false otherwise
     */
    canWrite(): boolean {
      try {
        const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
        return activeTabId === tabId;
      } catch {
        return false;
      }
    },
  };
}
