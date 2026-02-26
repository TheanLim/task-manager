/**
 * useTMSSystemState — resolves the active handler and its validated/migrated state.
 *
 * Extracted from TMSHost to keep the host component focused on lifecycle wiring.
 * Ref: Phase 7C.1
 */

import { useTMSStore } from '../stores/tmsStore';
import { getTMSHandler } from '../registry';

export function useTMSSystemState(handlerId: string) {
  const { state } = useTMSStore();
  const handler = getTMSHandler(handlerId);
  const raw = state.systemStates[handler.id];
  const persistedVersion = state.systemStateVersions[handler.id] ?? 1;
  const systemState = persistedVersion < handler.stateVersion
    ? handler.migrateState(persistedVersion, raw)
    : handler.validateState(raw);
  return { handler, systemState };
}
