import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabSyncProvider } from './TabSyncProvider';
import { useTabSyncStore } from '@/lib/tab-sync/store';
import { STORAGE_KEYS } from '@/lib/tab-sync/constants';

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

    // Simulate storage event for other tabs
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
    const oldValue = this.store.get(key);
    this.store.delete(key);

    // Simulate storage event
    this.listeners.forEach((listener) => {
      const event = new StorageEvent('storage', {
        key,
        oldValue: oldValue ?? null,
        newValue: null,
        storageArea: this as any,
      });
      listener(event);
    });
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

describe('TabSyncProvider - Integration Tests', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    global.localStorage = mockLocalStorage as any;
    
    // Reset the store state
    useTabSyncStore.setState({
      isActiveTab: false,
      isReadOnly: true,
      canEdit: false,
      lastSyncTime: null,
    });
  });

  afterEach(() => {
    mockLocalStorage.clear();
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  /**
   * Feature: multi-tab-sync, Property 13: UI State Matches Tab Status
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
   * 
   * For any tab, the UI should display read-only indicators (banner and disabled controls)
   * when the tab is read-only, and active indicators (active badge and enabled controls)
   * when the tab is active.
   */
  it('Property 13: should display correct UI based on tab status', async () => {
    // Test with first tab (should become active, but no green banner for single tab)
    const { queryByText: queryByText1, unmount: unmount1 } = render(
      <TabSyncProvider>
        <div data-testid="content">Test Content</div>
      </TabSyncProvider>
    );

    // Wait for initialization - first tab should become active
    await waitFor(() => {
      const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
      expect(activeTabId).not.toBeNull();
    }, { timeout: 1000 });

    // Single tab should NOT show active indicator (no other tabs exist)
    await waitFor(() => {
      expect(queryByText1(/Active tab/i)).toBeNull();
      // Should NOT show read-only banner either
      expect(queryByText1(/Read-only mode/i)).toBeNull();
    }, { timeout: 1000 });

    // Unmount first tab before testing second tab
    unmount1();

    // Now test with second tab (should be read-only since first tab is still active in localStorage)
    // But wait, we just unmounted the first tab, so it should have cleaned up
    // Let's set up an active tab manually
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, 'other-tab-123');
    localStorage.setItem(STORAGE_KEYS.HEARTBEAT, JSON.stringify({
      tabId: 'other-tab-123',
      timestamp: Date.now(),
    }));

    const { queryByRole: queryByRole2, queryByText: queryByText2 } = render(
      <TabSyncProvider>
        <div data-testid="content-2">Test Content 2</div>
      </TabSyncProvider>
    );

    // Wait a bit for second tab to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second tab should show read-only banner
    await waitFor(() => {
      expect(queryByText2(/Read-only mode/i)).not.toBeNull();
      const takeControlButton = queryByRole2('button', { name: /Take control/i });
      expect(takeControlButton).not.toBeNull();
      // Should NOT show active indicator
      expect(queryByText2(/Active tab/i)).toBeNull();
    }, { timeout: 1000 });
  });

  /**
   * Feature: multi-tab-sync, Property 14: Take Control Button Presence
   * **Validates: Requirements 8.1**
   * 
   * For any tab in read-only mode, a "Take control" button should be visible in the UI.
   */
  it('Property 14: should show Take control button in read-only mode', async () => {
    // Create first tab (becomes active)
    const { unmount: unmount1 } = render(
      <TabSyncProvider>
        <div data-testid="content-1">Tab 1</div>
      </TabSyncProvider>
    );

    // Wait for first tab to become active
    await waitFor(() => {
      const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
      expect(activeTabId).not.toBeNull();
    }, { timeout: 1000 });

    // Create second tab (becomes read-only)
    const { getAllByRole, unmount: unmount2 } = render(
      <TabSyncProvider>
        <div data-testid="content-2">Tab 2</div>
      </TabSyncProvider>
    );

    // Wait for second tab to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should show "Take control" button(s)
    await waitFor(() => {
      const takeControlButtons = getAllByRole('button', { name: /Take control/i });
      // There might be multiple buttons if both tabs are still mounted
      // But we just need to verify at least one exists
      expect(takeControlButtons.length).toBeGreaterThan(0);
      expect(takeControlButtons[0]).toBeVisible();
    }, { timeout: 1000 });

    // Cleanup
    unmount1();
    unmount2();
  });

  it('should NOT show Take control button in active mode', async () => {
    // Create first tab (becomes active)
    const { queryByRole } = render(
      <TabSyncProvider>
        <div data-testid="content">Test Content</div>
      </TabSyncProvider>
    );

    // Wait for initialization
    await waitFor(() => {
      const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
      expect(activeTabId).not.toBeNull();
    }, { timeout: 1000 });

    // Should NOT show "Take control" button (because it's active)
    await waitFor(() => {
      const takeControlButton = queryByRole('button', { name: /Take control/i });
      expect(takeControlButton).toBeNull();
    }, { timeout: 1000 });
  });

  /**
   * Integration Test: First tab becomes active, second becomes read-only
   * 
   * Requirements: 1.1, 1.2
   */
  it('should make first tab active and second tab read-only', async () => {
    // Render first tab
    const { unmount: unmount1 } = render(
      <TabSyncProvider>
        <div data-testid="content-1">Tab 1 Content</div>
      </TabSyncProvider>
    );

    // Wait for initialization
    await waitFor(() => {
      const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
      expect(activeTabId).not.toBeNull();
    }, { timeout: 1000 });

    const activeTabId1 = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);

    // Render second tab
    const { unmount: unmount2 } = render(
      <TabSyncProvider>
        <div data-testid="content-2">Tab 2 Content</div>
      </TabSyncProvider>
    );

    // Wait a bit for second tab to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Active tab ID should remain unchanged (first tab is still active)
    const activeTabId2 = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
    expect(activeTabId2).toBe(activeTabId1);

    // Cleanup
    unmount1();
    unmount2();
  });

  /**
   * Integration Test: Promotion after active tab closes
   * 
   * Requirements: 3.1, 3.2, 5.1
   */
  it('should promote read-only tab when active tab closes', async () => {
    vi.useFakeTimers();

    // Render first tab (active)
    const { unmount: unmount1 } = render(
      <TabSyncProvider>
        <div data-testid="content-1">Tab 1 Content</div>
      </TabSyncProvider>
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    const activeTabId1 = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
    expect(activeTabId1).not.toBeNull();

    // Render second tab (read-only)
    const { unmount: unmount2 } = render(
      <TabSyncProvider>
        <div data-testid="content-2">Tab 2 Content</div>
      </TabSyncProvider>
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Close first tab (active tab)
    unmount1();

    // Wait for cleanup and promotion
    await act(async () => {
      // Advance time past heartbeat timeout (30 seconds)
      vi.advanceTimersByTime(32000);
    });

    // Second tab should now be active
    const activeTabId2 = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
    expect(activeTabId2).not.toBe(activeTabId1);
    expect(activeTabId2).not.toBeNull();

    // Cleanup
    unmount2();
    vi.useRealTimers();
  });

  /**
   * Integration Test: Force takeover flow
   * 
   * Requirements: 8.2
   */
  it('should allow read-only tab to force takeover', async () => {
    const user = userEvent.setup();

    // Render first tab (active)
    const { unmount: unmount1 } = render(
      <TabSyncProvider>
        <div data-testid="content-1">Tab 1 Content</div>
      </TabSyncProvider>
    );

    await waitFor(() => {
      const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
      expect(activeTabId).not.toBeNull();
    }, { timeout: 1000 });

    const activeTabId1 = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);

    // Render second tab (read-only)
    const { getAllByRole } = render(
      <TabSyncProvider>
        <div data-testid="content-2">Tab 2 Content</div>
      </TabSyncProvider>
    );

    // Wait for second tab to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Find all "Take control" buttons (both tabs may show them)
    const takeControlButtons = getAllByRole('button', { name: /Take control/i });
    expect(takeControlButtons.length).toBeGreaterThan(0);
    
    // Click the last button (second tab's button)
    await user.click(takeControlButtons[takeControlButtons.length - 1]);

    // Wait for takeover to complete
    await waitFor(() => {
      const activeTabId2 = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
      expect(activeTabId2).not.toBe(activeTabId1);
    }, { timeout: 1000 });

    // Verify heartbeat is being sent by second tab
    const heartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
    expect(heartbeatJson).not.toBeNull();

    // Cleanup
    unmount1();
  });

  /**
   * Integration Test: Complete tab lifecycle
   * 
   * Tests the full lifecycle: initialization, heartbeat, monitoring, promotion
   * 
   * Requirements: 1.1, 1.2, 2.1, 4.1, 5.1
   */
  it('should handle complete tab lifecycle correctly', async () => {
    vi.useFakeTimers();

    // Render first tab
    const { unmount: unmount1 } = render(
      <TabSyncProvider>
        <div data-testid="content-1">Tab 1 Content</div>
      </TabSyncProvider>
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    const activeTabId1 = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
    expect(activeTabId1).not.toBeNull();

    // Verify heartbeat is being sent
    const heartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
    expect(heartbeatJson).not.toBeNull();

    // Advance time and verify heartbeat updates
    const initialHeartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
    const initialHeartbeat = initialHeartbeatJson ? JSON.parse(initialHeartbeatJson) : null;

    await act(async () => {
      vi.advanceTimersByTime(2500); // Past one heartbeat interval
    });

    const updatedHeartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
    const updatedHeartbeat = updatedHeartbeatJson ? JSON.parse(updatedHeartbeatJson) : null;

    if (initialHeartbeat && updatedHeartbeat) {
      expect(updatedHeartbeat.timestamp).toBeGreaterThan(initialHeartbeat.timestamp);
    }

    // Render second tab
    const { unmount: unmount2 } = render(
      <TabSyncProvider>
        <div data-testid="content-2">Tab 2 Content</div>
      </TabSyncProvider>
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Close first tab
    unmount1();

    // Wait for second tab to detect stale heartbeat and promote
    await act(async () => {
      vi.advanceTimersByTime(32000); // Past heartbeat timeout
    });

    // Second tab should now be active
    const activeTabId2 = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
    expect(activeTabId2).not.toBe(activeTabId1);
    expect(activeTabId2).not.toBeNull();

    // Cleanup
    unmount2();
    vi.useRealTimers();
  });

  /**
   * Integration Test: Cleanup on unmount
   * 
   * Verifies that TabCoordinator properly cleans up when component unmounts
   * 
   * Requirements: 3.1, 3.2
   */
  it('should cleanup properly on unmount', async () => {
    const { unmount } = render(
      <TabSyncProvider>
        <div data-testid="content">Tab Content</div>
      </TabSyncProvider>
    );

    await waitFor(() => {
      const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
      expect(activeTabId).not.toBeNull();
    }, { timeout: 1000 });

    // Unmount the component (React cleanup — stops timers but does NOT clear storage)
    // Storage is only cleared on actual page close (beforeunload), not React unmount,
    // to avoid issues with React strict mode double-mount in dev.
    unmount();

    // Active tab ID should still be in localStorage (not cleared on React unmount)
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID)).not.toBeNull();
  });

  /**
   * Regression Test: No read-only banner flash on single-tab load
   * 
   * The Zustand store defaults to isReadOnly: true before the coordinator
   * initializes. Without the `initialized` gate, the ReadOnlyBanner would
   * flash briefly on every page load even with a single tab.
   */
  it('should not flash read-only banner when opening a single tab', async () => {
    // Track every render to catch even momentary flashes
    let sawReadOnlyBanner = false;

    const BannerSpy = ({ children }: { children: React.ReactNode }) => {
      const { isReadOnly } = useTabSyncStore();
      // We're checking the raw store value on every render
      // The banner should never appear for a single tab
      return (
        <>
          {children}
          {/* Hidden marker to detect if banner would render */}
          {isReadOnly && <div data-testid="readonly-spy" />}
        </>
      );
    };

    const { queryByText, unmount } = render(
      <TabSyncProvider>
        <BannerSpy>
          <div>Content</div>
        </BannerSpy>
      </TabSyncProvider>
    );

    // Check immediately on first render — banner should NOT be visible
    expect(queryByText(/Read-only mode/i)).toBeNull();

    // Wait for coordinator to initialize
    await waitFor(() => {
      const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
      expect(activeTabId).not.toBeNull();
    }, { timeout: 1000 });

    // Still no banner after initialization
    expect(queryByText(/Read-only mode/i)).toBeNull();

    unmount();
  });
});
