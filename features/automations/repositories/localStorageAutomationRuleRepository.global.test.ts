import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageAutomationRuleRepository } from './localStorageAutomationRuleRepository';
import type { AutomationRule } from '../types';

// Minimal localStorage mock
class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

const NOW = '2025-01-15T10:00:00.000Z';

function makeRule(id: string, projectId: string | null, overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id,
    projectId,
    name: `Rule ${id}`,
    trigger: { type: 'card_moved_into_section', sectionId: null },
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
    createdAt: NOW,
    updatedAt: NOW,
    bulkPausedAt: null,
    excludedProjectIds: [],
    ...overrides,
  };
}

describe('LocalStorageAutomationRuleRepository — global rules (findGlobal)', () => {
  let mock: LocalStorageMock;

  beforeEach(() => {
    mock = new LocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mock,
      writable: true,
      configurable: true,
    });
    mock.clear();
  });

  it('findGlobal() returns empty array when no rules exist', () => {
    const repo = new LocalStorageAutomationRuleRepository();
    expect(repo.findGlobal()).toEqual([]);
  });

  it('findGlobal() returns only rules with projectId === null', () => {
    const repo = new LocalStorageAutomationRuleRepository();
    repo.create(makeRule('global-1', null));
    repo.create(makeRule('global-2', null));
    repo.create(makeRule('project-1', 'proj-a'));

    const globals = repo.findGlobal();
    expect(globals).toHaveLength(2);
    expect(globals.map((r) => r.id).sort()).toEqual(['global-1', 'global-2']);
  });

  it('findGlobal() returns empty array when only project-scoped rules exist', () => {
    const repo = new LocalStorageAutomationRuleRepository();
    repo.create(makeRule('project-1', 'proj-a'));
    repo.create(makeRule('project-2', 'proj-b'));

    expect(repo.findGlobal()).toEqual([]);
  });

  it('findByProjectId() excludes global rules (null projectId)', () => {
    const repo = new LocalStorageAutomationRuleRepository();
    repo.create(makeRule('global-1', null));
    repo.create(makeRule('project-1', 'proj-a'));
    repo.create(makeRule('project-2', 'proj-a'));

    const projectRules = repo.findByProjectId('proj-a');
    expect(projectRules).toHaveLength(2);
    expect(projectRules.every((r) => r.projectId === 'proj-a')).toBe(true);
  });

  it('create() then findGlobal() round-trip for a global rule', () => {
    const repo = new LocalStorageAutomationRuleRepository();
    const rule = makeRule('global-1', null, { name: 'My Global Rule' });
    repo.create(rule);

    const found = repo.findGlobal();
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('global-1');
    expect(found[0].projectId).toBeNull();
    expect(found[0].name).toBe('My Global Rule');
  });

  it('global rule with excludedProjectIds survives round-trip through create() → loadFromStorage()', () => {
    const repo = new LocalStorageAutomationRuleRepository();
    const rule = makeRule('global-1', null, { excludedProjectIds: ['proj-x', 'proj-y'] });
    repo.create(rule);

    // Simulate reload by creating a new repo instance (reads from localStorage)
    const repo2 = new LocalStorageAutomationRuleRepository();
    const found = repo2.findGlobal();
    expect(found).toHaveLength(1);
    expect(found[0].excludedProjectIds).toEqual(['proj-x', 'proj-y']);
  });

  it('existing project-scoped rules survive round-trip unchanged (regression)', () => {
    const repo = new LocalStorageAutomationRuleRepository();
    repo.create(makeRule('project-1', 'proj-a'));

    const repo2 = new LocalStorageAutomationRuleRepository();
    const rules = repo2.findByProjectId('proj-a');
    expect(rules).toHaveLength(1);
    expect(rules[0].projectId).toBe('proj-a');
    expect(rules[0].excludedProjectIds).toEqual([]); // default applied by migration
  });

  it('migration is idempotent — loading the same data twice produces the same result', () => {
    const repo = new LocalStorageAutomationRuleRepository();
    repo.create(makeRule('global-1', null));
    repo.create(makeRule('project-1', 'proj-a'));

    const repo2 = new LocalStorageAutomationRuleRepository();
    const firstLoad = repo2.findAll();

    // Simulate a second load by creating another instance
    const repo3 = new LocalStorageAutomationRuleRepository();
    const secondLoad = repo3.findAll();

    expect(secondLoad).toEqual(firstLoad);
  });

  it('update() on a global rule preserves projectId: null', () => {
    const repo = new LocalStorageAutomationRuleRepository();
    repo.create(makeRule('global-1', null));
    repo.update('global-1', { name: 'Updated Name' });

    const found = repo.findGlobal();
    expect(found).toHaveLength(1);
    expect(found[0].projectId).toBeNull();
    expect(found[0].name).toBe('Updated Name');
  });

  it('delete() removes a global rule from findGlobal()', () => {
    const repo = new LocalStorageAutomationRuleRepository();
    repo.create(makeRule('global-1', null));
    repo.create(makeRule('global-2', null));
    repo.delete('global-1');

    const found = repo.findGlobal();
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('global-2');
  });
});
