/**
 * useTMSStoreHydrated — returns true once the TMS store has finished hydrating.
 *
 * Extracted from tmsStore.ts to keep React hooks out of the store file.
 * Ref: Phase 7E.2
 */

import { useState, useEffect } from 'react';
import { useTMSStore } from '../stores/tmsStore';

export function useTMSStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(useTMSStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useTMSStore.persist.onFinishHydration(() => setHydrated(true));
    if (useTMSStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  return hydrated;
}
