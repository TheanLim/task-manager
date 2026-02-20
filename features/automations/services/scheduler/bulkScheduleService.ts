import type { Clock } from './clock';
import type { AutomationRuleRepository } from '../../repositories/types';
import { isScheduledTrigger } from '../../types';

export interface BulkPauseResult {
  pausedCount: number;
  pausedRuleIds: string[];
}

export interface BulkResumeResult {
  resumedCount: number;
  resumedRuleIds: string[];
}

/**
 * Service for bulk pause/resume of scheduled automation rules.
 *
 * - pauseAllScheduled: disables all enabled scheduled rules, sets bulkPausedAt
 * - resumeAllScheduled: re-enables only bulk-paused rules (not individually-disabled)
 *
 * Does NOT import stores — uses repository interface only.
 */
export class BulkScheduleService {
  constructor(
    private ruleRepo: AutomationRuleRepository,
    private clock: Clock
  ) {}

  /**
   * Pause all enabled scheduled rules for a project.
   * Sets enabled=false and bulkPausedAt to current time.
   * Already-disabled rules are skipped (they were individually disabled).
   */
  pauseAllScheduled(projectId: string): BulkPauseResult {
    const rules = this.ruleRepo.findByProjectId(projectId);
    const nowIso = new Date(this.clock.now()).toISOString();
    const pausedRuleIds: string[] = [];

    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (!isScheduledTrigger(rule.trigger)) continue;

      this.ruleRepo.update(rule.id, {
        enabled: false,
        bulkPausedAt: nowIso,
      } as any);
      pausedRuleIds.push(rule.id);
    }

    return { pausedCount: pausedRuleIds.length, pausedRuleIds };
  }

  /**
   * Resume all bulk-paused scheduled rules for a project.
   * Only re-enables rules with bulkPausedAt !== null (not individually-disabled).
   * Clears bulkPausedAt on resumed rules.
   */
  resumeAllScheduled(projectId: string): BulkResumeResult {
    const rules = this.ruleRepo.findByProjectId(projectId);
    const resumedRuleIds: string[] = [];

    for (const rule of rules) {
      if (rule.bulkPausedAt === null) continue;

      this.ruleRepo.update(rule.id, {
        enabled: true,
        bulkPausedAt: null,
      } as any);
      resumedRuleIds.push(rule.id);
    }

    return { resumedCount: resumedRuleIds.length, resumedRuleIds };
  }
}
