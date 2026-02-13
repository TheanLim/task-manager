/**
 * Multi-tab synchronization module
 * 
 * This module provides infrastructure for coordinating multiple browser tabs
 * to prevent localStorage race conditions. It implements an "active tab" mechanism
 * where only one tab can edit at a time, while other tabs remain in read-only mode.
 */

export * from './types';
export * from './constants';
export * from './utils';
export * from './store';
export { TabCoordinator } from './TabCoordinator';
