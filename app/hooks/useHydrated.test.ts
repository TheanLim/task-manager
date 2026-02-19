import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useHydrated } from './useHydrated';

describe('useHydrated', () => {
  it('returns true after hydration (useEffect has fired)', () => {
    const { result } = renderHook(() => useHydrated());
    // In jsdom, useEffect fires synchronously during renderHook,
    // so by the time we read result.current it's already true.
    expect(result.current).toBe(true);
  });

  it('returns a stable boolean value across re-renders', () => {
    const { result, rerender } = renderHook(() => useHydrated());
    expect(result.current).toBe(true);

    rerender();
    expect(result.current).toBe(true);
  });
});
