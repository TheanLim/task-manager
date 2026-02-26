import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { useTMSStoreMockFn } = vi.hoisted(() => {
  const fn = vi.fn() as any;
  fn.persist = { rehydrate: vi.fn() };
  return { useTMSStoreMockFn: fn };
});

vi.mock('../stores/tmsStore', () => ({
  useTMSStore: useTMSStoreMockFn,
}));
vi.mock('../registry', () => ({ getTMSHandler: vi.fn() }));

import { useTMSStore } from '../stores/tmsStore';
import { getTMSHandler } from '../registry';
import { useTMSSystemState } from './useTMSSystemState';

function makeHandler(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    stateVersion: 1,
    validateState: vi.fn((raw: unknown) => raw ?? {}),
    migrateState: vi.fn((_v: number, raw: unknown) => raw ?? {}),
    ...overrides,
  };
}

describe('useTMSSystemState', () => {
  afterEach(() => vi.clearAllMocks());

  it('calls validateState when persisted version matches handler version', () => {
    const handler = makeHandler('dit', { stateVersion: 2 });
    vi.mocked(getTMSHandler).mockReturnValue(handler as any);
    vi.mocked(useTMSStore).mockReturnValue({
      state: {
        activeSystem: 'dit',
        systemStates: { dit: { field: 'data' } },
        systemStateVersions: { dit: 2 },
      },
    } as any);

    const { result } = renderHook(() => useTMSSystemState('dit'));

    expect(handler.validateState).toHaveBeenCalledWith({ field: 'data' });
    expect(handler.migrateState).not.toHaveBeenCalled();
    expect(result.current.handler).toBe(handler);
  });

  it('calls migrateState when persisted version is behind handler version', () => {
    const handler = makeHandler('dit', { stateVersion: 3 });
    vi.mocked(getTMSHandler).mockReturnValue(handler as any);
    vi.mocked(useTMSStore).mockReturnValue({
      state: {
        activeSystem: 'dit',
        systemStates: { dit: { field: 'old' } },
        systemStateVersions: { dit: 1 },
      },
    } as any);

    renderHook(() => useTMSSystemState('dit'));

    expect(handler.migrateState).toHaveBeenCalledWith(1, { field: 'old' });
    expect(handler.validateState).not.toHaveBeenCalled();
  });

  it('defaults persisted version to 1 when missing', () => {
    const handler = makeHandler('dit', { stateVersion: 2 });
    vi.mocked(getTMSHandler).mockReturnValue(handler as any);
    vi.mocked(useTMSStore).mockReturnValue({
      state: {
        activeSystem: 'dit',
        systemStates: { dit: { field: 'old' } },
        systemStateVersions: {},
      },
    } as any);

    renderHook(() => useTMSSystemState('dit'));

    expect(handler.migrateState).toHaveBeenCalledWith(1, { field: 'old' });
  });
});
