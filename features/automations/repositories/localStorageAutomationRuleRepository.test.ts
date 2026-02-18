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
});

const automationRuleArb = fc.record({
  id: idArb,
  projectId: idArb,
  name: fc.string({ minLength: 1, maxLength: 200 }),
  trigger: triggerArb,
  action: actionArb,
  enabled: fc.boolean(),
  brokenReason: fc.oneof(fc.string({ minLength: 1, maxLength: 100 }), fc.constant(null)),
  executionCount: fc.nat(),
  lastExecutedAt: fc.oneof(isoDateTimeArb, fc.constant(null)),
  order: fc.integer(),
  createdAt: isoDateTimeArb,
  updatedAt: isoDateTimeArb,
}) as fc.Arbitrary<AutomationRule>;

describe('LocalStorageAutomationRuleRepository Property Tests', () => {
  let localStorageMock: LocalStorageMock;

  beforeEach(() => {
    localStorageMock = new LocalStorageMock();
    global.localStorage = localStorageMock as any;
  });

  afterEach(() => {
    localStorageMock.clear();
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
