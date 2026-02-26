import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TMSState, TimeManagementSystem, UUID } from '@/types';

interface TMSStore {
  state: TMSState;
  
  setActiveSystem: (system: TimeManagementSystem) => void;
  
  // DIT actions
  addToToday: (taskId: UUID) => void;
  addToTomorrow: (taskId: UUID) => void;
  moveToToday: (taskId: UUID) => void;
  moveToTomorrow: (taskId: UUID) => void;
  removeFromSchedule: (taskId: UUID) => void;
  performDayRollover: () => void;
  
  // Generic state update — apply a partial TMSState delta (used by pure TMS handlers)
  updateState: (delta: Partial<TMSState>) => void;
  
  // Cleanup
  clearSystemMetadata: () => void;
}

export const useTMSStore = create<TMSStore>()(
  persist(
    (set, get) => ({
      state: {
        activeSystem: TimeManagementSystem.NONE,
        dit: {
          todayTasks: [],
          tomorrowTasks: [],
          lastDayChange: new Date().toISOString()
        },
        af4: {
          backlogTaskIds: [],
          activeListTaskIds: [],
          currentPosition: 0,
          lastPassHadWork: false,
          passStartPosition: 0,
          dismissedTaskIds: [],
          phase: 'backlog' as const,
        },
        fvp: {
          dottedTasks: [],
          scanPosition: 1,
        }
      },
      
      setActiveSystem: (system) => set((state) => ({
        state: { ...state.state, activeSystem: system }
      })),
      
      addToToday: (taskId) => set((state) => ({
        state: {
          ...state.state,
          dit: {
            ...state.state.dit,
            todayTasks: [...state.state.dit.todayTasks, taskId]
          }
        }
      })),
      
      addToTomorrow: (taskId) => set((state) => ({
        state: {
          ...state.state,
          dit: {
            ...state.state.dit,
            tomorrowTasks: [...state.state.dit.tomorrowTasks, taskId]
          }
        }
      })),
      
      moveToToday: (taskId) => set((state) => ({
        state: {
          ...state.state,
          dit: {
            ...state.state.dit,
            todayTasks: [...state.state.dit.todayTasks, taskId],
            tomorrowTasks: state.state.dit.tomorrowTasks.filter(id => id !== taskId)
          }
        }
      })),
      
      moveToTomorrow: (taskId) => set((state) => ({
        state: {
          ...state.state,
          dit: {
            ...state.state.dit,
            tomorrowTasks: [...state.state.dit.tomorrowTasks, taskId],
            todayTasks: state.state.dit.todayTasks.filter(id => id !== taskId)
          }
        }
      })),
      
      removeFromSchedule: (taskId) => set((state) => ({
        state: {
          ...state.state,
          dit: {
            ...state.state.dit,
            todayTasks: state.state.dit.todayTasks.filter(id => id !== taskId),
            tomorrowTasks: state.state.dit.tomorrowTasks.filter(id => id !== taskId)
          }
        }
      })),
      
      performDayRollover: () => set((state) => ({
        state: {
          ...state.state,
          dit: {
            todayTasks: [...state.state.dit.tomorrowTasks],
            tomorrowTasks: [],
            lastDayChange: new Date().toISOString()
          }
        }
      })),
      
      
      updateState: (delta) => set((store) => ({
        state: {
          ...store.state,
          ...delta,
          dit: delta.dit ? { ...store.state.dit, ...delta.dit } : store.state.dit,
          af4: delta.af4 ? { ...store.state.af4, ...delta.af4 } : store.state.af4,
          fvp: delta.fvp ? { ...store.state.fvp, ...delta.fvp } : store.state.fvp,
        },
      })),
      
      clearSystemMetadata: () => set((state) => ({
        state: {
          ...state.state,
          dit: {
            todayTasks: [],
            tomorrowTasks: [],
            lastDayChange: new Date().toISOString()
          },
          af4: {
            backlogTaskIds: [],
            activeListTaskIds: [],
            currentPosition: 0,
            lastPassHadWork: false,
            passStartPosition: 0,
            dismissedTaskIds: [],
            phase: 'backlog' as const,
          },
          fvp: {
            dottedTasks: [],
            scanPosition: 1,
          }
        }
      }))
    }),
    {
      name: 'task-management-tms',
      version: 1
    }
  )
);
