import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FakeClock, SystemClock } from './clock';

describe('FakeClock', () => {
  // Feature: scheduled-triggers-phase-5a, Property 11: FakeClock advance/set consistency
  it('advance/set consistency — now() reflects initial + sum of advances', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 2_000_000_000_000 }), // initial time
        fc.array(fc.nat({ max: 100_000_000 }), { minLength: 1, maxLength: 20 }), // advances
        (initial, advances) => {
          const clock = new FakeClock(initial);
          let expected = initial;
          for (const ms of advances) {
            clock.advance(ms);
            expected += ms;
          }
          expect(clock.now()).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('set() overrides current time, subsequent advances are relative', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 2_000_000_000_000 }),
        fc.nat({ max: 2_000_000_000_000 }),
        fc.nat({ max: 100_000_000 }),
        (initial, setTime, advanceMs) => {
          const clock = new FakeClock(initial);
          clock.set(setTime);
          expect(clock.now()).toBe(setTime);
          clock.advance(advanceMs);
          expect(clock.now()).toBe(setTime + advanceMs);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('accepts Date objects for constructor and set()', () => {
    const date = new Date('2026-01-15T09:00:00.000Z');
    const clock = new FakeClock(date);
    expect(clock.now()).toBe(date.getTime());

    const newDate = new Date('2026-06-01T12:00:00.000Z');
    clock.set(newDate);
    expect(clock.now()).toBe(newDate.getTime());
  });

  it('toDate() returns a Date matching now()', () => {
    const clock = new FakeClock(1700000000000);
    const d = clock.toDate();
    expect(d.getTime()).toBe(1700000000000);
  });

  it('defaults to 0 when no initial time provided', () => {
    const clock = new FakeClock();
    expect(clock.now()).toBe(0);
  });
});

describe('SystemClock', () => {
  it('now() returns a value close to Date.now()', () => {
    const clock = new SystemClock();
    const before = Date.now();
    const result = clock.now();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it('toDate() returns a Date close to now', () => {
    const clock = new SystemClock();
    const before = Date.now();
    const d = clock.toDate();
    const after = Date.now();
    expect(d.getTime()).toBeGreaterThanOrEqual(before);
    expect(d.getTime()).toBeLessThanOrEqual(after);
  });
});
