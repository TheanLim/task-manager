import { z } from 'zod';
import { ComponentType } from 'react';
import { Task } from '@/types';

// ── Shared prop/dispatch types ────────────────────────────────────────────────

/** Props passed to every TMS view component */
export interface TMSViewProps<S = unknown> {
  tasks: Task[];
  systemState: S;
  dispatch: TMSDispatch<unknown>;
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}

/**
 * Semantic action dispatch — views emit named actions, not raw state deltas.
 * Each handler defines its own action union type.
 */
export type TMSDispatch<A> = (action: A) => void;

// ── Handler interface ─────────────────────────────────────────────────────────

/**
 * Full handler contract. Pure functions only — no store imports.
 *
 * State is typed generically; each concrete handler uses its own specific
 * state type. The host (Phase 4) casts via handler.validateState().
 */
export interface TimeManagementSystemHandler<S = unknown, A = unknown> {
  // ── Identity ──────────────────────────────────────────────────────────────
  readonly id: string;
  readonly displayName: string;
  readonly description: string;

  // ── State contract ────────────────────────────────────────────────────────
  readonly stateSchema: z.ZodType<S>;
  readonly stateVersion: number;

  getInitialState(): S;
  /** Falls back to getInitialState() on failure — never throws */
  validateState(raw: unknown): S;
  migrateState(fromVersion: number, raw: unknown): S;

  // ── Lifecycle hooks (pure — return deltas, never mutate) ──────────────────
  /**
   * Called when the user switches TO this system.
   * Return value is merged with getInitialState() — {} means "use defaults".
   */
  onActivate(tasks: Task[], currentState: S): Partial<S>;

  /**
   * Called when the user switches AWAY from this system.
   * Use to reset transient UI state (e.g. selectionInProgress).
   */
  onDeactivate(currentState: S): Partial<S>;

  getOrderedTasks(tasks: Task[], systemState: S): Task[];
  onTaskCreated(task: Task, systemState: S): Partial<S>;
  onTaskCompleted(task: Task, systemState: S): Partial<S>;
  onTaskDeleted(taskId: string, systemState: S): Partial<S>;

  // ── Action reducer ────────────────────────────────────────────────────────
  /**
   * Pure reducer: given the current state and a semantic action, return a
   * partial state delta. Views dispatch actions; this function applies them.
   */
  reduce(state: S, action: A): Partial<S>;

  // ── View binding ──────────────────────────────────────────────────────────
  /**
   * Returns the React component type for this system's view.
   * The component receives TMSViewProps<S> — no store access inside.
   */
  getViewComponent(): ComponentType<TMSViewProps<S>>;
}
