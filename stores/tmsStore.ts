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
  
  // AF4 actions
  markTask: (taskId: UUID) => void;
  unmarkTask: (taskId: UUID) => void;
  
  // FVP actions
  startFVPSelection: (firstTaskId: UUID) => void;
  selectFVPTask: (taskId: UUID) => void;
  skipFVPTask: () => void;
  endFVPSelection: () => void;
  resetFVP: () => void;
  
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
          markedTasks: [],
          markedOrder: []
        },
        fvp: {
          dottedTasks: [],
          currentX: null,
          selectionInProgress: false
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
      
      markTask: (taskId) => set((state) => {
        if (state.state.af4.markedTasks.includes(taskId)) {
          return state;
        }
        return {
          state: {
            ...state.state,
            af4: {
              markedTasks: [...state.state.af4.markedTasks, taskId],
              markedOrder: [...state.state.af4.markedOrder, taskId]
            }
          }
        };
      }),
      
      unmarkTask: (taskId) => set((state) => ({
        state: {
          ...state.state,
          af4: {
            markedTasks: state.state.af4.markedTasks.filter(id => id !== taskId),
            markedOrder: state.state.af4.markedOrder.filter(id => id !== taskId)
          }
        }
      })),
      
      startFVPSelection: (firstTaskId) => set((state) => ({
        state: {
          ...state.state,
          fvp: {
            dottedTasks: [],
            currentX: firstTaskId,
            selectionInProgress: true
          }
        }
      })),
      
      selectFVPTask: (taskId) => set((state) => ({
        state: {
          ...state.state,
          fvp: {
            ...state.state.fvp,
            dottedTasks: state.state.fvp.dottedTasks.includes(taskId)
              ? state.state.fvp.dottedTasks
              : [...state.state.fvp.dottedTasks, taskId],
            currentX: taskId
          }
        }
      })),
      
      skipFVPTask: () => {
        // No state change, just continue with current X
      },
      
      endFVPSelection: () => set((state) => ({
        state: {
          ...state.state,
          fvp: {
            ...state.state.fvp,
            selectionInProgress: false,
            currentX: null
          }
        }
      })),
      
      resetFVP: () => set((state) => ({
        state: {
          ...state.state,
          fvp: {
            dottedTasks: [],
            currentX: null,
            selectionInProgress: false
          }
        }
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
            markedTasks: [],
            markedOrder: []
          },
          fvp: {
            dottedTasks: [],
            currentX: null,
            selectionInProgress: false
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
