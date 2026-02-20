import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateOneTimeReEnable } from './ruleValidation';

// ─── Generators ─────────────────────────────────────────────────────────

/** Generates a fireAt ISO datetime string in a reasonable range */
const fireAtArb = fc
  .date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') })
  .map((d) => d.toISOString());

/** Generates a nowMs epoch timestamp */
const nowMsArb = fc.integer({
  min: new Date('2024-01-01').getTime(),
  max: new Date('2030-12-31').getTime(),
});

// ─── Property Tests ─────────────────────────────────────────────────────

describe('validateOneTimeReEnable', () => {
  // Feature: scheduled-triggers-phase-5c, Property 11: Re-enable one-time with past fireAt is blocked
  // **Validates: Requirements 1.5**
  it('P11: re-enable one-time with past fireAt is blocked — fireAt < now + enabled: true → validation error', () => {
    fc.assert(
      fc.property(fireAtArb, nowMsArb, (fireAt, nowMs) => {
        const fireAtMs = new Date(fireAt).getTime();
        // Ensure fireAt is strictly in the past relative to nowMs
        const effectiveNowMs = fireAtMs + Math.abs(nowMs % 1_000_000_000) + 1;

        const result = validateOneTimeReEnable(
          { type: 'scheduled_one_time', schedule: { kind: 'one_time', fireAt } },
          true,
          effectiveNowMs
        );

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toContain('future');
        }
      }),
      { numRuns: 150 }
    );
  });

  // ─── Unit Tests ─────────────────────────────────────────────────────────

  it('rejects re-enabling a one-time rule with past fireAt', () => {
    const pastFireAt = '2024-01-01T10:00:00.000Z';
    const nowMs = new Date('2025-06-01T00:00:00.000Z').getTime();

    const result = validateOneTimeReEnable(
      { type: 'scheduled_one_time', schedule: { kind: 'one_time', fireAt: pastFireAt } },
      true,
      nowMs
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe(
        'Update the fire date to a future time before re-enabling this rule.'
      );
    }
  });

  it('allows re-enabling a one-time rule with future fireAt', () => {
    const futureFireAt = '2030-06-15T15:00:00.000Z';
    const nowMs = new Date('2025-06-01T00:00:00.000Z').getTime();

    const result = validateOneTimeReEnable(
      { type: 'scheduled_one_time', schedule: { kind: 'one_time', fireAt: futureFireAt } },
      true,
      nowMs
    );

    expect(result.valid).toBe(true);
  });

  it('allows re-enabling a one-time rule with updated future fireAt', () => {
    const updatedFireAt = '2030-12-25T09:00:00.000Z';
    const nowMs = new Date('2025-06-01T00:00:00.000Z').getTime();

    const result = validateOneTimeReEnable(
      { type: 'scheduled_one_time', schedule: { kind: 'one_time', fireAt: updatedFireAt } },
      true,
      nowMs
    );

    expect(result.valid).toBe(true);
  });

  it('skips validation when enabled is false (not re-enabling)', () => {
    const pastFireAt = '2024-01-01T10:00:00.000Z';
    const nowMs = new Date('2025-06-01T00:00:00.000Z').getTime();

    const result = validateOneTimeReEnable(
      { type: 'scheduled_one_time', schedule: { kind: 'one_time', fireAt: pastFireAt } },
      false,
      nowMs
    );

    expect(result.valid).toBe(true);
  });

  it('skips validation for non-one-time trigger types', () => {
    const nowMs = new Date('2025-06-01T00:00:00.000Z').getTime();

    const result = validateOneTimeReEnable(
      { type: 'scheduled_cron' } as any,
      true,
      nowMs
    );

    expect(result.valid).toBe(true);
  });
});
