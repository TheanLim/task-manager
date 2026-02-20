import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FakeClock } from './clock';
import { SchedulerService } from './schedulerService';
import type { AutomationRule } from '../../types';

// ─── In-memory repos ────────────────────────────────────────────────────

function createInMemoryRuleRepo(rules: AutomationRule[]) {
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
  };
}

function createInMemoryTaskRepo(tasks: any[] = []) {
  return {
    findAll: () => tasks,
    findById: (id: string) => tasks.find((t: any) => t.id === id),
    update: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    replaceAll: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    findByProjectId: vi.fn(() => []),
    findByParentTaskId: vi.fn(() => []),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

const BASE_TIME = new Date('2026-02-19T10:00:00.000Z').getTime();

function makeIntervalRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule-1',
    projectId: 'proj-1',
    name: 'Test Rule',
    trigger: {
      type: 'scheduled_interval',
      sectionId: null,
      schedule: { kind: 'interval', intervalMinutes: 30 },
      lastEvaluatedAt: null,
    },
    filters: [],
    action: {
      type: 'mark_card_complete',
      sectionId: null,
      dateOption: null,
      position: null,
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    },
    enabled: true,
    brokenReason: null,
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    order: 0,
    createdAt: '2026-02-19T09:00:00.000Z',
    updatedAt: '2026-02-19T09:00:00.000Z',
    ...overrides,
  } as any;
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('SchedulerService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires immediate catch-up tick on start()', () => {
    const clock = new FakeClock(BASE_TIME);
    const rule = makeIntervalRule(); // lastEvaluatedAt: null → fires immediately
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.start();

    expect(onRuleFired).toHaveBeenCalledTimes(1);
    expect(onRuleFired).toHaveBeenCalledWith(
      expect.objectContaining({
        rule: expect.objectContaining({ id: 'rule-1' }),
        evaluation: expect.objectContaining({ shouldFire: true }),
      })
    );

    scheduler.stop();
  });

  it('fires on 60-second interval tick', () => {
    const clock = new FakeClock(BASE_TIME);
    const rule = makeIntervalRule({
      trigger: {
        type: 'scheduled_interval',
        sectionId: null,
        schedule: { kind: 'interval', intervalMinutes: 1 }, // 1 min interval
        lastEvaluatedAt: new Date(BASE_TIME - 120_000).toISOString(), // 2 min ago
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.start();

    // First call is the catch-up tick
    expect(onRuleFired).toHaveBeenCalledTimes(1);
    onRuleFired.mockClear();

    // Advance clock and timer by 60s
    clock.advance(60_000);
    vi.advanceTimersByTime(60_000);

    // The rule was already updated with lastEvaluatedAt = now after catch-up,
    // so it won't fire again until another interval passes
    // (1 min interval, 60s since last eval → fires)
    expect(onRuleFired).toHaveBeenCalledTimes(1);

    scheduler.stop();
  });

  // Feature: scheduled-triggers-phase-5a, Property 12: lastEvaluatedAt updated before callback
  it('P12: lastEvaluatedAt is updated BEFORE onRuleFired callback', () => {
    const clock = new FakeClock(BASE_TIME);
    const rule = makeIntervalRule();
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();

    let lastEvalDuringCallback: string | null | undefined;
    const onRuleFired = vi.fn(() => {
      const updatedRule = ruleRepo.findById('rule-1');
      lastEvalDuringCallback = (updatedRule?.trigger as any)?.lastEvaluatedAt;
    });

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.start();

    expect(onRuleFired).toHaveBeenCalledTimes(1);
    expect(lastEvalDuringCallback).toBe(new Date(BASE_TIME).toISOString());

    scheduler.stop();
  });

  // Feature: scheduled-triggers-phase-5a, Property 13: Scheduler start idempotency
  it('P13: multiple start() calls create only one timer', () => {
    const clock = new FakeClock(BASE_TIME);
    const rule = makeIntervalRule();
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.start();
    scheduler.start(); // second call — should be no-op
    scheduler.start(); // third call — should be no-op

    // Only one catch-up tick from the first start()
    expect(onRuleFired).toHaveBeenCalledTimes(1);

    // Advance timer — only one interval fires
    onRuleFired.mockClear();
    clock.advance(60_000);
    vi.advanceTimersByTime(60_000);

    // Should fire at most once (depends on whether interval elapsed)
    expect(onRuleFired.mock.calls.length).toBeLessThanOrEqual(1);

    scheduler.stop();
  });

  it('stop() clears interval and removes listener', () => {
    const clock = new FakeClock(BASE_TIME);
    const ruleRepo = createInMemoryRuleRepo([makeIntervalRule()]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);

    onRuleFired.mockClear();
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);

    // Advance timer — no more ticks
    clock.advance(120_000);
    vi.advanceTimersByTime(120_000);
    expect(onRuleFired).not.toHaveBeenCalled();
  });

  it('after stop(), start() creates a new interval', () => {
    const clock = new FakeClock(BASE_TIME);
    const rule = makeIntervalRule();
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.start();
    scheduler.stop();

    onRuleFired.mockClear();
    // Advance time so the rule fires again
    clock.advance(60_000 * 31); // 31 minutes
    scheduler.start();

    // Should fire catch-up tick
    expect(onRuleFired).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('onTickComplete callback receives summary params', () => {
    const clock = new FakeClock(BASE_TIME);
    const rule = makeIntervalRule();
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();
    const onTickComplete = vi.fn();

    const scheduler = new SchedulerService(
      clock, ruleRepo as any, taskRepo as any, onRuleFired, onTickComplete
    );
    scheduler.start();

    expect(onTickComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        rulesEvaluated: 1,
        rulesFired: 1,
        isCatchUp: true,
      })
    );

    scheduler.stop();
  });

  it('callback error does not prevent next rule from firing', () => {
    const clock = new FakeClock(BASE_TIME);
    const rule1 = makeIntervalRule({ id: 'rule-1' });
    const rule2 = makeIntervalRule({ id: 'rule-2', order: 1 });
    const ruleRepo = createInMemoryRuleRepo([rule1, rule2]);
    const taskRepo = createInMemoryTaskRepo();

    let callCount = 0;
    const onRuleFired = vi.fn(() => {
      callCount++;
      if (callCount === 1) throw new Error('Callback error');
    });

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.start();

    // Both rules should have been attempted
    expect(onRuleFired).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it('repo error skips the tick entirely', () => {
    const clock = new FakeClock(BASE_TIME);
    const ruleRepo = {
      findAll: vi.fn(() => { throw new Error('Storage error'); }),
      findById: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      replaceAll: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
      findByProjectId: vi.fn(() => []),
    };
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.start();

    // No rules fired because repo threw
    expect(onRuleFired).not.toHaveBeenCalled();

    scheduler.stop();
  });

  // ─── Property 7: skip_missed catch-up suppression ─────────────────────
  // Feature: scheduled-triggers-phase-5b, Property 7: skip_missed catch-up suppression
  // Validates: Requirements 7.1, 7.2

  describe('skip_missed catch-up policy', () => {
    it('P7: rule with skip_missed does NOT fire onRuleFired on catch-up tick, but lastEvaluatedAt advances', () => {
      const clock = new FakeClock(BASE_TIME);
      const rule = makeIntervalRule({
        trigger: {
          type: 'scheduled_interval',
          sectionId: null,
          schedule: { kind: 'interval', intervalMinutes: 30 },
          lastEvaluatedAt: null, // null → fires immediately
          catchUpPolicy: 'skip_missed',
        } as any,
      });
      const ruleRepo = createInMemoryRuleRepo([rule]);
      const taskRepo = createInMemoryTaskRepo();
      const onRuleFired = vi.fn();

      const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
      // start() calls tick(true) — catch-up tick
      scheduler.start();

      // onRuleFired should NOT be called for skip_missed on catch-up
      expect(onRuleFired).not.toHaveBeenCalled();

      // But lastEvaluatedAt should be updated to now
      const updatedRule = ruleRepo.findById('rule-1');
      expect((updatedRule?.trigger as any)?.lastEvaluatedAt).toBe(
        new Date(BASE_TIME).toISOString()
      );

      scheduler.stop();
    });

    it('P7: rule with catch_up_latest fires onRuleFired on catch-up tick (Phase 5a behavior preserved)', () => {
      const clock = new FakeClock(BASE_TIME);
      const rule = makeIntervalRule({
        trigger: {
          type: 'scheduled_interval',
          sectionId: null,
          schedule: { kind: 'interval', intervalMinutes: 30 },
          lastEvaluatedAt: null,
          catchUpPolicy: 'catch_up_latest',
        } as any,
      });
      const ruleRepo = createInMemoryRuleRepo([rule]);
      const taskRepo = createInMemoryTaskRepo();
      const onRuleFired = vi.fn();

      const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
      scheduler.start();

      // catch_up_latest should fire normally on catch-up
      expect(onRuleFired).toHaveBeenCalledTimes(1);
      expect(onRuleFired).toHaveBeenCalledWith(
        expect.objectContaining({
          rule: expect.objectContaining({ id: 'rule-1' }),
        })
      );

      scheduler.stop();
    });

    it('P7: rule with skip_missed fires onRuleFired normally on non-catch-up tick', () => {
      const clock = new FakeClock(BASE_TIME);
      const rule = makeIntervalRule({
        trigger: {
          type: 'scheduled_interval',
          sectionId: null,
          schedule: { kind: 'interval', intervalMinutes: 1 }, // 1 min interval
          lastEvaluatedAt: new Date(BASE_TIME - 120_000).toISOString(), // 2 min ago
          catchUpPolicy: 'skip_missed',
        } as any,
      });
      const ruleRepo = createInMemoryRuleRepo([rule]);
      const taskRepo = createInMemoryTaskRepo();
      const onRuleFired = vi.fn();

      const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);

      // start() calls tick(true) — catch-up tick, skip_missed suppresses it
      scheduler.start();
      expect(onRuleFired).not.toHaveBeenCalled();

      // Now advance clock and timer for a normal (non-catch-up) tick
      onRuleFired.mockClear();
      clock.advance(60_000);
      vi.advanceTimersByTime(60_000);

      // Non-catch-up tick should fire normally regardless of catchUpPolicy
      expect(onRuleFired).toHaveBeenCalledTimes(1);

      scheduler.stop();
    });

    it('P7: skipped catch-up produces execution log entry with executionType: skipped', () => {
      const clock = new FakeClock(BASE_TIME);
      const rule = makeIntervalRule({
        trigger: {
          type: 'scheduled_interval',
          sectionId: null,
          schedule: { kind: 'interval', intervalMinutes: 30 },
          lastEvaluatedAt: null,
          catchUpPolicy: 'skip_missed',
        } as any,
      });
      const ruleRepo = createInMemoryRuleRepo([rule]);
      const taskRepo = createInMemoryTaskRepo();
      const onRuleFired = vi.fn();

      const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
      scheduler.start();

      // Verify a "skipped" execution log entry was recorded
      const updatedRule = ruleRepo.findById('rule-1');
      expect(updatedRule?.recentExecutions).toHaveLength(1);
      expect(updatedRule?.recentExecutions[0]).toEqual(
        expect.objectContaining({
          executionType: 'skipped',
          triggerDescription: expect.stringContaining('Skipped'),
        })
      );

      scheduler.stop();
    });

    it('P7: rule without catchUpPolicy defaults to catch_up_latest behavior', () => {
      const clock = new FakeClock(BASE_TIME);
      // Rule without catchUpPolicy field — should default to catch_up_latest
      const rule = makeIntervalRule();
      const ruleRepo = createInMemoryRuleRepo([rule]);
      const taskRepo = createInMemoryTaskRepo();
      const onRuleFired = vi.fn();

      const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
      scheduler.start();

      // Should fire on catch-up (default catch_up_latest behavior)
      expect(onRuleFired).toHaveBeenCalledTimes(1);

      scheduler.stop();
    });
  });
});

// ─── Regression: updateNonFiredRules must not advance lastEvaluatedAt for waiting interval rules ──

describe('interval rule timing accuracy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('5-minute interval rule fires exactly every 5 minutes, not delayed by stale-check', () => {
    const clock = new FakeClock(BASE_TIME);
    const rule = makeIntervalRule({
      trigger: {
        type: 'scheduled_interval',
        sectionId: null,
        schedule: { kind: 'interval', intervalMinutes: 5 },
        lastEvaluatedAt: new Date(BASE_TIME).toISOString(), // just fired
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);

    // Start — catch-up tick. Rule just fired so it should NOT fire again.
    scheduler.start();
    expect(onRuleFired).not.toHaveBeenCalled();

    // Simulate 4 ticks (4 minutes) — rule should NOT fire
    for (let i = 0; i < 4; i++) {
      clock.advance(60_000);
      vi.advanceTimersByTime(60_000);
    }
    expect(onRuleFired).not.toHaveBeenCalled();

    // 5th tick (5 minutes elapsed) — rule SHOULD fire
    clock.advance(60_000);
    vi.advanceTimersByTime(60_000);
    expect(onRuleFired).toHaveBeenCalledTimes(1);

    // Verify lastEvaluatedAt is at the 5-minute mark
    const updatedRule = ruleRepo.findById('rule-1');
    const lastEval = new Date((updatedRule?.trigger as any)?.lastEvaluatedAt).getTime();
    expect(lastEval).toBe(BASE_TIME + 5 * 60_000);

    scheduler.stop();
  });

  it('lastEvaluatedAt is NOT advanced by stale-check for rules waiting for their interval', () => {
    const clock = new FakeClock(BASE_TIME);
    const rule = makeIntervalRule({
      trigger: {
        type: 'scheduled_interval',
        sectionId: null,
        schedule: { kind: 'interval', intervalMinutes: 5 },
        lastEvaluatedAt: new Date(BASE_TIME).toISOString(),
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.start();

    // After 3 minutes (3 ticks), lastEvaluatedAt should still be BASE_TIME
    for (let i = 0; i < 3; i++) {
      clock.advance(60_000);
      vi.advanceTimersByTime(60_000);
    }

    const ruleAfter3Min = ruleRepo.findById('rule-1');
    const lastEvalAfter3Min = (ruleAfter3Min?.trigger as any)?.lastEvaluatedAt;
    expect(lastEvalAfter3Min).toBe(new Date(BASE_TIME).toISOString());

    scheduler.stop();
  });
});

describe('interval rule fires repeatedly at correct intervals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('5-minute interval rule fires on catch-up, then again after 5 more minutes', () => {
    const clock = new FakeClock(BASE_TIME);
    // Rule with null lastEvaluatedAt — will fire on catch-up
    const rule = makeIntervalRule({
      trigger: {
        type: 'scheduled_interval',
        sectionId: null,
        schedule: { kind: 'interval', intervalMinutes: 5 },
        lastEvaluatedAt: null,
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);

    // start() calls tick(true) — catch-up tick. Rule fires because lastEvaluatedAt is null.
    scheduler.start();
    expect(onRuleFired).toHaveBeenCalledTimes(1);

    // Verify lastEvaluatedAt was set to BASE_TIME
    const ruleAfterCatchUp = ruleRepo.findById('rule-1');
    expect((ruleAfterCatchUp?.trigger as any)?.lastEvaluatedAt).toBe(
      new Date(BASE_TIME).toISOString()
    );

    onRuleFired.mockClear();

    // Advance 5 ticks (5 minutes) — rule should fire again
    for (let i = 0; i < 5; i++) {
      clock.advance(60_000);
      vi.advanceTimersByTime(60_000);
    }

    expect(onRuleFired).toHaveBeenCalledTimes(1);

    // Verify lastEvaluatedAt advanced to BASE_TIME + 5 min
    const ruleAfter5Min = ruleRepo.findById('rule-1');
    expect((ruleAfter5Min?.trigger as any)?.lastEvaluatedAt).toBe(
      new Date(BASE_TIME + 5 * 60_000).toISOString()
    );

    onRuleFired.mockClear();

    // Advance 5 more ticks — should fire a third time
    for (let i = 0; i < 5; i++) {
      clock.advance(60_000);
      vi.advanceTimersByTime(60_000);
    }

    expect(onRuleFired).toHaveBeenCalledTimes(1);

    scheduler.stop();
  });
});

describe('evaluateSingleRule (Run Now)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires the rule even if the interval has not elapsed (force-fire)', () => {
    const clock = new FakeClock(BASE_TIME);
    // Rule with lastEvaluatedAt = now (just fired) — interval NOT elapsed
    const rule = makeIntervalRule({
      trigger: {
        type: 'scheduled_interval',
        sectionId: null,
        schedule: { kind: 'interval', intervalMinutes: 60 },
        lastEvaluatedAt: new Date(BASE_TIME).toISOString(), // just evaluated
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);

    // Don't start the scheduler — just call evaluateSingleRule directly
    scheduler.evaluateSingleRule(rule);

    // Should fire even though interval hasn't elapsed
    expect(onRuleFired).toHaveBeenCalledTimes(1);
    expect(onRuleFired).toHaveBeenCalledWith(
      expect.objectContaining({
        rule: expect.objectContaining({ id: 'rule-1' }),
      })
    );
  });

  it('fires a cron rule even if the cron window was already evaluated', () => {
    const clock = new FakeClock(BASE_TIME);
    const rule = makeIntervalRule({
      id: 'cron-rule',
      trigger: {
        type: 'scheduled_cron',
        sectionId: null,
        schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] },
        lastEvaluatedAt: new Date(BASE_TIME).toISOString(),
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.evaluateSingleRule(rule);

    expect(onRuleFired).toHaveBeenCalledTimes(1);
  });

  it('updates lastEvaluatedAt after force-fire', () => {
    const clock = new FakeClock(BASE_TIME);
    const oldEval = new Date(BASE_TIME - 60_000).toISOString();
    const rule = makeIntervalRule({
      trigger: {
        type: 'scheduled_interval',
        sectionId: null,
        schedule: { kind: 'interval', intervalMinutes: 60 },
        lastEvaluatedAt: oldEval,
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.evaluateSingleRule(rule);

    const updated = ruleRepo.findById('rule-1');
    expect((updated?.trigger as any)?.lastEvaluatedAt).toBe(new Date(BASE_TIME).toISOString());
  });
});

describe('Regression: start/stop/start (React strict mode) does not double-fire', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start → stop → start only fires onRuleFired once (not twice)', () => {
    const clock = new FakeClock(BASE_TIME);
    const rule = makeIntervalRule({
      trigger: {
        type: 'scheduled_interval',
        sectionId: null,
        schedule: { kind: 'interval', intervalMinutes: 5 },
        lastEvaluatedAt: null, // will fire on catch-up
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);

    // Simulate React strict mode: start → stop → start
    scheduler.start();  // tick(true) fires — rule fires once
    scheduler.stop();
    scheduler.start();  // tick(true) fires again — should NOT fire (lastEvaluatedAt updated)

    // Should fire exactly once, not twice
    expect(onRuleFired).toHaveBeenCalledTimes(1);

    scheduler.stop();
  });

  it('after 5 minutes, only one fire per interval (not multiple)', () => {
    const clock = new FakeClock(BASE_TIME);
    const rule = makeIntervalRule({
      trigger: {
        type: 'scheduled_interval',
        sectionId: null,
        schedule: { kind: 'interval', intervalMinutes: 5 },
        lastEvaluatedAt: new Date(BASE_TIME).toISOString(),
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.start();

    // Advance exactly 5 minutes
    for (let i = 0; i < 5; i++) {
      clock.advance(60_000);
      vi.advanceTimersByTime(60_000);
    }

    // Should fire exactly once at the 5-minute mark
    expect(onRuleFired).toHaveBeenCalledTimes(1);

    // Simulate visibility change right after (tab focus)
    // This calls tick(true) again — should NOT re-fire
    onRuleFired.mockClear();
    scheduler.tick(true);
    expect(onRuleFired).not.toHaveBeenCalled();

    scheduler.stop();
  });
});


// ─── One-Time Auto-Disable (Phase 5c, Task 6) ──────────────────────────
// Feature: scheduled-triggers-phase-5c
// Validates: Requirements 1.2, 1.4
// QA Scenario 8: One-time rule fires once, auto-disables, catch-up works

function makeOneTimeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'one-time-rule-1',
    projectId: 'proj-1',
    name: 'One-Time Rule',
    trigger: {
      type: 'scheduled_one_time',
      sectionId: null,
      schedule: { kind: 'one_time', fireAt: '2026-02-19T12:00:00.000Z' },
      lastEvaluatedAt: null,
    },
    filters: [],
    action: {
      type: 'mark_card_complete',
      sectionId: null,
      dateOption: null,
      position: null,
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    },
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

describe('one-time auto-disable (Phase 5c)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('one-time rule fires → rule.enabled set to false in repository after execution', () => {
    // fireAt is 12:00, clock is at 12:00 → should fire
    const fireAt = '2026-02-19T12:00:00.000Z';
    const nowMs = new Date(fireAt).getTime();
    const clock = new FakeClock(nowMs);

    const rule = makeOneTimeRule({
      trigger: {
        type: 'scheduled_one_time',
        sectionId: null,
        schedule: { kind: 'one_time', fireAt },
        lastEvaluatedAt: null,
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.tick();

    // Callback should have been called
    expect(onRuleFired).toHaveBeenCalledTimes(1);

    // Rule should be auto-disabled
    const updatedRule = ruleRepo.findById('one-time-rule-1');
    expect(updatedRule?.enabled).toBe(false);
  });

  it('one-time rule fires on catch-up → auto-disabled after catch-up execution', () => {
    // fireAt was 2 hours ago, simulating app was closed
    const fireAt = '2026-02-19T12:00:00.000Z';
    const fireAtMs = new Date(fireAt).getTime();
    const nowMs = fireAtMs + 2 * 60 * 60 * 1000; // 2 hours later
    const clock = new FakeClock(nowMs);

    const rule = makeOneTimeRule({
      trigger: {
        type: 'scheduled_one_time',
        sectionId: null,
        schedule: { kind: 'one_time', fireAt },
        lastEvaluatedAt: '2026-02-19T11:00:00.000Z', // last evaluated before fireAt
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.tick(true); // catch-up tick

    // Should fire on catch-up
    expect(onRuleFired).toHaveBeenCalledTimes(1);

    // Should be auto-disabled after catch-up
    const updatedRule = ruleRepo.findById('one-time-rule-1');
    expect(updatedRule?.enabled).toBe(false);
  });

  it('disabled one-time rule is not evaluated on subsequent ticks', () => {
    const fireAt = '2026-02-19T12:00:00.000Z';
    const fireAtMs = new Date(fireAt).getTime();
    const clock = new FakeClock(fireAtMs);

    // Rule already fired and was disabled
    const rule = makeOneTimeRule({
      enabled: false,
      trigger: {
        type: 'scheduled_one_time',
        sectionId: null,
        schedule: { kind: 'one_time', fireAt },
        lastEvaluatedAt: fireAt,
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);

    // Tick multiple times — disabled rule should never fire
    scheduler.tick();
    clock.advance(60_000);
    scheduler.tick();
    clock.advance(60_000);
    scheduler.tick();

    expect(onRuleFired).not.toHaveBeenCalled();
  });

  it('auto-disable happens AFTER onRuleFired callback completes (execution first, then disable)', () => {
    const fireAt = '2026-02-19T12:00:00.000Z';
    const nowMs = new Date(fireAt).getTime();
    const clock = new FakeClock(nowMs);

    const rule = makeOneTimeRule({
      trigger: {
        type: 'scheduled_one_time',
        sectionId: null,
        schedule: { kind: 'one_time', fireAt },
        lastEvaluatedAt: null,
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();

    // Track the enabled state DURING the callback
    let enabledDuringCallback: boolean | undefined;
    const onRuleFired = vi.fn(() => {
      const ruleSnapshot = ruleRepo.findById('one-time-rule-1');
      enabledDuringCallback = ruleSnapshot?.enabled;
    });

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.tick();

    // During callback, rule should still be enabled (not yet auto-disabled)
    expect(enabledDuringCallback).toBe(true);

    // After tick completes, rule should be disabled
    const finalRule = ruleRepo.findById('one-time-rule-1');
    expect(finalRule?.enabled).toBe(false);
  });

  it('auto-disable does NOT clear lastEvaluatedAt (preserves execution history)', () => {
    const fireAt = '2026-02-19T12:00:00.000Z';
    const nowMs = new Date(fireAt).getTime();
    const clock = new FakeClock(nowMs);

    const rule = makeOneTimeRule({
      trigger: {
        type: 'scheduled_one_time',
        sectionId: null,
        schedule: { kind: 'one_time', fireAt },
        lastEvaluatedAt: null,
      } as any,
    });
    const ruleRepo = createInMemoryRuleRepo([rule]);
    const taskRepo = createInMemoryTaskRepo();
    const onRuleFired = vi.fn();

    const scheduler = new SchedulerService(clock, ruleRepo as any, taskRepo as any, onRuleFired);
    scheduler.tick();

    // Rule should be disabled
    const updatedRule = ruleRepo.findById('one-time-rule-1');
    expect(updatedRule?.enabled).toBe(false);

    // lastEvaluatedAt should be preserved (set to now), NOT cleared
    const trigger = updatedRule?.trigger as any;
    expect(trigger?.lastEvaluatedAt).toBe(new Date(nowMs).toISOString());
  });
});
