import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { TabCoordinator } from './TabCoordinator';
import { STORAGE_KEYS } from './constants';

/**
 * Mock localStorage for testing
 */
class MockLocalStorage {
  private store: Map<string, string> = new Map();
  private listeners: ((event: StorageEvent) => void)[] = [];

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    const oldValue = this.store.get(key);
    this.store.set(key, value);

    // Simulate storage event
    this.listeners.forEach((listener) => {
      const event = new StorageEvent('storage', {
        key,
        oldValue: oldValue ?? null,
        newValue: value,
        storageArea: this as any,
      });
      listener(event);
    });
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  addEventListener(type: string, listener: (e: StorageEvent) => void): void {
    if (type === 'storage') {
      this.listeners.push(listener);
    }
  }

  removeEventListener(type: string, listener: (e: StorageEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

describe('TabCoordinator - Core Functionality', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    global.localStorage = mockLocalStorage as any;
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe('Constructor and Basic Methods', () => {
    it('should create a TabCoordinator with a unique tab ID', () => {
      const coordinator = new TabCoordinator();
      expect(coordinator.getTabId()).toMatch(/^tab-\d+-[a-z0-9]+$/);
    });

    it('should use default config when no config provided', () => {
      const coordinator = new TabCoordinator();
      const config = coordinator.getConfig();
      
      expect(config.heartbeatInterval).toBe(2000);
      expect(config.heartbeatTimeout).toBe(30000);
      expect(config.monitorInterval).toBe(2000);
    });

    it('should merge provided config with defaults', () => {
      const coordinator = new TabCoordinator({
        heartbeatInterval: 3000,
      });
      const config = coordinator.getConfig();
      
      expect(config.heartbeatInterval).toBe(3000);
      expect(config.heartbeatTimeout).toBe(30000); // default
      expect(config.monitorInterval).toBe(2000); // default
    });
  });

  describe('Active Tab Management', () => {
    it('should become active when no other tab is active', () => {
      const coordinator = new TabCoordinator();
      
      // Initially no active tab
      expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBeNull();
      
      // Attempt to become active
      const result = (coordinator as any).attemptBecomeActive();
      
      expect(result).toBe(true);
      expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBe(coordinator.getTabId());
    });

    it('should not become active when another tab is already active', () => {
      // Simulate another tab being active with a fresh heartbeat
      const otherTabId = 'tab-other-123';
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, otherTabId);
      localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
        tabId: otherTabId,
        timestamp: Date.now(),
      }));
      
      const coordinator = new TabCoordinator();
      const result = (coordinator as any).attemptBecomeActive();
      
      expect(result).toBe(false);
      expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBe(otherTabId);
    });

    it('should return correct active status via isActiveTab()', () => {
      const coordinator = new TabCoordinator();
      
      // Initially not active
      expect(coordinator.isActiveTab()).toBe(false);
      
      // Make it active
      (coordinator as any).attemptBecomeActive();
      
      // Now should be active
      expect(coordinator.isActiveTab()).toBe(true);
    });

    it('should return correct tab state via getTabState()', () => {
      const coordinator = new TabCoordinator();
      
      // Initially not active
      let state = coordinator.getTabState();
      expect(state.tabId).toBe(coordinator.getTabId());
      expect(state.isActive).toBe(false);
      expect(state.lastHeartbeat).toBeNull();
      
      // Make it active
      (coordinator as any).attemptBecomeActive();
      
      // Now should be active
      state = coordinator.getTabState();
      expect(state.isActive).toBe(true);
    });
  });
});

describe('TabCoordinator - Property-Based Tests', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    global.localStorage = mockLocalStorage as any;
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  /**
   * Feature: multi-tab-sync, Property 1: Single Active Tab Invariant
   * **Validates: Requirements 1.4**
   * 
   * For any point in time across all browser tabs, at most one tab 
   * should have active status in localStorage.
   */
  it('Property 1: should maintain at most one active tab at any time', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }), // Number of tabs
        fc.integer({ min: 0, max: 9 }),   // Which tab attempts first (order variation)
        (numTabs, firstTabIndex) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          
          // Create multiple coordinators
          const coordinators: TabCoordinator[] = [];
          for (let i = 0; i < numTabs; i++) {
            coordinators.push(new TabCoordinator());
          }
          
          // Vary the order of initialization to test different race scenarios
          const startIdx = firstTabIndex % numTabs;
          const orderedCoordinators = [
            ...coordinators.slice(startIdx),
            ...coordinators.slice(0, startIdx),
          ];
          
          // Simulate concurrent initialization - all try to become active
          orderedCoordinators.forEach((c) => {
            (c as any).attemptBecomeActive();
          });
          
          // Count how many tabs think they're active
          const activeTabs = coordinators.filter((c) => c.isActiveTab());
          
          // EXACTLY one should be active (not zero, not more than one)
          expect(activeTabs.length).toBe(1);
          
          // Verify localStorage consistency - the stored ID must match the active coordinator
          const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
          expect(activeTabId).not.toBeNull();
          expect(activeTabId).toBe(activeTabs[0].getTabId());
          
          // No other coordinator should report as active
          const inactiveTabs = coordinators.filter((c) => !c.isActiveTab());
          expect(inactiveTabs.length).toBe(numTabs - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-tab-sync, Property 2: New Tab Becomes Read-Only When Active Tab Exists
   * **Validates: Requirements 1.2**
   * 
   * For any new tab initialization, if an active tab already exists in localStorage,
   * the new tab should be designated as read-only.
   */
  it('Property 2: should designate new tab as read-only when active tab exists', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }), // Existing active tab ID
        (existingTabId) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          
          // Set up an existing active tab with a fresh heartbeat
          localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, existingTabId);
          localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
            tabId: existingTabId,
            timestamp: Date.now(),
          }));
          
          // Create a new tab coordinator
          const newTab = new TabCoordinator();
          
          // Attempt to become active
          const becameActive = (newTab as any).attemptBecomeActive();
          
          // Should not become active
          expect(becameActive).toBe(false);
          expect(newTab.isActiveTab()).toBe(false);
          
          // The existing active tab ID should remain unchanged
          expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBe(existingTabId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-tab-sync, Property 3: Active Tab Storage Persistence
   * **Validates: Requirements 1.3**
   * 
   * For any tab that becomes active, localStorage should immediately contain
   * both the tab identifier and a valid timestamp.
   */
  it('Property 3: should persist tab identifier and timestamp when becoming active', () => {
    fc.assert(
      fc.property(
        fc.record({
          heartbeatInterval: fc.integer({ min: 500, max: 5000 }),
          heartbeatTimeout: fc.integer({ min: 3000, max: 10000 }),
        }),
        (configOverrides) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          
          // Create a new tab coordinator with varied config
          const coordinator = new TabCoordinator(configOverrides);
          const tabId = coordinator.getTabId();
          
          // Attempt to become active
          const becameActive = (coordinator as any).attemptBecomeActive();
          
          // Should always become active (no other tab exists)
          expect(becameActive).toBe(true);
          
          // localStorage should contain the tab identifier IMMEDIATELY
          const storedTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
          expect(storedTabId).toBe(tabId);
          
          // The last active tab ID should also be set
          const lastActiveTabId = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
          expect(lastActiveTabId).toBe(tabId);
          
          // Start heartbeat to persist timestamp
          (coordinator as any).startHeartbeat();
          
          // Now verify that a valid timestamp (heartbeat) exists
          const heartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
          expect(heartbeatJson).not.toBeNull();
          
          const heartbeat = JSON.parse(heartbeatJson!);
          
          // Should contain the correct tab ID
          expect(heartbeat.tabId).toBe(tabId);
          
          // Should contain a valid timestamp
          expect(typeof heartbeat.timestamp).toBe('number');
          expect(heartbeat.timestamp).toBeGreaterThan(0);
          
          // Timestamp should be recent (within last second)
          const now = Date.now();
          expect(heartbeat.timestamp).toBeGreaterThan(now - 1000);
          expect(heartbeat.timestamp).toBeLessThanOrEqual(now);
          
          // Cleanup
          (coordinator as any).stopHeartbeat();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('TabCoordinator - Heartbeat Property Tests', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    global.localStorage = mockLocalStorage as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  /**
   * Feature: multi-tab-sync, Property 4: Heartbeat Update Interval
   * **Validates: Requirements 2.1**
   * 
   * For any active tab, heartbeat timestamps in localStorage should be updated
   * at intervals of approximately 2 seconds (±200ms tolerance).
   */
  it('Property 4: should update heartbeat at configured intervals', async () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 5000 }), // Heartbeat interval in ms
        fc.integer({ min: 2, max: 5 }), // Number of intervals to test
        (heartbeatInterval, numIntervals) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Mock Date.now() to work with fake timers
          let currentTime = Date.now();
          vi.spyOn(Date, 'now').mockImplementation(() => currentTime);
          
          // Create coordinator with custom interval
          const coordinator = new TabCoordinator({ heartbeatInterval });
          
          // Make it active and start heartbeat
          (coordinator as any).attemptBecomeActive();
          (coordinator as any).startHeartbeat();
          
          const timestamps: number[] = [];
          
          // Collect the initial heartbeat timestamp (startHeartbeat calls updateHeartbeat immediately)
          const initialHeartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
          if (initialHeartbeatJson) {
            const initialHeartbeat = JSON.parse(initialHeartbeatJson);
            timestamps.push(initialHeartbeat.timestamp);
          }
          
          // Collect heartbeat timestamps after each interval
          for (let i = 0; i < numIntervals; i++) {
            // Advance both fake timers and mocked Date.now()
            currentTime += heartbeatInterval;
            vi.advanceTimersByTime(heartbeatInterval);
            
            const heartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
            if (heartbeatJson) {
              const heartbeat = JSON.parse(heartbeatJson);
              timestamps.push(heartbeat.timestamp);
            }
          }
          
          // Verify we collected timestamps (initial + numIntervals)
          expect(timestamps.length).toBeGreaterThanOrEqual(numIntervals);
          
          // Verify intervals between timestamps are approximately correct
          for (let i = 1; i < timestamps.length; i++) {
            const interval = timestamps[i] - timestamps[i - 1];
            // Allow for some tolerance due to timer precision
            const tolerance = heartbeatInterval * 0.1; // 10% tolerance
            expect(interval).toBeGreaterThanOrEqual(heartbeatInterval - tolerance);
            expect(interval).toBeLessThanOrEqual(heartbeatInterval + tolerance);
          }
          
          // Cleanup
          (coordinator as any).stopHeartbeat();
          vi.restoreAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-tab-sync, Property 5: Heartbeat Data Completeness
   * **Validates: Requirements 2.2, 2.3**
   * 
   * For any heartbeat update, the persisted data should contain both
   * a valid tab identifier and a current timestamp.
   */
  it('Property 5: should include tab ID and timestamp in heartbeat data', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // Number of consecutive heartbeat updates
        fc.integer({ min: 500, max: 5000 }), // Heartbeat interval config
        (numUpdates, heartbeatInterval) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          
          // Create coordinator with varied config
          const coordinator = new TabCoordinator({ heartbeatInterval });
          const tabId = coordinator.getTabId();
          
          // Perform multiple heartbeat updates and verify each one
          for (let i = 0; i < numUpdates; i++) {
            (coordinator as any).updateHeartbeat();
            
            // Verify heartbeat data in localStorage after each update
            const heartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
            expect(heartbeatJson).not.toBeNull();
            
            const heartbeat = JSON.parse(heartbeatJson!);
            
            // Must contain tab ID matching this coordinator
            expect(heartbeat.tabId).toBe(tabId);
            expect(typeof heartbeat.tabId).toBe('string');
            expect(heartbeat.tabId.length).toBeGreaterThan(0);
            
            // Must contain a valid numeric timestamp
            expect(typeof heartbeat.timestamp).toBe('number');
            expect(Number.isFinite(heartbeat.timestamp)).toBe(true);
            
            // Timestamp should be recent (within last second)
            const now = Date.now();
            expect(heartbeat.timestamp).toBeGreaterThan(now - 1000);
            expect(heartbeat.timestamp).toBeLessThanOrEqual(now);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-tab-sync, Property 8: Stale Heartbeat Detection
   * **Validates: Requirements 4.2**
   * 
   * For any heartbeat timestamp, if it is older than 5 seconds from the
   * current time, it should be classified as stale.
   */
  it('Property 8: should detect heartbeats older than timeout as stale', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }), // Heartbeat age in ms
        fc.integer({ min: 3000, max: 7000 }), // Heartbeat timeout in ms
        (age, heartbeatTimeout) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          
          // Create coordinator with custom timeout
          const coordinator = new TabCoordinator({ heartbeatTimeout });
          
          // Create a heartbeat with specific age
          const heartbeat = {
            tabId: coordinator.getTabId(),
            timestamp: Date.now() - age,
          };
          
          localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(heartbeat));
          
          // Check if it's detected as stale
          const isStale = (coordinator as any).isHeartbeatStale();
          
          // Should be stale if age > timeout
          const expectedStale = age > heartbeatTimeout;
          expect(isStale).toBe(expectedStale);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('TabCoordinator - Monitoring and Promotion Property Tests', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    global.localStorage = mockLocalStorage as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  /**
   * Feature: multi-tab-sync, Property 7: Heartbeat Monitoring Interval
   * **Validates: Requirements 4.1**
   * 
   * For any read-only tab, heartbeat status checks should occur at intervals
   * of approximately 1 second (±200ms tolerance).
   */
  it('Property 7: should check heartbeat status at configured monitor intervals', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 3000 }), // Monitor interval in ms
        fc.integer({ min: 2, max: 5 }), // Number of intervals to test
        (monitorInterval, numIntervals) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Set up an active tab in localStorage
          const activeTabId = 'active-tab-123';
          localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, activeTabId);
          
          // Set up a fresh heartbeat
          const heartbeat = {
            tabId: activeTabId,
            timestamp: Date.now(),
          };
          localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(heartbeat));
          
          // Create a read-only coordinator with custom monitor interval
          // Use a large heartbeat timeout so the heartbeat never goes stale during the test
          const coordinator = new TabCoordinator({ monitorInterval, heartbeatTimeout: 60000 });
          
          // Track how many times checkActiveTabStatus is called
          let checkCount = 0;
          const originalCheck = (coordinator as any).checkActiveTabStatus;
          (coordinator as any).checkActiveTabStatus = function() {
            checkCount++;
            return originalCheck.call(this);
          };
          
          // Start monitoring
          (coordinator as any).startMonitoring();
          
          // Initial check should happen immediately
          expect(checkCount).toBeGreaterThan(0);
          const initialCount = checkCount;
          
          // Advance time and count checks
          for (let i = 0; i < numIntervals; i++) {
            vi.advanceTimersByTime(monitorInterval);
          }
          
          // Should have performed additional checks
          const additionalChecks = checkCount - initialCount;
          expect(additionalChecks).toBeGreaterThanOrEqual(numIntervals - 1);
          expect(additionalChecks).toBeLessThanOrEqual(numIntervals + 1);
          
          // Cleanup
          (coordinator as any).stopMonitoring();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-tab-sync, Property 9: Promotion on Stale Heartbeat
   * **Validates: Requirements 4.3, 5.1**
   * 
   * For any read-only tab that detects a stale heartbeat, it should
   * initiate the promotion process to become active. Conversely, when
   * the heartbeat is fresh, no promotion should be attempted.
   */
  it('Property 9: should initiate promotion when stale heartbeat detected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 15000 }), // Heartbeat age (may or may not be stale)
        fc.integer({ min: 3000, max: 7000 }), // Heartbeat timeout
        (heartbeatAge, heartbeatTimeout) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Set up an active tab in localStorage
          const activeTabId = 'active-tab-123';
          localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, activeTabId);
          
          // Set up a heartbeat with the given age
          const heartbeat = {
            tabId: activeTabId,
            timestamp: Date.now() - heartbeatAge,
          };
          localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(heartbeat));
          
          // Create a read-only coordinator with the given timeout
          const coordinator = new TabCoordinator({ heartbeatTimeout });
          
          // Track if attemptPromotion is called
          let promotionAttempted = false;
          const originalAttemptPromotion = (coordinator as any).attemptPromotion;
          (coordinator as any).attemptPromotion = function() {
            promotionAttempted = true;
            return originalAttemptPromotion.call(this);
          };
          
          // Check active tab status (should detect stale/fresh heartbeat)
          (coordinator as any).checkActiveTabStatus();
          
          const expectedStale = heartbeatAge > heartbeatTimeout;
          
          if (expectedStale) {
            // Stale heartbeat: promotion MUST be attempted
            expect(promotionAttempted).toBe(true);
          } else {
            // Fresh heartbeat: promotion must NOT be attempted
            expect(promotionAttempted).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-tab-sync, Property 10: Election Uniqueness
   * **Validates: Requirements 5.2**
   * 
   * For any scenario where multiple read-only tabs simultaneously attempt
   * promotion, exactly one tab should successfully become active.
   * 
   * Since localStorage is synchronous and single-threaded, we test this by
   * having multiple tabs attempt election sequentially (which is how it works
   * in practice — JS is single-threaded per tab, and localStorage operations
   * are atomic). The first tab to claim the election slot wins; others must fail.
   */
  it('Property 10: should ensure only one tab wins election', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }), // Number of competing tabs
        (numTabs) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          
          // Set up a stale active tab so all tabs want to promote
          localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, 'dead-tab');
          const staleHeartbeat = {
            tabId: 'dead-tab',
            timestamp: Date.now() - 10000, // Very stale
          };
          localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(staleHeartbeat));
          
          // Create multiple coordinators
          const coordinators: TabCoordinator[] = [];
          for (let i = 0; i < numTabs; i++) {
            coordinators.push(new TabCoordinator());
          }
          
          // All tabs attempt election (synchronous part)
          const electionResults = coordinators.map((c) => {
            return (c as any).attemptElection();
          });
          
          // Only one tab should have successfully claimed the election slot
          const successCount = electionResults.filter((r: boolean) => r === true).length;
          expect(successCount).toBe(1);
          
          // The election data in localStorage should belong to exactly one tab
          const electionJson = localStorage.getItem(STORAGE_KEYS.ELECTION);
          expect(electionJson).not.toBeNull();
          
          const electionData = JSON.parse(electionJson!);
          const winnerTab = coordinators.find((c) => c.getTabId() === electionData.tabId);
          expect(winnerTab).toBeDefined();
          
          // Verify no other tab's ID is in the election data
          const otherTabs = coordinators.filter((c) => c.getTabId() !== electionData.tabId);
          otherTabs.forEach((c) => {
            expect(electionData.tabId).not.toBe(c.getTabId());
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-tab-sync, Property 11: Post-Promotion State Consistency
   * **Validates: Requirements 5.3, 5.4**
   * 
   * For any tab that successfully completes promotion, it should both
   * start sending heartbeat signals and have editing capabilities enabled.
   */
  it('Property 11: should start heartbeat and enable editing after promotion', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 5000 }), // Heartbeat interval
        fc.integer({ min: 3000, max: 10000 }), // Heartbeat timeout
        (heartbeatInterval, heartbeatTimeout) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Create a coordinator with varied config
          const coordinator = new TabCoordinator({ heartbeatInterval, heartbeatTimeout });
          
          // Verify it's not active initially
          expect(coordinator.isActiveTab()).toBe(false);
          
          // Directly call completePromotion (the method that runs after winning election)
          // This avoids the async setTimeout in attemptElection and tests the actual
          // post-promotion state transition
          (coordinator as any).completePromotion();
          
          // Promotion should succeed (no other tab is active)
          expect(coordinator.isActiveTab()).toBe(true);
          
          // Should have a heartbeat in localStorage
          const heartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
          expect(heartbeatJson).not.toBeNull();
          
          const heartbeat = JSON.parse(heartbeatJson!);
          expect(heartbeat.tabId).toBe(coordinator.getTabId());
          expect(typeof heartbeat.timestamp).toBe('number');
          
          // Timestamp should be recent
          const now = Date.now();
          expect(heartbeat.timestamp).toBeGreaterThan(now - 1000);
          expect(heartbeat.timestamp).toBeLessThanOrEqual(now);
          
          // Heartbeat timer should be running (not null)
          expect((coordinator as any).heartbeatTimer).not.toBeNull();
          
          // Monitoring timer should be stopped (null) — active tabs don't monitor
          expect((coordinator as any).monitorTimer).toBeNull();
          
          // Election data should be cleared
          expect(localStorage.getItem(STORAGE_KEYS.ELECTION)).toBeNull();
          
          // Verify heartbeat continues updating over time
          const initialTimestamp = heartbeat.timestamp;
          
          // Mock Date.now to advance time
          let currentTime = Date.now();
          vi.spyOn(Date, 'now').mockImplementation(() => currentTime);
          
          currentTime += heartbeatInterval;
          vi.advanceTimersByTime(heartbeatInterval);
          
          const updatedHeartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
          expect(updatedHeartbeatJson).not.toBeNull();
          const updatedHeartbeat = JSON.parse(updatedHeartbeatJson!);
          expect(updatedHeartbeat.timestamp).toBeGreaterThan(initialTimestamp);
          
          // Cleanup
          (coordinator as any).stopHeartbeat();
          vi.restoreAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('TabCoordinator - Force Takeover Property Tests', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    global.localStorage = mockLocalStorage as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  /**
   * Feature: multi-tab-sync, Property 15: Force Takeover Execution
   * **Validates: Requirements 8.2, 8.3, 8.4**
   * 
   * For any user-initiated force takeover action, the tab should claim
   * active status and update localStorage regardless of existing active
   * tab state.
   */
  it('Property 15: should claim active status unconditionally on force takeover', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }), // Existing active tab ID
        fc.boolean(), // Whether heartbeat exists
        (existingActiveTabId, hasHeartbeat) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Set up an existing active tab
          localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, existingActiveTabId);
          
          // Optionally set up a heartbeat
          if (hasHeartbeat) {
            const heartbeat = {
              tabId: existingActiveTabId,
              timestamp: Date.now(),
            };
            localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(heartbeat));
          }
          
          // Create a new tab coordinator (should be read-only)
          const coordinator = new TabCoordinator();
          const tabId = coordinator.getTabId();
          
          // Verify it's not active initially
          expect(coordinator.isActiveTab()).toBe(false);
          expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBe(existingActiveTabId);
          
          // Force takeover
          coordinator.forceTakeover();
          
          // Should now be active
          expect(coordinator.isActiveTab()).toBe(true);
          
          // localStorage should be updated with new active tab ID
          expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBe(tabId);
          expect(localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE)).toBe(tabId);
          
          // Heartbeat should be updated with new tab's data
          const heartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
          expect(heartbeatJson).not.toBeNull();
          
          if (heartbeatJson) {
            const heartbeat = JSON.parse(heartbeatJson);
            expect(heartbeat.tabId).toBe(tabId);
            expect(heartbeat.timestamp).toBeDefined();
            
            // Timestamp should be recent
            const now = Date.now();
            expect(heartbeat.timestamp).toBeGreaterThan(now - 1000);
            expect(heartbeat.timestamp).toBeLessThanOrEqual(now);
          }
          
          // Election data should be cleared
          expect(localStorage.getItem(STORAGE_KEYS.ELECTION)).toBeNull();
          
          // Cleanup
          vi.clearAllTimers();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should successfully force takeover when no active tab exists', () => {
    // Clear localStorage
    mockLocalStorage.clear();
    
    // Create coordinator
    const coordinator = new TabCoordinator();
    const tabId = coordinator.getTabId();
    
    // Force takeover
    coordinator.forceTakeover();
    
    // Should be active
    expect(coordinator.isActiveTab()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBe(tabId);
    
    // Should have heartbeat
    const heartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
    expect(heartbeatJson).not.toBeNull();
  });

  it('should stop monitoring and start heartbeat on force takeover', () => {
    // Clear localStorage
    mockLocalStorage.clear();
    vi.clearAllTimers();
    
    // Set up an existing active tab
    const existingActiveTabId = 'active-tab-123';
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, existingActiveTabId);
    
    const heartbeat = {
      tabId: existingActiveTabId,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(heartbeat));
    
    // Create a read-only coordinator
    const coordinator = new TabCoordinator();
    
    // Start monitoring (simulating read-only state)
    (coordinator as any).startMonitoring();
    
    // Verify monitoring is active
    expect((coordinator as any).monitorTimer).not.toBeNull();
    
    // Force takeover
    coordinator.forceTakeover();
    
    // Monitoring should be stopped
    expect((coordinator as any).monitorTimer).toBeNull();
    
    // Heartbeat should be started
    expect((coordinator as any).heartbeatTimer).not.toBeNull();
    
    // Verify heartbeat is being sent
    const initialHeartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
    const initialHeartbeat = initialHeartbeatJson ? JSON.parse(initialHeartbeatJson) : null;
    
    vi.advanceTimersByTime(2500); // Advance past one heartbeat interval
    
    const updatedHeartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
    const updatedHeartbeat = updatedHeartbeatJson ? JSON.parse(updatedHeartbeatJson) : null;
    
    if (initialHeartbeat && updatedHeartbeat) {
      // Heartbeat should have been updated
      expect(updatedHeartbeat.timestamp).toBeGreaterThan(initialHeartbeat.timestamp);
      expect(updatedHeartbeat.tabId).toBe(coordinator.getTabId());
    }
    
    // Cleanup
    vi.clearAllTimers();
  });

  it('should allow multiple tabs to force takeover sequentially', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }), // Number of tabs
        (numTabs) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Create multiple coordinators
          const coordinators: TabCoordinator[] = [];
          for (let i = 0; i < numTabs; i++) {
            coordinators.push(new TabCoordinator());
          }
          
          // Each tab forces takeover in sequence
          for (let i = 0; i < numTabs; i++) {
            coordinators[i].forceTakeover();
            
            // This tab should be active
            expect(coordinators[i].isActiveTab()).toBe(true);
            expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBe(
              coordinators[i].getTabId()
            );
            
            // All other tabs should not be active
            for (let j = 0; j < numTabs; j++) {
              if (i !== j) {
                expect(coordinators[j].isActiveTab()).toBe(false);
              }
            }
          }
          
          // Cleanup
          vi.clearAllTimers();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Feature: multi-tab-sync, Property 15b: Dethroned Tab Transitions to Read-Only
   * **Validates: Requirements 8.2, 8.3, 8.4, 7.1, 7.2**
   * 
   * For any force takeover by tab B, the previously active tab A should:
   * - Stop its heartbeat
   * - Start monitoring
   * - Update its store to read-only (setActiveStatus(false))
   */
  it('should transition dethroned tab to read-only when another tab forces takeover', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();

          // Mock window and document for event listeners
          const windowStorageListeners: ((e: StorageEvent) => void)[] = [];
          global.window = {
            addEventListener: vi.fn((type: string, listener: any) => {
              if (type === 'storage') {
                windowStorageListeners.push(listener);
              }
            }),
            removeEventListener: vi.fn(),
          } as any;

          global.document = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            hidden: false,
          } as any;

          // Create stores for both tabs
          const storeA = {
            setActiveStatus: vi.fn(),
            syncFromStorage: vi.fn(),
            forceTakeover: vi.fn(),
            setWarning: vi.fn(),
            setLocalStorageAvailable: vi.fn(),
          };

          const storeB = {
            setActiveStatus: vi.fn(),
            syncFromStorage: vi.fn(),
            forceTakeover: vi.fn(),
            setWarning: vi.fn(),
            setLocalStorageAvailable: vi.fn(),
          };

          // Tab A initializes first — becomes active
          const tabA = new TabCoordinator(undefined, storeA as any);
          tabA.initialize();

          expect(tabA.isActiveTab()).toBe(true);
          expect(storeA.setActiveStatus).toHaveBeenCalledWith(true);

          // Tab B initializes — becomes read-only
          const tabB = new TabCoordinator(undefined, storeB as any);
          tabB.initialize();

          expect(tabB.isActiveTab()).toBe(false);
          expect(storeB.setActiveStatus).toHaveBeenCalledWith(false);

          // Reset mocks to track the takeover transition
          storeA.setActiveStatus.mockClear();
          storeB.setActiveStatus.mockClear();

          // Tab B forces takeover
          tabB.forceTakeover();

          // Tab B should now be active
          expect(tabB.isActiveTab()).toBe(true);
          expect(storeB.setActiveStatus).toHaveBeenCalledWith(true);

          // Simulate the storage event that the browser would fire in tab A
          // (In real browsers, localStorage.setItem in one tab fires 'storage' in other tabs)
          const storageEvent = new StorageEvent('storage', {
            key: 'tab-sync:active-tab-id',
            oldValue: tabA.getTabId(),
            newValue: tabB.getTabId(),
          });
          windowStorageListeners.forEach(listener => listener(storageEvent));

          // Tab A should now be read-only
          expect(tabA.isActiveTab()).toBe(false);
          expect(storeA.setActiveStatus).toHaveBeenCalledWith(false);

          // Tab A's heartbeat should be stopped, monitoring should be started
          expect((tabA as any).heartbeatTimer).toBeNull();
          expect((tabA as any).monitorTimer).not.toBeNull();

          // Cleanup
          tabA.cleanup();
          tabB.cleanup();
          vi.clearAllTimers();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('TabCoordinator - Storage Event Synchronization Property Tests', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    global.localStorage = mockLocalStorage as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  /**
   * Feature: multi-tab-sync, Property 12: Storage Event Synchronization
   * **Validates: Requirements 6.2, 6.3, 6.4**
   * 
   * For any storage event received by a read-only tab, the tab should
   * process the event synchronously (handler completes without async delay)
   * and trigger store synchronization. The handler must be invoked for
   * relevant storage key changes.
   */
  it('Property 12: should synchronize on storage events for relevant keys', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }), // Active tab ID
        fc.integer({ min: 1, max: 5 }), // Number of storage events to fire
        fc.boolean(), // Whether to fire heartbeat or active-tab-id events
        (activeTabId, numEvents, useHeartbeatKey) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Mock window for event listeners
          const windowEventListeners: Map<string, ((e: StorageEvent) => void)[]> = new Map();
          global.window = {
            addEventListener: vi.fn((type: string, listener: any) => {
              if (!windowEventListeners.has(type)) {
                windowEventListeners.set(type, []);
              }
              windowEventListeners.get(type)!.push(listener);
            }),
            removeEventListener: vi.fn(),
          } as any;
          
          global.document = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            hidden: false,
          } as any;
          
          // Set up an active tab in localStorage
          localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, activeTabId);
          
          // Set up a fresh heartbeat
          const heartbeat = {
            tabId: activeTabId,
            timestamp: Date.now(),
          };
          localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(heartbeat));
          
          // Create a read-only coordinator with a mock store
          const mockStore = {
            setActiveStatus: vi.fn(),
            syncFromStorage: vi.fn(),
            forceTakeover: vi.fn(),
            setWarning: vi.fn(),
            setLocalStorageAvailable: vi.fn(),
          };
          
          const coordinator = new TabCoordinator(undefined, mockStore as any);
          coordinator.initialize();
          
          // Verify it's read-only
          expect(coordinator.isActiveTab()).toBe(false);
          
          // Reset mock calls from initialization
          mockStore.syncFromStorage.mockClear();
          
          // Get the registered storage listeners
          const storageListeners = windowEventListeners.get('storage') || [];
          // Must have registered at least one storage listener
          expect(storageListeners.length).toBeGreaterThan(0);
          
          // Fire storage events for relevant keys
          const eventKey = useHeartbeatKey
            ? STORAGE_KEYS.HEARTBEAT
            : STORAGE_KEYS.ACTIVE_TAB_ID;
          
          for (let i = 0; i < numEvents; i++) {
            const newHeartbeat = {
              tabId: activeTabId,
              timestamp: Date.now() + (i + 1) * 1000,
            };
            const oldValue = localStorage.getItem(eventKey);
            const newValue = useHeartbeatKey
              ? JSON.stringify(newHeartbeat)
              : activeTabId;
            localStorage.setItem(eventKey, newValue);
            
            const storageEvent = new StorageEvent('storage', {
              key: eventKey,
              oldValue,
              newValue,
            });
            
            storageListeners.forEach(listener => listener(storageEvent));
          }
          
          // syncFromStorage MUST have been called for each event (Req 6.2, 6.3)
          expect(mockStore.syncFromStorage.mock.calls.length).toBe(numEvents);
          
          // Cleanup
          coordinator.cleanup();
          vi.clearAllTimers();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-tab-sync, Property 12b: Storage events for irrelevant keys should NOT trigger sync
   * **Validates: Requirements 6.4**
   */
  it('Property 12b: should NOT synchronize on storage events for irrelevant keys', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }), // Active tab ID
        fc.string({ minLength: 3, maxLength: 30 }).filter(
          k => k !== STORAGE_KEYS.ACTIVE_TAB_ID && k !== STORAGE_KEYS.HEARTBEAT
        ), // Irrelevant key
        (activeTabId, irrelevantKey) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Mock window for event listeners
          const windowEventListeners: Map<string, ((e: StorageEvent) => void)[]> = new Map();
          global.window = {
            addEventListener: vi.fn((type: string, listener: any) => {
              if (!windowEventListeners.has(type)) {
                windowEventListeners.set(type, []);
              }
              windowEventListeners.get(type)!.push(listener);
            }),
            removeEventListener: vi.fn(),
          } as any;
          
          global.document = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            hidden: false,
          } as any;
          
          // Set up an active tab in localStorage
          localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, activeTabId);
          const heartbeat = {
            tabId: activeTabId,
            timestamp: Date.now(),
          };
          localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(heartbeat));
          
          const mockStore = {
            setActiveStatus: vi.fn(),
            syncFromStorage: vi.fn(),
            forceTakeover: vi.fn(),
            setWarning: vi.fn(),
            setLocalStorageAvailable: vi.fn(),
          };
          
          const coordinator = new TabCoordinator(undefined, mockStore as any);
          coordinator.initialize();
          
          mockStore.syncFromStorage.mockClear();
          
          const storageListeners = windowEventListeners.get('storage') || [];
          
          // Fire a storage event for an irrelevant key
          const storageEvent = new StorageEvent('storage', {
            key: irrelevantKey,
            oldValue: null,
            newValue: 'some-value',
          });
          
          storageListeners.forEach(listener => listener(storageEvent));
          
          // syncFromStorage should NOT have been called for irrelevant keys
          expect(mockStore.syncFromStorage).not.toHaveBeenCalled();
          
          // Cleanup
          coordinator.cleanup();
          vi.clearAllTimers();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should trigger syncFromStorage when storage event occurs', () => {
    // This test verifies that storage events trigger synchronization
    // We use a simpler approach without property-based testing for edge cases
    
    // Clear localStorage
    mockLocalStorage.clear();
    vi.clearAllTimers();
    
    // Mock window for event listeners
    const windowEventListeners: Map<string, ((e: StorageEvent) => void)[]> = new Map();
    global.window = {
      addEventListener: vi.fn((type: string, listener: any) => {
        if (!windowEventListeners.has(type)) {
          windowEventListeners.set(type, []);
        }
        windowEventListeners.get(type)!.push(listener);
      }),
      removeEventListener: vi.fn(),
    } as any;
    
    global.document = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      hidden: false,
    } as any;
    
    // Set up an active tab in localStorage
    const activeTabId = 'active-tab-123';
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, activeTabId);
    
    // Set up a fresh heartbeat
    const heartbeat = {
      tabId: activeTabId,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(heartbeat));
    
    // Create a read-only coordinator with store
    const mockStore = {
      setActiveStatus: vi.fn(),
      syncFromStorage: vi.fn(),
      forceTakeover: vi.fn(),
      setWarning: vi.fn(),
      setLocalStorageAvailable: vi.fn(),
    };
    
    const coordinator = new TabCoordinator(undefined, mockStore as any);
    coordinator.initialize();
    
    // Verify it's read-only
    expect(coordinator.isActiveTab()).toBe(false);
    
    // Reset mock calls from initialization
    mockStore.syncFromStorage.mockClear();
    
    // Manually trigger a storage event on the window
    const newHeartbeat = {
      tabId: activeTabId,
      timestamp: Date.now() + 1000,
    };
    const oldHeartbeatValue = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
    localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(newHeartbeat));
    
    // Trigger the storage event manually
    const storageEvent = new StorageEvent('storage', {
      key: STORAGE_KEYS.HEARTBEAT,
      oldValue: oldHeartbeatValue,
      newValue: JSON.stringify(newHeartbeat),
    });
    
    // Call all storage event listeners
    const storageListeners = windowEventListeners.get('storage') || [];
    storageListeners.forEach(listener => listener(storageEvent));
    
    // syncFromStorage should have been called
    expect(mockStore.syncFromStorage).toHaveBeenCalled();
    
    // Cleanup
    coordinator.cleanup();
    vi.clearAllTimers();
  });

  it('should synchronize data within reasonable time after storage event', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // Number of storage events
        (numEvents) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Mock window for event listeners
          const windowEventListeners: Map<string, ((e: StorageEvent) => void)[]> = new Map();
          global.window = {
            addEventListener: vi.fn((type: string, listener: any) => {
              if (!windowEventListeners.has(type)) {
                windowEventListeners.set(type, []);
              }
              windowEventListeners.get(type)!.push(listener);
            }),
            removeEventListener: vi.fn(),
          } as any;
          
          global.document = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            hidden: false,
          } as any;
          
          // Set up an active tab in localStorage
          const activeTabId = 'active-tab-test';
          localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, activeTabId);
          
          // Set up a fresh heartbeat
          const heartbeat = {
            tabId: activeTabId,
            timestamp: Date.now(),
          };
          localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(heartbeat));
          
          // Create a read-only coordinator with store
          const mockStore = {
            setActiveStatus: vi.fn(),
            syncFromStorage: vi.fn(),
            forceTakeover: vi.fn(),
            setWarning: vi.fn(),
            setLocalStorageAvailable: vi.fn(),
          };
          
          const coordinator = new TabCoordinator(undefined, mockStore as any);
          coordinator.initialize();
          
          // Reset mock calls from initialization
          mockStore.syncFromStorage.mockClear();
          
          // Trigger multiple storage events
          const storageListeners = windowEventListeners.get('storage') || [];
          for (let i = 0; i < numEvents; i++) {
            const newHeartbeat = {
              tabId: activeTabId,
              timestamp: Date.now() + (i + 1) * 1000,
            };
            const oldValue = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
            localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(newHeartbeat));
            
            // Manually trigger storage event
            const storageEvent = new StorageEvent('storage', {
              key: STORAGE_KEYS.HEARTBEAT,
              oldValue,
              newValue: JSON.stringify(newHeartbeat),
            });
            
            storageListeners.forEach(listener => listener(storageEvent));
          }
          
          // syncFromStorage should have been called at least once
          expect(mockStore.syncFromStorage.mock.calls.length).toBeGreaterThanOrEqual(1);
          
          // Cleanup
          coordinator.cleanup();
          vi.clearAllTimers();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('TabCoordinator - Write Operation Exclusivity Property Tests', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    global.localStorage = mockLocalStorage as any;
  });

  afterEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  /**
   * Feature: multi-tab-sync, Property 16: Write Operation Exclusivity
   * **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
   * 
   * For any write operation to application data in localStorage, it should
   * only be executed by a tab that has active status.
   */
  it('Property 16: should only allow active tab to write to localStorage', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }), // Active tab ID
        fc.string({ minLength: 5, maxLength: 20 }), // Data key
        fc.string({ minLength: 10, maxLength: 100 }), // Data value
        (activeTabId, dataKey, dataValue) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          
          // Set up an active tab in localStorage with fresh heartbeat
          localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, activeTabId);
          localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
            tabId: activeTabId,
            timestamp: Date.now(),
          }));
          
          // Create a read-only coordinator
          const readOnlyCoordinator = new TabCoordinator();
          readOnlyCoordinator.initialize();
          
          // Verify it's read-only
          expect(readOnlyCoordinator.isActiveTab()).toBe(false);
          
          // Get guarded storage for read-only tab
          const readOnlyStorage = readOnlyCoordinator.getGuardedStorage();
          
          // Attempt to write with read-only tab
          const readOnlyWriteResult = readOnlyStorage.setItem(dataKey, dataValue);
          
          // Write should fail (return false)
          expect(readOnlyWriteResult).toBe(false);
          
          // Data should not be in localStorage
          expect(localStorage.getItem(dataKey)).toBeNull();
          
          // Now create an active coordinator
          readOnlyCoordinator.cleanup();
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_TAB_ID);
          
          const activeCoordinator = new TabCoordinator();
          activeCoordinator.initialize();
          
          // Verify it's active
          expect(activeCoordinator.isActiveTab()).toBe(true);
          
          // Get guarded storage for active tab
          const activeStorage = activeCoordinator.getGuardedStorage();
          
          // Attempt to write with active tab
          const activeWriteResult = activeStorage.setItem(dataKey, dataValue);
          
          // Write should succeed (return true)
          expect(activeWriteResult).toBe(true);
          
          // Data should be in localStorage
          expect(localStorage.getItem(dataKey)).toBe(JSON.stringify(dataValue));
          
          // Cleanup
          activeCoordinator.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should prevent read-only tabs from modifying application data', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 1, maxLength: 5 }), // Data keys
        fc.array(fc.string({ minLength: 10, maxLength: 100 }), { minLength: 1, maxLength: 5 }), // Data values
        (dataKeys, dataValues) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          
          // Set up an active tab in localStorage with fresh heartbeat
          const activeTabId = 'active-tab-123';
          localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, activeTabId);
          localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
            tabId: activeTabId,
            timestamp: Date.now(),
          }));
          
          // Create a read-only coordinator
          const coordinator = new TabCoordinator();
          coordinator.initialize();
          
          // Verify it's read-only
          expect(coordinator.isActiveTab()).toBe(false);
          
          // Get guarded storage
          const guardedStorage = coordinator.getGuardedStorage();
          
          // Attempt to write multiple items
          const minLength = Math.min(dataKeys.length, dataValues.length);
          for (let i = 0; i < minLength; i++) {
            const writeResult = guardedStorage.setItem(dataKeys[i], dataValues[i]);
            
            // All writes should fail
            expect(writeResult).toBe(false);
            
            // Data should not be in localStorage
            expect(localStorage.getItem(dataKeys[i])).toBeNull();
          }
          
          // Cleanup
          coordinator.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow active tab to write and read-only tab to read', () => {
    // Clear localStorage
    mockLocalStorage.clear();
    
    // Create active coordinator
    const activeCoordinator = new TabCoordinator();
    activeCoordinator.initialize();
    
    expect(activeCoordinator.isActiveTab()).toBe(true);
    
    // Write data with active tab
    const activeStorage = activeCoordinator.getGuardedStorage();
    const writeResult = activeStorage.setItem('test-key', 'test-value');
    
    expect(writeResult).toBe(true);
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('test-value'));
    
    // Create read-only coordinator
    const readOnlyCoordinator = new TabCoordinator();
    readOnlyCoordinator.initialize();
    
    expect(readOnlyCoordinator.isActiveTab()).toBe(false);
    
    // Read-only tab should be able to read (returns raw JSON-stringified value)
    const readOnlyStorage = readOnlyCoordinator.getGuardedStorage();
    const readResult = readOnlyStorage.getItem('test-key');
    
    // getItem returns the raw localStorage value (JSON-stringified)
    expect(readResult).toBe(JSON.stringify('test-value'));
    
    // But should not be able to write
    const readOnlyWriteResult = readOnlyStorage.setItem('test-key-2', 'test-value-2');
    expect(readOnlyWriteResult).toBe(false);
    expect(localStorage.getItem('test-key-2')).toBeNull();
    
    // Cleanup
    activeCoordinator.cleanup();
    readOnlyCoordinator.cleanup();
  });
});

describe('TabCoordinator - Lifecycle Methods', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    global.localStorage = mockLocalStorage as any;
    
    // Mock window and document for event listeners
    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;
    
    global.document = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      hidden: false,
    } as any;
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    mockLocalStorage.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should initialize as active tab when no other tab exists', () => {
    const coordinator = new TabCoordinator();
    coordinator.initialize();
    
    expect(coordinator.isActiveTab()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBe(coordinator.getTabId());
  });

  it('should set up event listeners on initialization', () => {
    const coordinator = new TabCoordinator();
    coordinator.initialize();
    
    expect(window.addEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('should cleanup active tab status when closing', () => {
    const coordinator = new TabCoordinator();
    coordinator.initialize();
    
    expect(coordinator.isActiveTab()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBe(coordinator.getTabId());
    
    // Simulate actual page close (beforeunload clears storage, then cleanup stops timers)
    (coordinator as any).handleBeforeUnload();
    
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.HEARTBEAT)).toBeNull();
  });

  it('should detect when another tab becomes active', () => {
    const coordinator = new TabCoordinator();
    coordinator.initialize();
    
    expect(coordinator.isActiveTab()).toBe(true);
    
    // Simulate another tab becoming active by directly modifying localStorage
    const otherTabId = 'tab-other-123';
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, otherTabId);
    
    // Coordinator should detect it's no longer active
    expect(coordinator.isActiveTab()).toBe(false);
  });

  it('should remove event listeners on cleanup', () => {
    const coordinator = new TabCoordinator();
    coordinator.initialize();
    
    coordinator.cleanup();
    
    // Verify removeEventListener was called
    expect(window.removeEventListener).toHaveBeenCalled();
  });
});

describe('TabCoordinator - Visibility and Cleanup Properties', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    global.localStorage = mockLocalStorage as any;
    
    // Mock window and document for event listeners
    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;
    
    // Create a proper document mock with event handling
    const eventListeners: Map<string, Function[]> = new Map();
    global.document = {
      addEventListener: vi.fn((event: string, handler: Function) => {
        if (!eventListeners.has(event)) {
          eventListeners.set(event, []);
        }
        eventListeners.get(event)!.push(handler);
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn((event: Event) => {
        const handlers = eventListeners.get(event.type) || [];
        handlers.forEach(handler => handler(event));
        return true;
      }),
      hidden: false,
    } as any;
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    mockLocalStorage.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /**
   * Property 6: Active Tab Cleanup on Close
   * 
   * For any active tab that closes (after varying amounts of heartbeat activity),
   * both the active tab identifier and heartbeat timestamp should be removed
   * from localStorage during cleanup.
   * 
   * **Validates: Requirements 3.1, 3.2**
   */
  it('Property 6: should remove active tab ID and heartbeat on cleanup', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 4000 }), // Heartbeat interval
        fc.integer({ min: 1, max: 8 }), // Number of heartbeat cycles before cleanup
        (heartbeatInterval, heartbeatCycles) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Create and initialize a coordinator with varied config
          const coordinator = new TabCoordinator({ heartbeatInterval });
          coordinator.initialize();
          
          // Verify it's active and has heartbeat
          expect(coordinator.isActiveTab()).toBe(true);
          expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBe(coordinator.getTabId());
          
          // Let heartbeat run for several cycles to build up state
          vi.advanceTimersByTime(heartbeatInterval * heartbeatCycles);
          
          // Verify heartbeat exists and belongs to this tab
          const heartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
          expect(heartbeatJson).not.toBeNull();
          const heartbeat = JSON.parse(heartbeatJson!);
          expect(heartbeat.tabId).toBe(coordinator.getTabId());
          
          // Verify LAST_ACTIVE is also set
          expect(localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE)).toBe(coordinator.getTabId());
          
          // Simulate tab closing (beforeunload clears storage)
          (coordinator as any).handleBeforeUnload();
          
          // BOTH active tab ID AND heartbeat must be removed (Req 3.1, 3.2)
          expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBeNull();
          expect(localStorage.getItem(STORAGE_KEYS.HEARTBEAT)).toBeNull();
          
          // Verify the coordinator no longer reports as active
          expect(coordinator.isActiveTab()).toBe(false);
          
          // Cleanup
          vi.clearAllTimers();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17: Monitoring Persistence During Visibility Changes
   * 
   * For any tab that becomes hidden, monitoring for active tab changes 
   * should continue without interruption. Verified by checking that the
   * monitor timer is still active and checkActiveTabStatus is still called
   * after the tab becomes hidden.
   * 
   * **Validates: Requirements 10.1**
   */
  it('Property 17: should continue monitoring when tab becomes hidden', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 2000 }), // Monitor interval
        fc.integer({ min: 1, max: 4 }), // Number of monitor cycles while hidden
        (monitorInterval, hiddenCycles) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Create first tab (becomes active)
          const coordinator1 = new TabCoordinator({ monitorInterval });
          coordinator1.initialize();
          
          // Set up a fresh heartbeat so coordinator2 doesn't try to promote
          const heartbeat = {
            tabId: coordinator1.getTabId(),
            timestamp: Date.now(),
          };
          localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify(heartbeat));
          
          // Create second tab (becomes read-only, starts monitoring)
          const coordinator2 = new TabCoordinator({ monitorInterval });
          
          // Patch checkActiveTabStatus BEFORE initialize so the interval captures it
          let checkCountWhileHidden = 0;
          const originalCheck = (coordinator2 as any).checkActiveTabStatus;
          (coordinator2 as any).checkActiveTabStatus = function() {
            if ((global.document as any).hidden) {
              checkCountWhileHidden++;
            }
            return originalCheck.call(this);
          };
          
          coordinator2.initialize();
          
          expect(coordinator2.isActiveTab()).toBe(false);
          
          // Verify monitoring timer is running
          expect((coordinator2 as any).monitorTimer).not.toBeNull();
          
          // Simulate tab becoming hidden
          (global.document as any).hidden = true;
          const visibilityEvent = new Event('visibilitychange');
          document.dispatchEvent(visibilityEvent);
          
          // Verify monitoring timer is STILL running after becoming hidden
          expect((coordinator2 as any).monitorTimer).not.toBeNull();
          
          // Keep heartbeat fresh so coordinator2 doesn't try to promote
          let currentTime = Date.now();
          vi.spyOn(Date, 'now').mockImplementation(() => currentTime);
          
          // Advance time for several monitor cycles while hidden
          for (let i = 0; i < hiddenCycles; i++) {
            currentTime += monitorInterval;
            vi.advanceTimersByTime(monitorInterval);
            // Keep heartbeat fresh
            localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
              tabId: coordinator1.getTabId(),
              timestamp: currentTime,
            }));
          }
          
          // checkActiveTabStatus MUST have been called while hidden (Req 10.1)
          expect(checkCountWhileHidden).toBeGreaterThanOrEqual(hiddenCycles);
          
          // Cleanup
          coordinator1.cleanup();
          coordinator2.cleanup();
          vi.restoreAllMocks();
          vi.clearAllTimers();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18: Status Verification on Visibility
   * 
   * For any tab that becomes visible, it should verify its active status 
   * is still valid and promote itself if necessary.
   * 
   * This test verifies that when a read-only tab becomes visible after the
   * active tab has closed, the visibility change handler triggers a status
   * check that leads to promotion.
   * 
   * **Validates: Requirements 10.2, 10.3**
   */
  it('Property 18: should verify status when tab becomes visible', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 2000 }), // Monitor interval
        (monitorInterval) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Create first tab (becomes active)
          const coordinator1 = new TabCoordinator({ monitorInterval });
          coordinator1.initialize();
          
          // Create second tab (becomes read-only, starts monitoring)
          const coordinator2 = new TabCoordinator({ monitorInterval });
          coordinator2.initialize();
          
          expect(coordinator1.isActiveTab()).toBe(true);
          expect(coordinator2.isActiveTab()).toBe(false);
          
          // Close the active tab — removes active tab ID and heartbeat
          (coordinator1 as any).handleBeforeUnload();
          
          // Verify no active tab exists
          expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBeNull();
          
          // Simulate tab becoming visible — handleVisibilityChange calls
          // checkActiveTabStatus for read-only tabs
          (global.document as any).hidden = false;
          
          // Directly invoke the visibility change handler to simulate the event
          // (since the mock document's event dispatch may not reach the bound handler)
          (coordinator2 as any).handleVisibilityChange();
          
          // The handler called checkActiveTabStatus which detected no active tab
          // and called attemptPromotion -> attemptElection which uses setTimeout
          // Advance timers to let the election complete
          vi.advanceTimersByTime(1000);
          
          // The second tab should have promoted itself
          expect(coordinator2.isActiveTab()).toBe(true);
          
          // Verify localStorage is consistent
          expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBe(coordinator2.getTabId());
          
          // Cleanup
          coordinator2.cleanup();
          vi.clearAllTimers();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19: Heartbeat Continuity During Visibility Changes
   * 
   * For any active tab experiencing visibility changes, heartbeat updates 
   * should continue without disruption.
   * 
   * **Validates: Requirements 10.4**
   */
  it('Property 19: should maintain heartbeat when active tab visibility changes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 3000 }), // Heartbeat interval
        (heartbeatInterval) => {
          // Clear localStorage before each iteration
          mockLocalStorage.clear();
          vi.clearAllTimers();
          
          // Create and initialize a coordinator (becomes active)
          const coordinator = new TabCoordinator({ heartbeatInterval });
          coordinator.initialize();
          
          expect(coordinator.isActiveTab()).toBe(true);
          
          // Wait for initial heartbeat
          vi.advanceTimersByTime(100);
          const heartbeat1 = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
          expect(heartbeat1).not.toBeNull();
          
          // Simulate tab becoming hidden
          (global.document as any).hidden = true;
          const hiddenEvent = new Event('visibilitychange');
          document.dispatchEvent(hiddenEvent);
          
          // Advance time by heartbeat interval
          vi.advanceTimersByTime(heartbeatInterval);
          
          // Heartbeat should have been updated even while hidden
          const heartbeat2 = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
          expect(heartbeat2).not.toBeNull();
          expect(heartbeat2).not.toBe(heartbeat1);
          
          // Simulate tab becoming visible again
          (global.document as any).hidden = false;
          const visibleEvent = new Event('visibilitychange');
          document.dispatchEvent(visibleEvent);
          
          // Advance time by heartbeat interval
          vi.advanceTimersByTime(heartbeatInterval);
          
          // Heartbeat should continue updating after becoming visible
          const heartbeat3 = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
          expect(heartbeat3).not.toBeNull();
          expect(heartbeat3).not.toBe(heartbeat2);
          
          // Tab should still be active
          expect(coordinator.isActiveTab()).toBe(true);
          
          // Cleanup
          coordinator.cleanup();
          vi.clearAllTimers();
        }
      ),
      { numRuns: 100 }
    );
  });
});
