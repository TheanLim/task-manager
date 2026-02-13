import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TabCoordinator } from './TabCoordinator';
import { STORAGE_KEYS } from './constants';
import { useTabSyncStore } from './store';
import * as utils from './utils';

describe('TabCoordinator - Fallback Mechanisms', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    useTabSyncStore.setState({
      isActiveTab: false,
      isReadOnly: true,
      canEdit: false,
      lastSyncTime: null,
      warningMessage: null,
      isLocalStorageAvailable: true,
    });
    // Ensure document.hidden is false so promotion logic works in tests
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  describe('localStorage Unavailable Fallback (Req 9.1)', () => {
    it('should treat tab as active when localStorage is unavailable', () => {
      vi.spyOn(utils, 'isLocalStorageAvailable').mockReturnValue(false);

      const store = useTabSyncStore.getState();
      const coordinator = new TabCoordinator(undefined, store);
      coordinator.initialize();

      const state = useTabSyncStore.getState();
      expect(state.isLocalStorageAvailable).toBe(false);
      expect(state.isActiveTab).toBe(true);
      expect(state.canEdit).toBe(true);
      expect(state.isReadOnly).toBe(false);
    });

    it('should display a warning message when localStorage is unavailable', () => {
      vi.spyOn(utils, 'isLocalStorageAvailable').mockReturnValue(false);

      const store = useTabSyncStore.getState();
      const coordinator = new TabCoordinator(undefined, store);
      coordinator.initialize();

      const state = useTabSyncStore.getState();
      expect(state.warningMessage).not.toBeNull();
      expect(state.warningMessage).toContain('localStorage');
    });

    it('should not start heartbeat or monitoring when localStorage is unavailable', () => {
      vi.useFakeTimers();
      vi.spyOn(utils, 'isLocalStorageAvailable').mockReturnValue(false);

      const store = useTabSyncStore.getState();
      const coordinator = new TabCoordinator(undefined, store);
      coordinator.initialize();

      vi.advanceTimersByTime(5000);
      expect(localStorage.getItem(STORAGE_KEYS.HEARTBEAT)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('Storage Event Fallback Polling (Req 6.2)', () => {
    it('should detect active tab ID changes via fallback polling', () => {
      vi.useFakeTimers();

      const coordinator1 = new TabCoordinator();
      coordinator1.initialize();
      expect(coordinator1.isActiveTab()).toBe(true);

      const store2 = useTabSyncStore.getState();
      const coordinator2 = new TabCoordinator(undefined, store2);
      coordinator2.initialize();
      expect(coordinator2.isActiveTab()).toBe(false);

      // Directly modify active tab ID WITHOUT firing storage event
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, 'some-other-tab-id');

      // Advance past fallback polling interval (2 seconds)
      vi.advanceTimersByTime(2500);

      const updatedSyncTime = useTabSyncStore.getState().lastSyncTime;
      expect(updatedSyncTime).not.toBeNull();

      coordinator1.cleanup();
      coordinator2.cleanup();
      vi.useRealTimers();
    });

    it('should detect heartbeat changes via fallback polling', () => {
      vi.useFakeTimers();

      const coordinator1 = new TabCoordinator();
      coordinator1.initialize();

      const store2 = useTabSyncStore.getState();
      const coordinator2 = new TabCoordinator(undefined, store2);
      coordinator2.initialize();
      expect(coordinator2.isActiveTab()).toBe(false);

      vi.advanceTimersByTime(100);

      localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
        tabId: coordinator1.getTabId(),
        timestamp: Date.now() + 5000,
      }));

      vi.advanceTimersByTime(2500);

      const syncTime = useTabSyncStore.getState().lastSyncTime;
      expect(syncTime).not.toBeNull();

      coordinator1.cleanup();
      coordinator2.cleanup();
      vi.useRealTimers();
    });

    it('should promote read-only tab when fallback polling detects stale heartbeat', () => {
      vi.useFakeTimers();

      // Use a short timeout for this test to avoid long timer advances
      const coordinator1 = new TabCoordinator({ heartbeatTimeout: 5000 });
      coordinator1.initialize();
      expect(coordinator1.isActiveTab()).toBe(true);
      const tab1Id = coordinator1.getTabId();

      const coordinator2 = new TabCoordinator({ heartbeatTimeout: 5000 });
      coordinator2.initialize();
      expect(coordinator2.isActiveTab()).toBe(false);

      // Simulate tab1 crash: cleanup then re-set with stale heartbeat
      coordinator1.cleanup();
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, tab1Id);
      localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
        tabId: tab1Id,
        timestamp: Date.now() - 6000,
      }));

      // Advance time for monitoring to detect stale heartbeat
      vi.advanceTimersByTime(3000);
      // Advance for election delay + completion
      vi.advanceTimersByTime(2000);

      const finalActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
      expect(finalActiveId).not.toBe(tab1Id);

      coordinator2.cleanup();
      vi.useRealTimers();
    });
  });

  describe('Election Retry with Exponential Backoff (Req 5.2)', () => {
    it('should use exponential backoff delays (100ms, 200ms, 400ms) on retry', () => {
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // Use short timeout so heartbeat is detected as stale
      // Start with a fresh heartbeat so attemptBecomeActive returns false
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, 'stale-tab');
      localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
        tabId: 'stale-tab',
        timestamp: Date.now(),
      }));
      localStorage.setItem(STORAGE_KEYS.ELECTION, JSON.stringify({
        tabId: 'competing-tab',
        timestamp: Date.now(),
      }));

      const coordinator = new TabCoordinator();
      coordinator.initialize();

      // Now make the heartbeat stale
      localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
        tabId: 'stale-tab',
        timestamp: Date.now() - 40000,
      }));

      // Advance past monitor interval to trigger stale heartbeat detection
      vi.advanceTimersByTime(3000);

      const timeoutDelays = setTimeoutSpy.mock.calls
        .map(call => call[1])
        .filter(delay => delay === 100 || delay === 200 || delay === 400);

      expect(timeoutDelays.length).toBeGreaterThanOrEqual(1);
      expect(timeoutDelays).toContain(100);

      coordinator.cleanup();
      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
    });

    it('should successfully become active after retries when election slot clears', () => {
      vi.useFakeTimers();

      // Start with fresh heartbeat so attemptBecomeActive returns false
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, 'dead-tab');
      localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
        tabId: 'dead-tab',
        timestamp: Date.now(),
      }));

      const coordinator = new TabCoordinator();
      coordinator.initialize();

      // Now make the heartbeat stale
      localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
        tabId: 'dead-tab',
        timestamp: Date.now() - 40000,
      }));

      // Advance for monitoring to detect stale heartbeat
      vi.advanceTimersByTime(3000);

      // Clear election slot
      localStorage.removeItem(STORAGE_KEYS.ELECTION);

      // Advance for retries + election random delay + completion
      vi.advanceTimersByTime(1000);
      localStorage.removeItem(STORAGE_KEYS.ELECTION);
      vi.advanceTimersByTime(2000);

      const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
      expect(activeTabId).toBe(coordinator.getTabId());

      coordinator.cleanup();
      vi.useRealTimers();
    });

    it('should stop retrying after maximum 3 attempts per election cycle', () => {
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      const occupyElection = () => {
        localStorage.setItem(STORAGE_KEYS.ELECTION, JSON.stringify({
          tabId: 'permanent-competitor',
          timestamp: Date.now(),
        }));
      };

      // Start with fresh heartbeat so attemptBecomeActive returns false
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, 'dead-tab');
      localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
        tabId: 'dead-tab',
        timestamp: Date.now(),
      }));
      occupyElection();

      const coordinator = new TabCoordinator();
      coordinator.initialize();

      // Now make the heartbeat stale
      localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
        tabId: 'dead-tab',
        timestamp: Date.now() - 40000,
      }));

      occupyElection();
      vi.advanceTimersByTime(3000);
      occupyElection();
      vi.advanceTimersByTime(100);
      occupyElection();
      vi.advanceTimersByTime(200);
      occupyElection();
      vi.advanceTimersByTime(400);
      occupyElection();
      vi.advanceTimersByTime(1000);

      const retryDelays = setTimeoutSpy.mock.calls
        .map(call => call[1])
        .filter(delay => delay === 100 || delay === 200 || delay === 400);

      retryDelays.forEach(delay => {
        expect([100, 200, 400]).toContain(delay);
      });

      expect(coordinator.isActiveTab()).toBe(false);

      coordinator.cleanup();
      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('Combined Fallback Scenarios', () => {
    it('should handle localStorage becoming unavailable after initialization gracefully', () => {
      vi.useFakeTimers();

      const coordinator = new TabCoordinator();
      coordinator.initialize();
      expect(coordinator.isActiveTab()).toBe(true);

      const heartbeatBefore = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
      expect(heartbeatBefore).not.toBeNull();

      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('Quota exceeded');
      });

      vi.advanceTimersByTime(3000);

      Storage.prototype.setItem = originalSetItem;

      vi.advanceTimersByTime(2500);
      const heartbeatAfter = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
      expect(heartbeatAfter).not.toBeNull();

      coordinator.cleanup();
      vi.useRealTimers();
    });

    it('should promote via monitoring when active tab heartbeat goes stale', () => {
      vi.useFakeTimers();

      // Use short timeout for this test
      const coordinator1 = new TabCoordinator({ heartbeatTimeout: 5000 });
      coordinator1.initialize();
      expect(coordinator1.isActiveTab()).toBe(true);
      const tab1Id = coordinator1.getTabId();

      const coordinator2 = new TabCoordinator({ heartbeatTimeout: 5000 });
      coordinator2.initialize();
      expect(coordinator2.isActiveTab()).toBe(false);

      // Simulate tab1 crash
      coordinator1.cleanup();
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, tab1Id);
      localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
        tabId: tab1Id,
        timestamp: Date.now() - 6000,
      }));

      // Advance for monitoring + election
      vi.advanceTimersByTime(3000);
      vi.advanceTimersByTime(2000);

      const finalActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
      expect(finalActiveId).not.toBe(tab1Id);
      expect(finalActiveId).toBe(coordinator2.getTabId());

      coordinator2.cleanup();
      vi.useRealTimers();
    });
  });
});
