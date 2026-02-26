import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TMSState } from '@/types';

export function migrateTMSState(persistedState: unknown, version: number): TMSState {
  if (version === 1) {
    const s = (persistedState as any) ?? {};
    // Drop passStartPosition from af4 during migration
    const af4Raw = s.af4 ? { ...s.af4 } : null;
    if (af4Raw && 'passStartPosition' in af4Raw) {
      delete af4Raw.passStartPosition;
    }
    return {
      activeSystem: (s.activeSystem as string) ?? 'none',
      systemStates: {
        ...(s.dit  ? { dit:  s.dit  } : {}),
        ...(af4Raw ? { af4:  af4Raw } : {}),
        ...(s.fvp  ? { fvp:  s.fvp  } : {}),
      },
      systemStateVersions: {
        ...(s.dit  ? { dit:  1 } : {}),
        ...(af4Raw ? { af4:  1 } : {}),
        ...(s.fvp  ? { fvp:  1 } : {}),
      },
    };
  }
  // Unknown/corrupt version — safe default, no crash
  return { activeSystem: 'none', systemStates: {}, systemStateVersions: {} };
}

interface TMSStore {
  state: TMSState;

  setActiveSystem: (system: string) => void;
  applySystemStateDelta: (systemId: string, delta: Record<string, unknown>, newVersion?: number) => void;
  setSystemState: (systemId: string, state: unknown, version?: number) => void;
  clearSystemState: (systemId: string) => void;
}

const DEFAULT_STATE: TMSState = {
  activeSystem: 'none',
  systemStates: {},
  systemStateVersions: {},
};

export const useTMSStore = create<TMSStore>()(
  persist(
    (set) => ({
      state: DEFAULT_STATE,

      setActiveSystem: (system) => set((store) => ({
        state: { ...store.state, activeSystem: system },
      })),

      applySystemStateDelta: (systemId, delta, newVersion) => set((store) => {
        const existing = (store.state.systemStates[systemId] ?? {}) as Record<string, unknown>;
        const merged = { ...existing, ...delta };
        const versions = newVersion !== undefined
          ? { ...store.state.systemStateVersions, [systemId]: newVersion }
          : store.state.systemStateVersions;
        return {
          state: {
            ...store.state,
            systemStates: { ...store.state.systemStates, [systemId]: merged },
            systemStateVersions: versions,
          },
        };
      }),

      setSystemState: (systemId, state, version) => set((store) => {
        const versions = version !== undefined
          ? { ...store.state.systemStateVersions, [systemId]: version }
          : store.state.systemStateVersions;
        return {
          state: {
            ...store.state,
            systemStates: { ...store.state.systemStates, [systemId]: state },
            systemStateVersions: versions,
          },
        };
      }),

      clearSystemState: (systemId) => set((store) => {
        const { [systemId]: _s, ...remainingStates } = store.state.systemStates;
        const { [systemId]: _v, ...remainingVersions } = store.state.systemStateVersions;
        return {
          state: {
            ...store.state,
            systemStates: remainingStates,
            systemStateVersions: remainingVersions,
          },
        };
      }),
    }),
    {
      name: 'task-management-tms',
      version: 2,
      migrate: migrateTMSState,
    }
  )
);
