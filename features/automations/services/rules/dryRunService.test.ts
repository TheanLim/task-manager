import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { dryRunScheduledRule, type DryRunResult } from './dryRunService';
import type { AutomationRule, RuleAction, EvaluationContext, DomainEvent } from '../../types';
import type { Task, Section } from '@/lib/schemas';

// ─── Helpers ────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? 'task-1',
    projectId: 'proj-1',
    parentTaskId: null,
    sectionId: 'section-1',
    description: overrides.description ?? 'Test task',
    notes: '',
    assignee: '',
    priority: 'none',
    tags: [],
    dueDate: null,
    completed: false,
    completedAt: null,
    order: 0,
    createdAt: now,
    updatedAt: now,
    lastActionAt: null,
    ...overrides,
  };
}

function makeSection(overrides: Partial<Section> = {}): Section {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? 'section-1',
    projectId: 'proj-1',
    name: overrides.name ?? 'Test Section',
    order: 0,
    collapsed: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCronRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  const now = new Date().toISOString();
  return {
    id: 'rule-1',
    projectId: 'proj-1',
    name: 'Test Cron Rule',
    trigger: {
      type: 'scheduled_cron',
      sectionId: null,
      schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] },
      lastEvaluatedAt: null,
      catchUpPolicy: 'catch_up_latest',
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
    executionCount: 5,
    lastExecutedAt: now,
    recentExecutions: [
      {
        timestamp: now,
        triggerDescription: 'Scheduled',
        actionDescription: 'mark as complete',
        taskName: 'Old task',
      },
    ],
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as AutomationRule;
}

function makeIntervalRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  const now = new Date().toISOString();
  return {
    id: 'rule-2',
    projectId: 'proj-1',
    name: 'Test Interval Rule',
    trigger: {
      type: 'scheduled_interval',
      sectionId: null,
      schedule: { kind: 'interval', intervalMinutes: 60 },
      lastEvaluatedAt: null,
      catchUpPolicy: 'catch_up_latest',
    },
    filters: [],
    action: {
      type: 'move_card_to_bottom_of_section',
      sectionId: 'section-2',
      dateOption: null,
      position: 'bottom',
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as AutomationRule;
}


// ─── Unit Tests ─────────────────────────────────────────────────────────

describe('dryRunScheduledRule', () => {
  it('dry-run with cron rule matching 5 tasks → returns 5 task names, no state changes', () => {
    const tasks = Array.from({ length: 5 }, (_, i) =>
      makeTask({ id: `task-${i}`, description: `Task ${i}` })
    );
    const sections = [makeSection()];
    const rule = makeCronRule();

    // Snapshot rule state before dry-run
    const originalExecutionCount = rule.executionCount;
    const originalLastExecutedAt = rule.lastExecutedAt;
    const originalRecentExecutions = [...rule.recentExecutions];
    const originalLastEvaluatedAt = (rule.trigger as any).lastEvaluatedAt;

    // Rule engine that returns an action per task
    const ruleEngine = (_event: DomainEvent, context: EvaluationContext): RuleAction[] => {
      return context.allTasks
        .filter(t => t.parentTaskId === null)
        .map(t => ({
          ruleId: rule.id,
          actionType: rule.action.type,
          targetEntityId: t.id,
          params: {},
        }));
    };

    const result = dryRunScheduledRule(rule, Date.now(), tasks, sections, ruleEngine);

    expect(result.matchingTasks).toHaveLength(5);
    expect(result.totalCount).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(result.matchingTasks[i]).toEqual({ id: `task-${i}`, name: `Task ${i}` });
    }

    // Verify no state mutation
    expect(rule.executionCount).toBe(originalExecutionCount);
    expect(rule.lastExecutedAt).toBe(originalLastExecutedAt);
    expect(rule.recentExecutions).toEqual(originalRecentExecutions);
    expect((rule.trigger as any).lastEvaluatedAt).toBe(originalLastEvaluatedAt);
  });

  it('dry-run with interval rule matching 0 tasks → returns empty result', () => {
    const tasks: Task[] = [];
    const sections = [makeSection()];
    const rule = makeIntervalRule();

    const ruleEngine = (): RuleAction[] => [];

    const result = dryRunScheduledRule(rule, Date.now(), tasks, sections, ruleEngine);

    expect(result.matchingTasks).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.actionDescription).toBeTruthy();
  });

  it('dry-run does not modify lastEvaluatedAt on the rule', () => {
    const tasks = [makeTask()];
    const sections = [makeSection()];
    const rule = makeCronRule();
    const originalLastEvaluatedAt = (rule.trigger as any).lastEvaluatedAt;

    const ruleEngine = (_event: DomainEvent, context: EvaluationContext): RuleAction[] =>
      context.allTasks.map(t => ({
        ruleId: rule.id,
        actionType: rule.action.type,
        targetEntityId: t.id,
        params: {},
      }));

    dryRunScheduledRule(rule, Date.now(), tasks, sections, ruleEngine);

    expect((rule.trigger as any).lastEvaluatedAt).toBe(originalLastEvaluatedAt);
  });

  it('dry-run does not modify executionCount or recentExecutions', () => {
    const tasks = [makeTask()];
    const sections = [makeSection()];
    const rule = makeCronRule({ executionCount: 10 });
    const originalCount = rule.executionCount;
    const originalExecutions = [...rule.recentExecutions];

    const ruleEngine = (_event: DomainEvent, context: EvaluationContext): RuleAction[] =>
      context.allTasks.map(t => ({
        ruleId: rule.id,
        actionType: rule.action.type,
        targetEntityId: t.id,
        params: {},
      }));

    dryRunScheduledRule(rule, Date.now(), tasks, sections, ruleEngine);

    expect(rule.executionCount).toBe(originalCount);
    expect(rule.recentExecutions).toEqual(originalExecutions);
  });

  it('disabled rule → empty result', () => {
    const tasks = [makeTask()];
    const sections = [makeSection()];
    const rule = makeCronRule({ enabled: false });

    const ruleEngine = (): RuleAction[] => {
      throw new Error('Should not be called for disabled rule');
    };

    const result = dryRunScheduledRule(rule, Date.now(), tasks, sections, ruleEngine);

    expect(result.matchingTasks).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('broken rule → empty result', () => {
    const tasks = [makeTask()];
    const sections = [makeSection()];
    const rule = makeCronRule({ brokenReason: 'Section deleted' });

    const ruleEngine = (): RuleAction[] => {
      throw new Error('Should not be called for broken rule');
    };

    const result = dryRunScheduledRule(rule, Date.now(), tasks, sections, ruleEngine);

    expect(result.matchingTasks).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('returns human-readable actionDescription', () => {
    const tasks = [makeTask()];
    const sections = [makeSection()];
    const rule = makeCronRule();

    const ruleEngine = (_event: DomainEvent, context: EvaluationContext): RuleAction[] =>
      context.allTasks.map(t => ({
        ruleId: rule.id,
        actionType: 'mark_card_complete' as const,
        targetEntityId: t.id,
        params: {},
      }));

    const result = dryRunScheduledRule(rule, Date.now(), tasks, sections, ruleEngine);

    expect(result.actionDescription).toBe('mark as complete');
  });
});


// ─── Property-Based Tests ───────────────────────────────────────────────

// Feature: scheduled-triggers-phase-5b, Property 9: Dry-run produces zero side effects
describe('Property 9: Dry-run produces zero side effects', () => {
  /**
   * **Validates: Requirements 9.1, 9.3, 9.4**
   *
   * For any scheduled rule and any current state, calling dryRunScheduledRule()
   * does not modify: (1) any rule's lastEvaluatedAt, (2) any rule's executionCount
   * or recentExecutions, (3) any task's fields, (4) any section's fields.
   */
  it('no state mutation after dry-run across arbitrary inputs', () => {
    fc.assert(
      fc.property(
        // Arbitrary number of tasks (0–10)
        fc.array(
          fc.record({
            id: fc.uuid(),
            description: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        // Arbitrary nowMs
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }).map(d => d.getTime()),
        // Whether rule is enabled
        fc.boolean(),
        (taskInputs, nowMs, enabled) => {
          const tasks = taskInputs.map((t, i) =>
            makeTask({ id: t.id, description: t.description, order: i })
          );
          const sections = [makeSection()];
          const rule = makeCronRule({ enabled });

          // Deep snapshot before
          const ruleSnapshot = JSON.stringify(rule);
          const tasksSnapshot = JSON.stringify(tasks);
          const sectionsSnapshot = JSON.stringify(sections);

          const ruleEngine = (_event: DomainEvent, context: EvaluationContext): RuleAction[] =>
            context.allTasks
              .filter(t => t.parentTaskId === null)
              .map(t => ({
                ruleId: rule.id,
                actionType: rule.action.type,
                targetEntityId: t.id,
                params: {},
              }));

          dryRunScheduledRule(rule, nowMs, tasks, sections, ruleEngine);

          // Verify zero mutations
          expect(JSON.stringify(rule)).toBe(ruleSnapshot);
          expect(JSON.stringify(tasks)).toBe(tasksSnapshot);
          expect(JSON.stringify(sections)).toBe(sectionsSnapshot);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: scheduled-triggers-phase-5b, Property 10: Dry-run result matches actual execution
describe('Property 10: Dry-run result matches actual execution', () => {
  /**
   * **Validates: Requirements 9.1, 9.2**
   *
   * For any scheduled rule, the set of task IDs returned by dryRunScheduledRule()
   * is identical to the set of task IDs that would be acted upon by a real execution
   * of the same rule at the same time with the same state.
   */
  it('same task IDs as real execution across arbitrary inputs', () => {
    fc.assert(
      fc.property(
        // Arbitrary tasks (1–8)
        fc.array(
          fc.record({
            id: fc.uuid(),
            description: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          { minLength: 1, maxLength: 8 }
        ),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }).map(d => d.getTime()),
        // Subset of tasks that the rule engine would match (random selection)
        fc.nat({ max: 255 }),
        (taskInputs, nowMs, matchBitmask) => {
          const tasks = taskInputs.map((t, i) =>
            makeTask({ id: t.id, description: t.description, order: i })
          );
          const sections = [makeSection()];
          const rule = makeCronRule();

          // Deterministic rule engine: match tasks based on bitmask
          const ruleEngine = (_event: DomainEvent, context: EvaluationContext): RuleAction[] =>
            context.allTasks
              .filter(t => t.parentTaskId === null)
              .filter((_, i) => (matchBitmask >> i) & 1)
              .map(t => ({
                ruleId: rule.id,
                actionType: rule.action.type,
                targetEntityId: t.id,
                params: {},
              }));

          // Dry-run
          const dryResult = dryRunScheduledRule(rule, nowMs, tasks, sections, ruleEngine);

          // Simulate "real" execution by calling the same rule engine
          const realActions = ruleEngine(
            {
              type: 'schedule.fired',
              entityId: '',
              projectId: rule.projectId,
              changes: { triggerType: rule.trigger.type },
              previousValues: {},
              triggeredByRule: rule.id,
              depth: 0,
            },
            {
              allTasks: tasks,
              allSections: sections,
              maxDepth: 5,
              executedSet: new Set(),
            }
          );

          const dryTaskIds = new Set(dryResult.matchingTasks.map(t => t.id));
          const realTaskIds = new Set(realActions.map(a => a.targetEntityId));

          expect(dryTaskIds).toEqual(realTaskIds);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('create_card actions show card title instead of Unknown task', () => {
  it('dry-run for create_card rule shows the card title, not "Unknown task"', () => {
    const sections = [makeSection()];
    const rule = makeCronRule({
      action: {
        type: 'create_card',
        sectionId: 'section-1',
        dateOption: null,
        position: null,
        cardTitle: 'Daily Standup — {{date}}',
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
    });

    const ruleEngine = (_event: DomainEvent, _context: EvaluationContext): RuleAction[] => [
      {
        ruleId: rule.id,
        actionType: 'create_card',
        targetEntityId: rule.id, // create_card uses rule ID, not a task ID
        params: {
          sectionId: 'section-1',
          cardTitle: 'Daily Standup — {{date}}',
        },
      },
    ];

    const result = dryRunScheduledRule(rule, Date.now(), [], sections, ruleEngine);

    expect(result.totalCount).toBe(1);
    // Should show the card title, not "Unknown task"
    expect(result.matchingTasks[0].name).not.toBe('Unknown task');
    expect(result.matchingTasks[0].name).toContain('Daily Standup');
  });

  it('dry-run for non-create_card rule still shows task description', () => {
    const tasks = [makeTask({ id: 'task-1', description: 'Fix login bug' })];
    const sections = [makeSection()];
    const rule = makeCronRule();

    const ruleEngine = (_event: DomainEvent, _context: EvaluationContext): RuleAction[] => [
      {
        ruleId: rule.id,
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        params: {},
      },
    ];

    const result = dryRunScheduledRule(rule, Date.now(), tasks, sections, ruleEngine);

    expect(result.matchingTasks[0].name).toBe('Fix login bug');
  });
});
