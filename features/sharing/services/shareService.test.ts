import { describe, it, expect, beforeEach } from 'vitest';
import { ShareService, ShareError, ShareErrorType } from './shareService';
import type { AutomationRule } from '@/features/automations/types';
import type { AutomationRuleRepository } from '@/features/automations/repositories/types';
import type { SubscriptionCallback, Unsubscribe } from '@/lib/repositories/types';

describe('ShareService', () => {
  let shareService: ShareService;

  beforeEach(() => {
    shareService = new ShareService();
  });

  describe('encodeForURL and decodeFromURL', () => {
    it('should encode and decode byte arrays correctly', () => {
      const testData = [72, 101, 108, 108, 111]; // "Hello" in ASCII
      
      const encoded = shareService.encodeForURL(testData);
      expect(encoded).toBeTruthy();
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
      
      const decoded = shareService.decodeFromURL(encoded);
      expect(decoded).toEqual(testData);
    });

    it('should handle empty arrays', () => {
      const testData: number[] = [];
      
      const encoded = shareService.encodeForURL(testData);
      const decoded = shareService.decodeFromURL(encoded);
      
      expect(decoded).toEqual(testData);
    });
  });

  describe('checkURLLength', () => {
    it('should return none for short URLs', () => {
      const url = 'https://example.com/#share=abc123';
      const result = shareService.checkURLLength(url);
      
      expect(result.warningLevel).toBe('none');
      expect(result.length).toBe(url.length);
      expect(result.message).toBeUndefined();
    });

    it('should return caution for URLs over 2000 characters', () => {
      const url = 'https://example.com/#share=' + 'a'.repeat(2000);
      const result = shareService.checkURLLength(url);
      
      expect(result.warningLevel).toBe('caution');
      expect(result.message).toBeTruthy();
    });

    it('should return error for URLs over 8000 characters', () => {
      const url = 'https://example.com/#share=' + 'a'.repeat(8000);
      const result = shareService.checkURLLength(url);
      
      expect(result.warningLevel).toBe('error');
      expect(result.message).toBeTruthy();
    });
  });

  describe('serializeState', () => {
    it('should serialize application state', () => {
      const json = shareService.serializeState();
      
      expect(json).toBeTruthy();
      expect(() => JSON.parse(json)).not.toThrow();
      
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('projects');
      expect(parsed).toHaveProperty('tasks');
      expect(parsed).toHaveProperty('sections');
      expect(parsed).toHaveProperty('dependencies');
    });
  });

  describe('extractHashData', () => {
    it('should return null when no hash is present', () => {
      // Mock window.location
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, hash: '' } as any;
      
      const result = shareService.extractHashData();
      expect(result).toBeNull();
      
      // Restore
      window.location = originalLocation;
    });

    it('should return null when hash does not start with #share=', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, hash: '#other=data' } as any;
      
      const result = shareService.extractHashData();
      expect(result).toBeNull();
      
      window.location = originalLocation;
    });

    it('should extract data after #share=', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, hash: '#share=abc123' } as any;
      
      const result = shareService.extractHashData();
      expect(result).toBe('abc123');
      
      window.location = originalLocation;
    });
  });
});

// --- Automation rules integration tests ---

function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? 'rule-1',
    projectId: overrides.projectId ?? 'proj-1',
    name: overrides.name ?? 'Test Rule',
    trigger: overrides.trigger ?? { type: 'card_moved_into_section', sectionId: 'sec-1' },
    filters: overrides.filters ?? [],
    action: overrides.action ?? {
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
    enabled: overrides.enabled ?? true,
    brokenReason: overrides.brokenReason ?? null,
    executionCount: overrides.executionCount ?? 0,
    lastExecutedAt: overrides.lastExecutedAt ?? null,
    recentExecutions: overrides.recentExecutions ?? [],
    order: overrides.order ?? 0,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function createMockRuleRepo(initialRules: AutomationRule[] = []) {
  const rules = new Map<string, AutomationRule>();
  for (const r of initialRules) {
    rules.set(r.id, r);
  }
  return {
    findAll: () => [...rules.values()],
    findById: (id: string) => rules.get(id),
    findByProjectId: (pid: string) => [...rules.values()].filter((r) => r.projectId === pid),
    create: (item: AutomationRule) => { rules.set(item.id, item); },
    update: (id: string, updates: Partial<AutomationRule>) => {
      const existing = rules.get(id);
      if (existing) rules.set(id, { ...existing, ...updates });
    },
    delete: (id: string) => { rules.delete(id); },
    replaceAll: (items: AutomationRule[]) => {
      rules.clear();
      for (const r of items) rules.set(r.id, r);
    },
    subscribe: (() => () => {}) as (cb: SubscriptionCallback<AutomationRule>) => Unsubscribe,
    _rules: rules,
  };
}

describe('ShareService — automation rules', () => {
  describe('serializeState with automationRules', () => {
    it('should include automationRules when includeAutomations is true', () => {
      const rule = makeRule();
      const repo = createMockRuleRepo([rule]);
      const service = new ShareService(repo as any);

      const json = service.serializeState(undefined, { includeAutomations: true });
      const parsed = JSON.parse(json);

      expect(parsed.automationRules).toBeDefined();
      expect(parsed.automationRules).toHaveLength(1);
      expect(parsed.automationRules[0].id).toBe('rule-1');
    });

    it('should include automationRules by default when repo is provided', () => {
      const repo = createMockRuleRepo([makeRule()]);
      const service = new ShareService(repo as any);

      const json = service.serializeState();
      const parsed = JSON.parse(json);

      expect(parsed.automationRules).toBeDefined();
      expect(parsed.automationRules).toHaveLength(1);
    });

    it('should omit automationRules when includeAutomations is false', () => {
      const repo = createMockRuleRepo([makeRule()]);
      const service = new ShareService(repo as any);

      const json = service.serializeState(undefined, { includeAutomations: false });
      const parsed = JSON.parse(json);

      expect(parsed.automationRules).toBeUndefined();
    });

    it('should omit automationRules when no repo is provided', () => {
      const service = new ShareService();

      const json = service.serializeState();
      const parsed = JSON.parse(json);

      expect(parsed.automationRules).toBeUndefined();
    });

    it('should include empty array when repo has no rules', () => {
      const repo = createMockRuleRepo([]);
      const service = new ShareService(repo as any);

      const json = service.serializeState();
      const parsed = JSON.parse(json);

      expect(parsed.automationRules).toEqual([]);
    });
  });

  describe('importAutomationRules', () => {
    it('should import valid rules into the repository', () => {
      const repo = createMockRuleRepo();
      const service = new ShareService(repo as any);
      const rule = makeRule({ id: 'imported-1', trigger: { type: 'card_moved_into_section', sectionId: 'sec-1' } });

      service.importAutomationRules({
        sections: [{ id: 'sec-1' }],
        automationRules: [rule],
      });

      expect(repo.findAll()).toHaveLength(1);
      expect(repo.findById('imported-1')).toBeDefined();
      expect(repo.findById('imported-1')!.enabled).toBe(true);
      expect(repo.findById('imported-1')!.brokenReason).toBeNull();
    });

    it('should mark rules with missing section references as broken', () => {
      const repo = createMockRuleRepo();
      const service = new ShareService(repo as any);
      const rule = makeRule({
        id: 'broken-1',
        trigger: { type: 'card_moved_into_section', sectionId: 'missing-sec' },
      });

      service.importAutomationRules({
        sections: [{ id: 'sec-1' }],
        automationRules: [rule],
      });

      expect(repo.findAll()).toHaveLength(1);
      const imported = repo.findById('broken-1')!;
      expect(imported.enabled).toBe(false);
      expect(imported.brokenReason).toBe('section_deleted');
    });

    it('should skip import when includeAutomations is false', () => {
      const repo = createMockRuleRepo();
      const service = new ShareService(repo as any);

      service.importAutomationRules(
        { sections: [], automationRules: [makeRule()] },
        { includeAutomations: false },
      );

      expect(repo.findAll()).toHaveLength(0);
    });

    it('should skip import when no repo is provided', () => {
      const service = new ShareService();
      // Should not throw
      service.importAutomationRules({
        sections: [],
        automationRules: [makeRule()],
      });
    });

    it('should skip import when automationRules is missing from payload', () => {
      const repo = createMockRuleRepo();
      const service = new ShareService(repo as any);

      service.importAutomationRules({ sections: [] });

      expect(repo.findAll()).toHaveLength(0);
    });

    it('should skip import when automationRules is empty', () => {
      const repo = createMockRuleRepo();
      const service = new ShareService(repo as any);

      service.importAutomationRules({ sections: [], automationRules: [] });

      expect(repo.findAll()).toHaveLength(0);
    });

    it('should import multiple rules and validate each independently', () => {
      const repo = createMockRuleRepo();
      const service = new ShareService(repo as any);
      const validRule = makeRule({ id: 'valid-1', trigger: { type: 'card_moved_into_section', sectionId: 'sec-1' } });
      const brokenRule = makeRule({ id: 'broken-1', trigger: { type: 'card_moved_into_section', sectionId: 'gone-sec' } });

      service.importAutomationRules({
        sections: [{ id: 'sec-1' }],
        automationRules: [validRule, brokenRule],
      });

      expect(repo.findAll()).toHaveLength(2);
      expect(repo.findById('valid-1')!.enabled).toBe(true);
      expect(repo.findById('broken-1')!.enabled).toBe(false);
      expect(repo.findById('broken-1')!.brokenReason).toBe('section_deleted');
    });
  });
});
