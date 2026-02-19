import { describe, it, expect } from 'vitest';
import { getPriorityVariant } from './priorityUtils';
import { Priority } from '@/types';

describe('getPriorityVariant', () => {
  it('returns "destructive" for HIGH priority', () => {
    expect(getPriorityVariant(Priority.HIGH)).toBe('destructive');
  });

  it('returns "default" for MEDIUM priority', () => {
    expect(getPriorityVariant(Priority.MEDIUM)).toBe('default');
  });

  it('returns "secondary" for LOW priority', () => {
    expect(getPriorityVariant(Priority.LOW)).toBe('secondary');
  });

  it('returns "outline" for NONE priority', () => {
    expect(getPriorityVariant(Priority.NONE)).toBe('outline');
  });

  it('returns "outline" for unknown priority string', () => {
    expect(getPriorityVariant('unknown')).toBe('outline');
  });

  it('returns "outline" for empty string', () => {
    expect(getPriorityVariant('')).toBe('outline');
  });
});
