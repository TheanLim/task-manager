import { useEffect } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { useTMSStore } from '@/stores/tmsStore';

/**
 * Listens for localStorage changes from other tabs and rehydrates
 * persisted zustand stores to keep them in sync.
 */
const STORE_KEYS: Record<string, { rehydrate: () => void }> = {
  'task-management-data': useDataStore.persist,
  'task-management-settings': useAppStore.persist,
  'task-management-tms': useTMSStore.persist,
};

export function useCrossTabSync() {
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key && e.key in STORE_KEYS) {
        STORE_KEYS[e.key].rehydrate();
      }
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
}
