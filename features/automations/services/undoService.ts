import type { TaskRepository } from '@/lib/repositories/types';
import type { UndoSnapshot, DomainEvent, RuleAction } from '../types';
import { getActionHandler, type ActionContext } from './actionHandlers';

/** Undo window duration in milliseconds */
export const UNDO_EXPIRY_MS = 10_000;

/** Single source of truth for undo state — no duplicate tracking. */
let undoSnapshotStack: UndoSnapshot[] = [];

/** Prune expired snapshots in-place and return the stack. */
function pruneExpired(): UndoSnapshot[] {
  undoSnapshotStack = undoSnapshotStack.filter(
    (s) => Date.now() - s.timestamp <= UNDO_EXPIRY_MS
  );
  return undoSnapshotStack;
}

/** Get the current (most recent) undo snapshot, or null if none or expired (Req 6.7) */
export function getUndoSnapshot(): UndoSnapshot | null {
  const stack = pruneExpired();
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

/** Get all non-expired undo snapshots (for multi-rule undo) */
export function getUndoSnapshots(): UndoSnapshot[] {
  return [...pruneExpired()];
}

/** Push an undo snapshot onto the stack (for multi-rule batch) */
export function pushUndoSnapshot(snapshot: UndoSnapshot): void {
  undoSnapshotStack.push(snapshot);
}

/** Set the current undo snapshot (replaces entire stack — Req 6.9) */
export function setUndoSnapshot(snapshot: UndoSnapshot | null): void {
  undoSnapshotStack = snapshot ? [snapshot] : [];
}

/** Clear all undo snapshots */
export function clearAllUndoSnapshots(): void {
  undoSnapshotStack = [];
}

/** @deprecated Use clearAllUndoSnapshots — kept for backward compatibility */
export const clearUndoSnapshot = clearAllUndoSnapshots;

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
  clearAllUndoSnapshots();
  return true;
}

/**
 * Perform undo of a specific rule's execution by its ruleId.
 * Removes that snapshot from the stack. Other snapshots remain.
 * Returns true if undo was performed.
 */
export function performUndoById(ruleId: string, taskRepo: TaskRepository): boolean {
  pruneExpired();
  const idx = undoSnapshotStack.findIndex((s) => s.ruleId === ruleId);
  if (idx === -1) return false;

  const snapshot = undoSnapshotStack[idx];
  applyUndo(snapshot, taskRepo);
  undoSnapshotStack.splice(idx, 1);
  return true;
}

/**
 * Apply undo logic for a single snapshot by delegating to the action handler.
 */
function applyUndo(snapshot: UndoSnapshot, taskRepo: TaskRepository): void {
  const handler = getActionHandler(snapshot.actionType);
  // Build a minimal ActionContext — undo only needs taskRepo
  const ctx: ActionContext = {
    taskRepo,
    sectionRepo: undefined as any,
    taskService: undefined as any,
  };
  handler.undo(snapshot, ctx);
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
    actionType: action.actionType,
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
