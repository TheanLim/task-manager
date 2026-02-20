/**
 * Format automation rule execution messages for toast notifications.
 * 
 * Validates Requirements: 11.1, 11.2
 */

export interface RuleExecutionParams {
  ruleName: string;
  taskDescription: string;
  batchSize: number;
}

/**
 * Format a toast message for automation rule execution.
 * 
 * - Single execution (batchSize === 1): "⚡ Automation: [rule name] ran on [task description]"
 * - Batch execution (batchSize > 1): "⚡ Automation: [rule name] ran on X tasks"
 */
export function formatAutomationToastMessage(params: RuleExecutionParams): string {
  const { ruleName, taskDescription, batchSize } = params;

  if (batchSize === 1) {
    return `⚡ Automation: ${ruleName} ran on ${taskDescription}`;
  } else {
    return `⚡ Automation: ${ruleName} ran on ${batchSize} tasks`;
  }
}
