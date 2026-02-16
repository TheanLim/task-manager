import { create } from 'zustand';
import type { GridCoord } from '../types';

/**
 * Lightweight store for keyboard navigation state.
 * Allows page.tsx to read the focused task ID without prop threading.
 * No business logic — just state.
 */
interface KeyboardNavStore {
  /** The currently focused task ID from grid navigation, or null */
  focusedTaskId: string | null;
  /** The full active cell coordinate */
  activeCell: GridCoord | null;
  /** Set the focused task from the navigation hook */
  setFocusedTask: (taskId: string | null, cell: GridCoord | null) => void;
}

export const useKeyboardNavStore = create<KeyboardNavStore>()((set) => ({
  focusedTaskId: null,
  activeCell: null,
  setFocusedTask: (taskId, cell) => set({ focusedTaskId: taskId, activeCell: cell }),
}));
