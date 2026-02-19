import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { shouldSkipCreateCard, getLookbackMs } from './createCardDedup';

const NOW = new Date('2026-02-19T10:00:00.000Z').getTime();
const ONE_HOUR = 60 * 60 * 1000;

describe('shouldSkipCreateCard', () => {
  // Feature: scheduled-triggers-phase-5a, Property 17: create_card dedup heuristic
  it('P17: skips if same title exists in target section within lookback window', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 2, max: 24 * 60 * 60 * 1000 }), // lookback up to 24h
        (title, sectionId, lookbackMs) => {
          // Task created 1ms ago — well within any lookback window >= 2ms
          const tasks = [
            {
              description: title,
              sectionId,
              createdAt: new Date(NOW - 1).toISOString(),
            },
          ];
          expect(shouldSkipCreateCard(title, sectionId, tasks, lookbackMs, NOW)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('P17: does NOT skip if task is outside lookback window', () => {
    const tasks = [
      {
        description: 'Standup',
        sectionId: 'sec-1',
        createdAt: new Date(NOW - 2 * ONE_HOUR).toISOString(),
      },
    ];
    // Lookback is 1 hour — task was created 2 hours ago
    expect(shouldSkipCreateCard('Standup', 'sec-1', tasks, ONE_HOUR, NOW)).toBe(false);
  });

  it('does NOT skip if title differs', () => {
    const tasks = [
      {
        description: 'Standup',
        sectionId: 'sec-1',
        createdAt: new Date(NOW - 1000).toISOString(),
      },
    ];
    expect(shouldSkipCreateCard('Retro', 'sec-1', tasks, ONE_HOUR, NOW)).toBe(false);
  });

  it('does NOT skip if section differs', () => {
    const tasks = [
      {
        description: 'Standup',
        sectionId: 'sec-2',
        createdAt: new Date(NOW - 1000).toISOString(),
      },
    ];
    expect(shouldSkipCreateCard('Standup', 'sec-1', tasks, ONE_HOUR, NOW)).toBe(false);
  });

  it('does NOT skip when no tasks exist', () => {
    expect(shouldSkipCreateCard('Standup', 'sec-1', [], ONE_HOUR, NOW)).toBe(false);
  });
});

describe('getLookbackMs', () => {
  it('returns intervalMinutes * 60 * 1000 for scheduled_interval', () => {
    expect(getLookbackMs('scheduled_interval', 30)).toBe(30 * 60 * 1000);
    expect(getLookbackMs('scheduled_interval', 60)).toBe(60 * 60 * 1000);
  });

  it('returns 24h for cron triggers', () => {
    expect(getLookbackMs('scheduled_cron')).toBe(24 * 60 * 60 * 1000);
  });

  it('returns 24h for due_date_relative triggers', () => {
    expect(getLookbackMs('scheduled_due_date_relative')).toBe(24 * 60 * 60 * 1000);
  });

  it('returns 24h for event triggers (dedup not used, but safe fallback)', () => {
    expect(getLookbackMs('card_moved_into_section')).toBe(24 * 60 * 60 * 1000);
  });
});
