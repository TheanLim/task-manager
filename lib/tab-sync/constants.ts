/**
 * localStorage keys used for tab coordination
 */
export const STORAGE_KEYS = {
  /** Key for storing the active tab ID */
  ACTIVE_TAB_ID: 'tab-sync:active-tab-id',
  /** Key for storing heartbeat data */
  HEARTBEAT: 'tab-sync:heartbeat',
  /** Key for storing the last active tab ID (debugging) */
  LAST_ACTIVE: 'tab-sync:last-active-tab-id',
  /** Key for storing election data during promotion */
  ELECTION: 'tab-sync:election',
} as const;

/**
 * Default configuration values for TabCoordinator
 */
export const DEFAULT_CONFIG = {
  /** Default heartbeat interval: 2 seconds */
  heartbeatInterval: 2000,
  /** Default heartbeat timeout: 30 seconds — generous to tolerate browser throttling of hidden tabs */
  heartbeatTimeout: 30000,
  /** Default monitor interval: 2 seconds */
  monitorInterval: 2000,
} as const;
