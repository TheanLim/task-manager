/** All shortcut action identifiers */
export type ShortcutAction =
  // Navigation
  | 'nav.up' | 'nav.down' | 'nav.left' | 'nav.right'
  | 'nav.home' | 'nav.end' | 'nav.gridHome' | 'nav.gridEnd'
  | 'nav.sectionPrev' | 'nav.sectionNext'
  | 'nav.gg' | 'nav.G' | 'nav.halfPageDown' | 'nav.halfPageUp'
  // Global
  | 'global.newTask' | 'global.search' | 'global.help'
  // Task context
  | 'task.edit' | 'task.open' | 'task.toggleComplete'
  | 'task.delete' | 'task.addSubtask'
  | 'task.saveEdit' | 'task.cancelEdit';

/** A single shortcut binding */
export interface ShortcutBinding {
  key: string;           // Key identifier (e.g., 'n', '/', '?', 'Enter', 'Space')
  label: string;         // Human-readable label (e.g., 'New task')
  category: 'Navigation' | 'Global' | 'Task Actions';
  description: string;   // Tooltip/help text
}

/** The full shortcut map: action → binding */
export type ShortcutMap = Record<ShortcutAction, ShortcutBinding>;

/** Conflict descriptor returned by conflict detection */
export interface ShortcutConflict {
  key: string;
  existingAction: ShortcutAction;
  newAction: ShortcutAction;
}

/** Grid cell coordinate with stable task identity */
export interface GridCoord {
  row: number;           // 0-based index into visible rows (for rendering)
  column: number;        // 0-based index into visible columns (0 = name column)
  taskId: string | null; // Stable identity for focus restoration across re-renders, drag-and-drop
}

/** All supported movement directions for grid navigation */
export type MoveDirection =
  | 'up' | 'down' | 'left' | 'right'
  | 'home' | 'end'
  | 'gridHome' | 'gridEnd'
  | 'firstRow' | 'lastRow'
  | 'halfPageDown' | 'halfPageUp';

/** Descriptor for a visible row in the flattened task grid */
export type VisibleRow = {
  type: 'task' | 'subtask' | 'sectionHeader';
  taskId: string | null;  // null for section headers
  sectionId: string | null;
  parentTaskId: string | null; // non-null for subtasks
};
