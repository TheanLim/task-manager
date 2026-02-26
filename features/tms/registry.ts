/**
 * Static TMS handler registry.
 *
 * Pre-populated at module load time with all four built-in systems.
 * Use `registerTMSHandler` to add additional handlers (e.g. in tests).
 *
 * Ref: EXTENSIBILITY-ARCHITECTURE.md §4
 */

import { TimeManagementSystemHandler } from './handlers';
import { DITHandler } from './handlers/DITHandler';
import { AF4Handler } from './handlers/af4';
import { FVPHandler } from './handlers/fvp';
import { StandardHandler } from './handlers/StandardHandler';

const TMS_REGISTRY: Record<string, TimeManagementSystemHandler> = {};

export function getTMSHandler(id: string): TimeManagementSystemHandler {
  const handler = TMS_REGISTRY[id];
  if (!handler) throw new Error(`Unknown TMS: "${id}"`);
  return handler;
}

export function getAllTMSHandlers(): TimeManagementSystemHandler[] {
  return Object.values(TMS_REGISTRY);
}

/**
 * Register a handler. Validates at registration time — a misconfigured handler
 * throws immediately rather than at runtime when a user switches to it.
 */
export function registerTMSHandler(handler: TimeManagementSystemHandler): void {
  handler.validateState(handler.getInitialState()); // must not throw
  TMS_REGISTRY[handler.id] = handler;
}

// ── Pre-populate with all four built-in systems ───────────────────────────────

registerTMSHandler(DITHandler as TimeManagementSystemHandler);
registerTMSHandler(AF4Handler as TimeManagementSystemHandler);
registerTMSHandler(FVPHandler as TimeManagementSystemHandler);
registerTMSHandler(StandardHandler as TimeManagementSystemHandler);
