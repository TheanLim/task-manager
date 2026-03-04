import { describe, it, expect, beforeEach } from 'vitest';
import { RuleExecutor } from './ruleExecutor';
import type { AutomationRule, DomainEvent, ExecutionLogEntry } from '../../types';
import type { Task, Section } from '@/lib/schemas';

// ─── Minimal in-memory repos ─────────────────────────────────────────────────

class InMemoryTaskRepo {
  private map = new Map<string, Task>();
  findById = (id: string) => this.map.get(id);
  findAll = () => [...this.map.values()];
  findByProjectId = (pid: string) => this.findAll().filter(t => t.projectId === pid);
  findByParentTaskId = () => [];
  create = (t: Task) => { this.map.set(t.id, t); return t; };
  update = (id: string, u: Partial<Task>) => {
    const t = this.map.get(id); if (t) this.map.set(id, { ...t, ...u });
  };
  delete = (id: string) => this.map.delete(id);
  replaceAll = () => {};
  subscribe = () => () => {};
}

class InMemorySectionRepo {
  private map = new Map<string, Section>();
  findById = (id: string) => this.map.get(id);
  findAll = () => [...this.map.values()];
  findByProjectId = (pid: string) => this.findAll().filter(s => s.projectId === pid);
  create = (s: Section) => { this.map.set(s.id, s); return s; };
  update = () => {};
  delete = (id: string) => this.map.delete(id);
  replaceAll = () => {};
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
    const r = this.map.get(id); if (r) this.map.set(id, { ...r, ...u });
  };
  delete = (id: string) => this.map.delete(id);
  replaceAll = () => {};
  subscribe = () => () => {};
}

class MockTaskService {
  cascadeComplete() {}
  cascadeDelete() {}
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = '2025-01-15T10:00:00.000Z';

function makeTask(id: string, projectId: string): Task {
  return {
    id, projectId, parentTaskId: null, sectionId: null,
    description: `Task ${id}`, notes: '', assignee: '', priority: 'none',
    tags: [], dueDate: null, completed: false, completedAt: null,
    order: 0, createdAt: NOW, updatedAt: NOW,
  };
}

function makeSection(id: string, projectId: string, name: string): Section {
  return { id, projectId, name, order: 0, collapsed: false, createdAt: NOW, updatedAt: NOW };
}

function makeRule(
  id: string,
  projectId: string | null,
  sectionId: string | null,
  actionSectionId: string | null,
  opts: { sectionName?: string; actionSectionName?: string } = {}
): AutomationRule {
  return {
    id, projectId, name: `Rule ${id}`,
    trigger: {
      type: 'card_moved_into_section',
      sectionId,
      ...(opts.sectionName ? { sectionName: opts.sectionName } : {}),
    } as any,
    filters: [],
    action: {
      type: 'move_card_to_top_of_section',
      sectionId: actionSectionId,
      ...(opts.actionSectionName ? { sectionName: opts.actionSectionName } : {}),
      dateOption: null, position: 'top', cardTitle: null,
      cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null,
    },
    enabled: true, brokenReason: null, executionCount: 0,
    lastExecutedAt: null, recentExecutions: [], order: 0,
    createdAt: NOW, updatedAt: NOW, bulkPausedAt: null,
    excludedProjectIds: [],
  };
}

function makeEvent(entityId: string, projectId: string, sectionId: string): DomainEvent {
  return {
    type: 'task.updated', entityId, projectId,
    changes: { sectionId }, previousValues: { sectionId: 'old' },
    depth: 0,
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

let taskRepo: InMemoryTaskRepo;
let sectionRepo: InMemorySectionRepo;
let ruleRepo: InMemoryRuleRepo;
let taskService: MockTaskService;

beforeEach(() => {
  taskRepo = new InMemoryTaskRepo();
  sectionRepo = new InMemorySectionRepo();
  ruleRepo = new InMemoryRuleRepo();
  taskService = new MockTaskService();
});

function makeExecutor() {
  return new RuleExecutor(
    taskRepo as any, sectionRepo as any, taskService as any, ruleRepo as any
  );
}

function getRecentExecutions(ruleId: string): ExecutionLogEntry[] {
  return ruleRepo.findById(ruleId)?.recentExecutions ?? [];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RuleExecutor — section-not-found guard', () => {
  describe('checkSectionExists guard', () => {
    it('writes a skipped log entry when action section is missing for a global rule', () => {
      const task = makeTask('t1', 'proj-b');
      taskRepo.create(task);

      // Global rule references a section from proj-a that doesn't exist in proj-b
      const rule = makeRule('global-1', null, null, 'section-from-proj-a');
      ruleRepo.create(rule);

      const executor = makeExecutor();
      const action = {
        ruleId: 'global-1',
        targetEntityId: 't1',
        actionType: 'move_card_to_top_of_section' as const,
        params: { sectionId: 'section-from-proj-a', position: 'top' },
      };

      executor.executeActions([action], makeEvent('t1', 'proj-b', 'some-section'));

      const entries = getRecentExecutions('global-1');
      expect(entries).toHaveLength(1);
      expect(entries[0].executionType).toBe('skipped');
      expect(entries[0].isGlobal).toBe(true);
      expect(entries[0].firingProjectId).toBe('proj-b');
      expect(entries[0].skipReason).toContain('not found');
      expect(entries[0].ruleId).toBe('global-1');
    });

    it('does NOT write a skipped entry when section exists', () => {
      const task = makeTask('t1', 'proj-a');
      taskRepo.create(task);
      sectionRepo.create(makeSection('sec-done', 'proj-a', 'Done'));

      const rule = makeRule('global-1', null, null, 'sec-done');
      ruleRepo.create(rule);

      const executor = makeExecutor();
      const action = {
        ruleId: 'global-1',
        targetEntityId: 't1',
        actionType: 'move_card_to_top_of_section' as const,
        params: { sectionId: 'sec-done', position: 'top' },
      };

      executor.executeActions([action], makeEvent('t1', 'proj-a', 'sec-done'));

      const entries = getRecentExecutions('global-1');
      // May have a fired entry (if task was moved) or nothing — but NOT a skipped entry
      const skipped = entries.filter(e => e.executionType === 'skipped');
      expect(skipped).toHaveLength(0);
    });

    it('does NOT guard non-section action types (no false positives)', () => {
      const task = makeTask('t1', 'proj-a');
      taskRepo.create(task);

      const rule: AutomationRule = {
        id: 'global-1', projectId: null, name: 'Global complete',
        trigger: { type: 'card_marked_complete', sectionId: null } as any,
        filters: [],
        action: {
          type: 'mark_card_complete', sectionId: null,
          dateOption: null, position: null, cardTitle: null,
          cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null,
        },
        enabled: true, brokenReason: null, executionCount: 0,
        lastExecutedAt: null, recentExecutions: [], order: 0,
        createdAt: NOW, updatedAt: NOW, bulkPausedAt: null,
        excludedProjectIds: [],
      };
      ruleRepo.create(rule);

      const executor = makeExecutor();
      const action = {
        ruleId: 'global-1',
        targetEntityId: 't1',
        actionType: 'mark_card_complete' as const,
        params: {},
      };

      // Should not throw and should not write a skipped entry
      expect(() => executor.executeActions([action], makeEvent('t1', 'proj-a', 'sec-1'))).not.toThrow();
      const skipped = getRecentExecutions('global-1').filter(e => e.executionType === 'skipped');
      expect(skipped).toHaveLength(0);
    });

    it('does NOT guard project-scoped rules (only applies to global rules)', () => {
      const task = makeTask('t1', 'proj-a');
      taskRepo.create(task);

      // Project-scoped rule with a missing section — should NOT produce a skipped entry
      // (the action handler will simply not find the section and do nothing, but no guard log)
      const rule = makeRule('project-1', 'proj-a', null, 'missing-section');
      ruleRepo.create(rule);

      const executor = makeExecutor();
      const action = {
        ruleId: 'project-1',
        targetEntityId: 't1',
        actionType: 'move_card_to_top_of_section' as const,
        params: { sectionId: 'missing-section', position: 'top' },
      };

      executor.executeActions([action], makeEvent('t1', 'proj-a', 'sec-1'));

      const skipped = getRecentExecutions('project-1').filter(e => e.executionType === 'skipped');
      expect(skipped).toHaveLength(0);
    });

    it('skipped entry has all required global fields', () => {
      const task = makeTask('t1', 'proj-b');
      taskRepo.create(task);

      const rule = makeRule('global-1', null, null, 'missing-sec', { actionSectionName: 'Done' });
      ruleRepo.create(rule);

      const executor = makeExecutor();
      executor.executeActions([{
        ruleId: 'global-1',
        targetEntityId: 't1',
        actionType: 'move_card_to_top_of_section' as const,
        params: { sectionId: 'missing-sec', sectionName: 'Done', position: 'top' },
      }], makeEvent('t1', 'proj-b', 'sec-1'));

      const entry = getRecentExecutions('global-1')[0];
      expect(entry.executionType).toBe('skipped');
      expect(entry.isGlobal).toBe(true);
      expect(entry.firingProjectId).toBe('proj-b');
      expect(entry.ruleId).toBe('global-1');
      expect(entry.skipReason).toMatch(/not found/);
    });
  });

  describe('getTriggerDescription — sectionName fallback', () => {
    it('uses sectionName fallback when section lookup returns undefined', () => {
      const rule = makeRule('global-1', null, 'missing-sec', null, { sectionName: 'Done' });
      ruleRepo.create(rule);

      const executor = makeExecutor();
      // Access via executeActions — trigger description is written to log on execution
      // We test indirectly: create a task and fire an action that succeeds,
      // then check the triggerDescription in the log entry.
      const task = makeTask('t1', 'proj-a');
      taskRepo.create(task);
      sectionRepo.create(makeSection('target-sec', 'proj-a', 'Target'));

      // Use a non-section action so the guard doesn't block it
      const ruleWithNonSectionAction: AutomationRule = {
        ...rule,
        action: {
          type: 'mark_card_complete', sectionId: null,
          dateOption: null, position: null, cardTitle: null,
          cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null,
        },
      };
      ruleRepo.update('global-1', ruleWithNonSectionAction);

      executor.executeActions([{
        ruleId: 'global-1',
        targetEntityId: 't1',
        actionType: 'mark_card_complete' as const,
        params: {},
      }], makeEvent('t1', 'proj-a', 'missing-sec'));

      const entries = getRecentExecutions('global-1');
      const fired = entries.find(e => e.executionType !== 'skipped');
      // triggerDescription should use 'Done' (from sectionName) not 'unknown section'
      expect(fired?.triggerDescription).toContain('Done');
      expect(fired?.triggerDescription).not.toContain('unknown section');
    });

    it('falls back to "unknown section" when neither section nor sectionName is available', () => {
      const rule = makeRule('global-1', null, 'missing-sec', null); // no sectionName
      ruleRepo.create(rule);

      const task = makeTask('t1', 'proj-a');
      taskRepo.create(task);

      const ruleWithNonSectionAction: AutomationRule = {
        ...rule,
        action: {
          type: 'mark_card_complete', sectionId: null,
          dateOption: null, position: null, cardTitle: null,
          cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null,
        },
      };
      ruleRepo.update('global-1', ruleWithNonSectionAction);

      const executor = makeExecutor();
      executor.executeActions([{
        ruleId: 'global-1',
        targetEntityId: 't1',
        actionType: 'mark_card_complete' as const,
        params: {},
      }], makeEvent('t1', 'proj-a', 'missing-sec'));

      const entries = getRecentExecutions('global-1');
      const fired = entries.find(e => e.executionType !== 'skipped');
      expect(fired?.triggerDescription).toContain('unknown section');
    });
  });
});
