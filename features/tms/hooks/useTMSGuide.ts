import { useState, useCallback } from 'react';

const STORAGE_PREFIX = 'tms-guide-dismissed-';

/**
 * Manages the dismissed state of the TMS guide banner per system.
 * Persists to localStorage so the guide only auto-shows once per system.
 */
export function useTMSGuide(systemId: string) {
  const key = `${STORAGE_PREFIX}${systemId}`;

  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(key) !== 'true';
  });

  const dismiss = useCallback(() => {
    localStorage.setItem(key, 'true');
    setIsVisible(false);
  }, [key]);

  const reopen = useCallback(() => {
    setIsVisible(true);
  }, []);

  return { isVisible, dismiss, reopen };
}
