import { useState, useEffect } from 'react';

/**
 * Returns `false` during SSR and on the first client render,
 * then `true` after hydration completes.
 *
 * Useful for deferring client-only UI (skeletons, media queries, etc.)
 * until the React tree has hydrated on the client.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
