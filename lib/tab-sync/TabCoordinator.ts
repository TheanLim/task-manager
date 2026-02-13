import type { TabCoordinatorConfig, TabState, HeartbeatData } from './types';
import type { TabSyncStore } from './store';
import { DEFAULT_CONFIG, STORAGE_KEYS } from './constants';
import { 
  generateTabId, 
  safeGetItem, 
  safeSetItem, 
  deserializeHeartbeat,
  serializeHeartbeat,
  isLocalStorageAvailable,
  safeRemoveItem,
  createGuardedStorage
} from './utils';

/**
 * TabCoordinator manages tab synchronization state and coordinates
 * active tab election across multiple browser tabs.
 * 
 * Only one tab can be active at a time. The active tab has exclusive
 * write permissions to localStorage, while read-only tabs monitor
 * for changes and can promote themselves when the active tab closes.
 */
export class TabCoordinator {
  private readonly tabId: string;
  private readonly config: TabCoordinatorConfig;
  private readonly store: TabSyncStore | null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private monitorTimer: NodeJS.Timeout | null = null;
  private fallbackPollingTimer: NodeJS.Timeout | null = null;
  private storageListener: ((e: StorageEvent) => void) | null = null;
  private lastKnownActiveTabId: string | null = null;
  private lastKnownHeartbeat: string | null = null;

  private boundHandleBeforeUnload: () => void;
  private boundHandleVisibilityChange: () => void;

  /**
   * Creates a new TabCoordinator instance
   * 
   * @param config - Optional partial configuration to override defaults
   * @param store - Optional Zustand store for state management
   */
  constructor(config?: Partial<TabCoordinatorConfig>, store?: TabSyncStore, tabId?: string) {
    this.tabId = tabId ?? generateTabId();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.store = store ?? null;
    // Bind event handlers once in constructor so we can properly remove them
    this.boundHandleBeforeUnload = this.handleBeforeUnload.bind(this);
    this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  /**
   * Gets the unique identifier for this tab
   * 
   * @returns The tab ID
   */
  getTabId(): string {
    return this.tabId;
  }

  /**
   * Gets the current configuration
   * 
   * @returns The configuration object
   */
  getConfig(): TabCoordinatorConfig {
    return { ...this.config };
  }

  /**
   * Attempts to make this tab the active tab
   * 
   * Checks if an active tab already exists in localStorage.
   * If no active tab exists, claims active status by writing
   * this tab's ID to localStorage.
   * 
   * @returns true if this tab became active, false if another tab is already active
   */
  private attemptBecomeActive(): boolean {
    // Check if there's already an active tab
    const existingActiveTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
    
    if (existingActiveTabId && existingActiveTabId !== this.tabId) {
      // Another tab claims to be active — check if it's actually alive
      // by verifying its heartbeat. If the heartbeat is stale or missing,
      // the old tab is dead (e.g. leftover from a previous session).
      if (!this.isHeartbeatStale()) {
        // Heartbeat is fresh — another tab is genuinely active
        return false;
      }
      // Heartbeat is stale — old tab is dead, we can claim active status
    }
    
    // No active tab exists, or the existing one is stale — claim active status
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, this.tabId);
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, this.tabId);
      return true;
    } catch (error) {
      console.error('Failed to set active tab ID:', error);
      return false;
    }
  }

  /**
   * Gets the current state of this tab
   * 
   * @returns The current tab state including active status and heartbeat info
   */
  getTabState(): TabState {
    const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
    const isActive = activeTabId === this.tabId;
    
    // Get the last heartbeat timestamp
    let lastHeartbeat: number | null = null;
    const heartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
    if (heartbeatJson) {
      const heartbeatData = deserializeHeartbeat(heartbeatJson);
      if (heartbeatData) {
        lastHeartbeat = heartbeatData.timestamp;
      }
    }
    
    return {
      tabId: this.tabId,
      isActive,
      lastHeartbeat,
    };
  }

  /**
   * Checks if this tab is currently the active tab
   * 
   * @returns true if this tab is active, false otherwise
   */
  isActiveTab(): boolean {
    const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
    return activeTabId === this.tabId;
  }

  /**
   * Updates the heartbeat timestamp in localStorage
   * 
   * Writes the current timestamp and tab ID to localStorage to signal
   * that this tab is still active and responsive.
   * 
   * @private
   */
  private updateHeartbeat(): void {
    const heartbeatData: HeartbeatData = {
      tabId: this.tabId,
      timestamp: Date.now(),
    };
    
    try {
      const serialized = serializeHeartbeat(heartbeatData);
      localStorage.setItem(STORAGE_KEYS.HEARTBEAT, serialized);
    } catch (error) {
      console.error('Failed to update heartbeat:', error);
    }
  }

  /**
   * Starts the heartbeat interval timer
   * 
   * Creates an interval that updates the heartbeat timestamp every
   * heartbeatInterval milliseconds (default: 2 seconds).
   * 
   * @private
   */
  private startHeartbeat(): void {
    // Clear any existing heartbeat timer
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    // Update heartbeat immediately
    this.updateHeartbeat();
    
    // Set up interval for periodic updates
    this.heartbeatTimer = setInterval(() => {
      this.updateHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * Stops the heartbeat interval timer
   * 
   * Clears the interval timer to stop sending heartbeat updates.
   * 
   * @private
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Checks if the current heartbeat is stale
   *
   * A heartbeat is considered stale if it is older than the configured
   * heartbeatTimeout (default: 5 seconds).
   *
   * @returns true if the heartbeat is stale or doesn't exist, false otherwise
   * @private
   */
  private isHeartbeatStale(): boolean {
    const heartbeatJson = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);
    if (!heartbeatJson) {
      // No heartbeat exists
      return true;
    }

    const heartbeatData = deserializeHeartbeat(heartbeatJson);
    if (!heartbeatData) {
      // Invalid heartbeat data
      return true;
    }

    const now = Date.now();
    const age = now - heartbeatData.timestamp;

    // Heartbeat is stale if older than timeout
    return age > this.config.heartbeatTimeout;
  }

  /**
   * Validates if a heartbeat is valid
   *
   * Checks for clock drift by rejecting heartbeats from the future.
   * Also checks if the heartbeat is stale.
   *
   * @param heartbeat - The heartbeat data to validate
   * @returns true if the heartbeat is valid, false otherwise
   * @private
   */
  private isHeartbeatValid(heartbeat: HeartbeatData): boolean {
    const now = Date.now();
    const age = now - heartbeat.timestamp;

    // Reject heartbeats from the future (clock drift)
    if (age < -1000) {
      console.warn('Heartbeat timestamp is in the future');
      return false;
    }

    // Reject stale heartbeats
    if (age > this.config.heartbeatTimeout) {
      return false;
    }

    return true;
  }

  /**
   * Checks the active tab status and initiates promotion if necessary
   *
   * Reads the active tab ID and heartbeat from localStorage.
   * If no active tab exists or the heartbeat is stale, attempts to
   * promote this tab to active status.
   *
   * @private
   */
  private checkActiveTabStatus(): void {
    const activeTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
    
    // If no active tab exists, attempt promotion
    if (!activeTabId) {
      // Only promote if this tab is visible — a hidden tab should not
      // steal active status since the user isn't looking at it
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      this.attemptPromotion();
      return;
    }
    
    // If we're already the active tab, no need to check further
    if (activeTabId === this.tabId) {
      return;
    }
    
    // Another tab is active — if we were previously active, we've been dethroned
    // (e.g. another tab did a force takeover). Transition to read-only.
    if (this.heartbeatTimer) {
      this.stopHeartbeat();
      this.startMonitoring();
      this.startFallbackPolling();
      
      if (this.store) {
        this.store.setActiveStatus(false);
      }
    }
    
    // Check if the heartbeat is stale — only promote if we're visible
    // Browser throttles timers in hidden tabs, causing false stale detections
    if (this.isHeartbeatStale()) {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      this.attemptPromotion();
    }
  }

  /**
   * Starts the monitoring interval timer
   *
   * Creates an interval that checks the active tab status every
   * monitorInterval milliseconds (default: 1 second).
   *
   * @private
   */
  private startMonitoring(): void {
    // Clear any existing monitor timer
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
    }
    
    // Check status immediately
    this.checkActiveTabStatus();
    
    // Set up interval for periodic checks
    this.monitorTimer = setInterval(() => {
      this.checkActiveTabStatus();
    }, this.config.monitorInterval);
  }

  /**
   * Stops the monitoring interval timer
   *
   * Clears the interval timer to stop monitoring for active tab changes.
   *
   * @private
   */
  private stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }

  /**
   * Starts fallback polling for browsers with unreliable storage events
   *
   * Polls localStorage every 2 seconds to manually check for data changes.
   * This is only used when the tab is in read-only mode.
   *
   * @private
   */
  private startFallbackPolling(): void {
    // Clear any existing polling timer
    if (this.fallbackPollingTimer) {
      clearInterval(this.fallbackPollingTimer);
    }

    // Initialize last known values
    this.lastKnownActiveTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
    this.lastKnownHeartbeat = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);

    // Set up interval for periodic checks (every 2 seconds)
    this.fallbackPollingTimer = setInterval(() => {
      if (!this.isActiveTab()) {
        // Manually check for data changes
        const currentActiveTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID);
        const currentHeartbeat = localStorage.getItem(STORAGE_KEYS.HEARTBEAT);

        // Check if active tab ID changed
        if (currentActiveTabId !== this.lastKnownActiveTabId) {
          this.lastKnownActiveTabId = currentActiveTabId;
          this.checkActiveTabStatus();
          
          // Notify store of synchronization
          if (this.store) {
            this.store.syncFromStorage();
          }
        }

        // Check if heartbeat changed
        if (currentHeartbeat !== this.lastKnownHeartbeat) {
          this.lastKnownHeartbeat = currentHeartbeat;
          
          // Notify store of synchronization
          if (this.store) {
            this.store.syncFromStorage();
          }
        }
      }
    }, 2000);
  }

  /**
   * Stops the fallback polling timer
   *
   * Clears the interval timer to stop polling for data changes.
   *
   * @private
   */
  private stopFallbackPolling(): void {
    if (this.fallbackPollingTimer) {
      clearInterval(this.fallbackPollingTimer);
      this.fallbackPollingTimer = null;
    }
  }

  /**
   * Attempts to promote this tab to active status
   *
   * Triggers promotion when no active tab is detected or when the
   * active tab's heartbeat is stale. Uses the election algorithm
   * with retry logic and exponential backoff to ensure only one tab
   * successfully promotes.
   *
   * @private
   */
  private attemptPromotion(): void {
    // Attempt to win the election with retry logic
    this.attemptElectionWithRetry();
  }

  /**
   * Attempts to win an election with retry logic and exponential backoff
   *
   * Retries up to 3 times with exponential backoff (100ms, 200ms, 400ms)
   * if the election fails. This helps handle race conditions when multiple
   * tabs attempt promotion simultaneously.
   *
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @private
   */
  private attemptElectionWithRetry(maxRetries: number = 3): void {
    let attempt = 0;

    const tryElection = () => {
      const success = this.attemptElection();

      if (!success && attempt < maxRetries) {
        // Election failed, retry with exponential backoff
        attempt++;
        const delay = Math.pow(2, attempt - 1) * 100; // 100ms, 200ms, 400ms

        setTimeout(() => {
          tryElection();
        }, delay);
      }
    };

    tryElection();
  }

  /**
   * Attempts to win an election to become the active tab
   *
   * Uses a timestamp-based election mechanism where multiple tabs
   * can compete. The tab that successfully claims the election slot
   * first wins. A small random delay allows other tabs to compete.
   *
   * @returns true if this tab won the election, false otherwise
   * @private
   */
  private attemptElection(): boolean {
    const now = Date.now();
    
    // Try to claim election slot
    const existingElectionJson = localStorage.getItem(STORAGE_KEYS.ELECTION);
    
    if (!existingElectionJson) {
      // No election in progress, claim it
      const electionData = {
        tabId: this.tabId,
        timestamp: now,
      };
      
      try {
        localStorage.setItem(STORAGE_KEYS.ELECTION, JSON.stringify(electionData));
        
        // Wait a small random delay to allow other tabs to compete
        const delay = Math.random() * 100;
        
        // Use setTimeout to check after delay
        setTimeout(() => {
          const currentElectionJson = localStorage.getItem(STORAGE_KEYS.ELECTION);
          if (currentElectionJson) {
            try {
              const currentElection = JSON.parse(currentElectionJson);
              if (currentElection.tabId === this.tabId) {
                // We won the election, complete the promotion
                this.completePromotion();
              }
            } catch (error) {
              console.error('Failed to parse election data:', error);
            }
          }
        }, delay);
        
        return true;
      } catch (error) {
        console.error('Failed to claim election slot:', error);
        return false;
      }
    }
    
    // Election already in progress
    return false;
  }

  /**
   * Completes the promotion process after winning an election
   *
   * Claims active status, clears the election data, stops monitoring,
   * and starts sending heartbeat signals.
   *
   * @private
   */
  private completePromotion(): void {
    // Force claim active status - we won the election, so we can
    // unconditionally overwrite the active tab ID (handles stale tab crash scenario)
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, this.tabId);
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, this.tabId);
    } catch (error) {
      console.error('Failed to claim active status during promotion:', error);
      return;
    }

    // Clear election data
    try {
      localStorage.removeItem(STORAGE_KEYS.ELECTION);
    } catch (error) {
      console.error('Failed to clear election data:', error);
    }

    // Stop monitoring and fallback polling since we're now active
    this.stopMonitoring();
    this.stopFallbackPolling();

    // Start sending heartbeat signals
    this.startHeartbeat();

    // Update store state
    if (this.store) {
      this.store.setActiveStatus(true);
    }
  }

  /**
   * Initializes the TabCoordinator
   *
   * Sets up event listeners and determines whether this tab should be
   * active or read-only. If localStorage is unavailable, treats the tab
   * as active (no coordination possible) and displays a warning to the user.
   *
   * This method should be called once when the tab is loaded.
   */
  initialize(): void {
    // Check if localStorage is available
    if (!isLocalStorageAvailable()) {
      console.warn('localStorage unavailable - multi-tab sync disabled');
      
      // Update store to indicate localStorage is unavailable
      if (this.store) {
        this.store.setLocalStorageAvailable(false);
        this.store.setWarning(
          'Multi-tab synchronization is disabled because localStorage is unavailable. ' +
          'This may occur in private browsing mode or when storage quota is exceeded. ' +
          'Each tab will operate independently.'
        );
        // Treat this tab as active since we can't coordinate
        this.store.setActiveStatus(true);
      }
      return;
    }

    // localStorage is available, clear any previous warnings
    if (this.store) {
      this.store.setLocalStorageAvailable(true);
      this.store.setWarning(null);
    }

    // Set up event listeners
    this.setupEventListeners();

    // Attempt to become active or start monitoring
    const becameActive = this.attemptBecomeActive();
    
    if (becameActive) {
      // We're the active tab, start heartbeat
      this.startHeartbeat();
      
      // Update store state
      if (this.store) {
        this.store.setActiveStatus(true);
      }
    } else {
      // We're read-only, start monitoring
      this.startMonitoring();
      
      // Start fallback polling for browsers with unreliable storage events
      this.startFallbackPolling();
      
      // Update store state
      if (this.store) {
        this.store.setActiveStatus(false);
      }
    }
  }

  /**
   * Cleans up the TabCoordinator
   *
   * Removes event listeners, stops all timers, and clears active tab
   * status from localStorage if this tab is active.
   *
   * This method should be called when the tab is closing or the
   * coordinator is being destroyed.
   */
  /**
   * Cleans up timers and event listeners (safe for React strict mode remounts)
   *
   * Does NOT clear localStorage — that's only done on actual page unload
   * via handleBeforeUnload. React strict mode in dev calls cleanup/remount
   * which would incorrectly clear the active tab status if we did it here.
   */
  cleanup(): void {
    // Stop all timers
    this.stopHeartbeat();
    this.stopMonitoring();
    this.stopFallbackPolling();

    // Remove event listeners
    this.removeEventListeners();
  }

  /**
   * Clears active tab status from localStorage
   *
   * Only called on actual page unload (beforeunload event), not on
   * React component unmount, to avoid issues with strict mode remounts.
   */
  private cleanupStorage(): void {
    if (this.isActiveTab()) {
      try {
        safeRemoveItem(STORAGE_KEYS.ACTIVE_TAB_ID);
        safeRemoveItem(STORAGE_KEYS.HEARTBEAT);
      } catch (error) {
        console.error('Failed to cleanup active tab status:', error);
      }
    }
  }

  /**
   * Sets up event listeners for storage, beforeunload, and visibility changes
   *
   * @private
   */
  private setupEventListeners(): void {
    // Storage event listener
    this.storageListener = this.handleStorageChange.bind(this);
    window.addEventListener('storage', this.storageListener);

    // Beforeunload event listener (using pre-bound reference for proper removal)
    window.addEventListener('beforeunload', this.boundHandleBeforeUnload);

    // Visibility change event listener (using pre-bound reference for proper removal)
    document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
  }

  /**
   * Removes all event listeners
   *
   * @private
   */
  private removeEventListeners(): void {
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
      this.storageListener = null;
    }

    window.removeEventListener('beforeunload', this.boundHandleBeforeUnload);
    document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
  }

  /**
   * Handles storage events from other tabs
   *
   * Detects when the active tab ID or heartbeat changes in localStorage
   * and triggers a re-check of this tab's status.
   *
   * @param event - The storage event
   * @private
   */
  private handleStorageChange(event: StorageEvent): void {
    // Only respond to changes in relevant keys
    if (
      event.key === STORAGE_KEYS.ACTIVE_TAB_ID ||
      event.key === STORAGE_KEYS.HEARTBEAT
    ) {
      // Re-check our status
      this.checkActiveTabStatus();
      
      // Notify store of synchronization
      if (this.store) {
        this.store.syncFromStorage();
      }
    }
  }

  /**
   * Handles the beforeunload event
   *
   * Calls cleanup to release active tab status and stop all timers.
   *
   * @private
   */
  private handleBeforeUnload(): void {
    this.cleanupStorage();
    this.cleanup();
  }

  /**
   * Handles visibility change events
   *
   * When the tab becomes visible, verifies that the active status is
   * still valid. If this tab should be active but isn't, attempts promotion.
   * Monitoring continues even when the tab is hidden.
   *
   * @private
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      // Tab is now hidden - monitoring continues automatically
      return;
    }

    // Tab is now visible again
    if (this.isActiveTab()) {
      // We're still the active tab — immediately refresh heartbeat
      // to prevent other tabs from thinking we're stale (browser throttles
      // timers in hidden tabs, so our heartbeat may have fallen behind)
      this.updateHeartbeat();
      
      if (!this.heartbeatTimer) {
        this.startHeartbeat();
      }
    } else if (this.heartbeatTimer) {
      // We were active (have a heartbeat timer) but someone took over
      // while we were hidden. Accept read-only — don't fight back.
      this.stopHeartbeat();
      this.startMonitoring();
      this.startFallbackPolling();
      
      if (this.store) {
        this.store.setActiveStatus(false);
      }
    } else {
      // We're a read-only tab becoming visible — check if we should promote
      // (only if there's genuinely no active tab or heartbeat is truly stale)
      this.checkActiveTabStatus();
    }
  }

  /**
   * Forces this tab to become the active tab
   *
   * Claims active status unconditionally, regardless of whether another
   * tab is currently active. Updates localStorage with this tab's ID and
   * starts sending heartbeat signals.
   *
   * This method is typically called when the user explicitly requests to
   * take control via the "Take control" button in the UI.
   */
  forceTakeover(): void {
    // Stop monitoring and fallback polling if we're currently monitoring
    this.stopMonitoring();
    this.stopFallbackPolling();

    // Claim active status unconditionally
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, this.tabId);
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, this.tabId);

      // Clear any existing election data
      localStorage.removeItem(STORAGE_KEYS.ELECTION);

      // Start sending heartbeat signals immediately
      this.startHeartbeat();
      
      // Update store state
      if (this.store) {
        this.store.setActiveStatus(true);
      }
    } catch (error) {
      console.error('Failed to force takeover:', error);
    }
  }

  /**
   * Gets a guarded localStorage wrapper for this tab
   *
   * Returns an object with write methods that automatically check
   * if this tab is active before allowing writes. This prevents
   * race conditions by ensuring only the active tab can write.
   *
   * @returns A guarded storage object with setItem, getItem, removeItem, and canWrite methods
   */
  getGuardedStorage() {
    return createGuardedStorage(this.tabId);
  }
}

