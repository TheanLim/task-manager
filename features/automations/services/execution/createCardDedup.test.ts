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
  it('returns (intervalMinutes - 1) * 60 * 1000 for scheduled_interval', () => {
    expect(getLookbackMs('scheduled_interval', 30)).toBe(29 * 60 * 1000);
    expect(getLookbackMs('scheduled_interval', 60)).toBe(59 * 60 * 1000);
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

describe('dedup does NOT block legitimate next-interval fires', () => {
  it('task created exactly at the interval boundary is NOT considered a duplicate', () => {
    // 5-minute interval rule. Card created 5 minutes ago.
    // The next fire at T+5min should NOT be blocked by dedup.
    const intervalMinutes = 5;
    const lookbackMs = getLookbackMs('scheduled_interval', intervalMinutes);
    const fiveMinAgo = new Date(NOW - intervalMinutes * 60 * 1000).toISOString();

    const tasks = [
      {
        description: 'Standup — 2026-02-19',
        sectionId: 'sec-1',
        createdAt: fiveMinAgo,
      },
    ];

    // At T+5min, the card from T+0 should NOT block the new card
    expect(shouldSkipCreateCard('Standup — 2026-02-19', 'sec-1', tasks, lookbackMs, NOW)).toBe(false);
  });

  it('task created well within the reduced lookback window IS still considered a duplicate', () => {
    // Card created 2 minutes ago — well within the 4-minute lookback (5min interval - 1 tick)
    const intervalMinutes = 5;
    const lookbackMs = getLookbackMs('scheduled_interval', intervalMinutes);
    const twoMinAgo = new Date(NOW - 2 * 60 * 1000).toISOString();

    const tasks = [
      {
        description: 'Standup — 2026-02-19',
        sectionId: 'sec-1',
        createdAt: twoMinAgo,
      },
    ];

    expect(shouldSkipCreateCard('Standup — 2026-02-19', 'sec-1', tasks, lookbackMs, NOW)).toBe(true);
  });
});

describe('getLookbackMs accounts for tick jitter', () => {
  it('interval lookback is interval minus one tick (60s) to avoid blocking next fire', () => {
    // 5-minute interval: lookback should be 4 minutes, not 5
    expect(getLookbackMs('scheduled_interval', 5)).toBe(4 * 60 * 1000);
  });

  it('10-minute interval: lookback is 9 minutes', () => {
    expect(getLookbackMs('scheduled_interval', 10)).toBe(9 * 60 * 1000);
  });

  it('minimum 5-minute interval: lookback is 4 minutes', () => {
    expect(getLookbackMs('scheduled_interval', 5)).toBe(4 * 60 * 1000);
  });

  it('cron lookback unchanged at 24h', () => {
    expect(getLookbackMs('scheduled_cron')).toBe(24 * 60 * 60 * 1000);
  });
});

describe('Regression: getLookbackMs with undefined intervalMinutes', () => {
  it('returns 24h fallback when intervalMinutes is undefined (BUG)', () => {
    // This is the actual call path: triggeringEvent.changes.intervalMinutes is undefined
    // because onScheduledRuleFired doesn't include it in the event
    const result = getLookbackMs('scheduled_interval', undefined);
    // BUG: returns 24h instead of a reasonable interval-based lookback
    // After fix: should still return a reasonable value, not 24h
    expect(result).not.toBe(24 * 60 * 60 * 1000);
  });
});
