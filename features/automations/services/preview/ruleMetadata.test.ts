import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TRIGGER_META, FILTER_META, formatFilterLabel } from './ruleMetadata';
import { formatFilterDescription } from './formatters';
import type { CardFilter } from '../../types';
import { isScheduledTrigger } from '../../types';
import { TriggerSchema } from '../../schemas';

describe('ruleMetadata — filter metadata', () => {
  const newFilterTypes = [
    'created_more_than',
    'completed_more_than',
    'last_updated_more_than',
    'not_modified_in',
    'overdue_by_more_than',
    'in_section_for_more_than',
  ] as const;

  describe('FILTER_META entries', () => {
    it.each(newFilterTypes)('has a metadata entry for %s', (filterType) => {
      const meta = FILTER_META.find((m) => m.type === filterType);
      expect(meta).toBeDefined();
      expect(meta!.label).toBeTruthy();
      expect(typeof meta!.label).toBe('string');
    });

    it('created_more_than has correct label', () => {
      const meta = FILTER_META.find((m) => m.type === 'created_more_than');
      expect(meta!.label).toBe('Created more than...');
    });

    it('completed_more_than has correct label', () => {
      const meta = FILTER_META.find((m) => m.type === 'completed_more_than');
      expect(meta!.label).toBe('Completed more than...');
    });

    it('last_updated_more_than has correct label', () => {
      const meta = FILTER_META.find((m) => m.type === 'last_updated_more_than');
      expect(meta!.label).toBe('Not updated in...');
    });

    it('not_modified_in has correct label', () => {
      const meta = FILTER_META.find((m) => m.type === 'not_modified_in');
      expect(meta!.label).toBe('Not modified in...');
    });

    it('overdue_by_more_than has correct label', () => {
      const meta = FILTER_META.find((m) => m.type === 'overdue_by_more_than');
      expect(meta!.label).toBe('Overdue by more than...');
    });

    it('in_section_for_more_than has correct label', () => {
      const meta = FILTER_META.find((m) => m.type === 'in_section_for_more_than');
      expect(meta!.label).toBe('In current section for more than...');
    });
  });

  describe('formatFilterLabel', () => {
    it.each(newFilterTypes)('returns a non-empty label for %s', (filterType) => {
      const label = formatFilterLabel(filterType);
      expect(label).toBeTruthy();
    });
  });

  describe('filter descriptions (formatFilterDescription)', () => {
    const noopSectionLookup = () => undefined;

    it('created_more_than: "created more than 5 days ago"', () => {
      const filter: CardFilter = { type: 'created_more_than', value: 5, unit: 'days' };
      expect(formatFilterDescription(filter, noopSectionLookup)).toBe('created more than 5 days ago');
    });

    it('completed_more_than: "completed more than 30 days ago"', () => {
      const filter: CardFilter = { type: 'completed_more_than', value: 30, unit: 'days' };
      expect(formatFilterDescription(filter, noopSectionLookup)).toBe('completed more than 30 days ago');
    });

    it('last_updated_more_than: "not updated in 7 days"', () => {
      const filter: CardFilter = { type: 'last_updated_more_than', value: 7, unit: 'days' };
      expect(formatFilterDescription(filter, noopSectionLookup)).toBe('not updated in 7 days');
    });

    it('not_modified_in: "not modified in 7 days"', () => {
      const filter: CardFilter = { type: 'not_modified_in', value: 7, unit: 'days' };
      expect(formatFilterDescription(filter, noopSectionLookup)).toBe('not modified in 7 days');
    });

    it('overdue_by_more_than: "overdue by more than 3 days"', () => {
      const filter: CardFilter = { type: 'overdue_by_more_than', value: 3, unit: 'days' };
      expect(formatFilterDescription(filter, noopSectionLookup)).toBe('overdue by more than 3 days');
    });

    it('in_section_for_more_than: "in current section for more than 5 days"', () => {
      const filter: CardFilter = { type: 'in_section_for_more_than', value: 5, unit: 'days' };
      expect(formatFilterDescription(filter, noopSectionLookup)).toBe('in current section for more than 5 days');
    });
  });
});


// ============================================================================
// Feature: scheduled-triggers-phase-5c — One-time trigger metadata
// **Validates: Requirements 8.1, 9.1, 9.2**
// ============================================================================

describe('ruleMetadata — scheduled_one_time trigger metadata', () => {
  it('TRIGGER_META includes scheduled_one_time with correct fields', () => {
    const meta = TRIGGER_META.find((m) => m.type === 'scheduled_one_time');
    expect(meta).toBeDefined();
    expect(meta!.category).toBe('scheduled');
    expect(meta!.label).toBe('at a specific date and time');
    expect(meta!.needsSection).toBe(false);
    expect(meta!.needsSchedule).toBe(true);
  });
});

// ============================================================================
// Feature: scheduled-triggers-phase-5c, Property 10: Scheduled rule limit includes one-time
// **Validates: Requirements 9.1, 9.2**
// ============================================================================

describe('Property 10: Scheduled rule limit includes one-time', () => {
  const scheduledTriggerTypeArb = fc.constantFrom(
    'scheduled_interval',
    'scheduled_cron',
    'scheduled_due_date_relative',
    'scheduled_one_time'
  );

  const scheduledTriggerArb = fc.oneof(
    fc.constant({
      type: 'scheduled_interval' as const,
      sectionId: null,
      schedule: { kind: 'interval' as const, intervalMinutes: 60 },
      lastEvaluatedAt: null,
      catchUpPolicy: 'catch_up_latest' as const,
    }),
    fc.constant({
      type: 'scheduled_cron' as const,
      sectionId: null,
      schedule: { kind: 'cron' as const, hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] },
      lastEvaluatedAt: null,
      catchUpPolicy: 'catch_up_latest' as const,
    }),
    fc.constant({
      type: 'scheduled_due_date_relative' as const,
      sectionId: null,
      schedule: { kind: 'due_date_relative' as const, offsetMinutes: -1440, displayUnit: 'days' as const },
      lastEvaluatedAt: null,
      catchUpPolicy: 'catch_up_latest' as const,
    }),
    fc.constant({
      type: 'scheduled_one_time' as const,
      sectionId: null,
      schedule: { kind: 'one_time' as const, fireAt: '2025-03-15T15:00:00.000Z' },
      lastEvaluatedAt: null,
    })
  );

  it('isScheduledTrigger returns true for all scheduled trigger types including one-time', () => {
    fc.assert(
      fc.property(scheduledTriggerArb, (trigger) => {
        const parsed = TriggerSchema.parse(trigger);
        expect(isScheduledTrigger(parsed)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('12-rule limit counts scheduled_one_time — isScheduledTrigger returns true', () => {
    const oneTimeTrigger = TriggerSchema.parse({
      type: 'scheduled_one_time',
      sectionId: null,
      schedule: { kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' },
      lastEvaluatedAt: null,
    });
    expect(isScheduledTrigger(oneTimeTrigger)).toBe(true);
  });

  it('fired (disabled) one-time rule still has scheduled trigger type', () => {
    // Even after auto-disable, the trigger type is still scheduled_one_time
    const oneTimeTrigger = TriggerSchema.parse({
      type: 'scheduled_one_time',
      sectionId: null,
      schedule: { kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' },
      lastEvaluatedAt: '2025-03-15T15:00:01.000Z',
    });
    expect(isScheduledTrigger(oneTimeTrigger)).toBe(true);
  });
});
