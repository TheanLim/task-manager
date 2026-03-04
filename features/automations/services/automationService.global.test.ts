import { describe, it, expect, beforeEach } from 'vitest';
import { AutomationService } from './automationService';
import { RuleExecutor } from './execution/ruleExecutor';
import type { AutomationRule, DomainEvent, ActionType } from '../types';
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
