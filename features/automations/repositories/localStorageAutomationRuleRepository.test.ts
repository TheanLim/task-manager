import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { LocalStorageAutomationRuleRepository } from './localStorageAutomationRuleRepository';
import type { AutomationRule } from '../types';

// Mock localStorage for testing
class LocalStorageMock {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Arbitraries for generating valid AutomationRule objects
const triggerTypeArb = fc.constantFrom(
  'card_moved_into_section',
  'card_moved_out_of_section',
  'card_marked_complete',
  'card_marked_incomplete',
);

const actionTypeArb = fc.constantFrom(
  'move_card_to_top_of_section',
  'move_card_to_bottom_of_section',
  'mark_card_complete',
  'mark_card_incomplete',
  'set_due_date',
  'remove_due_date',
);

const relativeDateOptionArb = fc.constantFrom(
  'today',
  'tomorrow',
  'next_working_day',
);

const positionArb = fc.constantFrom('top', 'bottom');

const idArb = fc.string({ minLength: 1, maxLength: 50 });
const isoDateTimeArb = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map((d) => d.toISOString());

const triggerArb = fc.record({
  type: triggerTypeArb,
  sectionId: fc.oneof(idArb, fc.constant(null)),
});

const actionArb = fc.record({
  type: actionTypeArb,
  sectionId: fc.oneof(idArb, fc.constant(null)),
  dateOption: fc.oneof(relativeDateOptionArb, fc.constant(null)),
  position: fc.oneof(positionArb, fc.constant(null)),
  cardTitle: fc.oneof(fc.string({ minLength: 1, maxLength: 200 }), fc.constant(null)),
  cardDateOption: fc.oneof(relativeDateOptionArb, fc.constant(null)),
  specificMonth: fc.oneof(fc.integer({ min: 1, max: 12 }), fc.constant(null)),
  specificDay: fc.oneof(fc.integer({ min: 1, max: 31 }), fc.constant(null)),
  monthTarget: fc.oneof(fc.constantFrom('this_month' as const, 'next_month' as const), fc.constant(null)),
});

const executionLogEntryArb = fc.record({
  timestamp: isoDateTimeArb,
  triggerDescription: fc.string({ minLength: 1, maxLength: 200 }),
  actionDescription: fc.string({ minLength: 1, maxLength: 200 }),
  taskName: fc.string({ minLength: 1, maxLength: 200 }),
});

const automationRuleArb = fc.record({
  id: idArb,
  projectId: idArb,
  name: fc.string({ minLength: 1, maxLength: 200 }),
  trigger: triggerArb,
  action: actionArb,
  filters: fc.constant([]), // Phase 3: empty filters array for now
  enabled: fc.boolean(),
  brokenReason: fc.oneof(fc.string({ minLength: 1, maxLength: 100 }), fc.constant(null)),
  executionCount: fc.nat(),
  lastExecutedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
  recentExecutions: fc.array(executionLogEntryArb, { minLength: 0, maxLength: 5 }),
  order: fc.integer(),
  createdAt: isoDateTimeArb,
  updatedAt: isoDateTimeArb,
  bulkPausedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
}) as fc.Arbitrary<AutomationRule>;

describe('LocalStorageAutomationRuleRepository', () => {
  let localStorageMock: LocalStorageMock;

  beforeEach(() => {
    localStorageMock = new LocalStorageMock();
    global.localStorage = localStorageMock as any;
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  // Unit tests for schema migration
  describe('Schema Migration', () => {
    it('should add empty filters array to Phase 1/2 rules missing the field', () => {
      // Create a Phase 1/2 rule without filters field
      const phase1Rule = {
        id: 'rule-1',
        projectId: 'project-1',
        name: 'Test Rule',
        trigger: {
          type: 'card_moved_into_section',
          sectionId: 'section-1',
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
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Store the Phase 1/2 rule directly in localStorage
      localStorageMock.setItem('task-management-automations', JSON.stringify([phase1Rule]));

      // Create repository instance (triggers migration)
      const repo = new LocalStorageAutomationRuleRepository();

      // Retrieve the rule
      const rules = repo.findAll();
      expect(rules.length).toBe(1);
      expect(rules[0].filters).toEqual([]);
    });

    it('should add null defaults for new action fields', () => {
      // Create a Phase 1/2 rule without new action fields
      const phase1Rule = {
        id: 'rule-1',
        projectId: 'project-1',
        name: 'Test Rule',
        trigger: {
          type: 'card_moved_into_section',
          sectionId: 'section-1',
        },
        action: {
          type: 'set_due_date',
          sectionId: null,
          dateOption: 'tomorrow',
          position: null,
          // Missing: cardTitle, cardDateOption, specificMonth, specificDay, monthTarget
        },
        enabled: true,
        brokenReason: null,
        executionCount: 0,
        lastExecutedAt: null,
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Store the Phase 1/2 rule directly in localStorage
      localStorageMock.setItem('task-management-automations', JSON.stringify([phase1Rule]));

      // Create repository instance (triggers migration)
      const repo = new LocalStorageAutomationRuleRepository();

      // Retrieve the rule
      const rules = repo.findAll();
      expect(rules.length).toBe(1);
      expect(rules[0].action.cardTitle).toBeNull();
      expect(rules[0].action.cardDateOption).toBeNull();
      expect(rules[0].action.specificMonth).toBeNull();
      expect(rules[0].action.specificDay).toBeNull();
      expect(rules[0].action.monthTarget).toBeNull();
    });

    it('should preserve all existing field values unchanged', () => {
      // Create a Phase 1/2 rule with all existing fields
      const phase1Rule = {
        id: 'rule-1',
        projectId: 'project-1',
        name: 'Test Rule',
        trigger: {
          type: 'card_moved_into_section',
          sectionId: 'section-1',
        },
        action: {
          type: 'move_card_to_top_of_section',
          sectionId: 'section-2',
          dateOption: 'today',
          position: 'top',
        },
        enabled: false,
        brokenReason: 'section_deleted',
        executionCount: 42,
        lastExecutedAt: '2024-01-15T12:00:00.000Z',
        order: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-10T00:00:00.000Z',
      };

      // Store the Phase 1/2 rule directly in localStorage
      localStorageMock.setItem('task-management-automations', JSON.stringify([phase1Rule]));

      // Create repository instance (triggers migration)
      const repo = new LocalStorageAutomationRuleRepository();

      // Retrieve the rule
      const rules = repo.findAll();
      expect(rules.length).toBe(1);
      
      // Verify all original fields are preserved
      expect(rules[0].id).toBe('rule-1');
      expect(rules[0].projectId).toBe('project-1');
      expect(rules[0].name).toBe('Test Rule');
      expect(rules[0].trigger.type).toBe('card_moved_into_section');
      expect(rules[0].trigger.sectionId).toBe('section-1');
      expect(rules[0].action.type).toBe('move_card_to_top_of_section');
      expect(rules[0].action.sectionId).toBe('section-2');
      expect(rules[0].action.dateOption).toBe('today');
      expect(rules[0].action.position).toBe('top');
      expect(rules[0].enabled).toBe(false);
      expect(rules[0].brokenReason).toBe('section_deleted');
      expect(rules[0].executionCount).toBe(42);
      expect(rules[0].lastExecutedAt).toBe('2024-01-15T12:00:00.000Z');
      expect(rules[0].order).toBe(5);
      expect(rules[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(rules[0].updatedAt).toBe('2024-01-10T00:00:00.000Z');
    });

    it('should add empty recentExecutions array to Phase 3 rules missing the field', () => {
      // Create a Phase 3 rule without recentExecutions field
      const phase3Rule = {
        id: 'rule-1',
        projectId: 'project-1',
        name: 'Test Rule',
        trigger: {
          type: 'card_moved_into_section',
          sectionId: 'section-1',
        },
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
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        // Missing: recentExecutions
      };

      localStorageMock.setItem('task-management-automations', JSON.stringify([phase3Rule]));

      const repo = new LocalStorageAutomationRuleRepository();
      const rules = repo.findAll();
      expect(rules.length).toBe(1);
      expect(rules[0].recentExecutions).toEqual([]);
    });

    it('should preserve existing recentExecutions when already present', () => {
      const existingEntries = [
        {
          timestamp: '2024-06-01T10:00:00.000Z',
          triggerDescription: 'Card moved into Done',
          actionDescription: 'Marked as complete',
          taskName: 'My Task',
        },
      ];

      const ruleWithExecutions = {
        id: 'rule-1',
        projectId: 'project-1',
        name: 'Test Rule',
        trigger: {
          type: 'card_moved_into_section',
          sectionId: 'section-1',
        },
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
        executionCount: 1,
        lastExecutedAt: '2024-06-01T10:00:00.000Z',
        recentExecutions: existingEntries,
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      localStorageMock.setItem('task-management-automations', JSON.stringify([ruleWithExecutions]));

      const repo = new LocalStorageAutomationRuleRepository();
      const rules = repo.findAll();
      expect(rules.length).toBe(1);
      expect(rules[0].recentExecutions).toEqual(existingEntries);
    });

    it('should not modify Phase 3 rules that already have all fields', () => {
      // Create a Phase 3 rule with all fields
      const phase3Rule = {
        id: 'rule-1',
        projectId: 'project-1',
        name: 'Test Rule',
        trigger: {
          type: 'card_created_in_section',
          sectionId: 'section-1',
        },
        filters: [
          { type: 'has_due_date' },
          { type: 'in_section', sectionId: 'section-2' },
        ],
        action: {
          type: 'create_card',
          sectionId: 'section-3',
          dateOption: null,
          position: null,
          cardTitle: 'New Task',
          cardDateOption: 'tomorrow',
          specificMonth: 12,
          specificDay: 25,
          monthTarget: 'next_month',
        },
        enabled: true,
        brokenReason: null,
        executionCount: 0,
        lastExecutedAt: null,
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Store the Phase 3 rule directly in localStorage
      localStorageMock.setItem('task-management-automations', JSON.stringify([phase3Rule]));

      // Create repository instance (triggers migration)
      const repo = new LocalStorageAutomationRuleRepository();

      // Retrieve the rule
      const rules = repo.findAll();
      expect(rules.length).toBe(1);
      
      // Verify all fields are preserved exactly
      expect(rules[0]).toEqual({ ...phase3Rule, recentExecutions: [], bulkPausedAt: null });
    });

    it('should handle multiple rules with mixed Phase 1/2 and Phase 3 schemas', () => {
      const phase1Rule = {
        id: 'rule-1',
        projectId: 'project-1',
        name: 'Phase 1 Rule',
        trigger: { type: 'card_moved_into_section', sectionId: 'section-1' },
        action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null },
        enabled: true,
        brokenReason: null,
        executionCount: 0,
        lastExecutedAt: null,
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const phase3Rule = {
        id: 'rule-2',
        projectId: 'project-1',
        name: 'Phase 3 Rule',
        trigger: { type: 'card_created_in_section', sectionId: 'section-2' },
        filters: [{ type: 'has_due_date' }],
        action: {
          type: 'create_card',
          sectionId: 'section-3',
          dateOption: null,
          position: null,
          cardTitle: 'New Task',
          cardDateOption: 'tomorrow',
          specificMonth: null,
          specificDay: null,
          monthTarget: null,
        },
        enabled: true,
        brokenReason: null,
        executionCount: 0,
        lastExecutedAt: null,
        order: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Store both rules
      localStorageMock.setItem('task-management-automations', JSON.stringify([phase1Rule, phase3Rule]));

      // Create repository instance (triggers migration)
      const repo = new LocalStorageAutomationRuleRepository();

      // Retrieve the rules
      const rules = repo.findAll();
      expect(rules.length).toBe(2);

      // Phase 1 rule should have been migrated
      const migratedPhase1 = rules.find(r => r.id === 'rule-1');
      expect(migratedPhase1?.filters).toEqual([]);
      expect(migratedPhase1?.action.cardTitle).toBeNull();

      // Phase 3 rule should be unchanged
      const unchangedPhase3 = rules.find(r => r.id === 'rule-2');
      expect(unchangedPhase3).toEqual({ ...phase3Rule, recentExecutions: [], bulkPausedAt: null });
    });
  });

  // Feature: automations-filters-dates, Property 20: Schema migration preserves existing data and adds defaults
  // **Validates: Requirements 12.1, 12.2**
  describe('Property 20: Schema migration preserves existing data and adds defaults', () => {
    // Arbitrary for Phase 1/2 rules (without filters and new action fields)
    const phase1ActionArb = fc.record({
      type: actionTypeArb,
      sectionId: fc.oneof(idArb, fc.constant(null)),
      dateOption: fc.oneof(relativeDateOptionArb, fc.constant(null)),
      position: fc.oneof(positionArb, fc.constant(null)),
      // Intentionally omit: cardTitle, cardDateOption, specificMonth, specificDay, monthTarget
    });

    const phase1RuleArb = fc.record({
      id: idArb,
      projectId: idArb,
      name: fc.string({ minLength: 1, maxLength: 200 }),
      trigger: triggerArb,
      action: phase1ActionArb,
      // Intentionally omit: filters
      enabled: fc.boolean(),
      brokenReason: fc.oneof(fc.string({ minLength: 1, maxLength: 100 }), fc.constant(null)),
      executionCount: fc.nat(),
      lastExecutedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
      order: fc.integer(),
      createdAt: isoDateTimeArb,
      updatedAt: isoDateTimeArb,
    });

    it('for any valid Phase 1/2 rule object (without filters field and without new action fields), running the migration function SHALL produce a valid Phase 3 rule where: (a) the filters array is empty, (b) all original field values are preserved unchanged, (c) new action fields default to null', () => {
      fc.assert(
        fc.property(phase1RuleArb, (phase1Rule) => {
          // Clear localStorage before each test
          localStorageMock.clear();

          // Store the Phase 1/2 rule directly in localStorage (bypassing validation)
          localStorageMock.setItem('task-management-automations', JSON.stringify([phase1Rule]));

          // Create repository instance (triggers migration)
          const repo = new LocalStorageAutomationRuleRepository();

          // Retrieve the migrated rule
          const rules = repo.findAll();

          // Should have exactly one rule
          expect(rules.length).toBe(1);
          const migratedRule = rules[0];

          // (a) The filters array should be empty
          expect(migratedRule.filters).toEqual([]);

          // (b) All original field values should be preserved unchanged
          expect(migratedRule.id).toBe(phase1Rule.id);
          expect(migratedRule.projectId).toBe(phase1Rule.projectId);
          expect(migratedRule.name).toBe(phase1Rule.name);
          expect(migratedRule.trigger).toEqual(phase1Rule.trigger);
          expect(migratedRule.enabled).toBe(phase1Rule.enabled);
          expect(migratedRule.brokenReason).toBe(phase1Rule.brokenReason);
          expect(migratedRule.executionCount).toBe(phase1Rule.executionCount);
          expect(migratedRule.lastExecutedAt).toBe(phase1Rule.lastExecutedAt);
          expect(migratedRule.order).toBe(phase1Rule.order);
          expect(migratedRule.createdAt).toBe(phase1Rule.createdAt);
          expect(migratedRule.updatedAt).toBe(phase1Rule.updatedAt);

          // Original action fields should be preserved
          expect(migratedRule.action.type).toBe(phase1Rule.action.type);
          expect(migratedRule.action.sectionId).toBe(phase1Rule.action.sectionId);
          expect(migratedRule.action.dateOption).toBe(phase1Rule.action.dateOption);
          expect(migratedRule.action.position).toBe(phase1Rule.action.position);

          // (c) New action fields should default to null
          expect(migratedRule.action.cardTitle).toBeNull();
          expect(migratedRule.action.cardDateOption).toBeNull();
          expect(migratedRule.action.specificMonth).toBeNull();
          expect(migratedRule.action.specificDay).toBeNull();
          expect(migratedRule.action.monthTarget).toBeNull();
        }),
        { numRuns: 100 },
      );
    });
  });

  // Feature: automations-foundation, Property 2: Repository persistence round-trip
  // **Validates: Requirements 2.1, 2.3, 2.5**
  describe('Property 2: Repository persistence round-trip', () => {
    it('for any set of valid AutomationRule objects, creating them in the repository, then constructing a new repository instance, SHALL restore the exact same set of rules', () => {
      fc.assert(
        fc.property(fc.array(automationRuleArb, { minLength: 0, maxLength: 20 }), (rules) => {
          // Clear localStorage before each test
          localStorageMock.clear();

          // Ensure unique IDs to avoid conflicts
          const uniqueRules = rules.map((rule, index) => ({
            ...rule,
            id: `${rule.id}-${index}`,
          }));

          // Create first repository instance and add rules
          const repo1 = new LocalStorageAutomationRuleRepository();
          
          for (const rule of uniqueRules) {
            repo1.create(rule);
          }

          // Get all rules from first instance
          const rulesFromRepo1 = repo1.findAll();

          // Create a new repository instance (simulating app reload)
          const repo2 = new LocalStorageAutomationRuleRepository();

          // Get all rules from second instance
          const rulesFromRepo2 = repo2.findAll();

          // Both should have the same rules
          expect(rulesFromRepo2).toEqual(rulesFromRepo1);
          expect(rulesFromRepo2.length).toBe(uniqueRules.length);

          // Verify each rule is present
          for (const rule of uniqueRules) {
            const foundInRepo2 = repo2.findById(rule.id);
            expect(foundInRepo2).toBeDefined();
            expect(foundInRepo2).toEqual(rule);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // Feature: automations-foundation, Property 3: Repository findByProjectId filter invariant
  // **Validates: Requirements 2.2**
  describe('Property 3: Repository findByProjectId filter invariant', () => {
    it('for any set of AutomationRule objects across multiple projects, findByProjectId(projectId) SHALL return exactly those rules whose projectId matches, and no others', () => {
      fc.assert(
        fc.property(
          fc.array(automationRuleArb, { minLength: 1, maxLength: 30 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (rules, targetProjectId) => {
            // Clear localStorage before each test
            localStorageMock.clear();

            // Ensure unique IDs to avoid conflicts
            const uniqueRules = rules.map((rule, index) => ({
              ...rule,
              id: `${rule.id}-${index}`,
            }));

            const repo = new LocalStorageAutomationRuleRepository();

            // Create all rules
            for (const rule of uniqueRules) {
              repo.create(rule);
            }

            // Query for specific project
            const filteredRules = repo.findByProjectId(targetProjectId);

            // Count expected matches
            const expectedMatches = uniqueRules.filter(r => r.projectId === targetProjectId);

            // Verify count matches
            expect(filteredRules.length).toBe(expectedMatches.length);

            // Verify all returned rules have the target projectId
            for (const rule of filteredRules) {
              expect(rule.projectId).toBe(targetProjectId);
            }

            // Verify all expected rules are present
            for (const expectedRule of expectedMatches) {
              const found = filteredRules.find(r => r.id === expectedRule.id);
              expect(found).toBeDefined();
              expect(found).toEqual(expectedRule);
            }

            // Verify no rules from other projects are included
            const otherProjectRules = uniqueRules.filter(r => r.projectId !== targetProjectId);
            for (const otherRule of otherProjectRules) {
              const found = filteredRules.find(r => r.id === otherRule.id);
              expect(found).toBeUndefined();
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: automations-foundation, Property 4: Repository subscriber notification
  // **Validates: Requirements 2.4**
  describe('Property 4: Repository subscriber notification', () => {
    it('for any rule creation operation, all registered subscriber callbacks SHALL be invoked with the updated complete rule list', () => {
      fc.assert(
        fc.property(
          fc.array(automationRuleArb, { minLength: 1, maxLength: 10 }),
          (rules) => {
            // Clear localStorage before each test
            localStorageMock.clear();

            // Ensure unique IDs to avoid conflicts
            const uniqueRules = rules.map((rule, index) => ({
              ...rule,
              id: `${rule.id}-${index}`,
            }));

            const repo = new LocalStorageAutomationRuleRepository();

            // Track subscriber invocations
            const subscriber1Calls: AutomationRule[][] = [];
            const subscriber2Calls: AutomationRule[][] = [];

            // Register two subscribers
            const unsubscribe1 = repo.subscribe((ruleList) => {
              subscriber1Calls.push([...ruleList]);
            });

            const unsubscribe2 = repo.subscribe((ruleList) => {
              subscriber2Calls.push([...ruleList]);
            });

            // Both subscribers should be called immediately with empty list
            expect(subscriber1Calls.length).toBe(1);
            expect(subscriber2Calls.length).toBe(1);
            expect(subscriber1Calls[0]).toEqual([]);
            expect(subscriber2Calls[0]).toEqual([]);

            // Create each rule and verify subscribers are notified
            for (let i = 0; i < uniqueRules.length; i++) {
              repo.create(uniqueRules[i]);

              // Both subscribers should have been called again
              expect(subscriber1Calls.length).toBe(i + 2);
              expect(subscriber2Calls.length).toBe(i + 2);

              // The latest call should contain all rules created so far
              const latestCall1 = subscriber1Calls[subscriber1Calls.length - 1];
              const latestCall2 = subscriber2Calls[subscriber2Calls.length - 1];

              expect(latestCall1.length).toBe(i + 1);
              expect(latestCall2.length).toBe(i + 1);

              // Verify the rule list contains all created rules
              for (let j = 0; j <= i; j++) {
                expect(latestCall1.find(r => r.id === uniqueRules[j].id)).toBeDefined();
                expect(latestCall2.find(r => r.id === uniqueRules[j].id)).toBeDefined();
              }
            }

            // Clean up
            unsubscribe1();
            unsubscribe2();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('for any rule update operation, all registered subscriber callbacks SHALL be invoked with the updated complete rule list', () => {
      fc.assert(
        fc.property(
          automationRuleArb,
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.boolean(),
          (rule, newName, newEnabled) => {
            // Clear localStorage before each test
            localStorageMock.clear();

            const repo = new LocalStorageAutomationRuleRepository();

            // Create initial rule
            repo.create(rule);

            // Track subscriber invocations
            const subscriberCalls: AutomationRule[][] = [];

            // Register subscriber (will be called immediately with current state)
            const unsubscribe = repo.subscribe((ruleList) => {
              subscriberCalls.push([...ruleList]);
            });

            // Should have been called once immediately
            expect(subscriberCalls.length).toBe(1);
            const initialCallCount = subscriberCalls.length;

            // Update the rule
            repo.update(rule.id, { name: newName, enabled: newEnabled });

            // Subscriber should have been called again
            expect(subscriberCalls.length).toBe(initialCallCount + 1);

            // The latest call should contain the updated rule
            const latestCall = subscriberCalls[subscriberCalls.length - 1];
            expect(latestCall.length).toBe(1);
            expect(latestCall[0].id).toBe(rule.id);
            expect(latestCall[0].name).toBe(newName);
            expect(latestCall[0].enabled).toBe(newEnabled);

            // Clean up
            unsubscribe();
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
