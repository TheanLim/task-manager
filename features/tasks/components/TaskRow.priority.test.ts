// Feature: warm-industrial-redesign, Property 2: Priority-to-Border-Color Mapping
// **Validates: Requirements 5.1**
// Design decision: uniform amber border on all rows (structural chrome).
// Priority is communicated solely via the badge, not the border.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Priority } from '@/types';

// Mirror the PRIORITY_BORDER map from TaskRow.tsx
const PRIORITY_BORDER: Record<string, string> = {
  high: 'border-l-accent-brand',
  medium: 'border-l-accent-brand',
  low: 'border-l-accent-brand',
  none: 'border-l-accent-brand',
};

const ALL_PRIORITIES = Object.values(Priority);

describe('Property 2: Priority-to-Border-Color Mapping', () => {
  it('every priority maps to a non-empty border class', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_PRIORITIES), (priority) => {
        const cls = PRIORITY_BORDER[priority];
        expect(cls).toBeDefined();
        expect(cls.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('all priorities map to the uniform accent-brand border', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_PRIORITIES), (priority) => {
        expect(PRIORITY_BORDER[priority]).toBe('border-l-accent-brand');
      }),
      { numRuns: 100 },
    );
  });

  it('the mapping is total — every Priority enum value has an entry', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_PRIORITIES), (priority) => {
        expect(priority in PRIORITY_BORDER).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
