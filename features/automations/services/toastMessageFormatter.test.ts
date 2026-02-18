import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatAutomationToastMessage } from './toastMessageFormatter';

describe('toastMessageFormatter', () => {
  describe('formatAutomationToastMessage', () => {
    it('should format single execution message correctly', () => {
      const result = formatAutomationToastMessage({
        ruleName: 'Move to Done',
        taskDescription: 'Complete the report',
        batchSize: 1,
      });

      expect(result).toBe('⚡ Automation: Move to Done ran on Complete the report');
    });

    it('should format batch execution message correctly', () => {
      const result = formatAutomationToastMessage({
        ruleName: 'Archive completed tasks',
        taskDescription: '', // Not used for batch
        batchSize: 5,
      });

      expect(result).toBe('⚡ Automation: Archive completed tasks ran on 5 tasks');
    });

    /**
     * Property 15: Toast message format for executions
     * 
     * **Validates: Requirements 11.1, 11.2**
     * 
     * For any rule execution result with a rule name and task description, the toast message
     * should follow the format "⚡ Automation: [rule name] ran on [task description]" for
     * single executions, and "⚡ Automation: [rule name] ran on X tasks" for batch executions
     * where X > 1.
     */
    it('Property 15: toast message format for executions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }), // ruleName
          fc.string({ minLength: 1, maxLength: 200 }), // taskDescription
          fc.integer({ min: 1, max: 100 }), // batchSize
          (ruleName, taskDescription, batchSize) => {
            const result = formatAutomationToastMessage({
              ruleName,
              taskDescription,
              batchSize,
            });

            // All messages should start with the automation emoji and prefix
            expect(result).toMatch(/^⚡ Automation: /);

            // All messages should contain the rule name
            expect(result).toContain(ruleName);

            if (batchSize === 1) {
              // Single execution: should contain task description and "ran on"
              expect(result).toContain('ran on');
              expect(result).toContain(taskDescription);
              expect(result).toBe(`⚡ Automation: ${ruleName} ran on ${taskDescription}`);
            } else {
              // Batch execution: should contain batch size and "tasks"
              expect(result).toContain('ran on');
              expect(result).toContain(`${batchSize} tasks`);
              expect(result).toBe(`⚡ Automation: ${ruleName} ran on ${batchSize} tasks`);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 15: message format is consistent and parseable', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.integer({ min: 1, max: 100 }),
          (ruleName, taskDescription, batchSize) => {
            const result = formatAutomationToastMessage({
              ruleName,
              taskDescription,
              batchSize,
            });

            // Message should be non-empty
            expect(result.length).toBeGreaterThan(0);

            // Message should follow a predictable structure
            const parts = result.split('ran on');
            expect(parts).toHaveLength(2);

            // First part should contain the emoji and rule name
            expect(parts[0]).toContain('⚡ Automation:');
            expect(parts[0]).toContain(ruleName);

            // Second part should contain either task description or batch count
            if (batchSize === 1) {
              expect(parts[1].trim()).toBe(taskDescription);
            } else {
              expect(parts[1].trim()).toBe(`${batchSize} tasks`);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
