import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { RuleExecutor } from './ruleExecutor';
import type {
  RuleAction,
  DomainEvent,
  AutomationRule,
  ActionType,
} from '../types';
import type { Task, Section } from '@/lib/schemas';
import type { TaskRepository, SectionRepository } from '@/lib/repositories/types';
import type { AutomationRuleRepository } from '../repositories/types';
import type { TaskService } from '@/features/tasks/services/taskService';

// Mock repositories and services
class MockTaskRepository {
  private tasks: Map<string, Task> = new Map();

  findById(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  findAll(): Task[] {
    return Array.from(this.tasks.values());
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

class MockSectionRepository {
  private sections: Map<string, Section> = new Map();

  findById(id: string): Section | undefined {
    return this.sections.get(id);
  }

  findAll(): Section[] {
    return Array.from(this.sections.values());
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

const taskArb = fc.record({
  id: idArb,
  projectId: idArb,
  parentTaskId: fc.oneof(idArb, fc.constant(null)),
  sectionId: fc.oneof(idArb, fc.constant(null)),
  description: fc.string({ minLength: 1, maxLength: 500 }),
  notes: fc.string(),
  assignee: fc.string(),
  priority: fc.constantFrom('none', 'low', 'medium', 'high'),
  tags: fc.array(fc.string()),
  dueDate: fc.oneof(isoDateTimeArb, fc.constant(null)),
  completed: fc.boolean(),
  completedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
  order: fc.integer(),
  createdAt: isoDateTimeArb,
  updatedAt: isoDateTimeArb,
});

const sectionArb = fc.record({
  id: idArb,
  projectId: fc.oneof(idArb, fc.constant(null)),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  order: fc.integer(),
  collapsed: fc.boolean(),
  createdAt: isoDateTimeArb,
  updatedAt: isoDateTimeArb,
});

const executionLogEntryArb = fc.record({
  timestamp: isoDateTimeArb,
  triggerDescription: fc.string({ minLength: 1, maxLength: 100 }),
  actionDescription: fc.string({ minLength: 1, maxLength: 100 }),
  taskName: fc.string({ minLength: 1, maxLength: 200 }),
});

const automationRuleArb = fc.record({
  id: idArb,
  projectId: idArb,
  name: fc.string({ minLength: 1, maxLength: 200 }),
  trigger: fc.record({
    type: fc.constantFrom(
      'card_moved_into_section',
      'card_moved_out_of_section',
      'card_marked_complete',
      'card_marked_incomplete',
    ),
    sectionId: fc.oneof(idArb, fc.constant(null)),
  }),
  action: fc.record({
    type: fc.constantFrom<ActionType>(
      'move_card_to_top_of_section',
      'move_card_to_bottom_of_section',
      'mark_card_complete',
      'mark_card_incomplete',
      'set_due_date',
      'remove_due_date',
    ),
    sectionId: fc.oneof(idArb, fc.constant(null)),
    dateOption: fc.constantFrom('today', 'tomorrow', 'next_working_day', null),
    position: fc.constantFrom('top', 'bottom', null),
  }),
  enabled: fc.boolean(),
  brokenReason: fc.oneof(fc.string({ minLength: 1 }), fc.constant(null)),
  executionCount: fc.nat(),
  lastExecutedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
  recentExecutions: fc.array(executionLogEntryArb, { minLength: 0, maxLength: 5 }),
  order: fc.integer(),
  createdAt: isoDateTimeArb,
  updatedAt: isoDateTimeArb,
});

// Feature: automations-foundation, Property 8: Move action positioning
// **Validates: Requirements 5.1, 5.2**
describe('Property 8: Move action positioning', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;
  let executor: RuleExecutor;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    executor = new RuleExecutor(taskRepo as any, sectionRepo as any, taskService as any, ruleRepo);
  });

  it('for any task and target section with existing tasks, move_card_to_top_of_section results in order strictly less than all other tasks', () => {
    fc.assert(
      fc.property(
        taskArb,
        sectionArb,
        fc.array(taskArb, { minLength: 1, maxLength: 10 }),
        automationRuleArb,
        (targetTask, targetSection, existingTasks, ruleTemplate) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create target section
          sectionRepo.create(targetSection);

          // Create existing tasks in the target section with various orders
          const tasksInSection = existingTasks.map((t, i) => ({
            ...t,
            sectionId: targetSection.id,
            order: i * 10, // Space them out
          }));
          tasksInSection.forEach(t => taskRepo.create(t as any));

          // Create target task in a different section
          const task = {
            ...targetTask,
            sectionId: 'different-section',
            order: 999,
          };
          taskRepo.create(task as any);

          // Create rule
          const rule = {
            ...ruleTemplate,
            id: 'test-rule',
            executionCount: 0,
            lastExecutedAt: null,
          } as any;
          ruleRepo.create(rule);

          // Create action
          const action: RuleAction = {
            ruleId: rule.id,
            actionType: 'move_card_to_top_of_section',
            targetEntityId: task.id,
            params: {
              sectionId: targetSection.id,
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: task.id,
            projectId: task.projectId,
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          executor.executeActions([action], event);

          // Verify the task was moved to the target section
          const movedTask = taskRepo.findById(task.id);
          expect(movedTask).toBeDefined();
          expect(movedTask!.sectionId).toBe(targetSection.id);

          // Verify the task's order is strictly less than all other tasks in the section
          const allTasksInSection = taskRepo
            .findAll()
            .filter(t => t.sectionId === targetSection.id);

          for (const otherTask of allTasksInSection) {
            if (otherTask.id !== task.id) {
              expect(movedTask!.order).toBeLessThan(otherTask.order);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any task and target section with existing tasks, move_card_to_bottom_of_section results in order strictly greater than all other tasks', () => {
    fc.assert(
      fc.property(
        taskArb,
        sectionArb,
        fc.array(taskArb, { minLength: 1, maxLength: 10 }),
        automationRuleArb,
        (targetTask, targetSection, existingTasks, ruleTemplate) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create target section
          sectionRepo.create(targetSection);

          // Create existing tasks in the target section with various orders
          const tasksInSection = existingTasks.map((t, i) => ({
            ...t,
            sectionId: targetSection.id,
            order: i * 10, // Space them out
          }));
          tasksInSection.forEach(t => taskRepo.create(t as any));

          // Create target task in a different section
          const task = {
            ...targetTask,
            sectionId: 'different-section',
            order: 999,
          };
          taskRepo.create(task as any);

          // Create rule
          const rule = {
            ...ruleTemplate,
            id: 'test-rule',
            executionCount: 0,
            lastExecutedAt: null,
          } as any;
          ruleRepo.create(rule);

          // Create action
          const action: RuleAction = {
            ruleId: rule.id,
            actionType: 'move_card_to_bottom_of_section',
            targetEntityId: task.id,
            params: {
              sectionId: targetSection.id,
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: task.id,
            projectId: task.projectId,
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          executor.executeActions([action], event);

          // Verify the task was moved to the target section
          const movedTask = taskRepo.findById(task.id);
          expect(movedTask).toBeDefined();
          expect(movedTask!.sectionId).toBe(targetSection.id);

          // Verify the task's order is strictly greater than all other tasks in the section
          const allTasksInSection = taskRepo
            .findAll()
            .filter(t => t.sectionId === targetSection.id);

          for (const otherTask of allTasksInSection) {
            if (otherTask.id !== task.id) {
              expect(movedTask!.order).toBeGreaterThan(otherTask.order);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any task moving to an empty section, move_card_to_top_of_section sets order to -1', () => {
    fc.assert(
      fc.property(
        taskArb,
        sectionArb,
        automationRuleArb,
        (targetTask, targetSection, ruleTemplate) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create target section (empty)
          sectionRepo.create(targetSection);

          // Create target task in a different section
          const task = {
            ...targetTask,
            sectionId: 'different-section',
            order: 999,
          };
          taskRepo.create(task as any);

          // Create rule
          const rule = {
            ...ruleTemplate,
            id: 'test-rule',
            executionCount: 0,
            lastExecutedAt: null,
          } as any;
          ruleRepo.create(rule);

          // Create action
          const action: RuleAction = {
            ruleId: rule.id,
            actionType: 'move_card_to_top_of_section',
            targetEntityId: task.id,
            params: {
              sectionId: targetSection.id,
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: task.id,
            projectId: task.projectId,
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          executor.executeActions([action], event);

          // Verify the task was moved to the target section
          const movedTask = taskRepo.findById(task.id);
          expect(movedTask).toBeDefined();
          expect(movedTask!.sectionId).toBe(targetSection.id);
          expect(movedTask!.order).toBe(-1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any task moving to an empty section, move_card_to_bottom_of_section sets order to 1', () => {
    fc.assert(
      fc.property(
        taskArb,
        sectionArb,
        automationRuleArb,
        (targetTask, targetSection, ruleTemplate) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create target section (empty)
          sectionRepo.create(targetSection);

          // Create target task in a different section
          const task = {
            ...targetTask,
            sectionId: 'different-section',
            order: 999,
          };
          taskRepo.create(task as any);

          // Create rule
          const rule = {
            ...ruleTemplate,
            id: 'test-rule',
            executionCount: 0,
            lastExecutedAt: null,
          } as any;
          ruleRepo.create(rule);

          // Create action
          const action: RuleAction = {
            ruleId: rule.id,
            actionType: 'move_card_to_bottom_of_section',
            targetEntityId: task.id,
            params: {
              sectionId: targetSection.id,
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: task.id,
            projectId: task.projectId,
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          executor.executeActions([action], event);

          // Verify the task was moved to the target section
          const movedTask = taskRepo.findById(task.id);
          expect(movedTask).toBeDefined();
          expect(movedTask!.sectionId).toBe(targetSection.id);
          expect(movedTask!.order).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: automations-foundation, Property 9: Executor skips missing entities
// **Validates: Requirements 5.7**
describe('Property 9: Executor skips missing entities', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;
  let executor: RuleExecutor;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    executor = new RuleExecutor(taskRepo as any, sectionRepo as any, taskService as any, ruleRepo);
  });

  it('for any RuleAction targeting a non-existent task ID, executor does not throw an error', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        fc.constantFrom<ActionType>(
          'move_card_to_top_of_section',
          'move_card_to_bottom_of_section',
          'mark_card_complete',
          'mark_card_incomplete',
          'set_due_date',
          'remove_due_date',
        ),
        (nonExistentTaskId, ruleId, actionType) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create action targeting non-existent task
          const action: RuleAction = {
            ruleId,
            actionType,
            targetEntityId: nonExistentTaskId,
            params: {
              sectionId: 'some-section',
              dateOption: 'today',
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: nonExistentTaskId,
            projectId: 'test-project',
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action - should not throw
          expect(() => {
            executor.executeActions([action], event);
          }).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any RuleAction targeting a non-existent task ID, executor does not modify any repository state', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        fc.array(taskArb, { minLength: 1, maxLength: 5 }),
        fc.constantFrom<ActionType>(
          'move_card_to_top_of_section',
          'move_card_to_bottom_of_section',
          'mark_card_complete',
          'mark_card_incomplete',
          'set_due_date',
          'remove_due_date',
        ),
        (nonExistentTaskId, ruleId, existingTasks, actionType) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Ensure nonExistentTaskId doesn't match any existing task IDs
          const uniqueTasks = existingTasks.map((t, idx) => ({
            ...t,
            id: `existing-${idx}`,
          }));

          // Create some existing tasks
          uniqueTasks.forEach(t => taskRepo.create(t as any));

          // Capture initial state
          const initialTasks = taskRepo.findAll().map(t => ({ ...t }));

          // Create action targeting non-existent task (use a guaranteed non-existent ID)
          const action: RuleAction = {
            ruleId,
            actionType,
            targetEntityId: `non-existent-${nonExistentTaskId}`,
            params: {
              sectionId: 'some-section',
              dateOption: 'today',
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: `non-existent-${nonExistentTaskId}`,
            projectId: 'test-project',
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          executor.executeActions([action], event);

          // Verify no tasks were modified
          const finalTasks = taskRepo.findAll();
          expect(finalTasks).toHaveLength(initialTasks.length);

          for (let i = 0; i < initialTasks.length; i++) {
            expect(finalTasks[i]).toEqual(initialTasks[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any move action targeting a non-existent section, executor skips the action', () => {
    fc.assert(
      fc.property(
        taskArb,
        idArb,
        idArb,
        fc.constantFrom<'move_card_to_top_of_section' | 'move_card_to_bottom_of_section'>(
          'move_card_to_top_of_section',
          'move_card_to_bottom_of_section',
        ),
        (task, nonExistentSectionId, ruleId, actionType) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create task
          taskRepo.create(task as any);

          // Capture initial task state
          const initialTask = { ...task };

          // Create action targeting non-existent section
          const action: RuleAction = {
            ruleId,
            actionType,
            targetEntityId: task.id,
            params: {
              sectionId: nonExistentSectionId,
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: task.id,
            projectId: task.projectId,
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          executor.executeActions([action], event);

          // Verify task was not modified
          const finalTask = taskRepo.findById(task.id);
          expect(finalTask).toEqual(initialTask);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: automations-foundation, Property 10: Executor updates rule metadata on success
// **Validates: Requirements 5.8**
describe('Property 10: Executor updates rule metadata on success', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;
  let executor: RuleExecutor;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    executor = new RuleExecutor(taskRepo as any, sectionRepo as any, taskService as any, ruleRepo);
  });

  it('for any successfully executed action, rule executionCount increases by 1', () => {
    fc.assert(
      fc.property(
        taskArb,
        sectionArb,
        automationRuleArb,
        fc.constantFrom<ActionType>(
          'move_card_to_top_of_section',
          'move_card_to_bottom_of_section',
          'mark_card_complete',
          'mark_card_incomplete',
          'set_due_date',
          'remove_due_date',
        ),
        (task, section, ruleTemplate, actionType) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create task and section
          taskRepo.create(task as any);
          sectionRepo.create(section);

          // Create rule with initial executionCount
          const initialExecutionCount = Math.floor(Math.random() * 100);
          const rule = {
            ...ruleTemplate,
            id: 'test-rule',
            executionCount: initialExecutionCount,
            lastExecutedAt: null,
          } as any;
          ruleRepo.create(rule);

          // Create action
          const action: RuleAction = {
            ruleId: rule.id,
            actionType,
            targetEntityId: task.id,
            params: {
              sectionId: section.id,
              dateOption: 'today',
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: task.id,
            projectId: task.projectId,
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          executor.executeActions([action], event);

          // Verify executionCount increased by 1
          const updatedRule = ruleRepo.findById(rule.id);
          expect(updatedRule).toBeDefined();
          expect(updatedRule!.executionCount).toBe(initialExecutionCount + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any successfully executed action, rule lastExecutedAt is updated to a non-null ISO datetime string', () => {
    fc.assert(
      fc.property(
        taskArb,
        sectionArb,
        automationRuleArb,
        fc.constantFrom<ActionType>(
          'move_card_to_top_of_section',
          'move_card_to_bottom_of_section',
          'mark_card_complete',
          'mark_card_incomplete',
          'set_due_date',
          'remove_due_date',
        ),
        (task, section, ruleTemplate, actionType) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create task and section
          taskRepo.create(task as any);
          sectionRepo.create(section);

          // Create rule with null lastExecutedAt
          const rule = {
            ...ruleTemplate,
            id: 'test-rule',
            executionCount: 0,
            lastExecutedAt: null,
          } as any;
          ruleRepo.create(rule);

          // Capture time before execution
          const beforeExecution = new Date();

          // Create action
          const action: RuleAction = {
            ruleId: rule.id,
            actionType,
            targetEntityId: task.id,
            params: {
              sectionId: section.id,
              dateOption: 'today',
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: task.id,
            projectId: task.projectId,
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          executor.executeActions([action], event);

          // Capture time after execution
          const afterExecution = new Date();

          // Verify lastExecutedAt is updated
          const updatedRule = ruleRepo.findById(rule.id);
          expect(updatedRule).toBeDefined();
          expect(updatedRule!.lastExecutedAt).not.toBeNull();

          // Verify it's a valid ISO datetime string
          const lastExecutedAt = new Date(updatedRule!.lastExecutedAt!);
          expect(lastExecutedAt.toISOString()).toBe(updatedRule!.lastExecutedAt);

          // Verify it's within a reasonable time range
          expect(lastExecutedAt.getTime()).toBeGreaterThanOrEqual(beforeExecution.getTime() - 1000);
          expect(lastExecutedAt.getTime()).toBeLessThanOrEqual(afterExecution.getTime() + 1000);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any failed action (missing entity), rule metadata is NOT updated', () => {
    fc.assert(
      fc.property(
        idArb,
        automationRuleArb,
        fc.constantFrom<ActionType>(
          'move_card_to_top_of_section',
          'move_card_to_bottom_of_section',
          'mark_card_complete',
          'mark_card_incomplete',
          'set_due_date',
          'remove_due_date',
        ),
        (nonExistentTaskId, ruleTemplate, actionType) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create rule with initial metadata
          const initialExecutionCount = Math.floor(Math.random() * 100);
          const rule = {
            ...ruleTemplate,
            id: 'test-rule',
            executionCount: initialExecutionCount,
            lastExecutedAt: null,
          } as any;
          ruleRepo.create(rule);

          // Create action targeting non-existent task
          const action: RuleAction = {
            ruleId: rule.id,
            actionType,
            targetEntityId: nonExistentTaskId,
            params: {
              sectionId: 'some-section',
              dateOption: 'today',
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.updated',
            entityId: nonExistentTaskId,
            projectId: 'test-project',
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          executor.executeActions([action], event);

          // Verify rule metadata was NOT updated
          const updatedRule = ruleRepo.findById(rule.id);
          expect(updatedRule).toBeDefined();
          expect(updatedRule!.executionCount).toBe(initialExecutionCount);
          expect(updatedRule!.lastExecutedAt).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Requirement 5.3: mark_card_complete calls TaskService.cascadeComplete with completed=true
// Requirement 5.4: mark_card_incomplete calls TaskService.cascadeComplete with completed=false
describe('Req 5.3 / 5.4: mark_card_complete and mark_card_incomplete call cascadeComplete', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;
  let executor: RuleExecutor;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    executor = new RuleExecutor(taskRepo as any, sectionRepo as any, taskService as any, ruleRepo);
  });

  it('mark_card_complete calls cascadeComplete with (taskId, true)', () => {
    const spy = vi.spyOn(taskService, 'cascadeComplete');

    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      parentTaskId: null,
      sectionId: 'section-1',
      description: 'Test',
      notes: '',
      assignee: '',
      priority: 'none' as const,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    taskRepo.create(task as any);

    const rule = {
      id: 'rule-1',
      projectId: 'proj-1',
      name: 'Test',
      trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
      action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
      filters: [],
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: 'rule-1',
      actionType: 'mark_card_complete',
      targetEntityId: 'task-1',
      params: {},
    };

    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    executor.executeActions([action], event);

    expect(spy).toHaveBeenCalledWith('task-1', true, { emitEvents: false });
    spy.mockRestore();
  });

  it('mark_card_incomplete calls cascadeComplete with (taskId, false)', () => {
    const spy = vi.spyOn(taskService, 'cascadeComplete');

    const task = {
      id: 'task-2',
      projectId: 'proj-1',
      parentTaskId: null,
      sectionId: 'section-1',
      description: 'Test',
      notes: '',
      assignee: '',
      priority: 'none' as const,
      tags: [],
      dueDate: null,
      completed: true,
      completedAt: new Date().toISOString(),
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    taskRepo.create(task as any);

    const rule = {
      id: 'rule-2',
      projectId: 'proj-1',
      name: 'Test',
      trigger: { type: 'card_marked_incomplete' as const, sectionId: null },
      action: { type: 'mark_card_incomplete' as const, sectionId: null, dateOption: null, position: null },
      filters: [],
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: 'rule-2',
      actionType: 'mark_card_incomplete',
      targetEntityId: 'task-2',
      params: {},
    };

    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-2',
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    executor.executeActions([action], event);

    expect(spy).toHaveBeenCalledWith('task-2', false, { emitEvents: false });
    spy.mockRestore();
  });
});

// Requirement 5.5: set_due_date calculates target date and updates task dueDate
// Requirement 5.6: remove_due_date sets task dueDate to null
describe('Req 5.5 / 5.6: set_due_date and remove_due_date actions', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;
  let executor: RuleExecutor;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    executor = new RuleExecutor(taskRepo as any, sectionRepo as any, taskService as any, ruleRepo);
  });

  it('set_due_date with "today" sets dueDate to start of current day', () => {
    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      parentTaskId: null,
      sectionId: 'section-1',
      description: 'Test',
      notes: '',
      assignee: '',
      priority: 'none' as const,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    taskRepo.create(task as any);

    const rule = {
      id: 'rule-1',
      projectId: 'proj-1',
      name: 'Test',
      trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
      action: { type: 'set_due_date' as const, sectionId: null, dateOption: 'today', position: null },
      filters: [],
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: 'rule-1',
      actionType: 'set_due_date',
      targetEntityId: 'task-1',
      params: { dateOption: 'today' as any },
    };

    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    executor.executeActions([action], event);

    const updatedTask = taskRepo.findById('task-1');
    expect(updatedTask).toBeDefined();
    expect(updatedTask!.dueDate).not.toBeNull();

    const dueDate = new Date(updatedTask!.dueDate!);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(dueDate.toDateString()).toBe(today.toDateString());
    expect(dueDate.getHours()).toBe(0);
    expect(dueDate.getMinutes()).toBe(0);
    expect(dueDate.getSeconds()).toBe(0);
    expect(dueDate.getMilliseconds()).toBe(0);
  });

  it('set_due_date with "tomorrow" sets dueDate to start of next day', () => {
    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      parentTaskId: null,
      sectionId: 'section-1',
      description: 'Test',
      notes: '',
      assignee: '',
      priority: 'none' as const,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    taskRepo.create(task as any);

    const rule = {
      id: 'rule-1',
      projectId: 'proj-1',
      name: 'Test',
      trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
      action: { type: 'set_due_date' as const, sectionId: null, dateOption: 'tomorrow', position: null },
      filters: [],
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: 'rule-1',
      actionType: 'set_due_date',
      targetEntityId: 'task-1',
      params: { dateOption: 'tomorrow' as any },
    };

    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    executor.executeActions([action], event);

    const updatedTask = taskRepo.findById('task-1');
    expect(updatedTask).toBeDefined();
    expect(updatedTask!.dueDate).not.toBeNull();

    const dueDate = new Date(updatedTask!.dueDate!);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    expect(dueDate.toDateString()).toBe(tomorrow.toDateString());
  });

  it('set_due_date with "next_working_day" sets dueDate to a weekday', () => {
    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      parentTaskId: null,
      sectionId: 'section-1',
      description: 'Test',
      notes: '',
      assignee: '',
      priority: 'none' as const,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    taskRepo.create(task as any);

    const rule = {
      id: 'rule-1',
      projectId: 'proj-1',
      name: 'Test',
      trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
      action: { type: 'set_due_date' as const, sectionId: null, dateOption: 'next_working_day', position: null },
      filters: [],
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: 'rule-1',
      actionType: 'set_due_date',
      targetEntityId: 'task-1',
      params: { dateOption: 'next_working_day' as any },
    };

    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    executor.executeActions([action], event);

    const updatedTask = taskRepo.findById('task-1');
    expect(updatedTask).toBeDefined();
    expect(updatedTask!.dueDate).not.toBeNull();

    const dueDate = new Date(updatedTask!.dueDate!);
    const dayOfWeek = dueDate.getDay();
    // Must be Monday-Friday (1-5)
    expect(dayOfWeek).toBeGreaterThanOrEqual(1);
    expect(dayOfWeek).toBeLessThanOrEqual(5);
  });

  it('set_due_date emits a task.updated domain event with dueDate change', () => {
    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      parentTaskId: null,
      sectionId: 'section-1',
      description: 'Test',
      notes: '',
      assignee: '',
      priority: 'none' as const,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    taskRepo.create(task as any);

    const rule = {
      id: 'rule-1',
      projectId: 'proj-1',
      name: 'Test',
      trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
      action: { type: 'set_due_date' as const, sectionId: null, dateOption: 'today', position: null },
      filters: [],
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: 'rule-1',
      actionType: 'set_due_date',
      targetEntityId: 'task-1',
      params: { dateOption: 'today' as any },
    };

    const triggeringEvent: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    const events = executor.executeActions([action], triggeringEvent);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('task.updated');
    expect(events[0].entityId).toBe('task-1');
    expect(events[0].changes).toHaveProperty('dueDate');
    expect(events[0].previousValues).toHaveProperty('dueDate');
    expect(events[0].previousValues.dueDate).toBeNull();
    expect(events[0].depth).toBe(1);
    expect(events[0].triggeredByRule).toBe('rule-1');
  });

  it('remove_due_date sets task dueDate to null', () => {
    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      parentTaskId: null,
      sectionId: 'section-1',
      description: 'Test',
      notes: '',
      assignee: '',
      priority: 'none' as const,
      tags: [],
      dueDate: '2025-06-15T00:00:00.000Z',
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    taskRepo.create(task as any);

    const rule = {
      id: 'rule-1',
      projectId: 'proj-1',
      name: 'Test',
      trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
      action: { type: 'remove_due_date' as const, sectionId: null, dateOption: null, position: null },
      filters: [],
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: 'rule-1',
      actionType: 'remove_due_date',
      targetEntityId: 'task-1',
      params: {},
    };

    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    executor.executeActions([action], event);

    const updatedTask = taskRepo.findById('task-1');
    expect(updatedTask).toBeDefined();
    expect(updatedTask!.dueDate).toBeNull();
  });

  it('remove_due_date emits a task.updated domain event with dueDate set to null', () => {
    const existingDueDate = '2025-06-15T00:00:00.000Z';
    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      parentTaskId: null,
      sectionId: 'section-1',
      description: 'Test',
      notes: '',
      assignee: '',
      priority: 'none' as const,
      tags: [],
      dueDate: existingDueDate,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    taskRepo.create(task as any);

    const rule = {
      id: 'rule-1',
      projectId: 'proj-1',
      name: 'Test',
      trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
      action: { type: 'remove_due_date' as const, sectionId: null, dateOption: null, position: null },
      filters: [],
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: 'rule-1',
      actionType: 'remove_due_date',
      targetEntityId: 'task-1',
      params: {},
    };

    const triggeringEvent: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    const events = executor.executeActions([action], triggeringEvent);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('task.updated');
    expect(events[0].entityId).toBe('task-1');
    expect(events[0].changes.dueDate).toBeNull();
    expect(events[0].previousValues.dueDate).toBe(existingDueDate);
    expect(events[0].depth).toBe(1);
    expect(events[0].triggeredByRule).toBe('rule-1');
  });

  it('remove_due_date on a task with no dueDate still works (idempotent)', () => {
    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      parentTaskId: null,
      sectionId: 'section-1',
      description: 'Test',
      notes: '',
      assignee: '',
      priority: 'none' as const,
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    taskRepo.create(task as any);

    const rule = {
      id: 'rule-1',
      projectId: 'proj-1',
      name: 'Test',
      trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
      action: { type: 'remove_due_date' as const, sectionId: null, dateOption: null, position: null },
      filters: [],
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: 'rule-1',
      actionType: 'remove_due_date',
      targetEntityId: 'task-1',
      params: {},
    };

    const event: DomainEvent = {
      type: 'task.updated',
      entityId: 'task-1',
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    executor.executeActions([action], event);

    const updatedTask = taskRepo.findById('task-1');
    expect(updatedTask).toBeDefined();
    expect(updatedTask!.dueDate).toBeNull();
  });
});

// Feature: automations-filters-dates, Property 18: create_card action produces a task with correct fields
// **Validates: Requirements 8.4, 8.5**
describe('Property 18: create_card action produces a task with correct fields', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;
  let executor: RuleExecutor;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    executor = new RuleExecutor(taskRepo as any, sectionRepo as any, taskService as any, ruleRepo);
  });

  it('for any create_card action with valid title and sectionId, a new task exists with the specified title and sectionId', () => {
    fc.assert(
      fc.property(
        sectionArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        idArb,
        (section, cardTitle, ruleId) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create target section
          sectionRepo.create(section);

          // Count initial tasks
          const initialTaskCount = taskRepo.findAll().length;

          // Create action
          const action: RuleAction = {
            ruleId,
            actionType: 'create_card',
            targetEntityId: 'trigger-entity-id', // Not used for create_card
            params: {
              sectionId: section.id,
              cardTitle,
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.created',
            entityId: 'some-task-id',
            projectId: section.projectId || 'test-project',
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          const events = executor.executeActions([action], event);

          // Verify a new task was created
          const allTasks = taskRepo.findAll();
          expect(allTasks.length).toBe(initialTaskCount + 1);

          // Find the newly created task
          const newTask = allTasks.find(t => t.description === cardTitle && t.sectionId === section.id);
          expect(newTask).toBeDefined();
          expect(newTask!.description).toBe(cardTitle);
          expect(newTask!.sectionId).toBe(section.id);
          expect(newTask!.projectId).toBe(section.projectId);

          // Verify a task.created event was emitted
          expect(events.length).toBe(1);
          expect(events[0].type).toBe('task.created');
          expect(events[0].entityId).toBe(newTask!.id);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any create_card action with a dateOption, the task dueDate is non-null', () => {
    fc.assert(
      fc.property(
        sectionArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.constantFrom('today', 'tomorrow', 'next_working_day'),
        idArb,
        (section, cardTitle, dateOption, ruleId) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create target section
          sectionRepo.create(section);

          // Create action with dateOption
          const action: RuleAction = {
            ruleId,
            actionType: 'create_card',
            targetEntityId: 'trigger-entity-id',
            params: {
              sectionId: section.id,
              cardTitle,
              cardDateOption: dateOption as any,
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.created',
            entityId: 'some-task-id',
            projectId: section.projectId || 'test-project',
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          executor.executeActions([action], event);

          // Find the newly created task
          const newTask = taskRepo.findAll().find(t => t.description === cardTitle);
          expect(newTask).toBeDefined();
          expect(newTask!.dueDate).not.toBeNull();

          // Verify it's a valid ISO datetime string
          const dueDate = new Date(newTask!.dueDate!);
          expect(dueDate.toISOString()).toBe(newTask!.dueDate);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any create_card action without a dateOption, the task dueDate is null', () => {
    fc.assert(
      fc.property(
        sectionArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        idArb,
        (section, cardTitle, ruleId) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create target section
          sectionRepo.create(section);

          // Create action without dateOption
          const action: RuleAction = {
            ruleId,
            actionType: 'create_card',
            targetEntityId: 'trigger-entity-id',
            params: {
              sectionId: section.id,
              cardTitle,
              // No cardDateOption
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.created',
            entityId: 'some-task-id',
            projectId: section.projectId || 'test-project',
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          executor.executeActions([action], event);

          // Find the newly created task
          const newTask = taskRepo.findAll().find(t => t.description === cardTitle);
          expect(newTask).toBeDefined();
          expect(newTask!.dueDate).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any create_card action targeting a non-existent section, no task is created', () => {
    fc.assert(
      fc.property(
        idArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        idArb,
        (nonExistentSectionId, cardTitle, ruleId) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Count initial tasks
          const initialTaskCount = taskRepo.findAll().length;

          // Create action targeting non-existent section
          const action: RuleAction = {
            ruleId,
            actionType: 'create_card',
            targetEntityId: 'trigger-entity-id',
            params: {
              sectionId: nonExistentSectionId,
              cardTitle,
            },
          };

          // Create triggering event
          const event: DomainEvent = {
            type: 'task.created',
            entityId: 'some-task-id',
            projectId: 'test-project',
            changes: {},
            previousValues: {},
            depth: 0,
          };

          // Execute action
          const events = executor.executeActions([action], event);

          // Verify no task was created
          const finalTaskCount = taskRepo.findAll().length;
          expect(finalTaskCount).toBe(initialTaskCount);

          // Verify no events were emitted
          expect(events.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Unit tests for create_card edge cases
describe('create_card edge cases', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;
  let executor: RuleExecutor;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    executor = new RuleExecutor(taskRepo as any, sectionRepo as any, taskService as any, ruleRepo);
  });

  it('target section does not exist → action skipped', () => {
    // Create action targeting non-existent section
    const action: RuleAction = {
      ruleId: 'test-rule',
      actionType: 'create_card',
      targetEntityId: 'trigger-entity-id',
      params: {
        sectionId: 'non-existent-section',
        cardTitle: 'Test Card',
      },
    };

    const event: DomainEvent = {
      type: 'task.created',
      entityId: 'some-task-id',
      projectId: 'test-project',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    // Execute action
    const events = executor.executeActions([action], event);

    // Verify no task was created
    expect(taskRepo.findAll().length).toBe(0);
    expect(events.length).toBe(0);
  });

  it('cardDateOption provided → dueDate set correctly', () => {
    // Create target section
    const section: Section = {
      id: 'test-section',
      projectId: 'test-project',
      name: 'Test Section',
      order: 0,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sectionRepo.create(section);

    // Create action with dateOption
    const action: RuleAction = {
      ruleId: 'test-rule',
      actionType: 'create_card',
      targetEntityId: 'trigger-entity-id',
      params: {
        sectionId: section.id,
        cardTitle: 'Test Card',
        cardDateOption: 'tomorrow' as any,
      },
    };

    const event: DomainEvent = {
      type: 'task.created',
      entityId: 'some-task-id',
      projectId: 'test-project',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    // Execute action
    executor.executeActions([action], event);

    // Verify task was created with dueDate
    const tasks = taskRepo.findAll();
    expect(tasks.length).toBe(1);
    expect(tasks[0].dueDate).not.toBeNull();

    // Verify dueDate is tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const taskDueDate = new Date(tasks[0].dueDate!);
    expect(taskDueDate.toDateString()).toBe(tomorrow.toDateString());
  });

  it('no cardDateOption → dueDate is null', () => {
    // Create target section
    const section: Section = {
      id: 'test-section',
      projectId: 'test-project',
      name: 'Test Section',
      order: 0,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sectionRepo.create(section);

    // Create action without dateOption
    const action: RuleAction = {
      ruleId: 'test-rule',
      actionType: 'create_card',
      targetEntityId: 'trigger-entity-id',
      params: {
        sectionId: section.id,
        cardTitle: 'Test Card',
      },
    };

    const event: DomainEvent = {
      type: 'task.created',
      entityId: 'some-task-id',
      projectId: 'test-project',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    // Execute action
    executor.executeActions([action], event);

    // Verify task was created without dueDate
    const tasks = taskRepo.findAll();
    expect(tasks.length).toBe(1);
    expect(tasks[0].dueDate).toBeNull();
  });

  it('specific_date with month/day → correct date calculated', () => {
    // Create target section
    const section: Section = {
      id: 'test-section',
      projectId: 'test-project',
      name: 'Test Section',
      order: 0,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sectionRepo.create(section);

    // Create action with specific_date
    const action: RuleAction = {
      ruleId: 'test-rule',
      actionType: 'create_card',
      targetEntityId: 'trigger-entity-id',
      params: {
        sectionId: section.id,
        cardTitle: 'Test Card',
        cardDateOption: 'specific_date' as any,
        specificMonth: 12,
        specificDay: 25,
      },
    };

    const event: DomainEvent = {
      type: 'task.created',
      entityId: 'some-task-id',
      projectId: 'test-project',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    // Execute action
    executor.executeActions([action], event);

    // Verify task was created with correct dueDate
    const tasks = taskRepo.findAll();
    expect(tasks.length).toBe(1);
    expect(tasks[0].dueDate).not.toBeNull();

    const taskDueDate = new Date(tasks[0].dueDate!);
    expect(taskDueDate.getMonth()).toBe(11); // December (0-indexed)
    expect(taskDueDate.getDate()).toBe(25);
  });

  it('created task is positioned at bottom of section', () => {
    // Create target section
    const section: Section = {
      id: 'test-section',
      projectId: 'test-project',
      name: 'Test Section',
      order: 0,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sectionRepo.create(section);

    // Create existing tasks in the section
    const existingTask1: Task = {
      id: 'task-1',
      projectId: 'test-project',
      parentTaskId: null,
      sectionId: section.id,
      description: 'Existing Task 1',
      notes: '',
      assignee: '',
      priority: 'none',
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActionAt: null,
    };

    const existingTask2: Task = {
      id: 'task-2',
      projectId: 'test-project',
      parentTaskId: null,
      sectionId: section.id,
      description: 'Existing Task 2',
      notes: '',
      assignee: '',
      priority: 'none',
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 20,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActionAt: null,
    };

    taskRepo.create(existingTask1 as any);
    taskRepo.create(existingTask2 as any);

    // Create action
    const action: RuleAction = {
      ruleId: 'test-rule',
      actionType: 'create_card',
      targetEntityId: 'trigger-entity-id',
      params: {
        sectionId: section.id,
        cardTitle: 'New Card',
      },
    };

    const event: DomainEvent = {
      type: 'task.created',
      entityId: 'some-task-id',
      projectId: 'test-project',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    // Execute action
    executor.executeActions([action], event);

    // Verify new task is at bottom (order > all existing tasks)
    const newTask = taskRepo.findAll().find(t => t.description === 'New Card');
    expect(newTask).toBeDefined();
    expect(newTask!.order).toBeGreaterThan(existingTask1.order);
    expect(newTask!.order).toBeGreaterThan(existingTask2.order);
    expect(newTask!.order).toBe(21); // maxOrder + 1
  });
});

// Trigger section sentinel resolution
describe('create_card with TRIGGER_SECTION_SENTINEL', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;
  let executor: RuleExecutor;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    executor = new RuleExecutor(taskRepo as any, sectionRepo as any, taskService as any, ruleRepo);
  });

  it('resolves __trigger_section__ to the triggering event entityId', () => {
    // Create the section that will be "just created" by the trigger
    const newSection: Section = {
      id: 'new-section-abc',
      projectId: 'proj-1',
      name: 'Sprint 42',
      order: 0,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sectionRepo.create(newSection);

    const action: RuleAction = {
      ruleId: 'rule-1',
      actionType: 'create_card',
      targetEntityId: newSection.id,
      params: {
        sectionId: '__trigger_section__',
        cardTitle: 'Standup Notes',
      },
    };

    // section.created event — entityId is the new section's ID
    const event: DomainEvent = {
      type: 'section.created',
      entityId: newSection.id,
      projectId: 'proj-1',
      changes: { name: 'Sprint 42' },
      previousValues: {},
      depth: 0,
    };

    const events = executor.executeActions([action], event);

    // A task should have been created in the triggering section
    const tasks = taskRepo.findAll();
    expect(tasks.length).toBe(1);
    expect(tasks[0].sectionId).toBe(newSection.id);
    expect(tasks[0].description).toBe('Standup Notes');
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('task.created');
  });

  it('skips when sentinel resolves to a non-existent section', () => {
    const action: RuleAction = {
      ruleId: 'rule-1',
      actionType: 'create_card',
      targetEntityId: 'ghost-section',
      params: {
        sectionId: '__trigger_section__',
        cardTitle: 'Should not be created',
      },
    };

    const event: DomainEvent = {
      type: 'section.created',
      entityId: 'ghost-section',
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    const events = executor.executeActions([action], event);

    expect(taskRepo.findAll().length).toBe(0);
    expect(events.length).toBe(0);
  });
});


// Feature: automations-polish, Task 4.1: Execution log push and trim
// **Validates: Requirements 4.3, 4.4**
describe('Execution log push and trim', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;
  let executor: RuleExecutor;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    executor = new RuleExecutor(taskRepo as any, sectionRepo as any, taskService as any, ruleRepo);
  });

  function createTestSection(id = 'section-1', name = 'Done'): Section {
    return {
      id,
      projectId: 'proj-1',
      name,
      order: 0,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  function createTestTask(id = 'task-1', description = 'My Task'): Task {
    return {
      id,
      projectId: 'proj-1',
      parentTaskId: null,
      sectionId: 'section-1',
      description,
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
      lastActionAt: null,
    };
  }

  function createTestRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
    return {
      id: 'rule-1',
      projectId: 'proj-1',
      name: 'Test Rule',
      trigger: { type: 'card_moved_into_section', sectionId: 'section-1' },
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  function createTriggeringEvent(taskId = 'task-1'): DomainEvent {
    return {
      type: 'task.updated',
      entityId: taskId,
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 0,
    };
  }

  it('pushes an execution log entry after a successful mark_card_complete action', () => {
    const section = createTestSection();
    const task = createTestTask();
    const rule = createTestRule();

    sectionRepo.create(section);
    taskRepo.create(task as any);
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: rule.id,
      actionType: 'mark_card_complete',
      targetEntityId: task.id,
      params: {},
    };

    executor.executeActions([action], createTriggeringEvent());

    const updatedRule = ruleRepo.findById(rule.id)!;
    expect(updatedRule.recentExecutions).toHaveLength(1);
    expect(updatedRule.recentExecutions[0].taskName).toBe('My Task');
    expect(updatedRule.recentExecutions[0].actionDescription).toBe('Marked as complete');
    expect(updatedRule.recentExecutions[0].triggerDescription).toBe("Card moved into 'Done'");
    expect(updatedRule.recentExecutions[0].timestamp).toBeTruthy();
  });

  it('pushes an execution log entry after a successful move action', () => {
    const section = createTestSection('target-section', 'In Progress');
    const task = createTestTask();
    const rule = createTestRule({
      trigger: { type: 'card_marked_complete', sectionId: null },
      action: {
        type: 'move_card_to_top_of_section',
        sectionId: 'target-section',
        dateOption: null,
        position: null,
        cardTitle: null,
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
    });

    sectionRepo.create(section);
    taskRepo.create(task as any);
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: rule.id,
      actionType: 'move_card_to_top_of_section',
      targetEntityId: task.id,
      params: { sectionId: 'target-section' },
    };

    executor.executeActions([action], createTriggeringEvent());

    const updatedRule = ruleRepo.findById(rule.id)!;
    expect(updatedRule.recentExecutions).toHaveLength(1);
    expect(updatedRule.recentExecutions[0].actionDescription).toBe("Moved to top of 'In Progress'");
    expect(updatedRule.recentExecutions[0].triggerDescription).toBe('Card marked complete');
    expect(updatedRule.recentExecutions[0].taskName).toBe('My Task');
  });

  it('pushes an execution log entry after a successful create_card action', () => {
    const section = createTestSection();
    const rule = createTestRule({
      trigger: { type: 'section_created', sectionId: null },
      action: {
        type: 'create_card',
        sectionId: 'section-1',
        dateOption: null,
        position: null,
        cardTitle: 'Standup Notes',
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
    });

    sectionRepo.create(section);
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: rule.id,
      actionType: 'create_card',
      targetEntityId: 'trigger-entity',
      params: { sectionId: section.id, cardTitle: 'Standup Notes' },
    };

    const event: DomainEvent = {
      type: 'section.created',
      entityId: section.id,
      projectId: 'proj-1',
      changes: {},
      previousValues: {},
      depth: 0,
    };

    executor.executeActions([action], event);

    const updatedRule = ruleRepo.findById(rule.id)!;
    expect(updatedRule.recentExecutions).toHaveLength(1);
    expect(updatedRule.recentExecutions[0].taskName).toBe('Standup Notes');
    expect(updatedRule.recentExecutions[0].actionDescription).toBe("Created card 'Standup Notes'");
    expect(updatedRule.recentExecutions[0].triggerDescription).toBe('Section created');
  });

  it('does NOT push a log entry when the action fails (missing task)', () => {
    const rule = createTestRule();
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: rule.id,
      actionType: 'mark_card_complete',
      targetEntityId: 'non-existent-task',
      params: {},
    };

    executor.executeActions([action], createTriggeringEvent('non-existent-task'));

    const updatedRule = ruleRepo.findById(rule.id)!;
    expect(updatedRule.recentExecutions).toHaveLength(0);
  });

  it('trims recentExecutions to 20 entries when exceeding the cap', () => {
    // Pre-populate rule with 20 existing entries
    const existingEntries = Array.from({ length: 20 }, (_, i) => ({
      timestamp: new Date(2025, 0, i + 1).toISOString(),
      triggerDescription: `Trigger ${i}`,
      actionDescription: `Action ${i}`,
      taskName: `Task ${i}`,
    }));

    const section = createTestSection();
    const task = createTestTask();
    const rule = createTestRule({ recentExecutions: existingEntries });

    sectionRepo.create(section);
    taskRepo.create(task as any);
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: rule.id,
      actionType: 'mark_card_complete',
      targetEntityId: task.id,
      params: {},
    };

    executor.executeActions([action], createTriggeringEvent());

    const updatedRule = ruleRepo.findById(rule.id)!;
    expect(updatedRule.recentExecutions).toHaveLength(20);
    // The oldest entry (Trigger 0) should be gone, newest should be the new one
    expect(updatedRule.recentExecutions[0].triggerDescription).toBe('Trigger 1');
    expect(updatedRule.recentExecutions[19].taskName).toBe('My Task');
  });

  it('accumulates entries up to 20 without trimming', () => {
    const section = createTestSection();
    const task = createTestTask();
    const rule = createTestRule();

    sectionRepo.create(section);
    taskRepo.create(task as any);
    ruleRepo.create(rule);

    const action: RuleAction = {
      ruleId: rule.id,
      actionType: 'mark_card_complete',
      targetEntityId: task.id,
      params: {},
    };

    // Execute 5 times
    for (let i = 0; i < 5; i++) {
      executor.executeActions([action], createTriggeringEvent());
    }

    const updatedRule = ruleRepo.findById(rule.id)!;
    expect(updatedRule.recentExecutions).toHaveLength(5);
  });

  it('generates correct descriptions for all action types', () => {
    const section = createTestSection('target-sec', 'Archive');
    const task = createTestTask();
    const rule = createTestRule({
      trigger: { type: 'card_marked_incomplete', sectionId: null },
    });

    sectionRepo.create(section);
    taskRepo.create(task as any);
    ruleRepo.create(rule);

    const actionTypes: Array<{ type: ActionType; params: RuleAction['params']; expected: string }> = [
      { type: 'mark_card_complete', params: {}, expected: 'Marked as complete' },
      { type: 'mark_card_incomplete', params: {}, expected: 'Marked as incomplete' },
      { type: 'move_card_to_top_of_section', params: { sectionId: 'target-sec' }, expected: "Moved to top of 'Archive'" },
      { type: 'move_card_to_bottom_of_section', params: { sectionId: 'target-sec' }, expected: "Moved to bottom of 'Archive'" },
      { type: 'set_due_date', params: { dateOption: 'today' as any }, expected: 'Set due date' },
      { type: 'remove_due_date', params: {}, expected: 'Removed due date' },
    ];

    for (const { type, params, expected } of actionTypes) {
      // Reset rule's recentExecutions
      ruleRepo.update(rule.id, { recentExecutions: [], executionCount: 0 });

      const action: RuleAction = {
        ruleId: rule.id,
        actionType: type,
        targetEntityId: task.id,
        params,
      };

      executor.executeActions([action], createTriggeringEvent());

      const updatedRule = ruleRepo.findById(rule.id)!;
      const lastEntry = updatedRule.recentExecutions[updatedRule.recentExecutions.length - 1];
      expect(lastEntry?.actionDescription).toBe(expected);
    }
  });

  it('generates correct trigger descriptions for all trigger types', () => {
    const section = createTestSection('trigger-sec', 'Backlog');
    const task = createTestTask();

    sectionRepo.create(section);
    taskRepo.create(task as any);

    const triggerTypes: Array<{ type: AutomationRule['trigger']['type']; sectionId: string | null; expected: string }> = [
      { type: 'card_moved_into_section', sectionId: 'trigger-sec', expected: "Card moved into 'Backlog'" },
      { type: 'card_moved_out_of_section', sectionId: 'trigger-sec', expected: "Card moved out of 'Backlog'" },
      { type: 'card_marked_complete', sectionId: null, expected: 'Card marked complete' },
      { type: 'card_marked_incomplete', sectionId: null, expected: 'Card marked incomplete' },
      { type: 'card_created_in_section', sectionId: 'trigger-sec', expected: "Card created in 'Backlog'" },
      { type: 'section_created', sectionId: null, expected: 'Section created' },
      { type: 'section_renamed', sectionId: null, expected: 'Section renamed' },
    ];

    for (const { type, sectionId, expected } of triggerTypes) {
      const rule = createTestRule({
        id: `rule-${type}`,
        trigger: { type, sectionId },
      });
      ruleRepo.create(rule);

      const action: RuleAction = {
        ruleId: rule.id,
        actionType: 'mark_card_complete',
        targetEntityId: task.id,
        params: {},
      };

      executor.executeActions([action], createTriggeringEvent());

      const updatedRule = ruleRepo.findById(rule.id)!;
      expect(updatedRule.recentExecutions[0]?.triggerDescription).toBe(expected);
    }
  });
});

// Feature: automations-polish, Property 4: Execution log push and cap invariant
// **Validates: Requirements 4.3, 4.4**
describe('Property 4: Execution log push and cap invariant', () => {
  let taskRepo: MockTaskRepository;
  let sectionRepo: MockSectionRepository;
  let ruleRepo: MockAutomationRuleRepository;
  let taskService: MockTaskService;
  let executor: RuleExecutor;

  beforeEach(() => {
    taskRepo = new MockTaskRepository();
    sectionRepo = new MockSectionRepository();
    ruleRepo = new MockAutomationRuleRepository();
    taskService = new MockTaskService();
    executor = new RuleExecutor(taskRepo as any, sectionRepo as any, taskService as any, ruleRepo);
  });

  it('after a successful execution, recentExecutions has length <= 20 and contains the new entry', () => {
    fc.assert(
      fc.property(
        // Generate 0-100 existing execution log entries
        fc.array(executionLogEntryArb, { minLength: 0, maxLength: 100 }),
        (existingEntries) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create section and task for a successful action
          const section: Section = {
            id: 'test-section',
            projectId: 'proj-1',
            name: 'Done',
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          sectionRepo.create(section);

          const task: Task = {
            id: 'test-task',
            projectId: 'proj-1',
            parentTaskId: null,
            sectionId: 'test-section',
            description: 'Test Task',
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
            lastActionAt: null,
          };
          taskRepo.create(task as any);

          // Create rule with the generated existing entries
          const rule: AutomationRule = {
            id: 'rule-1',
            projectId: 'proj-1',
            name: 'Test Rule',
            trigger: { type: 'card_moved_into_section', sectionId: 'test-section' },
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
            recentExecutions: existingEntries,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          ruleRepo.create(rule);

          // Execute a successful action
          const action: RuleAction = {
            ruleId: rule.id,
            actionType: 'mark_card_complete',
            targetEntityId: task.id,
            params: {},
          };

          const event: DomainEvent = {
            type: 'task.updated',
            entityId: task.id,
            projectId: 'proj-1',
            changes: {},
            previousValues: {},
            depth: 0,
          };

          executor.executeActions([action], event);

          const updatedRule = ruleRepo.findById(rule.id)!;

          // Invariant 1: length is at most 20
          expect(updatedRule.recentExecutions.length).toBeLessThanOrEqual(20);

          // Invariant 2: the new entry is present (task name matches)
          const hasNewEntry = updatedRule.recentExecutions.some(
            (e) => e.taskName === 'Test Task' && e.actionDescription === 'Marked as complete'
          );
          expect(hasNewEntry).toBe(true);

          // Invariant 3: length is min(existingEntries.length + 1, 20)
          const expectedLength = Math.min(existingEntries.length + 1, 20);
          expect(updatedRule.recentExecutions.length).toBe(expectedLength);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('the most recent 20 entries by insertion order are retained after trimming', () => {
    fc.assert(
      fc.property(
        // Generate 20-100 existing entries with sequential timestamps for ordering
        fc.integer({ min: 20, max: 100 }),
        (entryCount) => {
          // Clear repositories
          taskRepo.clear();
          sectionRepo.clear();
          ruleRepo.clear();

          // Create entries with sequential timestamps so we can verify ordering
          const existingEntries = Array.from({ length: entryCount }, (_, i) => ({
            timestamp: new Date(2025, 0, 1, 0, 0, i).toISOString(),
            triggerDescription: `Trigger ${i}`,
            actionDescription: `Action ${i}`,
            taskName: `Task ${i}`,
          }));

          // Create section and task
          const section: Section = {
            id: 'test-section',
            projectId: 'proj-1',
            name: 'Done',
            order: 0,
            collapsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          sectionRepo.create(section);

          const task: Task = {
            id: 'test-task',
            projectId: 'proj-1',
            parentTaskId: null,
            sectionId: 'test-section',
            description: 'New Execution Task',
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
            lastActionAt: null,
          };
          taskRepo.create(task as any);

          const rule: AutomationRule = {
            id: 'rule-1',
            projectId: 'proj-1',
            name: 'Test Rule',
            trigger: { type: 'card_moved_into_section', sectionId: 'test-section' },
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
            recentExecutions: existingEntries,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          ruleRepo.create(rule);

          // Execute action
          const action: RuleAction = {
            ruleId: rule.id,
            actionType: 'mark_card_complete',
            targetEntityId: task.id,
            params: {},
          };

          const event: DomainEvent = {
            type: 'task.updated',
            entityId: task.id,
            projectId: 'proj-1',
            changes: {},
            previousValues: {},
            depth: 0,
          };

          executor.executeActions([action], event);

          const updatedRule = ruleRepo.findById(rule.id)!;

          // After trimming, exactly 20 entries remain
          expect(updatedRule.recentExecutions).toHaveLength(20);

          // The new entry is the last one
          const lastEntry = updatedRule.recentExecutions[19];
          expect(lastEntry.taskName).toBe('New Execution Task');

          // The 19 entries before the new one are the last 19 from the original array
          for (let i = 0; i < 19; i++) {
            const expectedOriginalIndex = entryCount - 19 + i;
            expect(updatedRule.recentExecutions[i].taskName).toBe(`Task ${expectedOriginalIndex}`);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
