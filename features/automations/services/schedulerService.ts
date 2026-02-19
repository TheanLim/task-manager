import type { Clock } from './clock';
import type { AutomationRuleRepository } from '../repositories/types';
import type { TaskRepository } from '@/lib/repositories/types';
import type { AutomationRule } from '../types';
import { evaluateScheduledRules, type ScheduleEvaluation } from './scheduleEvaluator';
import { isScheduledTrigger } from '../types';

/**
 * Callback invoked when a scheduled rule fires.
 * The caller (integration layer) routes this into AutomationService.handleEvent().
 */
export interface ScheduledRuleCallback {
  (params: { rule: AutomationRule; evaluation: ScheduleEvaluation }): void;
}

/**
 * Callback invoked after a complete tick() pass finishes.
 * Used for summary notifications.
 */
export interface TickCompleteCallback {
  (params: {
    rulesEvaluated: number;
    rulesFired: number;
    totalTasksAffected: number;
    isCatchUp: boolean;
  }): void;
}

/**
 * SchedulerService manages the tick loop for scheduled automation rules.
 *
 * Responsibilities:
 * - Start/stop the tick interval
 * - On each tick: evaluate all scheduled rules via pure functions
 * - For rules that should fire: update lastEvaluatedAt BEFORE callback, then invoke callback
 * - Handle visibility changes (catch-up on foreground)
 * - Provide catch-up evaluation on startup
 *
 * Does NOT: execute actions, manage undo, emit toasts, import stores.
 */
export class SchedulerService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private readonly TICK_INTERVAL_MS = 60_000;
  private onTickComplete?: TickCompleteCallback;

  constructor(
    private clock: Clock,
    private ruleRepo: AutomationRuleRepository,
    private taskRepo: TaskRepository,
    private onRuleFired: ScheduledRuleCallback,
    onTickComplete?: TickCompleteCallback
  ) {
    this.onTickComplete = onTickComplete;
  }

  /**
   * Start the tick loop. Idempotent — calling start() when already running is a no-op.
   * On start: immediate catch-up tick + 60s interval + visibility listener.
   */
  start(): void {
    if (this.intervalId !== null) return;

    // Immediate catch-up on start
    this.tick(true);

    // Start periodic tick
    this.intervalId = setInterval(() => this.tick(false), this.TICK_INTERVAL_MS);

    // Visibility change handler: catch-up when tab becomes visible
    this.visibilityHandler = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.tick(true);
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  /** Stop the tick loop and clean up listeners. */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /**
   * Single tick: evaluate all scheduled rules and fire those that are due.
   * Also called on visibility change for catch-up.
   */
  tick(isCatchUp = false): void {
    let rules: AutomationRule[];
    let tasks: ReturnType<TaskRepository['findAll']>;

    try {
      rules = this.ruleRepo.findAll();
      tasks = this.taskRepo.findAll();
    } catch {
      // Repository error — skip this tick, retry on next
      return;
    }

    const nowMs = this.clock.now();
    const results = evaluateScheduledRules(nowMs, rules, tasks);
    let totalTasksAffected = 0;

    for (const { rule, evaluation } of results) {
      // Update lastEvaluatedAt BEFORE firing callback (crash recovery ordering)
      try {
        this.updateLastEvaluatedAt(rule.id, evaluation.newLastEvaluatedAt);
      } catch {
        // Log error, continue — rule may re-fire on next tick (acceptable)
      }

      try {
        this.onRuleFired({ rule, evaluation });
      } catch {
        // Callback error — continue to next rule
      }

      totalTasksAffected += evaluation.matchingTaskIds?.length ?? 1;
    }

    // Update lastEvaluatedAt for non-fired rules to prevent stale catch-up windows
    this.updateNonFiredRules(rules, results.map((r) => r.rule.id), nowMs);

    if (results.length > 0 && this.onTickComplete) {
      this.onTickComplete({
        rulesEvaluated: rules.filter(
          (r) => r.enabled && r.brokenReason === null && isScheduledTrigger(r.trigger)
        ).length,
        rulesFired: results.length,
        totalTasksAffected,
        isCatchUp,
      });
    }
  }

  /** Evaluate a single rule on demand (for "Run Now" feature). */
  evaluateSingleRule(rule: AutomationRule): void {
    if (!isScheduledTrigger(rule.trigger)) return;

    const nowMs = this.clock.now();
    const tasks = this.taskRepo.findAll();
    const results = evaluateScheduledRules(nowMs, [rule], tasks);

    for (const { rule: firedRule, evaluation } of results) {
      this.updateLastEvaluatedAt(firedRule.id, evaluation.newLastEvaluatedAt);
      this.onRuleFired({ rule: firedRule, evaluation });
    }
  }

  /** Check if the scheduler is currently running. */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  private updateLastEvaluatedAt(ruleId: string, lastEvaluatedAt: string): void {
    const rule = this.ruleRepo.findById(ruleId);
    if (!rule || !isScheduledTrigger(rule.trigger)) return;

    this.ruleRepo.update(ruleId, {
      trigger: { ...rule.trigger, lastEvaluatedAt },
    } as any);
  }

  private updateNonFiredRules(
    allRules: AutomationRule[],
    firedRuleIds: string[],
    nowMs: number
  ): void {
    const firedSet = new Set(firedRuleIds);
    const nowIso = new Date(nowMs).toISOString();
    const staleThresholdMs = this.TICK_INTERVAL_MS * 2;

    for (const rule of allRules) {
      if (!rule.enabled || rule.brokenReason !== null) continue;
      if (!isScheduledTrigger(rule.trigger)) continue;
      if (firedSet.has(rule.id)) continue;

      const lastMs = rule.trigger.lastEvaluatedAt
        ? new Date(rule.trigger.lastEvaluatedAt).getTime()
        : 0;

      if (nowMs - lastMs > staleThresholdMs) {
        try {
          this.updateLastEvaluatedAt(rule.id, nowIso);
        } catch {
          // Skip — non-critical
        }
      }
    }
  }
}
