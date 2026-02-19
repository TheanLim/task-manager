import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { LocalStorageBackend } from '@/lib/repositories/localStorageBackend';
import {
  LocalStorageTaskRepository,
  LocalStorageSectionRepository,
} from '@/lib/repositories/localStorageRepositories';
import { LocalStorageAutomationRuleRepository } from '@/features/automations/repositories/localStorageAutomationRuleRepository';
import { SectionService } from './sectionService';
import type { Task, Section } from '@/lib/schemas';
import type { AutomationRule } from '@/features/automations/types';

const PROPERTY_CONFIG = { numRuns: 100 };

function makeSection(id: string, projectId: string, name: string, order: number): Section {
  const now = new Date().toISOString();
  return { id, projectId, name, order, collapsed: false, createdAt: now, updatedAt: now };
}

function makeTask(id: string, projectId: string, sectionId: string | null): Task {
  const now = new Date().toISOString();
  return {
    id, projectId, parentTaskId: null, sectionId, description: 'task', notes: '',
    assignee: '', priority: 'none', tags: [], dueDate: null, completed: false,
    completedAt: null, order: 0, createdAt: now, updatedAt: now,
  };
}

function makeRule(id: string, projectId: string, triggerSectionId: string | null): AutomationRule {
  const now = new Date().toISOString();
  return {
    id, projectId, name: 'Rule', order: 0, enabled: true, brokenReason: null,
    executionCount: 0, lastExecutedAt: null, recentExecutions: [], createdAt: now, updatedAt: now,
    trigger: { type: 'card_moved_into_section', sectionId: triggerSectionId },
    action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    filters: [],
  } as AutomationRule;
}

describe('SectionService.createWithDefaults', () => {
  let backend: LocalStorageBackend;
  let sectionRepo: LocalStorageSectionRepository;
  let taskRepo: LocalStorageTaskRepository;
  let automationRuleRepo: LocalStorageAutomationRuleRepository;
  let sectionService: SectionService;

  beforeEach(() => {
    localStorage.clear();
    backend = new LocalStorageBackend();
    sectionRepo = new LocalStorageSectionRepository(backend);
    taskRepo = new LocalStorageTaskRepository(backend);
    automationRuleRepo = new LocalStorageAutomationRuleRepository();
    sectionService = new SectionService(sectionRepo, taskRepo, automationRuleRepo);
  });

  it('creates a section with generated ID and timestamps', () => {
    const section = sectionService.createWithDefaults('My Section', 'proj-1', 0);

    expect(section.name).toBe('My Section');
    expect(section.projectId).toBe('proj-1');
    expect(section.order).toBe(0);
    expect(section.collapsed).toBe(false);
    expect(section.id).toBeTruthy();
    expect(section.createdAt).toBeTruthy();
    expect(section.updatedAt).toBeTruthy();
  });

  it('persists the section to the repository', () => {
    const section = sectionService.createWithDefaults('Persisted', 'proj-1', 2);
    const found = sectionRepo.findById(section.id);

    expect(found).toBeDefined();
    expect(found!.name).toBe('Persisted');
  });

  it('supports null projectId for unlinked sections', () => {
    const section = sectionService.createWithDefaults('Unlinked', null, 0);
    expect(section.projectId).toBeNull();
  });
});

describe('SectionService.cascadeDelete', () => {
  let backend: LocalStorageBackend;
  let sectionRepo: LocalStorageSectionRepository;
  let taskRepo: LocalStorageTaskRepository;
  let automationRuleRepo: LocalStorageAutomationRuleRepository;
  let sectionService: SectionService;

  beforeEach(() => {
    localStorage.clear();
    backend = new LocalStorageBackend();
    sectionRepo = new LocalStorageSectionRepository(backend);
    taskRepo = new LocalStorageTaskRepository(backend);
    automationRuleRepo = new LocalStorageAutomationRuleRepository();
    sectionService = new SectionService(sectionRepo, taskRepo, automationRuleRepo);
  });

  it('reassigns tasks to "To Do" section before deleting', () => {
    const todoSection = makeSection('sec-todo', 'proj-1', 'To Do', 0);
    const doingSection = makeSection('sec-doing', 'proj-1', 'Doing', 1);
    sectionRepo.create(todoSection);
    sectionRepo.create(doingSection);

    const task1 = makeTask('task-1', 'proj-1', 'sec-doing');
    const task2 = makeTask('task-2', 'proj-1', 'sec-doing');
    const task3 = makeTask('task-3', 'proj-1', 'sec-todo');
    taskRepo.create(task1);
    taskRepo.create(task2);
    taskRepo.create(task3);

    sectionService.cascadeDelete('sec-doing');

    // Section deleted
    expect(sectionRepo.findById('sec-doing')).toBeUndefined();
    // Tasks reassigned to To Do
    expect(taskRepo.findById('task-1')!.sectionId).toBe('sec-todo');
    expect(taskRepo.findById('task-2')!.sectionId).toBe('sec-todo');
    // Task already in To Do unchanged
    expect(taskRepo.findById('task-3')!.sectionId).toBe('sec-todo');
  });

  it('sets sectionId to null when no "To Do" section exists', () => {
    const section = makeSection('sec-1', 'proj-1', 'Custom', 0);
    sectionRepo.create(section);

    const task = makeTask('task-1', 'proj-1', 'sec-1');
    taskRepo.create(task);

    sectionService.cascadeDelete('sec-1');

    expect(sectionRepo.findById('sec-1')).toBeUndefined();
    expect(taskRepo.findById('task-1')!.sectionId).toBeNull();
  });

  it('disables automation rules referencing the deleted section', () => {
    const section = makeSection('sec-target', 'proj-1', 'Done', 0);
    const todoSection = makeSection('sec-todo', 'proj-1', 'To Do', 1);
    sectionRepo.create(section);
    sectionRepo.create(todoSection);

    const rule = makeRule('rule-1', 'proj-1', 'sec-target');
    automationRuleRepo.create(rule);

    expect(automationRuleRepo.findById('rule-1')!.enabled).toBe(true);

    sectionService.cascadeDelete('sec-target');

    const updated = automationRuleRepo.findById('rule-1')!;
    expect(updated.enabled).toBe(false);
    expect(updated.brokenReason).toBe('section_deleted');
  });

  it('does nothing when section does not exist', () => {
    expect(() => sectionService.cascadeDelete('nonexistent')).not.toThrow();
  });

  it('property: after cascadeDelete, zero tasks reference the deleted section', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        (sectionId, taskIds) => {
          localStorage.clear();
          const b = new LocalStorageBackend();
          const sr = new LocalStorageSectionRepository(b);
          const tr = new LocalStorageTaskRepository(b);
          const ar = new LocalStorageAutomationRuleRepository();
          const svc = new SectionService(sr, tr, ar);

          sr.create(makeSection(sectionId, 'proj', 'Doomed', 0));
          sr.create(makeSection('todo', 'proj', 'To Do', 1));

          const uniqueIds = [...new Set(taskIds)];
          for (const tid of uniqueIds) {
            tr.create(makeTask(tid, 'proj', sectionId));
          }

          svc.cascadeDelete(sectionId);

          const remaining = tr.findAll().filter(t => t.sectionId === sectionId);
          expect(remaining).toHaveLength(0);
          expect(sr.findById(sectionId)).toBeUndefined();
        },
      ),
      PROPERTY_CONFIG,
    );
  });
});
