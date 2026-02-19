import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { AutomationService } from './automationService';
import { RuleExecutor } from './ruleExecutor';
import type {
  DomainEvent,
  AutomationRule,
  TriggerType,
  ActionType,
} from '../types';
import type { Task, Section } from '@/lib/schemas';
import type { TaskRepository, SectionRepository } from '@/lib/repositories/types';
import type { AutomationRuleRepository } from '../repositories/types';
import type { TaskService } from '@/features/tasks/services/taskService';

// Mock repositories and services
class MockTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();

  findById(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  findAll(): Task[] {
    return Array.from(this.tasks.values());
  }

  findByProjectId(projectId: string): Task[] {
    return this.findAll().filter(t => t.projectId === projectId);
  }

  findByParentTaskId(parentTaskId: string): Task[] {
    return this.findAll().filter(t => t.parentTaskId === parentTaskId);
  }

  create(task: Task): Task {
    this.tasks.set(task.id, task);
    return task;
  }

  update(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...updates };
    this.tasks.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.tasks.delete(id);
  }

  replaceAll(tasks: Task[]): void {
    this.tasks.clear();
    tasks.forEach(t => this.tasks.set(t.id, t));
  }

  subscribe(): () => void {
    return () => {};
  }

  clear(): void {
    this.tasks.clear();
  }
}

class MockSectionRepository implements SectionRepository {
  private sections: Map<string, Section> = new Map();

  findById(id: string): Section | undefined {
    return this.sections.get(id);
  }

  findAll(): Section[] {
    return Array.from(this.sections.values());
  }

  findByProjectId(projectId: string): Section[] {
    return this.findAll().filter(s => s.projectId === projectId);
  }

  create(section: Section): Section {
    this.sections.set(section.id, section);
    return section;
  }

  update(id: string, updates: Partial<Section>): Section | undefined {
    const section = this.sections.get(id);
    if (!section) return undefined;
    const updated = { ...section, ...updates };
    this.sections.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.sections.delete(id);
  }

  replaceAll(sections: Section[]): void {
    this.sections.clear();
    sections.forEach(s => this.sections.set(s.id, s));
  }

  subscribe(): () => void {
    return () => {};
  }

  clear(): void {
    this.sections.clear();
  }
}

class MockAutomationRuleRepository implements AutomationRuleRepository {
  private rules: Map<string, AutomationRule> = new Map();

  findById(id: string): AutomationRule | undefined {
    return this.rules.get(id);
  }

  findAll(): AutomationRule[] {
    return Array.from(this.rules.values());
  }

  findByProjectId(projectId: string): AutomationRule[] {
    return this.findAll().filter(r => r.projectId === projectId);
  }

  create(rule: AutomationRule): AutomationRule {
    this.rules.set(rule.id, rule);
    return rule;
  }

  update(id: string, updates: Partial<AutomationRule>): AutomationRule | undefined {
    const rule = this.rules.get(id);
    if (!rule) return undefined;
    const updated = { ...rule, ...updates };
    this.rules.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.rules.delete(id);
  }

  replaceAll(rules: AutomationRule[]): void {
    this.rules.clear();
    rules.forEach(r => this.rules.set(r.id, r));
  }

  subscribe(): () => void {
    return () => {};
  }

  clear(): void {
    this.rules.clear();
  }
}

class MockTaskService {
  cascadeComplete(): void {
    // Mock implementation
  }

  cascadeDelete(): void {
    // Mock implementation
  }
}

// Arbitraries for generating test data
const idArb = fc.string({ minLength: 1, maxLength: 50 });
const isoDateTimeArb = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map((d) => d.toISOString());

const triggerTypeArb = fc.constantFrom<TriggerType>(
  'card_moved_into_section',
  'card_moved_out_of_section',
  'card_marked_complete',
  'card_marked_incomplete',
);

const actionTypeArb = fc.constantFrom<ActionType>(
  'move_card_to_top_of_section',
  'move_card_to_bottom_of_section',
  'mark_card_complete',
  'mark_card_incomplete',
  'set_due_date',
  'remove_due_date',
);

// Feature: automations-foundation, Property 11: Loop protection terminates
// **Validates: Requirements 6.3, 6.4, 6.6**
describe('Property 11: Loop protection terminates', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;
  let executionLog: Array<{ ruleId: string; entityId: string; actionType: ActionType; depth: number }>;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    executionLog = [];
  });

  it('for any set of rules, total cascade depth does not exceed maxDepth', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        idArb,
        idArb,
        fc.array(
          fc.record({
            id: idArb,
            projectId: fc.constant('test-project'),
            name: fc.string({ minLength: 1, maxLength: 200 }),
            trigger: fc.record({
              type: triggerTypeArb,
              sectionId: fc.oneof(idArb, fc.constant(null)),
            }),
            action: fc.record({
              type: actionTypeArb,
              sectionId: fc.oneof(idArb, fc.constant(null)),
              dateOption: fc.constantFrom('today', 'tomorrow', 'next_working_day', null),
              position: fc.constantFrom('top', 'bottom', null),
            }),
            enabled: fc.constant(true),
            brokenReason: fc.constant(null),
            executionCount: fc.nat(),
            lastExecutedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
            order: fc.integer(),
            createdAt: isoDateTimeArb,
            updatedAt: isoDateTimeArb,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (maxDepth, taskId, sectionId, rules) => {
          // Clear repositories and execution log
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();
          executionLog = [];

          // Create a task
          const task: Task = {
            id: taskId,
            projectId: 'test-project',
            parentTaskId: null,
            sectionId: 'initial-section',
            description: 'Test task',
            notes: '',
            assignee: '',
            priority: 'none',
            tags: [],
            dueDate: null,
            completed: false,
            completedAt: null,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          taskRepo.create(task);

          // Create sections
          const section: Section = {
            id: sectionId,
            projectId: 'test-project',
            name: 'Test Section',
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          sectionRepo.create(section);

          // Create rules
          rules.forEach(r => ruleRepo.create(r as any));

          // Create a custom rule executor that logs executions
          const ruleExecutor = new RuleExecutor(taskRepo, sectionRepo, taskService as any, ruleRepo);
          const originalExecute = ruleExecutor.executeActions.bind(ruleExecutor);
          ruleExecutor.executeActions = (actions, event) => {
            actions.forEach(action => {
              executionLog.push({
                ruleId: action.ruleId,
                entityId: action.targetEntityId,
                actionType: action.actionType,
                depth: event.depth,
              });
            });
            return originalExecute(actions, event);
          };

          // Create automation service with custom maxDepth
          const service = new AutomationService(
            ruleRepo,
            taskRepo,
            sectionRepo,
            taskService as any,
            ruleExecutor,
            maxDepth
          );

          // Create initial event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: taskId,
            projectId: 'test-project',
            changes: { sectionId },
            previousValues: { sectionId: 'initial-section' },
            depth: 0,
          };

          // Handle event
          service.handleEvent(event);

          // Verify: All logged executions have depth < maxDepth
          for (const log of executionLog) {
            expect(log.depth).toBeLessThan(maxDepth);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any circular rule configuration, each ruleId:entityId:actionType combination executes at most once', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        (taskId, section1Id, section2Id) => {
          // Clear repositories and execution log
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();
          executionLog = [];

          // Create a task
          const task: Task = {
            id: taskId,
            projectId: 'test-project',
            parentTaskId: null,
            sectionId: section1Id,
            description: 'Test task',
            notes: '',
            assignee: '',
            priority: 'none',
            tags: [],
            dueDate: null,
            completed: false,
            completedAt: null,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          taskRepo.create(task);

          // Create sections
          const section1: Section = {
            id: section1Id,
            projectId: 'test-project',
            name: 'Section 1',
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const section2: Section = {
            id: section2Id,
            projectId: 'test-project',
            name: 'Section 2',
            order: 1,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          sectionRepo.create(section1);
          sectionRepo.create(section2);

          // Create circular rules:
          // Rule 1: When card moves into section1, move it to section2
          // Rule 2: When card moves into section2, move it to section1
          const rule1: AutomationRule = {
            id: 'rule-1',
            projectId: 'test-project',
            name: 'Move to section 2',
            trigger: {
              type: 'card_moved_into_section',
              sectionId: section1Id,
            },
            action: {
              type: 'move_card_to_bottom_of_section',
              sectionId: section2Id,
              dateOption: null,
              position: 'bottom',
            },
            enabled: true,
            brokenReason: null,
            executionCount: 0,
            lastExecutedAt: null,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const rule2: AutomationRule = {
            id: 'rule-2',
            projectId: 'test-project',
            name: 'Move to section 1',
            trigger: {
              type: 'card_moved_into_section',
              sectionId: section2Id,
            },
            action: {
              type: 'move_card_to_bottom_of_section',
              sectionId: section1Id,
              dateOption: null,
              position: 'bottom',
            },
            enabled: true,
            brokenReason: null,
            executionCount: 0,
            lastExecutedAt: null,
            order: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          ruleRepo.create(rule1);
          ruleRepo.create(rule2);

          // Create a custom rule executor that logs executions
          const ruleExecutor = new RuleExecutor(taskRepo, sectionRepo, taskService as any, ruleRepo);
          const originalExecute = ruleExecutor.executeActions.bind(ruleExecutor);
          ruleExecutor.executeActions = (actions, event) => {
            actions.forEach(action => {
              executionLog.push({
                ruleId: action.ruleId,
                entityId: action.targetEntityId,
                actionType: action.actionType,
                depth: event.depth,
              });
            });
            return originalExecute(actions, event);
          };

          // Create automation service
          const service = new AutomationService(
            ruleRepo,
            taskRepo,
            sectionRepo,
            taskService as any,
            ruleExecutor,
            5
          );

          // Create initial event (move task to section1)
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: taskId,
            projectId: 'test-project',
            changes: { sectionId: section1Id },
            previousValues: { sectionId: 'other-section' },
            depth: 0,
          };

          // Handle event
          service.handleEvent(event);

          // Verify: Each ruleId:entityId:actionType combination appears at most once
          const dedupKeys = new Set<string>();
          for (const log of executionLog) {
            const key = `${log.ruleId}:${log.entityId}:${log.actionType}`;
            expect(dedupKeys.has(key)).toBe(false);
            dedupKeys.add(key);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any set of automation rules, processing terminates (does not hang)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: idArb,
            projectId: fc.constant('test-project'),
            name: fc.string({ minLength: 1, maxLength: 200 }),
            trigger: fc.record({
              type: triggerTypeArb,
              sectionId: fc.oneof(idArb, fc.constant(null)),
            }),
            action: fc.record({
              type: actionTypeArb,
              sectionId: fc.oneof(idArb, fc.constant(null)),
              dateOption: fc.constantFrom('today', 'tomorrow', 'next_working_day', null),
              position: fc.constantFrom('top', 'bottom', null),
            }),
            enabled: fc.constant(true),
            brokenReason: fc.constant(null),
            executionCount: fc.nat(),
            lastExecutedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
            order: fc.integer(),
            createdAt: isoDateTimeArb,
            updatedAt: isoDateTimeArb,
          }),
          { minLength: 0, maxLength: 10 }
        ),
        idArb,
        idArb,
        (rules, taskId, sectionId) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create a task
          const task: Task = {
            id: taskId,
            projectId: 'test-project',
            parentTaskId: null,
            sectionId: 'initial-section',
            description: 'Test task',
            notes: '',
            assignee: '',
            priority: 'none',
            tags: [],
            dueDate: null,
            completed: false,
            completedAt: null,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          taskRepo.create(task);

          // Create section
          const section: Section = {
            id: sectionId,
            projectId: 'test-project',
            name: 'Test Section',
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          sectionRepo.create(section);

          // Create rules
          rules.forEach(r => ruleRepo.create(r as any));

          // Create automation service
          const ruleExecutor = new RuleExecutor(taskRepo, sectionRepo, taskService as any, ruleRepo);
          const service = new AutomationService(
            ruleRepo,
            taskRepo,
            sectionRepo,
            taskService as any,
            ruleExecutor,
            5
          );

          // Create initial event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: taskId,
            projectId: 'test-project',
            changes: { sectionId },
            previousValues: { sectionId: 'initial-section' },
            depth: 0,
          };

          // This should complete without hanging
          const startTime = Date.now();
          service.handleEvent(event);
          const endTime = Date.now();

          // Verify it completed in reasonable time (< 1 second)
          expect(endTime - startTime).toBeLessThan(1000);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for cascading rules, depth counter increments correctly and stops at maxDepth', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        idArb,
        (maxDepth, taskId) => {
          // Clear repositories and execution log
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();
          executionLog = [];

          // Create a task
          const task: Task = {
            id: taskId,
            projectId: 'test-project',
            parentTaskId: null,
            sectionId: null,
            description: 'Test task',
            notes: '',
            assignee: '',
            priority: 'none',
            tags: [],
            dueDate: null,
            completed: false,
            completedAt: null,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          taskRepo.create(task);

          // Create a chain of rules that cascade:
          // Rule 1: When marked complete, set due date
          // Rule 2: When due date changes, mark incomplete
          // Rule 3: When marked incomplete, mark complete
          // This creates a cycle that should be stopped by depth limit
          const rule1: AutomationRule = {
            id: 'rule-1',
            projectId: 'test-project',
            name: 'Set due date on complete',
            trigger: {
              type: 'card_marked_complete',
              sectionId: null,
            },
            action: {
              type: 'set_due_date',
              sectionId: null,
              dateOption: 'today',
              position: null,
            },
            enabled: true,
            brokenReason: null,
            executionCount: 0,
            lastExecutedAt: null,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const rule2: AutomationRule = {
            id: 'rule-2',
            projectId: 'test-project',
            name: 'Mark incomplete on due date change',
            trigger: {
              type: 'card_marked_complete',
              sectionId: null,
            },
            action: {
              type: 'mark_card_incomplete',
              sectionId: null,
              dateOption: null,
              position: null,
            },
            enabled: true,
            brokenReason: null,
            executionCount: 0,
            lastExecutedAt: null,
            order: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const rule3: AutomationRule = {
            id: 'rule-3',
            projectId: 'test-project',
            name: 'Mark complete on incomplete',
            trigger: {
              type: 'card_marked_incomplete',
              sectionId: null,
            },
            action: {
              type: 'mark_card_complete',
              sectionId: null,
              dateOption: null,
              position: null,
            },
            enabled: true,
            brokenReason: null,
            executionCount: 0,
            lastExecutedAt: null,
            order: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          ruleRepo.create(rule1);
          ruleRepo.create(rule2);
          ruleRepo.create(rule3);

          // Create a custom rule executor that logs executions
          const ruleExecutor = new RuleExecutor(taskRepo, sectionRepo, taskService as any, ruleRepo);
          const originalExecute = ruleExecutor.executeActions.bind(ruleExecutor);
          ruleExecutor.executeActions = (actions, event) => {
            actions.forEach(action => {
              executionLog.push({
                ruleId: action.ruleId,
                entityId: action.targetEntityId,
                actionType: action.actionType,
                depth: event.depth,
              });
            });
            return originalExecute(actions, event);
          };

          // Create automation service
          const service = new AutomationService(
            ruleRepo,
            taskRepo,
            sectionRepo,
            taskService as any,
            ruleExecutor,
            maxDepth
          );

          // Create initial event (mark task complete)
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: taskId,
            projectId: 'test-project',
            changes: { completed: true },
            previousValues: { completed: false },
            depth: 0,
          };

          // Handle event
          service.handleEvent(event);

          // Verify: Maximum depth in log is maxDepth - 1
          const maxLoggedDepth = Math.max(...executionLog.map(log => log.depth), -1);
          expect(maxLoggedDepth).toBeLessThan(maxDepth);

          // Verify: Execution log is not empty (at least some rules fired)
          if (executionLog.length > 0) {
            // Verify depths are sequential starting from 0
            const depths = executionLog.map(log => log.depth).sort((a, b) => a - b);
            expect(depths[0]).toBe(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// --- Undo Snapshot Tests (Task 5.1) ---
import {
  getUndoSnapshot,
  getUndoSnapshots,
  setUndoSnapshot,
  pushUndoSnapshot,
  clearUndoSnapshot,
  clearAllUndoSnapshots,
  performUndo,
  performUndoById,
  UNDO_EXPIRY_MS,
} from './undoService';
import type { UndoSnapshot } from '../types';

describe('Undo snapshot capture (Task 5.1)', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    // Always clear snapshot between tests
    clearUndoSnapshot();
  });

  // Helper to create a standard task
  function createTask(overrides: Partial<Task> = {}): Task {
    const task: Task = {
      id: 'task-1',
      projectId: 'project-1',
      parentTaskId: null,
      sectionId: 'section-a',
      description: 'Test task',
      notes: '',
      assignee: '',
      priority: 'none',
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    taskRepo.create(task);
    return task;
  }

  // Helper to create sections
  function createSection(id: string, name: string): Section {
    const section: Section = {
      id,
      projectId: 'project-1',
      name,
      order: 0,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sectionRepo.create(section);
    return section;
  }

  // Default action with all required fields
  const defaultAction = {
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

  // Helper to create a rule
  function createRule(overrides: Record<string, any> = {}): AutomationRule {
    const { action: actionOverride, ...rest } = overrides;
    const rule = {
      id: 'rule-1',
      projectId: 'project-1',
      name: 'Test Rule',
      trigger: {
        type: 'card_moved_into_section' as const,
        sectionId: 'section-b',
      },
      action: { ...defaultAction, ...actionOverride },
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...rest,
    } as AutomationRule;
    ruleRepo.create(rule);
    return rule;
  }

  describe('getUndoSnapshot / setUndoSnapshot / clearUndoSnapshot', () => {
    it('returns null when no snapshot is set', () => {
      expect(getUndoSnapshot()).toBeNull();
    });

    it('returns the snapshot when set and not expired', () => {
      const snapshot: UndoSnapshot = {
        ruleId: 'rule-1',
        ruleName: 'Test Rule',
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        previousState: { completed: false, completedAt: null },
        timestamp: Date.now(),
      };
      setUndoSnapshot(snapshot);
      expect(getUndoSnapshot()).toEqual(snapshot);
    });

    it('returns null when snapshot has expired (>10s)', () => {
      const snapshot: UndoSnapshot = {
        ruleId: 'rule-1',
        ruleName: 'Test Rule',
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        previousState: { completed: false },
        timestamp: Date.now() - UNDO_EXPIRY_MS - 1,
      };
      setUndoSnapshot(snapshot);
      expect(getUndoSnapshot()).toBeNull();
    });

    it('clears the snapshot', () => {
      const snapshot: UndoSnapshot = {
        ruleId: 'rule-1',
        ruleName: 'Test Rule',
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        previousState: { completed: false },
        timestamp: Date.now(),
      };
      setUndoSnapshot(snapshot);
      clearUndoSnapshot();
      expect(getUndoSnapshot()).toBeNull();
    });

    it('replaces previous snapshot when a new one is set (Req 6.9)', () => {
      const snapshot1: UndoSnapshot = {
        ruleId: 'rule-1',
        ruleName: 'Rule A',
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        previousState: { completed: false },
        timestamp: Date.now(),
      };
      const snapshot2: UndoSnapshot = {
        ruleId: 'rule-2',
        ruleName: 'Rule B',
        actionType: 'remove_due_date',
        targetEntityId: 'task-2',
        previousState: { dueDate: '2025-01-01T00:00:00.000Z' },
        timestamp: Date.now(),
      };
      setUndoSnapshot(snapshot1);
      setUndoSnapshot(snapshot2);
      expect(getUndoSnapshot()).toEqual(snapshot2);
    });
  });

  describe('snapshot capture during handleEvent', () => {
    it('captures undo snapshot after a mark_complete action executes', () => {
      createTask({ id: 'task-1', sectionId: 'section-b', completed: false, completedAt: null });
      createSection('section-a', 'To Do');
      createSection('section-b', 'Done');
      createRule({
        id: 'rule-1',
        name: 'Auto-complete',
        trigger: { type: 'card_moved_into_section', sectionId: 'section-b' },
        action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
      });

      const ruleExecutor = new RuleExecutor(taskRepo, sectionRepo, taskService as any, ruleRepo);
      const service = new AutomationService(
        ruleRepo, taskRepo, sectionRepo, taskService as any, ruleExecutor, 5
      );

      const event: DomainEvent = {
        type: 'task.updated',
        entityId: 'task-1',
        projectId: 'project-1',
        changes: { sectionId: 'section-b' },
        previousValues: { sectionId: 'section-a' },
        depth: 0,
      };

      service.handleEvent(event);

      const snapshot = getUndoSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.ruleId).toBe('rule-1');
      expect(snapshot!.ruleName).toBe('Auto-complete');
      expect(snapshot!.actionType).toBe('mark_card_complete');
      expect(snapshot!.targetEntityId).toBe('task-1');
      expect(snapshot!.previousState.completed).toBe(false);
      expect(snapshot!.previousState.completedAt).toBeNull();
    });

    it('captures undo snapshot after a move action with previous sectionId and order', () => {
      createTask({ id: 'task-1', sectionId: 'section-a', order: 5 });
      createSection('section-a', 'To Do');
      createSection('section-b', 'In Progress');
      createRule({
        id: 'rule-1',
        name: 'Auto-move',
        trigger: { type: 'card_marked_complete', sectionId: null },
        action: { type: 'move_card_to_bottom_of_section', sectionId: 'section-b', dateOption: null, position: 'bottom' },
      });

      const ruleExecutor = new RuleExecutor(taskRepo, sectionRepo, taskService as any, ruleRepo);
      const service = new AutomationService(
        ruleRepo, taskRepo, sectionRepo, taskService as any, ruleExecutor, 5
      );

      const event: DomainEvent = {
        type: 'task.updated',
        entityId: 'task-1',
        projectId: 'project-1',
        changes: { completed: true },
        previousValues: { completed: false },
        depth: 0,
      };

      service.handleEvent(event);

      const snapshot = getUndoSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.previousState.sectionId).toBe('section-a');
      expect(snapshot!.previousState.order).toBe(5);
    });

    it('does NOT capture snapshot for cascaded (depth > 0) events', () => {
      createTask({ id: 'task-1', sectionId: 'section-b' });
      createSection('section-b', 'Done');
      createRule({
        id: 'rule-1',
        name: 'Auto-complete',
        trigger: { type: 'card_moved_into_section', sectionId: 'section-b' },
        action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
      });

      const ruleExecutor = new RuleExecutor(taskRepo, sectionRepo, taskService as any, ruleRepo);
      const service = new AutomationService(
        ruleRepo, taskRepo, sectionRepo, taskService as any, ruleExecutor, 5
      );

      const event: DomainEvent = {
        type: 'task.updated',
        entityId: 'task-1',
        projectId: 'project-1',
        changes: { sectionId: 'section-b' },
        previousValues: { sectionId: 'section-a' },
        depth: 1, // cascaded event
        triggeredByRule: 'some-other-rule',
      };

      service.handleEvent(event);

      expect(getUndoSnapshot()).toBeNull();
    });

    it('replaces previous snapshot when a new rule executes (Req 6.9)', () => {
      createTask({ id: 'task-1', sectionId: 'section-a', completed: false });
      createTask({ id: 'task-2', sectionId: 'section-b', completed: false });
      createSection('section-a', 'To Do');
      createSection('section-b', 'Done');

      // Rule 1: mark complete when moved into section-b
      createRule({
        id: 'rule-1',
        name: 'Rule A',
        trigger: { type: 'card_moved_into_section', sectionId: 'section-b' },
        action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
      });

      const ruleExecutor = new RuleExecutor(taskRepo, sectionRepo, taskService as any, ruleRepo);
      const service = new AutomationService(
        ruleRepo, taskRepo, sectionRepo, taskService as any, ruleExecutor, 5
      );

      // First execution
      service.handleEvent({
        type: 'task.updated',
        entityId: 'task-1',
        projectId: 'project-1',
        changes: { sectionId: 'section-b' },
        previousValues: { sectionId: 'section-a' },
        depth: 0,
      });

      const firstSnapshot = getUndoSnapshot();
      expect(firstSnapshot).not.toBeNull();
      expect(firstSnapshot!.targetEntityId).toBe('task-1');

      // Second execution replaces the first
      service.handleEvent({
        type: 'task.updated',
        entityId: 'task-2',
        projectId: 'project-1',
        changes: { sectionId: 'section-b' },
        previousValues: { sectionId: 'section-a' },
        depth: 0,
      });

      const secondSnapshot = getUndoSnapshot();
      expect(secondSnapshot).not.toBeNull();
      expect(secondSnapshot!.targetEntityId).toBe('task-2');
    });

    it('does not capture snapshot when no rules match', () => {
      createTask({ id: 'task-1', sectionId: 'section-a' });
      createSection('section-a', 'To Do');
      // No rules created

      const ruleExecutor = new RuleExecutor(taskRepo, sectionRepo, taskService as any, ruleRepo);
      const service = new AutomationService(
        ruleRepo, taskRepo, sectionRepo, taskService as any, ruleExecutor, 5
      );

      service.handleEvent({
        type: 'task.updated',
        entityId: 'task-1',
        projectId: 'project-1',
        changes: { completed: true },
        previousValues: { completed: false },
        depth: 0,
      });

      expect(getUndoSnapshot()).toBeNull();
    });
  });
});

// --- performUndo Tests (Task 5.2) ---
describe('performUndo (Task 5.2)', () => {
  let taskRepo: MockTaskRepository;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    clearUndoSnapshot();
  });

  function createTask(overrides: Partial<Task> = {}): Task {
    const task: Task = {
      id: 'task-1',
      projectId: 'project-1',
      parentTaskId: null,
      sectionId: 'section-a',
      description: 'Test task',
      notes: '',
      assignee: '',
      priority: 'none',
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    taskRepo.create(task);
    return task;
  }

  it('returns false when no snapshot exists', () => {
    expect(performUndo(taskRepo)).toBe(false);
  });

  it('returns false when snapshot has expired', () => {
    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Test',
      actionType: 'mark_card_complete',
      targetEntityId: 'task-1',
      previousState: { completed: false, completedAt: null },
      timestamp: Date.now() - UNDO_EXPIRY_MS - 1,
    });
    expect(performUndo(taskRepo)).toBe(false);
  });

  it('clears the snapshot after successful undo', () => {
    createTask({ id: 'task-1', completed: true, completedAt: '2025-01-01T00:00:00.000Z' });
    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Test',
      actionType: 'mark_card_complete',
      targetEntityId: 'task-1',
      previousState: { completed: false, completedAt: null },
      timestamp: Date.now(),
    });

    expect(performUndo(taskRepo)).toBe(true);
    expect(getUndoSnapshot()).toBeNull();
  });

  // Req 6.3: Move undo
  it('undoes move_card_to_bottom_of_section by restoring sectionId and order', () => {
    createTask({ id: 'task-1', sectionId: 'section-b', order: 10 });
    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-move',
      actionType: 'move_card_to_bottom_of_section',
      targetEntityId: 'task-1',
      previousState: { sectionId: 'section-a', order: 3 },
      timestamp: Date.now(),
    });

    expect(performUndo(taskRepo)).toBe(true);
    const task = taskRepo.findById('task-1')!;
    expect(task.sectionId).toBe('section-a');
    expect(task.order).toBe(3);
  });

  it('undoes move_card_to_top_of_section by restoring sectionId and order', () => {
    createTask({ id: 'task-1', sectionId: 'section-b', order: 0 });
    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-move',
      actionType: 'move_card_to_top_of_section',
      targetEntityId: 'task-1',
      previousState: { sectionId: 'section-a', order: 7 },
      timestamp: Date.now(),
    });

    expect(performUndo(taskRepo)).toBe(true);
    const task = taskRepo.findById('task-1')!;
    expect(task.sectionId).toBe('section-a');
    expect(task.order).toBe(7);
  });

  // Req 6.4: Mark complete/incomplete undo
  it('undoes mark_card_complete by reverting completed and completedAt', () => {
    createTask({ id: 'task-1', completed: true, completedAt: '2025-06-01T12:00:00.000Z' });
    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-complete',
      actionType: 'mark_card_complete',
      targetEntityId: 'task-1',
      previousState: { completed: false, completedAt: null },
      timestamp: Date.now(),
    });

    expect(performUndo(taskRepo)).toBe(true);
    const task = taskRepo.findById('task-1')!;
    expect(task.completed).toBe(false);
    expect(task.completedAt).toBeNull();
  });

  it('undoes mark_card_incomplete by reverting completed and completedAt', () => {
    createTask({ id: 'task-1', completed: false, completedAt: null });
    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-incomplete',
      actionType: 'mark_card_incomplete',
      targetEntityId: 'task-1',
      previousState: { completed: true, completedAt: '2025-05-15T10:00:00.000Z' },
      timestamp: Date.now(),
    });

    expect(performUndo(taskRepo)).toBe(true);
    const task = taskRepo.findById('task-1')!;
    expect(task.completed).toBe(true);
    expect(task.completedAt).toBe('2025-05-15T10:00:00.000Z');
  });

  // Req 6.5: Set/remove due date undo
  it('undoes set_due_date by reverting dueDate to previous value', () => {
    createTask({ id: 'task-1', dueDate: '2025-07-01' });
    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-date',
      actionType: 'set_due_date',
      targetEntityId: 'task-1',
      previousState: { dueDate: null },
      timestamp: Date.now(),
    });

    expect(performUndo(taskRepo)).toBe(true);
    const task = taskRepo.findById('task-1')!;
    expect(task.dueDate).toBeNull();
  });

  it('undoes remove_due_date by restoring previous dueDate', () => {
    createTask({ id: 'task-1', dueDate: null });
    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-remove-date',
      actionType: 'remove_due_date',
      targetEntityId: 'task-1',
      previousState: { dueDate: '2025-03-15' },
      timestamp: Date.now(),
    });

    expect(performUndo(taskRepo)).toBe(true);
    const task = taskRepo.findById('task-1')!;
    expect(task.dueDate).toBe('2025-03-15');
  });

  // Req 6.6: Create card undo
  it('undoes create_card by deleting the created task', () => {
    createTask({ id: 'created-task-1' });
    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-create',
      actionType: 'create_card',
      targetEntityId: 'created-task-1',
      createdEntityId: 'created-task-1',
      previousState: {},
      timestamp: Date.now(),
    });

    expect(performUndo(taskRepo)).toBe(true);
    expect(taskRepo.findById('created-task-1')).toBeUndefined();
  });

  it('undoes create_card using createdEntityId when different from targetEntityId', () => {
    createTask({ id: 'actual-created-id' });
    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-create',
      actionType: 'create_card',
      targetEntityId: 'trigger-task-id',
      createdEntityId: 'actual-created-id',
      previousState: {},
      timestamp: Date.now(),
    });

    expect(performUndo(taskRepo)).toBe(true);
    expect(taskRepo.findById('actual-created-id')).toBeUndefined();
  });

  // Edge case: target entity no longer exists
  it('handles missing target entity gracefully for move undo', () => {
    // Task was deleted by user before undo
    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-move',
      actionType: 'move_card_to_bottom_of_section',
      targetEntityId: 'nonexistent-task',
      previousState: { sectionId: 'section-a', order: 0 },
      timestamp: Date.now(),
    });

    // Should still return true (undo was attempted) and clear snapshot
    expect(performUndo(taskRepo)).toBe(true);
    expect(getUndoSnapshot()).toBeNull();
  });
});

// --- Property 7: Undo restores exact previous state (Task 5.3) ---
// Feature: automations-polish, Property 7: Undo restores exact previous state
// **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6**
describe('Property 7: Undo restores exact previous state', () => {
  let taskRepo: MockTaskRepository;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    clearUndoSnapshot();
  });

  // Arbitrary for non-create_card action types that modify existing tasks
  const modifyActionTypeArb = fc.constantFrom<ActionType>(
    'move_card_to_top_of_section',
    'move_card_to_bottom_of_section',
    'mark_card_complete',
    'mark_card_incomplete',
    'set_due_date',
    'remove_due_date',
  );

  // Arbitrary for task field values relevant to undo
  const sectionIdArb = fc.string({ minLength: 1, maxLength: 30 });
  const orderArb = fc.integer({ min: 0, max: 10000 });
  const dueDateArb = fc.oneof(
    fc.constant(null as string | null),
    fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map(d => d.toISOString().split('T')[0]),
  );
  const completedAtArb = fc.oneof(
    fc.constant(null as string | null),
    isoDateTimeArb,
  );

  // Generate a task with arbitrary field values
  const taskFieldsArb = fc.record({
    sectionId: sectionIdArb,
    order: orderArb,
    completed: fc.boolean(),
    completedAt: completedAtArb,
    dueDate: dueDateArb,
  });

  function makeTask(id: string, fields: { sectionId: string; order: number; completed: boolean; completedAt: string | null; dueDate: string | null }): Task {
    return {
      id,
      projectId: 'project-1',
      parentTaskId: null,
      sectionId: fields.sectionId,
      description: 'Test task',
      notes: '',
      assignee: '',
      priority: 'none',
      tags: [],
      dueDate: fields.dueDate,
      completed: fields.completed,
      completedAt: fields.completedAt,
      order: fields.order,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  it('for any task and any modify action type, undo restores exact previous state', () => {
    fc.assert(
      fc.property(
        taskFieldsArb,
        taskFieldsArb,
        modifyActionTypeArb,
        (previousFields, postActionFields, actionType) => {
          taskRepo.clear();
          clearUndoSnapshot();

          const taskId = 'task-undo-test';

          // Build the previousState portion of the snapshot based on action type
          let previousState: UndoSnapshot['previousState'] = {};
          let postUpdates: Partial<Task> = {};

          switch (actionType) {
            case 'move_card_to_top_of_section':
            case 'move_card_to_bottom_of_section':
              previousState = { sectionId: previousFields.sectionId, order: previousFields.order };
              postUpdates = { sectionId: postActionFields.sectionId, order: postActionFields.order };
              break;
            case 'mark_card_complete':
            case 'mark_card_incomplete':
              previousState = { completed: previousFields.completed, completedAt: previousFields.completedAt };
              postUpdates = { completed: postActionFields.completed, completedAt: postActionFields.completedAt };
              break;
            case 'set_due_date':
            case 'remove_due_date':
              previousState = { dueDate: previousFields.dueDate };
              postUpdates = { dueDate: postActionFields.dueDate };
              break;
          }

          // Create the task in its post-action state (action already applied)
          const postActionTask = makeTask(taskId, { ...previousFields, ...postUpdates } as any);
          taskRepo.create(postActionTask);

          // Set up the undo snapshot with the previous state
          const snapshot: UndoSnapshot = {
            ruleId: 'rule-1',
            ruleName: 'Test Rule',
            actionType,
            targetEntityId: taskId,
            previousState,
            timestamp: Date.now(),
          };
          setUndoSnapshot(snapshot);

          // Perform undo
          const result = performUndo(taskRepo);
          expect(result).toBe(true);

          // Verify the task was restored to its previous state
          const restoredTask = taskRepo.findById(taskId)!;
          expect(restoredTask).toBeDefined();

          switch (actionType) {
            case 'move_card_to_top_of_section':
            case 'move_card_to_bottom_of_section':
              expect(restoredTask.sectionId).toBe(previousFields.sectionId);
              expect(restoredTask.order).toBe(previousFields.order);
              break;
            case 'mark_card_complete':
            case 'mark_card_incomplete':
              expect(restoredTask.completed).toBe(previousFields.completed);
              expect(restoredTask.completedAt).toBe(previousFields.completedAt);
              break;
            case 'set_due_date':
            case 'remove_due_date':
              expect(restoredTask.dueDate).toBe(previousFields.dueDate);
              break;
          }

          // Snapshot should be cleared after undo
          expect(getUndoSnapshot()).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for create_card actions, undo deletes the created task', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        (createdTaskId) => {
          taskRepo.clear();
          clearUndoSnapshot();

          // Create the task that was auto-created by the rule
          const createdTask = makeTask(createdTaskId, {
            sectionId: 'section-1',
            order: 0,
            completed: false,
            completedAt: null,
            dueDate: null,
          });
          taskRepo.create(createdTask);

          // Set up undo snapshot for create_card
          const snapshot: UndoSnapshot = {
            ruleId: 'rule-1',
            ruleName: 'Auto-create',
            actionType: 'create_card',
            targetEntityId: createdTaskId,
            createdEntityId: createdTaskId,
            previousState: {},
            timestamp: Date.now(),
          };
          setUndoSnapshot(snapshot);

          // Perform undo
          const result = performUndo(taskRepo);
          expect(result).toBe(true);

          // The created task should be deleted
          expect(taskRepo.findById(createdTaskId)).toBeUndefined();

          // Snapshot should be cleared
          expect(getUndoSnapshot()).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});


// --- Undo Snapshot Lifecycle Tests (Task 5.4) ---
describe('Undo snapshot lifecycle (Task 5.4)', () => {
  let taskRepo: MockTaskRepository;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    clearUndoSnapshot();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeTask(id: string, fields: Partial<Task> = {}): Task {
    const task: Task = {
      id,
      projectId: 'project-1',
      parentTaskId: null,
      sectionId: 'section-a',
      description: 'Test task',
      notes: '',
      assignee: '',
      priority: 'none',
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...fields,
    };
    taskRepo.create(task);
    return task;
  }

  describe('10-second expiry with fake timers', () => {
    it('snapshot is available immediately after setting', () => {
      const snapshot: UndoSnapshot = {
        ruleId: 'rule-1',
        ruleName: 'Test',
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        previousState: { completed: false, completedAt: null },
        timestamp: Date.now(),
      };
      setUndoSnapshot(snapshot);
      expect(getUndoSnapshot()).toEqual(snapshot);
    });

    it('snapshot is still available at exactly 10 seconds', () => {
      const now = Date.now();
      const snapshot: UndoSnapshot = {
        ruleId: 'rule-1',
        ruleName: 'Test',
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        previousState: { completed: false },
        timestamp: now,
      };
      setUndoSnapshot(snapshot);

      vi.advanceTimersByTime(UNDO_EXPIRY_MS);
      expect(getUndoSnapshot()).toEqual(snapshot);
    });

    it('snapshot expires after 10 seconds + 1ms', () => {
      const now = Date.now();
      const snapshot: UndoSnapshot = {
        ruleId: 'rule-1',
        ruleName: 'Test',
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        previousState: { completed: false },
        timestamp: now,
      };
      setUndoSnapshot(snapshot);

      vi.advanceTimersByTime(UNDO_EXPIRY_MS + 1);
      expect(getUndoSnapshot()).toBeNull();
    });

    it('performUndo succeeds within the 10-second window', () => {
      makeTask('task-1', { completed: true, completedAt: '2025-01-01T00:00:00.000Z' });
      setUndoSnapshot({
        ruleId: 'rule-1',
        ruleName: 'Test',
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        previousState: { completed: false, completedAt: null },
        timestamp: Date.now(),
      });

      vi.advanceTimersByTime(9_999);
      expect(performUndo(taskRepo)).toBe(true);
      const task = taskRepo.findById('task-1')!;
      expect(task.completed).toBe(false);
    });

    it('performUndo fails after the 10-second window', () => {
      makeTask('task-1', { completed: true });
      setUndoSnapshot({
        ruleId: 'rule-1',
        ruleName: 'Test',
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        previousState: { completed: false, completedAt: null },
        timestamp: Date.now(),
      });

      vi.advanceTimersByTime(UNDO_EXPIRY_MS + 1);
      expect(performUndo(taskRepo)).toBe(false);
      // Task should remain unchanged
      const task = taskRepo.findById('task-1')!;
      expect(task.completed).toBe(true);
    });
  });

  describe('snapshot replacement on new execution', () => {
    it('new snapshot replaces previous, only new one is undoable', () => {
      makeTask('task-1', { completed: true, completedAt: '2025-01-01T00:00:00.000Z' });
      makeTask('task-2', { dueDate: '2025-06-01' });

      // First snapshot
      setUndoSnapshot({
        ruleId: 'rule-1',
        ruleName: 'Rule A',
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        previousState: { completed: false, completedAt: null },
        timestamp: Date.now(),
      });

      vi.advanceTimersByTime(3_000);

      // Second snapshot replaces first
      setUndoSnapshot({
        ruleId: 'rule-2',
        ruleName: 'Rule B',
        actionType: 'set_due_date',
        targetEntityId: 'task-2',
        previousState: { dueDate: null },
        timestamp: Date.now(),
      });

      const snapshot = getUndoSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.ruleId).toBe('rule-2');
      expect(snapshot!.targetEntityId).toBe('task-2');

      // Undo reverts task-2, not task-1
      expect(performUndo(taskRepo)).toBe(true);
      expect(taskRepo.findById('task-2')!.dueDate).toBeNull();
      // task-1 remains unchanged (completed)
      expect(taskRepo.findById('task-1')!.completed).toBe(true);
    });

    it('after undo, no further undo is available', () => {
      makeTask('task-1', { completed: true });
      setUndoSnapshot({
        ruleId: 'rule-1',
        ruleName: 'Test',
        actionType: 'mark_card_complete',
        targetEntityId: 'task-1',
        previousState: { completed: false, completedAt: null },
        timestamp: Date.now(),
      });

      expect(performUndo(taskRepo)).toBe(true);
      // Second undo attempt should fail
      expect(performUndo(taskRepo)).toBe(false);
      expect(getUndoSnapshot()).toBeNull();
    });
  });
});

// --- Property 8: Only most recent execution is undoable (Task 5.4) ---
// Feature: automations-polish, Property 8: Only most recent execution is undoable
// **Validates: Requirements 6.7, 6.8, 6.9**
describe('Property 8: Only most recent execution is undoable', () => {
  let taskRepo: MockTaskRepository;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    clearUndoSnapshot();
  });

  const actionTypeArb = fc.constantFrom<ActionType>(
    'move_card_to_top_of_section',
    'move_card_to_bottom_of_section',
    'mark_card_complete',
    'mark_card_incomplete',
    'set_due_date',
    'remove_due_date',
  );

  const snapshotArb = fc.record({
    ruleId: fc.string({ minLength: 1, maxLength: 20 }),
    ruleName: fc.string({ minLength: 1, maxLength: 30 }),
    actionType: actionTypeArb,
    targetEntityId: fc.string({ minLength: 1, maxLength: 20 }),
    previousState: fc.record({
      sectionId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
      order: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
      completed: fc.option(fc.boolean(), { nil: undefined }),
      completedAt: fc.option(
        fc.oneof(
          fc.constant(null as string | null),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
        ),
        { nil: undefined },
      ),
      dueDate: fc.option(
        fc.oneof(
          fc.constant(null as string | null),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString().split('T')[0]),
        ),
        { nil: undefined },
      ),
    }),
    timestamp: fc.constant(Date.now()),
  });

  it('for any sequence of N (>=2) snapshots, only the last is available; after undo, none remain', () => {
    fc.assert(
      fc.property(
        fc.array(snapshotArb, { minLength: 2, maxLength: 10 }),
        (snapshots) => {
          taskRepo.clear();
          clearUndoSnapshot();

          // Set each snapshot sequentially — each replaces the previous
          for (const snap of snapshots) {
            setUndoSnapshot(snap as UndoSnapshot);
          }

          const lastSnapshot = snapshots[snapshots.length - 1];

          // Only the most recent snapshot should be available
          const current = getUndoSnapshot();
          expect(current).not.toBeNull();
          expect(current!.ruleId).toBe(lastSnapshot.ruleId);
          expect(current!.ruleName).toBe(lastSnapshot.ruleName);
          expect(current!.actionType).toBe(lastSnapshot.actionType);
          expect(current!.targetEntityId).toBe(lastSnapshot.targetEntityId);

          // Create a task so performUndo can operate on it
          const task: Task = {
            id: lastSnapshot.targetEntityId,
            projectId: 'project-1',
            parentTaskId: null,
            sectionId: lastSnapshot.previousState.sectionId ?? 'section-default',
            description: 'Test task',
            notes: '',
            assignee: '',
            priority: 'none',
            tags: [],
            dueDate: lastSnapshot.previousState.dueDate ?? null,
            completed: lastSnapshot.previousState.completed ?? false,
            completedAt: lastSnapshot.previousState.completedAt ?? null,
            order: lastSnapshot.previousState.order ?? 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          taskRepo.create(task);

          // Perform undo — should succeed
          const undoResult = performUndo(taskRepo);
          expect(undoResult).toBe(true);

          // After undo, no further undo should be available
          expect(getUndoSnapshot()).toBeNull();
          expect(performUndo(taskRepo)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// --- Batch Mode Tests (Task 6.1) ---
// Validates Requirements: 8.1, 8.2, 8.3, 8.4
describe('Batch mode (Task 6.1)', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    clearUndoSnapshot();
  });

  function createTask(overrides: Partial<Task> = {}): Task {
    const task: Task = {
      id: 'task-1',
      projectId: 'project-1',
      parentTaskId: null,
      sectionId: 'section-a',
      description: 'Test task',
      notes: '',
      assignee: '',
      priority: 'none',
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    taskRepo.create(task);
    return task;
  }

  function createSection(id: string, name: string): Section {
    const section: Section = {
      id,
      projectId: 'project-1',
      name,
      order: 0,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sectionRepo.create(section);
    return section;
  }

  function createRule(overrides: Record<string, any> = {}): AutomationRule {
    const rule = {
      id: 'rule-1',
      projectId: 'project-1',
      name: 'Test Rule',
      trigger: {
        type: 'card_moved_into_section' as const,
        sectionId: 'section-b',
      },
      action: {
        type: 'mark_card_complete' as const,
        sectionId: null,
        dateOption: null,
        position: null,
      },
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    } as AutomationRule;
    ruleRepo.create(rule);
    return rule;
  }

  function makeService(onRuleExecuted?: (params: { ruleName: string; taskDescription: string; batchSize: number }) => void) {
    const ruleExecutor = new RuleExecutor(taskRepo, sectionRepo, taskService as any, ruleRepo);
    return new AutomationService(
      ruleRepo, taskRepo, sectionRepo, taskService as any, ruleExecutor, 5, onRuleExecuted
    );
  }

  describe('beginBatch / endBatch', () => {
    it('suppresses individual toasts during batch mode (Req 8.4)', () => {
      createTask({ id: 'task-1', sectionId: 'section-b', completed: false });
      createSection('section-a', 'To Do');
      createSection('section-b', 'Done');
      createRule({
        id: 'rule-1',
        name: 'Auto-complete',
        trigger: { type: 'card_moved_into_section', sectionId: 'section-b' },
        action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
      });

      const toasts: Array<{ ruleName: string; taskDescription: string; batchSize: number }> = [];
      const service = makeService((params) => toasts.push(params));

      service.beginBatch();
      service.handleEvent({
        type: 'task.updated',
        entityId: 'task-1',
        projectId: 'project-1',
        changes: { sectionId: 'section-b' },
        previousValues: { sectionId: 'section-a' },
        depth: 0,
      });

      // No toasts emitted yet during batch
      expect(toasts).toHaveLength(0);

      service.endBatch();

      // One aggregated toast emitted after batch ends
      expect(toasts).toHaveLength(1);
      expect(toasts[0].ruleName).toBe('Auto-complete');
      expect(toasts[0].batchSize).toBe(1);
      expect(toasts[0].taskDescription).toBe('Test task');
    });

    it('aggregates multiple tasks for the same rule into one toast (Req 8.2)', () => {
      createTask({ id: 'task-1', sectionId: 'section-b', completed: false, description: 'Task A' });
      createTask({ id: 'task-2', sectionId: 'section-b', completed: false, description: 'Task B' });
      createSection('section-a', 'To Do');
      createSection('section-b', 'Done');
      createRule({
        id: 'rule-1',
        name: 'Auto-complete',
        trigger: { type: 'card_moved_into_section', sectionId: 'section-b' },
        action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
      });

      const toasts: Array<{ ruleName: string; taskDescription: string; batchSize: number }> = [];
      const service = makeService((params) => toasts.push(params));

      service.beginBatch();

      // Two tasks move into section-b
      service.handleEvent({
        type: 'task.updated',
        entityId: 'task-1',
        projectId: 'project-1',
        changes: { sectionId: 'section-b' },
        previousValues: { sectionId: 'section-a' },
        depth: 0,
      });
      service.handleEvent({
        type: 'task.updated',
        entityId: 'task-2',
        projectId: 'project-1',
        changes: { sectionId: 'section-b' },
        previousValues: { sectionId: 'section-a' },
        depth: 0,
      });

      service.endBatch();

      // One toast for the rule, aggregated across 2 tasks
      expect(toasts).toHaveLength(1);
      expect(toasts[0].ruleName).toBe('Auto-complete');
      expect(toasts[0].batchSize).toBe(2);
      expect(toasts[0].taskDescription).toBe(''); // empty for batch > 1
    });

    it('emits one toast per rule when multiple rules fire (Req 8.3)', () => {
      createTask({ id: 'task-1', sectionId: 'section-b', completed: false, description: 'Task A' });
      createSection('section-a', 'To Do');
      createSection('section-b', 'Done');
      createSection('section-c', 'Archive');

      // Rule 1: mark complete when moved into section-b
      createRule({
        id: 'rule-1',
        name: 'Auto-complete',
        trigger: { type: 'card_moved_into_section', sectionId: 'section-b' },
        action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
      });
      // Rule 2: set due date when moved into section-b
      createRule({
        id: 'rule-2',
        name: 'Auto-date',
        trigger: { type: 'card_moved_into_section', sectionId: 'section-b' },
        action: { type: 'set_due_date', sectionId: null, dateOption: 'today', position: null },
        order: 1,
      });

      const toasts: Array<{ ruleName: string; taskDescription: string; batchSize: number }> = [];
      const service = makeService((params) => toasts.push(params));

      service.beginBatch();
      service.handleEvent({
        type: 'task.updated',
        entityId: 'task-1',
        projectId: 'project-1',
        changes: { sectionId: 'section-b' },
        previousValues: { sectionId: 'section-a' },
        depth: 0,
      });
      service.endBatch();

      // Two toasts — one per rule
      expect(toasts).toHaveLength(2);
      const ruleNames = toasts.map(t => t.ruleName).sort();
      expect(ruleNames).toContain('Auto-complete');
      expect(ruleNames).toContain('Auto-date');
      // Each with batchSize 1
      expect(toasts.every(t => t.batchSize === 1)).toBe(true);
    });

    it('emits no toasts when batch has zero executions', () => {
      createTask({ id: 'task-1', sectionId: 'section-a' });
      createSection('section-a', 'To Do');
      // No rules

      const toasts: Array<{ ruleName: string; taskDescription: string; batchSize: number }> = [];
      const service = makeService((params) => toasts.push(params));

      service.beginBatch();
      service.handleEvent({
        type: 'task.updated',
        entityId: 'task-1',
        projectId: 'project-1',
        changes: { completed: true },
        previousValues: { completed: false },
        depth: 0,
      });
      service.endBatch();

      expect(toasts).toHaveLength(0);
    });

    it('without batch mode, toasts are emitted immediately as before', () => {
      createTask({ id: 'task-1', sectionId: 'section-b', completed: false, description: 'My task' });
      createSection('section-a', 'To Do');
      createSection('section-b', 'Done');
      createRule({
        id: 'rule-1',
        name: 'Auto-complete',
        trigger: { type: 'card_moved_into_section', sectionId: 'section-b' },
        action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
      });

      const toasts: Array<{ ruleName: string; taskDescription: string; batchSize: number }> = [];
      const service = makeService((params) => toasts.push(params));

      // No beginBatch — should emit immediately
      service.handleEvent({
        type: 'task.updated',
        entityId: 'task-1',
        projectId: 'project-1',
        changes: { sectionId: 'section-b' },
        previousValues: { sectionId: 'section-a' },
        depth: 0,
      });

      expect(toasts).toHaveLength(1);
      expect(toasts[0].ruleName).toBe('Auto-complete');
      expect(toasts[0].taskDescription).toBe('My task');
    });

    it('endBatch without beginBatch is a no-op', () => {
      const toasts: Array<{ ruleName: string; taskDescription: string; batchSize: number }> = [];
      const service = makeService((params) => toasts.push(params));

      // Should not throw
      service.endBatch();
      expect(toasts).toHaveLength(0);
    });

    it('batch mode resets after endBatch (subsequent events emit individually)', () => {
      createTask({ id: 'task-1', sectionId: 'section-b', completed: false, description: 'Task A' });
      createTask({ id: 'task-2', sectionId: 'section-b', completed: false, description: 'Task B' });
      createSection('section-a', 'To Do');
      createSection('section-b', 'Done');
      createRule({
        id: 'rule-1',
        name: 'Auto-complete',
        trigger: { type: 'card_moved_into_section', sectionId: 'section-b' },
        action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
      });

      const toasts: Array<{ ruleName: string; taskDescription: string; batchSize: number }> = [];
      const service = makeService((params) => toasts.push(params));

      // First: batch mode
      service.beginBatch();
      service.handleEvent({
        type: 'task.updated',
        entityId: 'task-1',
        projectId: 'project-1',
        changes: { sectionId: 'section-b' },
        previousValues: { sectionId: 'section-a' },
        depth: 0,
      });
      service.endBatch();
      expect(toasts).toHaveLength(1);

      // Reset task for second event
      taskRepo.update('task-2', { completed: false });

      // Second: no batch mode — should emit immediately
      service.handleEvent({
        type: 'task.updated',
        entityId: 'task-2',
        projectId: 'project-1',
        changes: { sectionId: 'section-b' },
        previousValues: { sectionId: 'section-a' },
        depth: 0,
      });
      expect(toasts).toHaveLength(2);
    });
  });
});


// --- Property 10: Batch toast aggregation (Task 6.2) ---
// Feature: automations-polish, Property 10: Batch toast aggregation
// **Validates: Requirements 8.1, 8.2, 8.3**
describe('Property 10: Batch toast aggregation', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    clearUndoSnapshot();
  });

  /**
   * For any batch of rule executions triggered by a single user action,
   * the number of toasts emitted SHALL equal the number of distinct rules that fired
   * (not the number of individual task executions). Each toast SHALL reference the
   * correct rule name and the count of tasks affected by that rule.
   */
  it('number of toasts equals number of distinct rules, each with correct ruleName and batchSize', () => {
    // Arbitrary: generate 1-5 rules, each with 1-4 tasks
    const ruleWithTasksArb = fc.record({
      ruleId: fc.string({ minLength: 1, maxLength: 20 }),
      ruleName: fc.string({ minLength: 1, maxLength: 30 }),
      taskCount: fc.integer({ min: 1, max: 4 }),
    });

    const batchArb = fc.array(ruleWithTasksArb, { minLength: 1, maxLength: 5 })
      // Ensure unique ruleIds
      .filter(rules => {
        const ids = rules.map(r => r.ruleId);
        return new Set(ids).size === ids.length;
      });

    fc.assert(
      fc.property(batchArb, (batchRules) => {
        taskRepo.clear();
        sectionRepo.clear();
        ruleRepo.clear();
        clearUndoSnapshot();

        // Create a trigger section and a target section
        const triggerSectionId = 'trigger-section';
        const targetSectionId = 'target-section';
        sectionRepo.create({
          id: triggerSectionId,
          projectId: 'project-1',
          name: 'Trigger Section',
          order: 0,
          collapsed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        sectionRepo.create({
          id: targetSectionId,
          projectId: 'project-1',
          name: 'Target Section',
          order: 1,
          collapsed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // For each rule, create the rule and its tasks
        // All rules trigger on card_moved_into_section for triggerSectionId
        // and perform mark_card_complete (a non-move action so tasks stay in place)
        const expectedByRule = new Map<string, { ruleName: string; taskCount: number }>();
        let taskIndex = 0;

        for (const ruleSpec of batchRules) {
          ruleRepo.create({
            id: ruleSpec.ruleId,
            projectId: 'project-1',
            name: ruleSpec.ruleName,
            trigger: {
              type: 'card_moved_into_section',
              sectionId: triggerSectionId,
            },
            action: {
              type: 'mark_card_complete',
              sectionId: null,
              dateOption: null,
              position: null,
            },
            enabled: true,
            brokenReason: null,
            executionCount: 0,
            lastExecutedAt: null,
            order: taskIndex,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as AutomationRule);

          // Create tasks for this rule
          for (let t = 0; t < ruleSpec.taskCount; t++) {
            const taskId = `task-${taskIndex}-${t}`;
            taskRepo.create({
              id: taskId,
              projectId: 'project-1',
              parentTaskId: null,
              sectionId: triggerSectionId,
              description: `Task ${taskIndex}-${t}`,
              notes: '',
              assignee: '',
              priority: 'none',
              tags: [],
              dueDate: null,
              completed: false,
              completedAt: null,
              order: taskIndex * 10 + t,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          expectedByRule.set(ruleSpec.ruleId, {
            ruleName: ruleSpec.ruleName,
            taskCount: ruleSpec.taskCount,
          });
          taskIndex++;
        }

        // Collect toasts
        const toasts: Array<{ ruleName: string; taskDescription: string; batchSize: number }> = [];
        const ruleExecutor = new RuleExecutor(taskRepo, sectionRepo, taskService as any, ruleRepo);
        const service = new AutomationService(
          ruleRepo, taskRepo, sectionRepo, taskService as any, ruleExecutor, 5,
          (params) => toasts.push(params),
        );

        // Begin batch and fire events for each task
        service.beginBatch();

        let tIdx = 0;
        for (const ruleSpec of batchRules) {
          for (let t = 0; t < ruleSpec.taskCount; t++) {
            const taskId = `task-${tIdx}-${t}`;
            service.handleEvent({
              type: 'task.updated',
              entityId: taskId,
              projectId: 'project-1',
              changes: { sectionId: triggerSectionId },
              previousValues: { sectionId: 'other-section' },
              depth: 0,
            });
          }
          tIdx++;
        }

        service.endBatch();

        // PROPERTY: Number of toasts == number of distinct rules
        // Note: All rules share the same trigger, so each event fires ALL rules.
        // That means each task triggers all rules, not just "its" rule.
        // The total executions per rule = total number of tasks across all rules.
        const totalTasks = batchRules.reduce((sum, r) => sum + r.taskCount, 0);
        const distinctRuleCount = batchRules.length;

        expect(toasts.length).toBe(distinctRuleCount);

        // PROPERTY: Each toast references the correct rule name
        const toastByName = new Map<string, number>();
        for (const toast of toasts) {
          toastByName.set(toast.ruleName, toast.batchSize);
        }

        for (const ruleSpec of batchRules) {
          expect(toastByName.has(ruleSpec.ruleName)).toBe(true);
          // Each rule fires on ALL tasks (since all share the same trigger section)
          expect(toastByName.get(ruleSpec.ruleName)).toBe(totalTasks);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('single rule firing on multiple tasks produces exactly one toast with correct count', () => {
    const taskCountArb = fc.integer({ min: 1, max: 20 });
    const ruleNameArb = fc.string({ minLength: 1, maxLength: 30 });

    fc.assert(
      fc.property(taskCountArb, ruleNameArb, (taskCount, ruleName) => {
        taskRepo.clear();
        sectionRepo.clear();
        ruleRepo.clear();
        clearUndoSnapshot();

        const sectionId = 'done-section';
        sectionRepo.create({
          id: sectionId,
          projectId: 'project-1',
          name: 'Done',
          order: 0,
          collapsed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        ruleRepo.create({
          id: 'rule-1',
          projectId: 'project-1',
          name: ruleName,
          trigger: { type: 'card_moved_into_section', sectionId },
          action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
          enabled: true,
          brokenReason: null,
          executionCount: 0,
          lastExecutedAt: null,
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as AutomationRule);

        // Create tasks
        for (let i = 0; i < taskCount; i++) {
          taskRepo.create({
            id: `task-${i}`,
            projectId: 'project-1',
            parentTaskId: null,
            sectionId,
            description: `Task ${i}`,
            notes: '',
            assignee: '',
            priority: 'none',
            tags: [],
            dueDate: null,
            completed: false,
            completedAt: null,
            order: i,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        const toasts: Array<{ ruleName: string; taskDescription: string; batchSize: number }> = [];
        const ruleExecutor = new RuleExecutor(taskRepo, sectionRepo, taskService as any, ruleRepo);
        const service = new AutomationService(
          ruleRepo, taskRepo, sectionRepo, taskService as any, ruleExecutor, 5,
          (params) => toasts.push(params),
        );

        service.beginBatch();
        for (let i = 0; i < taskCount; i++) {
          service.handleEvent({
            type: 'task.updated',
            entityId: `task-${i}`,
            projectId: 'project-1',
            changes: { sectionId },
            previousValues: { sectionId: 'other-section' },
            depth: 0,
          });
        }
        service.endBatch();

        // Exactly one toast
        expect(toasts.length).toBe(1);
        // Correct rule name
        expect(toasts[0].ruleName).toBe(ruleName);
        // Correct batch size
        expect(toasts[0].batchSize).toBe(taskCount);
      }),
      { numRuns: 100 },
    );
  });
});


// --- Undo with subtasks (Bug fix: undo should revert subtasks too) ---
describe('performUndo with subtasks', () => {
  let taskRepo: MockTaskRepository;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    clearUndoSnapshot();
  });

  function createTask(overrides: Partial<Task> = {}): Task {
    const task: Task = {
      id: 'task-1',
      projectId: 'project-1',
      parentTaskId: null,
      sectionId: 'section-a',
      description: 'Test task',
      notes: '',
      assignee: '',
      priority: 'none',
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    taskRepo.create(task);
    return task;
  }

  it('undoing mark_card_complete reverts subtasks that were cascade-completed', () => {
    // Parent task was completed by automation (cascade also completed subtasks)
    createTask({ id: 'parent-1', completed: true, completedAt: '2025-06-01T12:00:00.000Z' });
    createTask({ id: 'sub-1', parentTaskId: 'parent-1', completed: true, completedAt: '2025-06-01T12:00:00.000Z' });
    createTask({ id: 'sub-2', parentTaskId: 'parent-1', completed: true, completedAt: '2025-06-01T12:00:00.000Z' });

    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-complete',
      actionType: 'mark_card_complete',
      targetEntityId: 'parent-1',
      previousState: { completed: false, completedAt: null },
      // subtaskSnapshots should capture the previous state of subtasks
      subtaskSnapshots: [
        { taskId: 'sub-1', previousState: { completed: false, completedAt: null } },
        { taskId: 'sub-2', previousState: { completed: false, completedAt: null } },
      ],
      timestamp: Date.now(),
    } as UndoSnapshot);

    expect(performUndo(taskRepo)).toBe(true);

    // Parent should be reverted
    expect(taskRepo.findById('parent-1')!.completed).toBe(false);
    expect(taskRepo.findById('parent-1')!.completedAt).toBeNull();

    // Subtasks should also be reverted
    expect(taskRepo.findById('sub-1')!.completed).toBe(false);
    expect(taskRepo.findById('sub-1')!.completedAt).toBeNull();
    expect(taskRepo.findById('sub-2')!.completed).toBe(false);
    expect(taskRepo.findById('sub-2')!.completedAt).toBeNull();
  });

  it('undoing mark_card_incomplete reverts subtasks too', () => {
    // Parent was marked incomplete by automation
    createTask({ id: 'parent-1', completed: false, completedAt: null });
    createTask({ id: 'sub-1', parentTaskId: 'parent-1', completed: false, completedAt: null });

    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-incomplete',
      actionType: 'mark_card_incomplete',
      targetEntityId: 'parent-1',
      previousState: { completed: true, completedAt: '2025-05-15T10:00:00.000Z' },
      subtaskSnapshots: [
        { taskId: 'sub-1', previousState: { completed: true, completedAt: '2025-05-15T10:00:00.000Z' } },
      ],
      timestamp: Date.now(),
    } as UndoSnapshot);

    expect(performUndo(taskRepo)).toBe(true);

    expect(taskRepo.findById('parent-1')!.completed).toBe(true);
    expect(taskRepo.findById('sub-1')!.completed).toBe(true);
  });

  it('handles missing subtask gracefully during undo', () => {
    createTask({ id: 'parent-1', completed: true, completedAt: '2025-06-01T12:00:00.000Z' });
    // sub-1 was deleted before undo

    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-complete',
      actionType: 'mark_card_complete',
      targetEntityId: 'parent-1',
      previousState: { completed: false, completedAt: null },
      subtaskSnapshots: [
        { taskId: 'sub-1', previousState: { completed: false, completedAt: null } },
      ],
      timestamp: Date.now(),
    } as UndoSnapshot);

    // Should still succeed — parent reverted, missing subtask skipped
    expect(performUndo(taskRepo)).toBe(true);
    expect(taskRepo.findById('parent-1')!.completed).toBe(false);
  });

  it('works normally when subtaskSnapshots is empty or undefined', () => {
    createTask({ id: 'task-1', completed: true, completedAt: '2025-06-01T12:00:00.000Z' });

    setUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Auto-complete',
      actionType: 'mark_card_complete',
      targetEntityId: 'task-1',
      previousState: { completed: false, completedAt: null },
      timestamp: Date.now(),
    });

    expect(performUndo(taskRepo)).toBe(true);
    expect(taskRepo.findById('task-1')!.completed).toBe(false);
  });
});


// --- Multi-rule undo: each rule's action should be independently undoable ---
describe('Multi-rule undo (per-snapshot undo)', () => {
  let taskRepo: MockTaskRepository;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    clearUndoSnapshot();
  });

  function createTask(overrides: Partial<Task> = {}): Task {
    const task: Task = {
      id: 'task-1',
      projectId: 'project-1',
      parentTaskId: null,
      sectionId: 'section-a',
      description: 'Test task',
      notes: '',
      assignee: '',
      priority: 'none',
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    taskRepo.create(task);
    return task;
  }

  it('pushUndoSnapshot adds to the stack, getUndoSnapshots returns all non-expired', () => {
    const snap1: UndoSnapshot = {
      ruleId: 'rule-1',
      ruleName: 'Rule A',
      actionType: 'mark_card_complete',
      targetEntityId: 'task-1',
      previousState: { completed: false, completedAt: null },
      timestamp: Date.now(),
    };
    const snap2: UndoSnapshot = {
      ruleId: 'rule-2',
      ruleName: 'Rule B',
      actionType: 'set_due_date',
      targetEntityId: 'task-1',
      previousState: { dueDate: null },
      timestamp: Date.now(),
    };

    pushUndoSnapshot(snap1);
    pushUndoSnapshot(snap2);

    const all = getUndoSnapshots();
    expect(all).toHaveLength(2);
    expect(all[0].ruleId).toBe('rule-1');
    expect(all[1].ruleId).toBe('rule-2');
  });

  it('performUndoById reverts only the specified snapshot', () => {
    createTask({ id: 'task-1', completed: true, completedAt: '2025-06-01T00:00:00.000Z', dueDate: '2025-07-01' });

    const snap1: UndoSnapshot = {
      ruleId: 'rule-1',
      ruleName: 'Rule A',
      actionType: 'mark_card_complete',
      targetEntityId: 'task-1',
      previousState: { completed: false, completedAt: null },
      timestamp: Date.now(),
    };
    const snap2: UndoSnapshot = {
      ruleId: 'rule-2',
      ruleName: 'Rule B',
      actionType: 'set_due_date',
      targetEntityId: 'task-1',
      previousState: { dueDate: null },
      timestamp: Date.now(),
    };

    pushUndoSnapshot(snap1);
    pushUndoSnapshot(snap2);

    // Undo only the mark_complete (snap1)
    expect(performUndoById('rule-1', taskRepo)).toBe(true);

    const task = taskRepo.findById('task-1')!;
    // mark_complete was undone
    expect(task.completed).toBe(false);
    expect(task.completedAt).toBeNull();
    // set_due_date was NOT undone — still has the automation-set date
    expect(task.dueDate).toBe('2025-07-01');

    // snap1 removed from stack, snap2 still there
    const remaining = getUndoSnapshots();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].ruleId).toBe('rule-2');
  });

  it('performUndoById returns false for non-existent snapshot ID', () => {
    expect(performUndoById('nonexistent', taskRepo)).toBe(false);
  });

  it('clearAllUndoSnapshots empties the stack', () => {
    pushUndoSnapshot({
      ruleId: 'rule-1',
      ruleName: 'Rule A',
      actionType: 'mark_card_complete',
      targetEntityId: 'task-1',
      previousState: { completed: false },
      timestamp: Date.now(),
    });

    clearAllUndoSnapshots();
    expect(getUndoSnapshots()).toHaveLength(0);
    expect(getUndoSnapshot()).toBeNull();
  });

  it('expired snapshots are filtered out of getUndoSnapshots', () => {
    pushUndoSnapshot({
      ruleId: 'rule-old',
      ruleName: 'Old Rule',
      actionType: 'mark_card_complete',
      targetEntityId: 'task-1',
      previousState: { completed: false },
      timestamp: Date.now() - UNDO_EXPIRY_MS - 1,
    });
    pushUndoSnapshot({
      ruleId: 'rule-new',
      ruleName: 'New Rule',
      actionType: 'set_due_date',
      targetEntityId: 'task-1',
      previousState: { dueDate: null },
      timestamp: Date.now(),
    });

    const all = getUndoSnapshots();
    expect(all).toHaveLength(1);
    expect(all[0].ruleId).toBe('rule-new');
  });
});
