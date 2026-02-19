import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

describe('useMediaQuery', () => {
  let listeners: Map<string, (e: MediaQueryListEvent) => void>;
  let matchesMap: Map<string, boolean>;

  beforeEach(() => {
    listeners = new Map();
    matchesMap = new Map();

    window.matchMedia = vi.fn((query: string) => {
      const mql = {
        matches: matchesMap.get(query) ?? false,
        media: query,
        addEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
          listeners.set(query, handler);
        }),
        removeEventListener: vi.fn((_event: string, _handler: (e: MediaQueryListEvent) => void) => {
          listeners.delete(query);
        }),
        dispatchEvent: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      } as unknown as MediaQueryList;
      return mql;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false initially when query does not match', () => {
    matchesMap.set('(max-width: 1023px)', false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 1023px)'));
    expect(result.current).toBe(false);
  });

  it('returns true when query matches', () => {
    matchesMap.set('(max-width: 1023px)', true);
    const { result } = renderHook(() => useMediaQuery('(max-width: 1023px)'));
    expect(result.current).toBe(true);
  });

  it('updates when the media query match changes', () => {
    matchesMap.set('(max-width: 767px)', false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(false);

    // Simulate a viewport change
    act(() => {
      const handler = listeners.get('(max-width: 767px)');
      handler?.({ matches: true } as MediaQueryListEvent);
    });

    expect(result.current).toBe(true);
  });

  it('cleans up the listener on unmount', () => {
    matchesMap.set('(min-width: 768px)', true);
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));

    const mql = (window.matchMedia as ReturnType<typeof vi.fn>).mock.results[0].value;
    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('re-subscribes when the query string changes', () => {
    matchesMap.set('(max-width: 1023px)', true);
    matchesMap.set('(max-width: 767px)', false);

    const { result, rerender } = renderHook(
      ({ query }) => useMediaQuery(query),
      { initialProps: { query: '(max-width: 1023px)' } }
    );

    expect(result.current).toBe(true);

    rerender({ query: '(max-width: 767px)' });
    expect(result.current).toBe(false);
  });
});
