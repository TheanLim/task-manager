/**
 * useTMSDispatch — returns a stable dispatch function bound to the active TMS handler.
 *
 * Shared between TMSHost and GlobalTasksView so dispatch construction is not duplicated.
 * Returns a no-op when activeSystem is 'none' or 'standard'.
 *
 * React hook (UI layer) — store imports are permitted here.
 * Arch rule #2 applies to services/handlers/utilities only.
 */

import { useCallback } from 'react';
import { useTMSStore } from '../stores/tmsStore';
import { getTMSHandler } from '../registry';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const NOOP = () => {};

export function useTMSDispatch(): (action: unknown) => void {
  const activeSystem = useTMSStore((s) => s.state.activeSystem);
  const systemState = useTMSStore((s) => s.state.systemStates[s.state.activeSystem]);
  const applySystemStateDelta = useTMSStore((s) => s.applySystemStateDelta);

  return useCallback(
    (action: unknown) => {
      if (activeSystem === 'none' || activeSystem === 'standard') return;
      try {
        const handler = getTMSHandler(activeSystem);
        const delta = handler.reduce(systemState, action);
        applySystemStateDelta(handler.id, delta as Record<string, unknown>);
      } catch (err) {
        console.error('[useTMSDispatch] dispatch failed:', err);
      }
    },
    [activeSystem, systemState, applySystemStateDelta],
  );
}
