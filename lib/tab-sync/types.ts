/**
 * Configuration options for TabCoordinator
 */
export interface TabCoordinatorConfig {
  /** Interval in milliseconds for heartbeat updates (default: 2000ms) */
  heartbeatInterval: number;
  /** Timeout in milliseconds before heartbeat is considered stale (default: 5000ms) */
  heartbeatTimeout: number;
  /** Interval in milliseconds for monitoring heartbeat status (default: 1000ms) */
  monitorInterval: number;
}

/**
 * State information for a browser tab
 */
export interface TabState {
  /** Unique identifier for this tab */
  tabId: string;
  /** Whether this tab is currently the active tab */
  isActive: boolean;
  /** Timestamp of the last heartbeat, or null if no heartbeat exists */
  lastHeartbeat: number | null;
}

/**
 * Heartbeat data structure stored in localStorage
 */
export interface HeartbeatData {
  /** Unique identifier of the tab sending the heartbeat */
  tabId: string;
  /** Timestamp when the heartbeat was sent */
  timestamp: number;
}

/**
 * Tab coordination data stored in localStorage
 */
export interface TabCoordinationData {
  /** ID of the currently active tab, or null if no active tab */
  activeTabId: string | null;
  /** Timestamp of the last heartbeat, or null if no heartbeat exists */
  heartbeatTimestamp: number | null;
  /** ID of the last active tab (for debugging purposes) */
  lastActiveTabId: string | null;
}
