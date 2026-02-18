import { describe, it, expect, beforeEach } from 'vitest';
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
