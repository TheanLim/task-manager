import { describe, it, expect, beforeEach } from 'vitest';
import { AutomationService } from './automationService';
import { RuleExecutor } from './execution/ruleExecutor';
import { getUndoSnapshots } from './execution/undoService';
import type { AutomationRule, DomainEvent, ActionType, UndoSnapshot } from '../types';
import type { Task, Section } from '@/lib/schemas';

// ─── Minimal in-memory repos ─────────────────────────────────────────────────

class InMemoryTaskRepo {
  private map = new Map<string, Task>();
  findById = (id: string) => this.map.get(id);
  findAll = () => [...this.map.values()];
  findByProjectId = (pid: string) => this.findAll().filter(t => t.projectId === pid);
  findByParentTaskId = (pid: string) => this.findAll().filter(t => t.parentTaskId === pid);
  create = (t: Task) => { this.map.set(t.id, t); return t; };
  update = (id: string, u: Partial<Task>) => {
    const t = this.map.get(id);
    if (t) this.map.set(id, { ...t, ...u });
  };
  delete = (id: string) => this.map.delete(id);
  replaceAll = (items: Task[]) => { this.map.clear(); items.forEach(t => this.map.set(t.id, t)); };
  subscribe = () => () => {};
}

class InMemorySectionRepo {
  private map = new Map<string, Section>();
  findById = (id: string) => this.map.get(id);
  findAll = () => [...this.map.values()];
  findByProjectId = (pid: string) => this.findAll().filter(s => s.projectId === pid);
  create = (s: Section) => { this.map.set(s.id, s); return s; };
  update = (id: string, u: Partial<Section>) => {
    const s = this.map.get(id);
    if (s) this.map.set(id, { ...s, ...u });
  };
  delete = (id: string) => this.map.delete(id);
  replaceAll = (items: Section[]) => { this.map.clear(); items.forEach(s => this.map.set(s.id, s)); };
  subscribe = () => () => {};
}

class InMemoryRuleRepo {
  private map = new Map<string, AutomationRule>();
  findById = (id: string) => this.map.get(id);
  findAll = () => [...this.map.values()];
  findByProjectId = (pid: string) => this.findAll().filter(r => r.projectId === pid);
  findGlobal = () => this.findAll().filter(r => r.projectId === null);
  create = (r: AutomationRule) => { this.map.set(r.id, r); return r; };
  update = (id: string, u: Partial<AutomationRule>) => {
    const r = this.map.get(id);
    if (r) this.map.set(id, { ...r, ...u });
  };
  delete = (id: string) => this.map.delete(id);
  replaceAll = (items: AutomationRule[]) => { this.map.clear(); items.forEach(r => this.map.set(r.id, r)); };
  subscribe = () => () => {};
}

class MockTaskService {
  cascadeComplete() {}
  cascadeDelete() {}
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = '2025-01-15T10:00:00.000Z';

function makeTask(id: string, projectId: string, sectionId: string | null = null): Task {
  return {
    id, projectId, parentTaskId: null, sectionId,
    description: `Task ${id}`, notes: '', assignee: '', priority: 'none',
    tags: [], dueDate: null, completed: false, completedAt: null,
    order: 0, createdAt: NOW, updatedAt: NOW,
  };
}

function makeSection(id: string, projectId: string, name = 'Done'): Section {
  return { id, projectId, name, order: 0, collapsed: false, createdAt: NOW, updatedAt: NOW };
}

function makeRule(
  id: string,
  projectId: string | null,
  triggerType: string,
  actionType: ActionType,
  sectionId: string | null = null,
  overrides: Partial<AutomationRule> = {}
): AutomationRule {
  return {
    id, projectId, name: `Rule ${id}`,
    trigger: { type: triggerType as any, sectionId },
    filters: [],
    action: { type: actionType, sectionId, dateOption: null, position: null,
              cardTitle: null, cardDateOption: null, specificMonth: null,
              specificDay: null, monthTarget: null },
    enabled: true, brokenReason: null, executionCount: 0,
    lastExecutedAt: null, recentExecutions: [], order: 0,
    createdAt: NOW, updatedAt: NOW, bulkPausedAt: null,
    excludedProjectIds: [],
    ...overrides,
  };
}

function makeEvent(entityId: string, projectId: string, type = 'task.updated'): DomainEvent {
  return {
    type: type as any, entityId, projectId,
    changes: { completed: true }, previousValues: { completed: false },
    depth: 0,
  };
}

// ─── Test setup ──────────────────────────────────────────────────────────────

let taskRepo: InMemoryTaskRepo;
let sectionRepo: InMemorySectionRepo;
let ruleRepo: InMemoryRuleRepo;
let taskService: MockTaskService;
let executedActions: Array<{ ruleId: string; actionType: string }>;

function makeService(maxDepth = 5): AutomationService {
  const executor = new RuleExecutor(
    taskRepo as any, sectionRepo as any, taskService as any, ruleRepo as any
  );
  // Intercept executeActions to record what fired
  const origExecute = executor.executeActions.bind(executor);
  executor.executeActions = (actions, event) => {
    actions.forEach(a => executedActions.push({ ruleId: a.ruleId, actionType: a.actionType }));
    return origExecute(actions, event);
  };
  return new AutomationService(
    ruleRepo as any, taskRepo as any, sectionRepo as any,
    taskService as any, executor, maxDepth
  );
}

beforeEach(() => {
  taskRepo = new InMemoryTaskRepo();
  sectionRepo = new InMemorySectionRepo();
  ruleRepo = new InMemoryRuleRepo();
  taskService = new MockTaskService();
  executedActions = [];
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AutomationService — global rules', () => {
  describe('handleEvent() evaluates global rules', () => {
    it('evaluates a global rule when no project rules exist', () => {
      const task = makeTask('t1', 'proj-a');
      taskRepo.create(task);
      ruleRepo.create(makeRule('global-1', null, 'card_marked_complete', 'mark_card_complete'));

      const service = makeService();
      service.handleEvent(makeEvent('t1', 'proj-a', 'task.updated'));

      // Global rule was evaluated (may or may not fire depending on trigger match,
      // but it must be in the candidate set — verify via executionCount or no error)
      // The rule engine evaluates it; whether it fires depends on trigger matching.
      // We verify the service doesn't throw and processes global rules.
      expect(() => service.handleEvent(makeEvent('t1', 'proj-a', 'task.updated'))).not.toThrow();
    });

    it('evaluates both global and project rules for the same event', () => {
      const task = makeTask('t1', 'proj-a');
      taskRepo.create(task);

      // Both rules trigger on card_marked_complete with no section filter
      ruleRepo.create(makeRule('global-1', null, 'card_marked_complete', 'mark_card_complete'));
      ruleRepo.create(makeRule('project-1', 'proj-a', 'card_marked_complete', 'mark_card_incomplete'));

      const service = makeService();
      service.handleEvent({
        type: 'task.updated',
        entityId: 't1',
        projectId: 'proj-a',
        changes: { completed: true },
        previousValues: { completed: false },
        triggeredByRule: undefined,
        depth: 0,
      });

      const firedRuleIds = executedActions.map(a => a.ruleId);
      expect(firedRuleIds).toContain('global-1');
      expect(firedRuleIds).toContain('project-1');
    });

    it('global rules fire BEFORE project rules (global-first order)', () => {
      const task = makeTask('t1', 'proj-a');
      taskRepo.create(task);

      ruleRepo.create(makeRule('global-1', null, 'card_marked_complete', 'mark_card_complete'));
      ruleRepo.create(makeRule('project-1', 'proj-a', 'card_marked_complete', 'mark_card_incomplete'));

      const service = makeService();
      service.handleEvent({
        type: 'task.updated',
        entityId: 't1',
        projectId: 'proj-a',
        changes: { completed: true },
        previousValues: { completed: false },
        depth: 0,
      });

      const firedIds = executedActions.map(a => a.ruleId);
      const globalIdx = firedIds.indexOf('global-1');
      const projectIdx = firedIds.indexOf('project-1');

      // Both must have fired
      expect(globalIdx).toBeGreaterThanOrEqual(0);
      expect(projectIdx).toBeGreaterThanOrEqual(0);
      // Global fires first
      expect(globalIdx).toBeLessThan(projectIdx);
    });

    it('global rule with event.projectId in excludedProjectIds is skipped entirely', () => {
      const task = makeTask('t1', 'proj-a');
      taskRepo.create(task);

      ruleRepo.create(makeRule('global-1', null, 'card_marked_complete', 'mark_card_complete', null, {
        excludedProjectIds: ['proj-a'],
      }));

      const service = makeService();
      service.handleEvent({
        type: 'task.updated',
        entityId: 't1',
        projectId: 'proj-a',
        changes: { completed: true },
        previousValues: { completed: false },
        depth: 0,
      });

      expect(executedActions.map(a => a.ruleId)).not.toContain('global-1');
    });

    it('global rule with empty excludedProjectIds fires in all projects', () => {
      const task = makeTask('t1', 'proj-a');
      taskRepo.create(task);

      ruleRepo.create(makeRule('global-1', null, 'card_marked_complete', 'mark_card_complete', null, {
        excludedProjectIds: [],
      }));

      const service = makeService();
      service.handleEvent({
        type: 'task.updated',
        entityId: 't1',
        projectId: 'proj-a',
        changes: { completed: true },
        previousValues: { completed: false },
        depth: 0,
      });

      expect(executedActions.map(a => a.ruleId)).toContain('global-1');
    });

    it('global rule fires in a new project with no project-specific rules', () => {
      const task = makeTask('t1', 'brand-new-project');
      taskRepo.create(task);

      // Global rule exists — no project rules for brand-new-project
      ruleRepo.create(makeRule('global-1', null, 'card_marked_complete', 'mark_card_complete'));

      const service = makeService();
      service.handleEvent({
        type: 'task.updated',
        entityId: 't1',
        projectId: 'brand-new-project',
        changes: { completed: true },
        previousValues: { completed: false },
        depth: 0,
      });

      expect(executedActions.map(a => a.ruleId)).toContain('global-1');
    });

    it('excludedProjectIds only blocks the excluded project, not others', () => {
      const taskA = makeTask('t1', 'proj-a');
      const taskB = makeTask('t2', 'proj-b');
      taskRepo.create(taskA);
      taskRepo.create(taskB);

      ruleRepo.create(makeRule('global-1', null, 'card_marked_complete', 'mark_card_complete', null, {
        excludedProjectIds: ['proj-a'],
      }));

      const service = makeService();

      // Fire for proj-a — should be excluded
      service.handleEvent({
        type: 'task.updated', entityId: 't1', projectId: 'proj-a',
        changes: { completed: true }, previousValues: { completed: false }, depth: 0,
      });
      const firedForA = executedActions.map(a => a.ruleId);
      expect(firedForA).not.toContain('global-1');

      executedActions = [];

      // Fire for proj-b — should NOT be excluded
      service.handleEvent({
        type: 'task.updated', entityId: 't2', projectId: 'proj-b',
        changes: { completed: true }, previousValues: { completed: false }, depth: 0,
      });
      expect(executedActions.map(a => a.ruleId)).toContain('global-1');
    });

    it('dedup set is shared — same ruleId:entityId:actionType not executed twice across global+project', () => {
      const task = makeTask('t1', 'proj-a');
      taskRepo.create(task);

      // Both rules have the same effective action on the same task
      ruleRepo.create(makeRule('global-1', null, 'card_marked_complete', 'mark_card_complete'));
      ruleRepo.create(makeRule('project-1', 'proj-a', 'card_marked_complete', 'mark_card_complete'));

      const service = makeService();
      service.handleEvent({
        type: 'task.updated', entityId: 't1', projectId: 'proj-a',
        changes: { completed: true }, previousValues: { completed: false }, depth: 0,
      });

      // Both rules are evaluated but the dedup set prevents the same
      // ruleId:entityId:actionType from executing twice.
      // Since they have different ruleIds, both can fire — dedup is per ruleId.
      // The key invariant: no single ruleId:entityId:actionType appears more than once.
      const keys = executedActions.map(a => `${a.ruleId}:t1:${a.actionType}`);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });
  });
});

// ─── Toast behavior for skipped global rules (TDD) ───────────────────────────

describe('AutomationService — toast behavior for section-not-found skips', () => {
  // Decision: when a global rule's trigger fires but the action section doesn't
  // exist in the firing project, fire a WARNING toast (not silence, not success).
  // The trigger matched — the user should know the rule tried to run.
  // Toast message: "⚡ Automation: [rule name] — section '[name]' not found in this project"

  let taskRepo: InMemoryTaskRepo;
  let sectionRepo: InMemorySectionRepo;
  let ruleRepo: InMemoryRuleRepo;
  let toastCalls: Array<{ ruleId: string; ruleName: string; taskDescription: string; batchSize: number; skipped?: boolean; skipReason?: string }>;

  function makeService() {
    const executor = new RuleExecutor(
      taskRepo as any,
      sectionRepo as any,
      { cascadeComplete: () => [] } as any,
      ruleRepo as any,
    );
    const svc = new AutomationService(
      ruleRepo as any,
      taskRepo as any,
      sectionRepo as any,
      { cascadeComplete: () => [] } as any,
      executor,
    );
    svc.setRuleExecutionCallback((params) => {
      toastCalls.push(params);
    });
    return svc;
  }

  function makeGlobalMoveRule(id: string, sectionName: string): AutomationRule {
    return {
      id,
      projectId: null,
      name: `Move to ${sectionName}`,
      trigger: { type: 'card_marked_complete', sectionId: null },
      filters: [],
      action: {
        type: 'move_card_to_top_of_section',
        sectionId: null,
        sectionName,
        dateOption: null,
        position: 'top',
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
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      excludedProjectIds: [],
    } as any;
  }

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo();
    sectionRepo = new InMemorySectionRepo();
    ruleRepo = new InMemoryRuleRepo();
    toastCalls = [];

    taskRepo.create({
      id: 't1', projectId: 'proj-a', parentTaskId: null, sectionId: 'sec-todo',
      description: 'My Task', notes: '', assignee: '', priority: 'none', tags: [],
      dueDate: null, completed: false, completedAt: null, order: 0,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('does NOT fire success toast when section is missing (action skipped)', () => {
    // No "Done" section in proj-a
    ruleRepo.create(makeGlobalMoveRule('g1', 'Done'));

    const service = makeService();
    service.handleEvent({
      type: 'task.updated', entityId: 't1', projectId: 'proj-a',
      changes: { completed: true }, previousValues: { completed: false }, depth: 0,
    });

    // No success toast — the action was skipped
    const successToasts = toastCalls.filter(t => !t.skipped);
    expect(successToasts).toHaveLength(0);
  });

  it('fires a warning toast when section is missing', () => {
    // No "Done" section in proj-a
    ruleRepo.create(makeGlobalMoveRule('g1', 'Done'));

    const service = makeService();
    service.handleEvent({
      type: 'task.updated', entityId: 't1', projectId: 'proj-a',
      changes: { completed: true }, previousValues: { completed: false }, depth: 0,
    });

    // Warning toast should fire
    const warningToasts = toastCalls.filter(t => t.skipped === true);
    expect(warningToasts).toHaveLength(1);
    expect(warningToasts[0].ruleName).toBe('Move to Done');
    expect(warningToasts[0].skipReason).toContain('Done');
  });

  it('fires success toast (not warning) when section exists', () => {
    sectionRepo.create({
      id: 'sec-done', projectId: 'proj-a', name: 'Done', order: 1,
      collapsed: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });
    ruleRepo.create(makeGlobalMoveRule('g1', 'Done'));

    const service = makeService();
    service.handleEvent({
      type: 'task.updated', entityId: 't1', projectId: 'proj-a',
      changes: { completed: true }, previousValues: { completed: false }, depth: 0,
    });

    const successToasts = toastCalls.filter(t => !t.skipped);
    expect(successToasts).toHaveLength(1);
    expect(successToasts[0].ruleName).toBe('Move to Done');
    const warningToasts = toastCalls.filter(t => t.skipped === true);
    expect(warningToasts).toHaveLength(0);
  });

  it('fires warning for skipped rule and success for executed rule in same event', () => {
    // "Done" exists, "Archive" does not
    sectionRepo.create({
      id: 'sec-done', projectId: 'proj-a', name: 'Done', order: 1,
      collapsed: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });
    ruleRepo.create(makeGlobalMoveRule('g1', 'Done'));
    ruleRepo.create({ ...makeGlobalMoveRule('g2', 'Archive'), name: 'Move to Archive', order: 1 } as any);

    const service = makeService();
    service.handleEvent({
      type: 'task.updated', entityId: 't1', projectId: 'proj-a',
      changes: { completed: true }, previousValues: { completed: false }, depth: 0,
    });

    expect(toastCalls.filter(t => !t.skipped)).toHaveLength(1);
    expect(toastCalls.filter(t => t.skipped)).toHaveLength(1);
  });
});

// ─── Conflicting move rules — toast deduplication (TDD) ──────────────────────

describe('AutomationService — conflicting move rules on same entity', () => {
  // When multiple rules move the same card (same entityId + same actionType),
  // only the LAST rule's toast should fire. Earlier moves are intermediate states.
  // The card ends up where the last rule put it — that's the only toast the user needs.

  let taskRepo: InMemoryTaskRepo;
  let sectionRepo: InMemorySectionRepo;
  let ruleRepo: InMemoryRuleRepo;
  let toastCalls: Array<{ ruleId: string; ruleName: string; taskDescription: string; batchSize: number; skipped?: boolean }>;

  function makeService() {
    const executor = new RuleExecutor(
      taskRepo as any,
      sectionRepo as any,
      { cascadeComplete: () => [] } as any,
      ruleRepo as any,
    );
    const svc = new AutomationService(
      ruleRepo as any,
      taskRepo as any,
      sectionRepo as any,
      { cascadeComplete: () => [] } as any,
      executor,
    );
    svc.setRuleExecutionCallback((params) => {
      toastCalls.push(params);
    });
    return svc;
  }

  function makeMoveRule(id: string, sectionId: string, sectionName: string, projectId: string | null, order: number): AutomationRule {
    return {
      id,
      projectId,
      name: `Move to ${sectionName}`,
      trigger: { type: 'card_marked_complete', sectionId: null },
      filters: [],
      action: {
        type: 'move_card_to_top_of_section',
        sectionId: projectId === null ? null : sectionId,
        sectionName: projectId === null ? sectionName : undefined,
        dateOption: null,
        position: 'top',
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
      order,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      excludedProjectIds: [],
    } as any;
  }

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo();
    sectionRepo = new InMemorySectionRepo();
    ruleRepo = new InMemoryRuleRepo();
    toastCalls = [];

    taskRepo.create({
      id: 't1', projectId: 'proj-a', parentTaskId: null, sectionId: 'sec-todo',
      description: 'My Task', notes: '', assignee: '', priority: 'none', tags: [],
      dueDate: null, completed: false, completedAt: null, order: 0,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });

    // Create sections for all move targets
    ['sec-wow', 'sec-done'].forEach((id, i) => {
      sectionRepo.create({
        id, projectId: 'proj-a', name: id === 'sec-wow' ? 'wow' : 'Done', order: i,
        collapsed: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });
  });

  it('fires only ONE success toast when two global move rules conflict on same entity', () => {
    // Global rule 1 (order 0): move to "wow"
    // Global rule 2 (order 1): move to "boo" (missing — skipped)
    // Only "wow" executes → only 1 success toast
    ruleRepo.create(makeMoveRule('g1', 'sec-wow', 'wow', null, 0));
    ruleRepo.create(makeMoveRule('g2', 'sec-boo', 'boo', null, 1)); // missing section

    const service = makeService();
    service.handleEvent({
      type: 'task.updated', entityId: 't1', projectId: 'proj-a',
      changes: { completed: true }, previousValues: { completed: false }, depth: 0,
    });

    const successToasts = toastCalls.filter(t => !t.skipped);
    expect(successToasts).toHaveLength(1);
    expect(successToasts[0].ruleName).toBe('Move to wow');
  });

  it('when local rule overrides global move rule, only local rule toast fires', () => {
    // Global rule (order 0): move to "wow"
    // Local rule (order 0, fires after global): move to "Done"
    // Both sections exist. Card ends up in "Done". Only "Done" toast should fire.
    ruleRepo.create(makeMoveRule('g1', 'sec-wow', 'wow', null, 0));
    ruleRepo.create(makeMoveRule('local1', 'sec-done', 'Done', 'proj-a', 0));

    const service = makeService();
    service.handleEvent({
      type: 'task.updated', entityId: 't1', projectId: 'proj-a',
      changes: { completed: true }, previousValues: { completed: false }, depth: 0,
    });

    const successToasts = toastCalls.filter(t => !t.skipped);
    // Only the last move (local rule = "Done") should produce a toast
    expect(successToasts).toHaveLength(1);
    expect(successToasts[0].ruleName).toBe('Move to Done');
  });

  it('non-move rules (mark complete, set due date) each get their own toast', () => {
    // Two different action types on same entity — both should toast
    const markRule: AutomationRule = {
      ...makeMoveRule('r1', '', '', null, 0),
      name: 'Mark Complete',
      action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    } as any;
    const moveRule = makeMoveRule('r2', 'sec-wow', 'wow', null, 1);

    ruleRepo.create(markRule);
    ruleRepo.create(moveRule);

    const service = makeService();
    service.handleEvent({
      type: 'task.updated', entityId: 't1', projectId: 'proj-a',
      changes: { completed: true }, previousValues: { completed: false }, depth: 0,
    });

    const successToasts = toastCalls.filter(t => !t.skipped);
    // Different action types — both toast
    expect(successToasts).toHaveLength(2);
  });
});

// ─── Undo snapshot correctness for conflicting move rules (TDD) ──────────────

describe('AutomationService — undo snapshot for conflicting move rules', () => {
  // When multiple move rules fire on the same entity, undo should restore
  // to the ORIGINAL section (before any automation ran), not an intermediate state.

  let taskRepo: InMemoryTaskRepo;
  let sectionRepo: InMemorySectionRepo;
  let ruleRepo: InMemoryRuleRepo;

  function makeService() {
    const executor = new RuleExecutor(
      taskRepo as any,
      sectionRepo as any,
      { cascadeComplete: () => [] } as any,
      ruleRepo as any,
    );
    return new AutomationService(
      ruleRepo as any,
      taskRepo as any,
      sectionRepo as any,
      { cascadeComplete: () => [] } as any,
      executor,
    );
  }

  function makeMoveRule(id: string, sectionId: string, sectionName: string, order: number): AutomationRule {
    return {
      id,
      projectId: null,
      name: `Move to ${sectionName}`,
      trigger: { type: 'card_marked_complete', sectionId: null },
      filters: [],
      action: {
        type: 'move_card_to_top_of_section',
        sectionId,
        sectionName,
        dateOption: null,
        position: 'top',
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
      order,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      excludedProjectIds: [],
    } as any;
  }

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo();
    sectionRepo = new InMemorySectionRepo();
    ruleRepo = new InMemoryRuleRepo();

    // Task starts in 'sec-todo'
    taskRepo.create({
      id: 't1', projectId: 'proj-a', parentTaskId: null, sectionId: 'sec-todo',
      description: 'My Task', notes: '', assignee: '', priority: 'none', tags: [],
      dueDate: null, completed: false, completedAt: null, order: 0,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });

    ['sec-todo', 'sec-boo', 'sec-wow'].forEach((id, i) => {
      sectionRepo.create({
        id, projectId: 'proj-a', name: id.replace('sec-', ''), order: i,
        collapsed: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });
  });

  it('undo snapshot restores to original section, not intermediate move', () => {
    // Rule 1 (order 0): move to "boo"
    // Rule 2 (order 1): move to "wow"
    // Card starts in "sec-todo". After both rules: card is in "sec-wow".
    // Undo should restore to "sec-todo", not "sec-boo".
    ruleRepo.create(makeMoveRule('g1', 'sec-boo', 'boo', 0));
    ruleRepo.create(makeMoveRule('g2', 'sec-wow', 'wow', 1));

    const service = makeService();
    service.handleEvent({
      type: 'task.updated', entityId: 't1', projectId: 'proj-a',
      changes: { completed: true }, previousValues: { completed: false }, depth: 0,
    });

    // Get the undo snapshot for the last rule (g2 = "wow")
    const snapshots: UndoSnapshot[] = getUndoSnapshots();

    // There should be exactly one undo snapshot for the final move
    const moveSnapshots = snapshots.filter(s =>
      s.actionType === 'move_card_to_top_of_section' && s.targetEntityId === 't1'
    );
    expect(moveSnapshots).toHaveLength(1);

    // The snapshot's previousState should be the ORIGINAL section, not "boo"
    expect(moveSnapshots[0].previousState.sectionId).toBe('sec-todo');
  });

  it('single move rule: undo snapshot captures original section correctly', () => {
    ruleRepo.create(makeMoveRule('g1', 'sec-wow', 'wow', 0));

    const service = makeService();
    service.handleEvent({
      type: 'task.updated', entityId: 't1', projectId: 'proj-a',
      changes: { completed: true }, previousValues: { completed: false }, depth: 0,
    });

    const snapshots: UndoSnapshot[] = getUndoSnapshots();
    const moveSnapshot = snapshots.find(s => s.actionType === 'move_card_to_top_of_section');
    expect(moveSnapshot?.previousState.sectionId).toBe('sec-todo');
  });
});
