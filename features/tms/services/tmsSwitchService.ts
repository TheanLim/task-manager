/**
 * tmsSwitchService — pure switch logic extracted from TMSHost.
 *
 * No store imports. Accepts handler lookup via dependency injection so
 * tests can register mock handlers without touching the global registry.
 *
 * Ref: EXTENSIBILITY-ARCHITECTURE.md §3; tasks.md T-00a
 */

import { Task } from '@/types';
import { TimeManagementSystemHandler } from '../handlers';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TMSSystemId = string;
export type SystemState = Record<string, unknown>;

/** Minimal handler lookup — injected so tests can use a local registry. */
export type HandlerLookup = (id: TMSSystemId) => TimeManagementSystemHandler;

export interface TMSSwitchResult {
  newActiveSystem: TMSSystemId;
  /** Only the systems whose state changed — not the full state map. */
  systemStateUpdates: Partial<Record<TMSSystemId, SystemState>>;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Executes a TMS switch lifecycle:
 *   1. Calls `onDeactivate` on `fromId` (if fromId !== 'none')
 *   2. Calls `onActivate` on `toId` (if toId !== 'none'), passing `tasks`
 *      and the current system state for `toId`
 *
 * Returns only the systems that changed in `systemStateUpdates`.
 * DIT day-rollover toast logic stays in TMSHost as a side effect.
 *
 * @param fromId        - The currently active system (may be 'none')
 * @param toId          - The system to switch to (may be 'none')
 * @param tasks         - Current task list (passed to onActivate)
 * @param systemStates  - Per-system state map (read-only)
 * @param getHandler    - Handler lookup function (defaults to global registry)
 */
export function executeTMSSwitch(
  fromId: TMSSystemId,
  toId: TMSSystemId,
  tasks: Task[],
  systemStates: Record<TMSSystemId, SystemState>,
  getHandler: HandlerLookup,
): TMSSwitchResult {
  const updates: Partial<Record<TMSSystemId, SystemState>> = {};

  // 1. Deactivate the current system (skip if 'none' or 'standard' — Standard is a
  //    passthrough sort order with no lifecycle state to clean up)
  if (fromId !== 'none' && fromId !== 'standard') {
    const fromHandler = getHandler(fromId);
    const fromState = (systemStates[fromId] ?? fromHandler.getInitialState()) as SystemState;
    const deactivateDelta = fromHandler.onDeactivate(fromState) as SystemState;
    // Only record an update if onDeactivate returned a non-empty delta
    if (Object.keys(deactivateDelta).length > 0) {
      updates[fromId] = { ...fromState, ...deactivateDelta };
    }
  }

  // 2. Activate the new system (skip if switching to 'none' or 'standard')
  if (toId !== 'none' && toId !== 'standard') {
    const toHandler = getHandler(toId);
    const existingState = systemStates[toId];
    const baseState = (existingState ?? toHandler.getInitialState()) as SystemState;
    const validatedState = toHandler.validateState(baseState) as SystemState;
    const activateDelta = toHandler.onActivate(tasks, validatedState) as SystemState;
    const mergedState = { ...validatedState, ...activateDelta };
    updates[toId] = mergedState;
  }

  return { newActiveSystem: toId, systemStateUpdates: updates };
}
