import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { FakeClock } from './clock';
import { BulkScheduleService } from './bulkScheduleService';
import type { AutomationRule } from '../../types';
import type { AutomationRuleRepository } from '../../repositories/types';

// ─── In-memory repo ─────────────────────────────────────────────────────

function createInMemoryRuleRepo(rules: AutomationRule[]): AutomationRuleRepository {
  const map = new Map(rules.map((r) => [r.id, structuredClone(r)]));
  return {
    findAll: () => [...map.values()],
    findById: (id: string) => map.get(id),
    update: (id: string, updates: Partial<AutomationRule>) => {
      const existing = map.get(id);
      if (existing) {
        map.set(id, { ...existing, ...updates });
      }
    },
    create: vi.fn(),
    delete: vi.fn(),
    replaceAll: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    findByProjectId: (pid: string) => [...map.values()].filter((r) => r.projectId === pid),
  } as any;
}

// ─── Helpers ────────────────────────────────────────────────────────────

const DEFAULT_ACTION = {
  type: 'mark_card_complete' as const,
  sectionId: null,
  dateOption: null,
  position: null,
  cardTitle: null,
  cardDateOption: null,
  specificMonth: null,
  specificDay: null,
  monthTarget: null,
};

const BASE_TIME = new Date('2026-03-01T10:00:00.000Z').getTime();

function makeRule(overrides: Partial<AutomationRule> & { id: string }): AutomationRule {
  return {
    projectId: 'proj-1',
    name: 'Test Rule',
    trigger: {
      type: 'scheduled_interval',
      sectionId: null,
      schedule: { kind: 'interval', intervalMinutes: 30 },
      lastEvaluatedAt: null,
      catchUpPolicy: 'catch_up_latest',
    },
    filters: [],
    action: DEFAULT_ACTION,
    enabled: true,
    brokenReason: null,
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    order: 0,
    createdAt: '2026-02-19T09:00:00.000Z',
    updatedAt: '2026-02-19T09:00:00.000Z',
    bulkPausedAt: null,
    ...overrides,
  } as any;
}

// Scheduled trigger types for property test generators
const SCHEDULED_TRIGGER_TYPES = [
  'scheduled_interval',
  'scheduled_cron',
  'scheduled_due_date_relative',
  'scheduled_one_time',
] as const;

const EVENT_TRIGGER_TYPES = [
  'card_moved_into_section',
  'card_moved_out_of_section',
  'card_marked_complete',
  'card_marked_incomplete',
  'card_created_in_section',
] as const;

function makeTriggerForType(type: string): any {
  if (type === 'scheduled_interval') {
    return { type, sectionId: null, schedule: { kind: 'interval', intervalMinutes: 30 }, lastEvaluatedAt: null, catchUpPolicy: 'catch_up_latest' };
  }
  if (type === 'scheduled_cron') {
    return { type, sectionId: null, schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] }, lastEvaluatedAt: null, catchUpPolicy: 'catch_up_latest' };
  }
  if (type === 'scheduled_due_date_relative') {
    return { type, sectionId: null, schedule: { kind: 'due_date_relative', offsetMinutes: -1440, displayUnit: 'days' }, lastEvaluatedAt: null, catchUpPolicy: 'catch_up_latest' };
  }
  if (type === 'scheduled_one_time') {
    return { type, sectionId: null, schedule: { kind: 'one_time', fireAt: '2026-04-01T10:00:00.000Z' }, lastEvaluatedAt: null };
  }
  // Event trigger
  return { type, sectionId: null };
}

// ─── fast-check generators ──────────────────────────────────────────────

const scheduledTriggerTypeArb = fc.constantFrom(...SCHEDULED_TRIGGER_TYPES);
const eventTriggerTypeArb = fc.constantFrom(...EVENT_TRIGGER_TYPES);

const mixedRulesArb = fc.tuple(
  // Scheduled rules (1-10)
  fc.array(
    fc.record({
      triggerType: scheduledTriggerTypeArb,
      enabled: fc.boolean(),
    }),
    { minLength: 1, maxLength: 10 }
  ),
  // Event-driven rules (0-5)
  fc.array(
    fc.record({
      triggerType: eventTriggerTypeArb,
      enabled: fc.boolean(),
    }),
    { minLength: 0, maxLength: 5 }
  )
).map(([scheduled, eventDriven]) => {
  let idx = 0;
  const rules: AutomationRule[] = [];
  for (const s of scheduled) {
    rules.push(makeRule({
      id: `sched-${idx}`,
      trigger: makeTriggerForType(s.triggerType),
      enabled: s.enabled,
    }));
    idx++;
  }
  for (const e of eventDriven) {
    rules.push(makeRule({
      id: `event-${idx}`,
      trigger: makeTriggerForType(e.triggerType),
      enabled: e.enabled,
    }));
    idx++;
  }
  return rules;
});

// ─── Tests ──────────────────────────────────────────────────────────────

describe('BulkScheduleService', () => {
  // Feature: scheduled-triggers-phase-5c, Property 7: Bulk pause scope
  // **Validates: Requirement 5.1**
  describe('Property 7: Bulk pause scope — only scheduled rules affected, event-driven unchanged', () => {
    it('pauseAllScheduled only disables enabled scheduled rules, leaves event-driven unchanged', () => {
      fc.assert(
        fc.property(mixedRulesArb, (rules) => {
          const clock = new FakeClock(BASE_TIME);
          const repo = createInMemoryRuleRepo(rules);
          const service = new BulkScheduleService(repo, clock);

          // Snapshot event-driven rules before
          const eventRulesBefore = rules
            .filter((r) => !SCHEDULED_TRIGGER_TYPES.includes(r.trigger.type as any))
            .map((r) => ({ id: r.id, enabled: r.enabled, bulkPausedAt: r.bulkPausedAt }));

          const result = service.pauseAllScheduled('proj-1');

          // Event-driven rules unchanged
          for (const before of eventRulesBefore) {
            const after = repo.findById(before.id)!;
            expect(after.enabled).toBe(before.enabled);
            expect(after.bulkPausedAt).toBe(before.bulkPausedAt);
          }

          // Only enabled scheduled rules were paused
          const enabledScheduledBefore = rules.filter(
            (r) => SCHEDULED_TRIGGER_TYPES.includes(r.trigger.type as any) && r.enabled
          );
          expect(result.pausedCount).toBe(enabledScheduledBefore.length);
          expect(result.pausedRuleIds.length).toBe(enabledScheduledBefore.length);

          // Each paused rule now has enabled=false and bulkPausedAt set
          for (const id of result.pausedRuleIds) {
            const after = repo.findById(id)!;
            expect(after.enabled).toBe(false);
            expect(after.bulkPausedAt).not.toBeNull();
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: scheduled-triggers-phase-5c, Property 8: Bulk resume scope
  // **Validates: Requirements 5.2, 5.3**
  describe('Property 8: Bulk resume scope — only bulk-paused rules re-enabled, individually-disabled unchanged', () => {
    it('resumeAllScheduled only re-enables bulk-paused rules, leaves individually-disabled unchanged', () => {
      fc.assert(
        fc.property(mixedRulesArb, (rules) => {
          const clock = new FakeClock(BASE_TIME);
          const repo = createInMemoryRuleRepo(rules);
          const service = new BulkScheduleService(repo, clock);

          // First pause all scheduled rules
          service.pauseAllScheduled('proj-1');

          // Manually individually-disable one scheduled rule (simulate user action)
          // by setting enabled=false but bulkPausedAt=null
          const allAfterPause = repo.findByProjectId('proj-1');
          const individuallyDisabled: string[] = [];
          for (const r of allAfterPause) {
            if (SCHEDULED_TRIGGER_TYPES.includes(r.trigger.type as any) && r.bulkPausedAt) {
              // Pick the first bulk-paused rule and make it individually-disabled instead
              repo.update(r.id, { bulkPausedAt: null } as any);
              individuallyDisabled.push(r.id);
              break;
            }
          }

          const result = service.resumeAllScheduled('proj-1');

          // Individually-disabled rules remain disabled
          for (const id of individuallyDisabled) {
            const after = repo.findById(id)!;
            expect(after.enabled).toBe(false);
          }

          // Bulk-paused rules are re-enabled with bulkPausedAt cleared
          for (const id of result.resumedRuleIds) {
            const after = repo.findById(id)!;
            expect(after.enabled).toBe(true);
            expect(after.bulkPausedAt).toBeNull();
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // ─── Unit tests ─────────────────────────────────────────────────────────

  describe('pauseAllScheduled', () => {
    it('with mixed rules → only enabled scheduled rules get enabled: false + bulkPausedAt set', () => {
      const rules = [
        makeRule({ id: 'sched-1', trigger: makeTriggerForType('scheduled_interval'), enabled: true }),
        makeRule({ id: 'sched-2', trigger: makeTriggerForType('scheduled_cron'), enabled: true }),
        makeRule({ id: 'event-1', trigger: makeTriggerForType('card_moved_into_section'), enabled: true }),
        makeRule({ id: 'event-2', trigger: makeTriggerForType('card_marked_complete'), enabled: true }),
      ];
      const clock = new FakeClock(BASE_TIME);
      const repo = createInMemoryRuleRepo(rules);
      const service = new BulkScheduleService(repo, clock);

      const result = service.pauseAllScheduled('proj-1');

      expect(result.pausedCount).toBe(2);
      expect(result.pausedRuleIds).toEqual(expect.arrayContaining(['sched-1', 'sched-2']));

      // Scheduled rules paused
      expect(repo.findById('sched-1')!.enabled).toBe(false);
      expect(repo.findById('sched-1')!.bulkPausedAt).not.toBeNull();
      expect(repo.findById('sched-2')!.enabled).toBe(false);
      expect(repo.findById('sched-2')!.bulkPausedAt).not.toBeNull();

      // Event rules unchanged
      expect(repo.findById('event-1')!.enabled).toBe(true);
      expect(repo.findById('event-1')!.bulkPausedAt).toBeNull();
      expect(repo.findById('event-2')!.enabled).toBe(true);
      expect(repo.findById('event-2')!.bulkPausedAt).toBeNull();
    });

    it('returns correct pausedCount and pausedRuleIds', () => {
      const rules = [
        makeRule({ id: 'r1', trigger: makeTriggerForType('scheduled_interval'), enabled: true }),
        makeRule({ id: 'r2', trigger: makeTriggerForType('scheduled_one_time'), enabled: true }),
        makeRule({ id: 'r3', trigger: makeTriggerForType('scheduled_cron'), enabled: false }),
      ];
      const clock = new FakeClock(BASE_TIME);
      const repo = createInMemoryRuleRepo(rules);
      const service = new BulkScheduleService(repo, clock);

      const result = service.pauseAllScheduled('proj-1');

      expect(result.pausedCount).toBe(2);
      expect(result.pausedRuleIds.sort()).toEqual(['r1', 'r2']);
    });

    it('already-disabled scheduled rules are NOT bulk-paused (they were individually disabled)', () => {
      const rules = [
        makeRule({ id: 'r1', trigger: makeTriggerForType('scheduled_interval'), enabled: false }),
        makeRule({ id: 'r2', trigger: makeTriggerForType('scheduled_cron'), enabled: true }),
      ];
      const clock = new FakeClock(BASE_TIME);
      const repo = createInMemoryRuleRepo(rules);
      const service = new BulkScheduleService(repo, clock);

      const result = service.pauseAllScheduled('proj-1');

      expect(result.pausedCount).toBe(1);
      expect(result.pausedRuleIds).toEqual(['r2']);

      // r1 was already disabled — should NOT have bulkPausedAt set
      expect(repo.findById('r1')!.enabled).toBe(false);
      expect(repo.findById('r1')!.bulkPausedAt).toBeNull();
    });

    it('on project with no scheduled rules → { pausedCount: 0, pausedRuleIds: [] }', () => {
      const rules = [
        makeRule({ id: 'event-1', trigger: makeTriggerForType('card_moved_into_section'), enabled: true }),
      ];
      const clock = new FakeClock(BASE_TIME);
      const repo = createInMemoryRuleRepo(rules);
      const service = new BulkScheduleService(repo, clock);

      const result = service.pauseAllScheduled('proj-1');

      expect(result.pausedCount).toBe(0);
      expect(result.pausedRuleIds).toEqual([]);
    });
  });

  describe('resumeAllScheduled', () => {
    it('with mix of bulk-paused and individually-disabled → only bulk-paused re-enabled', () => {
      const rules = [
        // Bulk-paused (has bulkPausedAt)
        makeRule({ id: 'r1', trigger: makeTriggerForType('scheduled_interval'), enabled: false, bulkPausedAt: '2026-03-01T09:00:00.000Z' }),
        makeRule({ id: 'r2', trigger: makeTriggerForType('scheduled_cron'), enabled: false, bulkPausedAt: '2026-03-01T09:00:00.000Z' }),
        // Individually disabled (no bulkPausedAt)
        makeRule({ id: 'r3', trigger: makeTriggerForType('scheduled_one_time'), enabled: false, bulkPausedAt: null }),
        // Event-driven (should be untouched)
        makeRule({ id: 'event-1', trigger: makeTriggerForType('card_moved_into_section'), enabled: true }),
      ];
      const clock = new FakeClock(BASE_TIME);
      const repo = createInMemoryRuleRepo(rules);
      const service = new BulkScheduleService(repo, clock);

      const result = service.resumeAllScheduled('proj-1');

      expect(result.resumedCount).toBe(2);
      expect(result.resumedRuleIds.sort()).toEqual(['r1', 'r2']);

      // Bulk-paused rules re-enabled
      expect(repo.findById('r1')!.enabled).toBe(true);
      expect(repo.findById('r1')!.bulkPausedAt).toBeNull();
      expect(repo.findById('r2')!.enabled).toBe(true);
      expect(repo.findById('r2')!.bulkPausedAt).toBeNull();

      // Individually disabled remains disabled
      expect(repo.findById('r3')!.enabled).toBe(false);
      expect(repo.findById('r3')!.bulkPausedAt).toBeNull();

      // Event-driven unchanged
      expect(repo.findById('event-1')!.enabled).toBe(true);
    });

    it('clears bulkPausedAt on resumed rules', () => {
      const rules = [
        makeRule({ id: 'r1', trigger: makeTriggerForType('scheduled_interval'), enabled: false, bulkPausedAt: '2026-03-01T09:00:00.000Z' }),
      ];
      const clock = new FakeClock(BASE_TIME);
      const repo = createInMemoryRuleRepo(rules);
      const service = new BulkScheduleService(repo, clock);

      service.resumeAllScheduled('proj-1');

      const after = repo.findById('r1')!;
      expect(after.enabled).toBe(true);
      expect(after.bulkPausedAt).toBeNull();
    });
  });
});
