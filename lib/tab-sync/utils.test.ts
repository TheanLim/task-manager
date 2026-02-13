import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateTabId, serializeHeartbeat, deserializeHeartbeat } from './utils';
import type { HeartbeatData } from './types';

describe('generateTabId', () => {
  it('should generate a unique tab ID with correct format', () => {
    const tabId = generateTabId();
    
    // Should start with 'tab-'
    expect(tabId).toMatch(/^tab-/);
    
    // Should contain timestamp and random string
    expect(tabId).toMatch(/^tab-\d+-[a-z0-9]+$/);
  });

  it('should generate different IDs on subsequent calls', () => {
    const id1 = generateTabId();
    const id2 = generateTabId();
    
    expect(id1).not.toBe(id2);
  });

  it('should generate IDs with reasonable length', () => {
    const tabId = generateTabId();
    
    // Should be between 20 and 40 characters
    expect(tabId.length).toBeGreaterThan(20);
    expect(tabId.length).toBeLessThan(40);
  });
});

describe('serializeHeartbeat', () => {
  it('should serialize heartbeat data to JSON string', () => {
    const heartbeat: HeartbeatData = {
      tabId: 'tab-123-abc',
      timestamp: 1234567890,
    };
    
    const serialized = serializeHeartbeat(heartbeat);
    
    expect(serialized).toBe('{"tabId":"tab-123-abc","timestamp":1234567890}');
  });

  it('should handle special characters in tab ID', () => {
    const heartbeat: HeartbeatData = {
      tabId: 'tab-123-abc_def',
      timestamp: Date.now(),
    };
    
    const serialized = serializeHeartbeat(heartbeat);
    const parsed = JSON.parse(serialized);
    
    expect(parsed.tabId).toBe(heartbeat.tabId);
    expect(parsed.timestamp).toBe(heartbeat.timestamp);
  });
});

describe('deserializeHeartbeat', () => {
  it('should deserialize valid JSON string to heartbeat data', () => {
    const json = '{"tabId":"tab-123-abc","timestamp":1234567890}';
    
    const heartbeat = deserializeHeartbeat(json);
    
    expect(heartbeat).toEqual({
      tabId: 'tab-123-abc',
      timestamp: 1234567890,
    });
  });

  it('should return null for invalid JSON', () => {
    const invalidJson = 'not valid json';
    
    const heartbeat = deserializeHeartbeat(invalidJson);
    
    expect(heartbeat).toBeNull();
  });

  it('should return null for JSON missing tabId field', () => {
    const json = '{"timestamp":1234567890}';
    
    const heartbeat = deserializeHeartbeat(json);
    
    expect(heartbeat).toBeNull();
  });

  it('should return null for JSON missing timestamp field', () => {
    const json = '{"tabId":"tab-123-abc"}';
    
    const heartbeat = deserializeHeartbeat(json);
    
    expect(heartbeat).toBeNull();
  });

  it('should return null for JSON with wrong field types', () => {
    const json = '{"tabId":123,"timestamp":"not a number"}';
    
    const heartbeat = deserializeHeartbeat(json);
    
    expect(heartbeat).toBeNull();
  });

  it('should return null for null value', () => {
    const json = 'null';
    
    const heartbeat = deserializeHeartbeat(json);
    
    expect(heartbeat).toBeNull();
  });

  it('should return null for array value', () => {
    const json = '[{"tabId":"tab-123","timestamp":123}]';
    
    const heartbeat = deserializeHeartbeat(json);
    
    expect(heartbeat).toBeNull();
  });

  it('should handle round-trip serialization', () => {
    const original: HeartbeatData = {
      tabId: generateTabId(),
      timestamp: Date.now(),
    };
    
    const serialized = serializeHeartbeat(original);
    const deserialized = deserializeHeartbeat(serialized);
    
    expect(deserialized).toEqual(original);
  });
});

describe('isLocalStorageAvailable', () => {
  it('should return true when localStorage is available', async () => {
    const { isLocalStorageAvailable } = await import('./utils');
    
    const result = isLocalStorageAvailable();
    
    expect(result).toBe(true);
  });

  it('should clean up test key after checking', async () => {
    const { isLocalStorageAvailable } = await import('./utils');
    
    isLocalStorageAvailable();
    
    const testKey = localStorage.getItem('__localStorage_test__');
    expect(testKey).toBeNull();
  });
});

describe('safeGetItem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return validated data for valid item', async () => {
    const { safeGetItem } = await import('./utils');
    const validator = (data: unknown): data is { value: string } => {
      return typeof data === 'object' && data !== null && 'value' in data;
    };
    
    localStorage.setItem('test-key', JSON.stringify({ value: 'test' }));
    
    const result = safeGetItem('test-key', validator);
    
    expect(result).toEqual({ value: 'test' });
  });

  it('should return null for non-existent key', async () => {
    const { safeGetItem } = await import('./utils');
    const validator = (data: unknown): data is string => typeof data === 'string';
    
    const result = safeGetItem('non-existent', validator);
    
    expect(result).toBeNull();
  });

  it('should return null and clear corrupted JSON data', async () => {
    const { safeGetItem } = await import('./utils');
    const validator = (data: unknown): data is string => typeof data === 'string';
    
    // Manually set corrupted data
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => 'invalid json {',
        removeItem: vi.fn(),
        setItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: () => null,
      },
      writable: true,
    });
    
    const result = safeGetItem('corrupted-key', validator);
    
    expect(result).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('corrupted-key');
  });

  it('should return null and clear data that fails validation', async () => {
    const { safeGetItem } = await import('./utils');
    const validator = (data: unknown): data is { required: string } => {
      return typeof data === 'object' && data !== null && 'required' in data;
    };
    
    localStorage.setItem('invalid-data', JSON.stringify({ wrong: 'field' }));
    
    const result = safeGetItem('invalid-data', validator);
    
    expect(result).toBeNull();
    expect(localStorage.getItem('invalid-data')).toBeNull();
  });

  it('should handle complex validation logic', async () => {
    const { safeGetItem } = await import('./utils');
    const validator = (data: unknown): data is HeartbeatData => {
      return (
        typeof data === 'object' &&
        data !== null &&
        'tabId' in data &&
        'timestamp' in data &&
        typeof (data as any).tabId === 'string' &&
        typeof (data as any).timestamp === 'number'
      );
    };
    
    localStorage.setItem('heartbeat', JSON.stringify({ tabId: 'tab-1', timestamp: 123 }));
    
    const result = safeGetItem('heartbeat', validator);
    
    expect(result).toEqual({ tabId: 'tab-1', timestamp: 123 });
  });
});

describe('safeSetItem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should successfully write valid data', async () => {
    const { safeSetItem } = await import('./utils');
    
    const result = safeSetItem('test-key', { value: 'test' });
    
    expect(result).toBe(true);
    expect(localStorage.getItem('test-key')).toBe('{"value":"test"}');
  });

  it('should return false when localStorage.setItem throws', async () => {
    const { safeSetItem } = await import('./utils');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock localStorage to throw an error
    const mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    
    const result = safeSetItem('test-key', 'value');
    
    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    
    consoleError.mockRestore();
  });

  it('should handle various data types', async () => {
    const { safeSetItem } = await import('./utils');
    
    expect(safeSetItem('string', 'test')).toBe(true);
    expect(safeSetItem('number', 123)).toBe(true);
    expect(safeSetItem('boolean', true)).toBe(true);
    expect(safeSetItem('object', { a: 1 })).toBe(true);
    expect(safeSetItem('array', [1, 2, 3])).toBe(true);
    expect(safeSetItem('null', null)).toBe(true);
    
    expect(localStorage.getItem('string')).toBe('"test"');
    expect(localStorage.getItem('number')).toBe('123');
    expect(localStorage.getItem('boolean')).toBe('true');
    expect(localStorage.getItem('object')).toBe('{"a":1}');
    expect(localStorage.getItem('array')).toBe('[1,2,3]');
    expect(localStorage.getItem('null')).toBe('null');
  });
});

describe('safeRemoveItem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should successfully remove existing item', async () => {
    const { safeRemoveItem } = await import('./utils');
    
    localStorage.setItem('test-key', 'value');
    
    const result = safeRemoveItem('test-key');
    
    expect(result).toBe(true);
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('should return true even for non-existent key', async () => {
    const { safeRemoveItem } = await import('./utils');
    
    const result = safeRemoveItem('non-existent');
    
    expect(result).toBe(true);
  });

  it('should return false when localStorage.removeItem throws', async () => {
    const { safeRemoveItem } = await import('./utils');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock localStorage to throw an error
    const mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(() => {
        throw new Error('Storage error');
      }),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    
    const result = safeRemoveItem('test-key');
    
    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    
    consoleError.mockRestore();
  });
});

describe('isLocalStorageAvailable - unavailable', () => {
  it('should return false when localStorage throws on setItem', async () => {
    const { isLocalStorageAvailable } = await import('./utils');

    const mockStorage = {
      getItem: vi.fn(),
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      },
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const result = isLocalStorageAvailable();
    expect(result).toBe(false);
  });
});

describe('safeGetItem - nested error handling', () => {
  it('should return null when both JSON.parse and removeItem throw', async () => {
    const { safeGetItem } = await import('./utils');
    const validator = (data: unknown): data is string => typeof data === 'string';

    const mockStorage = {
      getItem: () => 'invalid json {',
      removeItem: () => {
        throw new Error('removeItem also fails');
      },
      setItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: () => null,
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const result = safeGetItem('key', validator);
    expect(result).toBeNull();
  });
});

describe('guardedWrite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should allow write when tabId matches active tab', async () => {
    const { guardedWrite } = await import('./utils');

    localStorage.setItem('tab-sync:active-tab-id', 'tab-1');

    const result = guardedWrite('my-key', { data: 'hello' }, 'tab-1');

    expect(result).toBe(true);
    expect(localStorage.getItem('my-key')).toBe('{"data":"hello"}');
  });

  it('should block write when tabId does not match active tab', async () => {
    const { guardedWrite } = await import('./utils');
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    localStorage.setItem('tab-sync:active-tab-id', 'tab-1');

    const result = guardedWrite('my-key', { data: 'hello' }, 'tab-2');

    expect(result).toBe(false);
    expect(localStorage.getItem('my-key')).toBeNull();
    expect(consoleWarn).toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it('should block write when no active tab exists', async () => {
    const { guardedWrite } = await import('./utils');
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = guardedWrite('my-key', 'value', 'tab-1');

    expect(result).toBe(false);

    consoleWarn.mockRestore();
  });

  it('should return false when localStorage throws during read', async () => {
    const { guardedWrite } = await import('./utils');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockStorage = {
      getItem: () => {
        throw new Error('Storage read error');
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const result = guardedWrite('key', 'value', 'tab-1');

    expect(result).toBe(false);

    consoleError.mockRestore();
  });
});

describe('createGuardedStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should allow setItem when tab is active', async () => {
    const { createGuardedStorage } = await import('./utils');

    localStorage.setItem('tab-sync:active-tab-id', 'tab-1');
    const storage = createGuardedStorage('tab-1');

    const result = storage.setItem('data-key', { value: 42 });

    expect(result).toBe(true);
    expect(localStorage.getItem('data-key')).toBe('{"value":42}');
  });

  it('should block setItem when tab is not active', async () => {
    const { createGuardedStorage } = await import('./utils');
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    localStorage.setItem('tab-sync:active-tab-id', 'tab-1');
    const storage = createGuardedStorage('tab-2');

    const result = storage.setItem('data-key', 'value');

    expect(result).toBe(false);
    expect(localStorage.getItem('data-key')).toBeNull();

    consoleWarn.mockRestore();
  });

  it('should always allow getItem regardless of active status', async () => {
    const { createGuardedStorage } = await import('./utils');

    localStorage.setItem('tab-sync:active-tab-id', 'tab-1');
    localStorage.setItem('data-key', 'stored-value');
    const storage = createGuardedStorage('tab-2'); // not active

    const result = storage.getItem('data-key');

    expect(result).toBe('stored-value');
  });

  it('should return null from getItem for non-existent key', async () => {
    const { createGuardedStorage } = await import('./utils');
    const storage = createGuardedStorage('tab-1');

    expect(storage.getItem('missing')).toBeNull();
  });

  it('should allow removeItem when tab is active', async () => {
    const { createGuardedStorage } = await import('./utils');

    localStorage.setItem('tab-sync:active-tab-id', 'tab-1');
    localStorage.setItem('data-key', 'value');
    const storage = createGuardedStorage('tab-1');

    const result = storage.removeItem('data-key');

    expect(result).toBe(true);
    expect(localStorage.getItem('data-key')).toBeNull();
  });

  it('should block removeItem when tab is not active', async () => {
    const { createGuardedStorage } = await import('./utils');
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    localStorage.setItem('tab-sync:active-tab-id', 'tab-1');
    localStorage.setItem('data-key', 'value');
    const storage = createGuardedStorage('tab-2');

    const result = storage.removeItem('data-key');

    expect(result).toBe(false);
    expect(localStorage.getItem('data-key')).toBe('value');

    consoleWarn.mockRestore();
  });

  it('should report canWrite correctly based on active status', async () => {
    const { createGuardedStorage } = await import('./utils');

    localStorage.setItem('tab-sync:active-tab-id', 'tab-1');

    const activeStorage = createGuardedStorage('tab-1');
    const readOnlyStorage = createGuardedStorage('tab-2');

    expect(activeStorage.canWrite()).toBe(true);
    expect(readOnlyStorage.canWrite()).toBe(false);
  });

  it('should report canWrite as false when no active tab exists', async () => {
    const { createGuardedStorage } = await import('./utils');
    const storage = createGuardedStorage('tab-1');

    expect(storage.canWrite()).toBe(false);
  });

  it('getItem should return null when localStorage throws', async () => {
    const { createGuardedStorage } = await import('./utils');

    const mockStorage = {
      getItem: () => {
        throw new Error('Storage error');
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const storage = createGuardedStorage('tab-1');
    expect(storage.getItem('key')).toBeNull();
  });

  it('canWrite should return false when localStorage throws', async () => {
    const { createGuardedStorage } = await import('./utils');

    const mockStorage = {
      getItem: () => {
        throw new Error('Storage error');
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const storage = createGuardedStorage('tab-1');
    expect(storage.canWrite()).toBe(false);
  });

  it('removeItem should return false when localStorage throws', async () => {
    const { createGuardedStorage } = await import('./utils');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockStorage = {
      getItem: () => {
        throw new Error('Storage error');
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const storage = createGuardedStorage('tab-1');
    expect(storage.removeItem('key')).toBe(false);

    consoleError.mockRestore();
  });
});
