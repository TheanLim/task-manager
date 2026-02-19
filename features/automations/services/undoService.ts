import type { TaskRepository } from '@/lib/repositories/types';
import type { UndoSnapshot, ActionType, DomainEvent, RuleAction } from '../types';

/** Undo window duration in milliseconds */
export const UNDO_EXPIRY_MS = 10_000;

let currentUndoSnapshot: UndoSnapshot | null = null;
let undoSnapshotStack: UndoSnapshot[] = [];

/** Get the current (most recent) undo snapshot, or null if none or expired (Req 6.7) */
export function getUndoSnapshot(): UndoSnapshot | null {
  undoSnapshotStack = undoSnapshotStack.filter(
    (s) => Date.now() - s.timestamp <= UNDO_EXPIRY_MS
  );
  if (!currentUndoSnapshot) return undoSnapshotStack.length > 0 ? undoSnapshotStack[undoSnapshotStack.length - 1] : null;
  if (Date.now() - currentUndoSnapshot.timestamp > UNDO_EXPIRY_MS) {
    currentUndoSnapshot = null;
    return undoSnapshotStack.length > 0 ? undoSnapshotStack[undoSnapshotStack.length - 1] : null;
  }
  return currentUndoSnapshot;
}

/** Get all non-expired undo snapshots (for multi-rule undo) */
export function getUndoSnapshots(): UndoSnapshot[] {
  undoSnapshotStack = undoSnapshotStack.filter(
    (s) => Date.now() - s.timestamp <= UNDO_EXPIRY_MS
  );
  return [...undoSnapshotStack];
}

/** Push an undo snapshot onto the stack (for multi-rule batch) */
export function pushUndoSnapshot(snapshot: UndoSnapshot): void {
  undoSnapshotStack.push(snapshot);
  currentUndoSnapshot = snapshot;
}

/** Set the current undo snapshot (replaces entire stack — Req 6.9) */
export function setUndoSnapshot(snapshot: UndoSnapshot | null): void {
  currentUndoSnapshot = snapshot;
  if (snapshot) {
    undoSnapshotStack = [snapshot];
  } else {
    undoSnapshotStack = [];
  }
}

/** Clear the current undo snapshot */
export function clearUndoSnapshot(): void {
  currentUndoSnapshot = null;
  undoSnapshotStack = [];
}

/** Clear all undo snapshots */
export function clearAllUndoSnapshots(): void {
  currentUndoSnapshot = null;
  undoSnapshotStack = [];
}

/**
 * Perform undo of the last rule execution by reverting the affected task to its previous state.
 * Returns true if undo was performed, false if no valid snapshot exists.
 *
 * Validates Requirements: 6.2, 6.3, 6.4, 6.5, 6.6
 */
export function performUndo(taskRepo: TaskRepository): boolean {
  const snapshot = getUndoSnapshot();
  if (!snapshot) return false;

  applyUndo(snapshot, taskRepo);
  clearUndoSnapshot();
  return true;
}

/**
 * Perform undo of a specific rule's execution by its ruleId.
 * Removes that snapshot from the stack. Other snapshots remain.
 * Returns true if undo was performed.
 */
export function performUndoById(ruleId: string, taskRepo: TaskRepository): boolean {
  const idx = undoSnapshotStack.findIndex((s) => s.ruleId === ruleId && Date.now() - s.timestamp <= UNDO_EXPIRY_MS);
  if (idx === -1) return false;

  const snapshot = undoSnapshotStack[idx];
  applyUndo(snapshot, taskRepo);

  // Remove from stack
  undoSnapshotStack.splice(idx, 1);
  // Update currentUndoSnapshot
  currentUndoSnapshot = undoSnapshotStack.length > 0 ? undoSnapshotStack[undoSnapshotStack.length - 1] : null;
  return true;
}

/**
 * Apply undo logic for a single snapshot (shared by performUndo and performUndoById).
 */
function applyUndo(snapshot: UndoSnapshot, taskRepo: TaskRepository): void {
  const { actionType, targetEntityId, previousState, createdEntityId } = snapshot;

  switch (actionType) {
    case 'move_card_to_top_of_section':
    case 'move_card_to_bottom_of_section': {
      const task = taskRepo.findById(targetEntityId);
      if (!task) break;
      const updates: Partial<{ sectionId: string | null; order: number }> = {};
      if (previousState.sectionId !== undefined) updates.sectionId = previousState.sectionId;
      if (previousState.order !== undefined) updates.order = previousState.order;
      taskRepo.update(targetEntityId, updates);
      break;
    }
    case 'mark_card_complete':
    case 'mark_card_incomplete': {
      const task = taskRepo.findById(targetEntityId);
      if (!task) break;
      const updates: Partial<{ completed: boolean; completedAt: string | null }> = {};
      if (previousState.completed !== undefined) updates.completed = previousState.completed;
      if (previousState.completedAt !== undefined) updates.completedAt = previousState.completedAt;
      taskRepo.update(targetEntityId, updates);
      if (snapshot.subtaskSnapshots) {
        for (const sub of snapshot.subtaskSnapshots) {
          const subtask = taskRepo.findById(sub.taskId);
          if (!subtask) continue;
          taskRepo.update(sub.taskId, {
            completed: sub.previousState.completed,
            completedAt: sub.previousState.completedAt,
          });
        }
      }
      break;
    }
    case 'set_due_date':
    case 'remove_due_date': {
      const task = taskRepo.findById(targetEntityId);
      if (!task) break;
      if (previousState.dueDate !== undefined) {
        taskRepo.update(targetEntityId, { dueDate: previousState.dueDate });
      }
      break;
    }
    case 'create_card': {
      const entityToDelete = createdEntityId ?? targetEntityId;
      taskRepo.delete(entityToDelete);
      break;
    }
    default:
      break;
  }
}

/**
 * Map a RuleAction's actionType to the ActionType used in UndoSnapshot.
 */
function mapActionTypeForUndo(actionType: ActionType): ActionType {
  return actionType;
}

/**
 * Build an UndoSnapshot from a rule action and the domain event produced by its execution.
 * The domain event's previousValues contain the state before the action was applied.
 */
export function buildUndoSnapshot(
  action: RuleAction,
  ruleName: string,
  resultEvent: DomainEvent
): UndoSnapshot {
  const prev = resultEvent.previousValues;
  const snapshot: UndoSnapshot = {
    ruleId: action.ruleId,
    ruleName,
    actionType: mapActionTypeForUndo(action.actionType),
    targetEntityId: action.targetEntityId,
    previousState: {
      sectionId: prev.sectionId as string | undefined,
      order: prev.order as number | undefined,
      completed: prev.completed as boolean | undefined,
      completedAt: prev.completedAt !== undefined ? (prev.completedAt as string | null) : undefined,
      dueDate: prev.dueDate !== undefined ? (prev.dueDate as string | null) : undefined,
    },
    timestamp: Date.now(),
  };

  // For create_card actions, the created entity is the event's entityId
  if (action.actionType === 'create_card') {
    snapshot.createdEntityId = resultEvent.entityId;
    snapshot.targetEntityId = resultEvent.entityId;
  }

  return snapshot;
}
