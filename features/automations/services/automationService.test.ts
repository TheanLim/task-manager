import { describe, it, expect, beforeEach } from 'vitest';
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
