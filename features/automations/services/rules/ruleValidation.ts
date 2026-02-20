/**
 * Validation for one-time rule re-enable.
 *
 * Pure function — no side effects, no store imports.
 * Used by the UI when saving a rule to block re-enabling a one-time rule
 * whose fireAt is in the past.
 */

interface OneTimeTriggerInput {
  type: 'scheduled_one_time';
  schedule: { kind: 'one_time'; fireAt: string };
}

type TriggerInput = OneTimeTriggerInput | { type: string };

type ValidationResult = { valid: true } | { valid: false; error: string };

/**
 * Validates that a one-time rule is not re-enabled with a past fireAt.
 *
 * @param trigger - The trigger configuration being saved
 * @param enabled - Whether the rule is being saved as enabled
 * @param nowMs - Current time in epoch milliseconds
 * @returns Validation result — valid or error message
 */
export function validateOneTimeReEnable(
  trigger: TriggerInput,
  enabled: boolean,
  nowMs: number
): ValidationResult {
  if (trigger.type !== 'scheduled_one_time') {
    return { valid: true };
  }

  if (!enabled) {
    return { valid: true };
  }

  const { fireAt } = (trigger as OneTimeTriggerInput).schedule;
  const fireAtMs = new Date(fireAt).getTime();

  if (fireAtMs < nowMs) {
    return {
      valid: false,
      error: 'Update the fire date to a future time before re-enabling this rule.',
    };
  }

  return { valid: true };
}
