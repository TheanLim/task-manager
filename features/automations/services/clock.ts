/**
 * Injectable clock abstraction for deterministic testing.
 * Production uses SystemClock. Tests inject FakeClock.
 */
export interface Clock {
  /** Epoch milliseconds, equivalent to Date.now() */
  now(): number;
  /** Equivalent to new Date() */
  toDate(): Date;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
  toDate(): Date {
    return new Date();
  }
}

/**
 * Fake clock for testing. Advances manually.
 * Supports advance() and set() for deterministic time control.
 */
export class FakeClock implements Clock {
  private currentTime: number;

  constructor(initialTime: number | Date = 0) {
    this.currentTime =
      typeof initialTime === 'number' ? initialTime : initialTime.getTime();
  }

  now(): number {
    return this.currentTime;
  }

  toDate(): Date {
    return new Date(this.currentTime);
  }

  /** Advance time by N milliseconds */
  advance(ms: number): void {
    this.currentTime += ms;
  }

  /** Set time to a specific point */
  set(time: number | Date): void {
    this.currentTime = typeof time === 'number' ? time : time.getTime();
  }
}
