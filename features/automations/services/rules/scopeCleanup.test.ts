import { describe, it, expect } from 'vitest';
import { cleanExcludedProjectIds } from './scopeCleanup';

describe('cleanExcludedProjectIds', () => {
  it('scope changes to selected with selectedProjectIds [a,b]: removes c from excludedProjectIds', () => {
    const updates = {
      scope: 'selected',
      selectedProjectIds: ['a', 'b'],
    };
    const currentRule = {
      excludedProjectIds: ['a', 'b', 'c'],
    } as any;

    const result = cleanExcludedProjectIds(updates, currentRule);

    expect(result.excludedProjectIds).toEqual(['a', 'b']);
  });

  it('scope changes to selected with selectedProjectIds [a,b]: keeps a in excludedProjectIds', () => {
    const updates = {
      scope: 'selected',
      selectedProjectIds: ['a', 'b'],
    };
    const currentRule = {
      excludedProjectIds: ['a', 'c'],
    } as any;

    const result = cleanExcludedProjectIds(updates, currentRule);

    expect(result.excludedProjectIds).toEqual(['a']);
  });

  it('scope changes to all: excludedProjectIds unchanged', () => {
    const updates = {
      scope: 'all',
    };
    const currentRule = {
      excludedProjectIds: ['a', 'b', 'c'],
    } as any;

    const result = cleanExcludedProjectIds(updates, currentRule);

    expect(result.excludedProjectIds).toEqual(['a', 'b', 'c']);
  });

  it('updates without scope change: excludedProjectIds unchanged', () => {
    const updates = {
      name: 'Updated name',
    };
    const currentRule = {
      excludedProjectIds: ['a', 'b', 'c'],
    } as any;

    const result = cleanExcludedProjectIds(updates, currentRule);

    expect(result.excludedProjectIds).toEqual(['a', 'b', 'c']);
  });

  it('empty excludedProjectIds: returns empty array regardless', () => {
    const updates = {
      scope: 'selected',
      selectedProjectIds: ['a', 'b'],
    };
    const currentRule = {
      excludedProjectIds: [],
    } as any;

    const result = cleanExcludedProjectIds(updates, currentRule);

    expect(result.excludedProjectIds).toEqual([]);
  });

  it('no excludedProjectIds on currentRule: returns empty array', () => {
    const updates = {
      scope: 'selected',
      selectedProjectIds: ['a', 'b'],
    };
    const currentRule = {} as any;

    const result = cleanExcludedProjectIds(updates, currentRule);

    expect(result.excludedProjectIds).toEqual([]);
  });
});
