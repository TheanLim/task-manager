import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FakeClock } from './clock';
import { SchedulerService } from './schedulerService';
import type { AutomationRule } from '../types';

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
});
