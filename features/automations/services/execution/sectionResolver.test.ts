import { describe, it, expect } from 'vitest';
import { findSectionByName, hasDuplicateSectionName } from './sectionResolver';
import type { Section } from '../../../schemas';

function makeSection(id: string, projectId: string | null, name: string, order: number = 0, createdAt: string = '2024-01-01T00:00:00.000Z'): Section {
  return {
    id,
    projectId,
    name,
    order,
    collapsed: false,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('findSectionByName', () => {
  const sections: Section[] = [
    makeSection('s1', 'p1', 'Todo', 0),
    makeSection('s2', 'p1', 'Done', 1),
    makeSection('s3', 'p1', 'In Progress', 2),
    makeSection('s4', 'p2', 'Todo', 0),
    makeSection('s5', 'p2', 'Review', 1),
  ];

  it('finds section by exact name match in correct project', () => {
    const result = findSectionByName('Done', 'p1', sections);
    expect(result).toEqual(sections[1]);
  });

  it('returns undefined when no section matches', () => {
    const result = findSectionByName('NonExistent', 'p1', sections);
    expect(result).toBeUndefined();
  });

  it('case-insensitive match', () => {
    expect(findSectionByName('done', 'p1', sections)).toEqual(sections[1]);
    expect(findSectionByName('DONE', 'p1', sections)).toEqual(sections[1]);
    expect(findSectionByName('dOnE', 'p1', sections)).toEqual(sections[1]);
  });

  it('trims whitespace before comparing', () => {
    expect(findSectionByName('  Done  ', 'p1', sections)).toEqual(sections[1]);
    expect(findSectionByName('\tTodo\n', 'p1', sections)).toEqual(sections[0]);
  });

  it('tiebreaker: returns oldest section when multiple sections share the same name', () => {
    const result = findSectionByName('Todo', 'p1', sections);
    expect(result).toEqual(sections[0]);
    expect(result?.id).toBe('s1');
  });

  it('does not match sections from other projects', () => {
    expect(findSectionByName('Todo', 'p1', sections)).not.toEqual(sections[3]);
    expect(findSectionByName('Review', 'p1', sections)).toBeUndefined();
  });

  it('property test: always returns a section from the correct project', () => {
    const testSections = [
      makeSection('a1', 'proj-a', 'Task', 0),
      makeSection('a2', 'proj-a', 'Task', 1),
      makeSection('b1', 'proj-b', 'Task', 0),
      makeSection('b2', 'proj-b', 'Task', 1),
    ];

    const results = ['task', 'TASK', ' Task ', 'task'].map(name =>
      findSectionByName(name, 'proj-a', testSections)
    );

    results.forEach(result => {
      expect(result).toBeDefined();
      expect(result?.projectId).toBe('proj-a');
    });
  });

  it('handles empty sections array', () => {
    expect(findSectionByName('Todo', 'p1', [])).toBeUndefined();
  });

  it('handles null projectId (global sections)', () => {
    const globalSections = [
      makeSection('g1', null, 'Global', 0),
      makeSection('g2', null, 'Global', 1),
    ];
    const result = findSectionByName('Global', null, globalSections);
    expect(result).toEqual(globalSections[0]);
  });
});

describe('hasDuplicateSectionName', () => {
  const sections: Section[] = [
    makeSection('s1', 'p1', 'Todo', 0),
    makeSection('s2', 'p1', 'Done', 1),
    makeSection('s3', 'p1', 'Todo', 2),
    makeSection('s4', 'p2', 'Todo', 0),
    makeSection('s5', 'p2', 'Review', 1),
  ];

  it('returns true when 2+ sections share a name in the same project', () => {
    expect(hasDuplicateSectionName('Todo', 'p1', sections)).toBe(true);
    expect(hasDuplicateSectionName('todo', 'p1', sections)).toBe(true);
    expect(hasDuplicateSectionName('  TODO  ', 'p1', sections)).toBe(true);
  });

  it('returns false for unique names', () => {
    expect(hasDuplicateSectionName('Done', 'p1', sections)).toBe(false);
    expect(hasDuplicateSectionName('Review', 'p2', sections)).toBe(false);
    expect(hasDuplicateSectionName('NonExistent', 'p1', sections)).toBe(false);
  });

  it('does not count sections from other projects', () => {
    expect(hasDuplicateSectionName('Todo', 'p1', sections)).toBe(true);
    expect(hasDuplicateSectionName('Todo', 'p2', sections)).toBe(false);
  });

  it('case-insensitive comparison', () => {
    expect(hasDuplicateSectionName('todo', 'p1', sections)).toBe(true);
    expect(hasDuplicateSectionName('DONE', 'p1', sections)).toBe(false);
  });

  it('trims whitespace before comparing', () => {
    expect(hasDuplicateSectionName('  Todo  ', 'p1', sections)).toBe(true);
  });

  it('handles empty sections array', () => {
    expect(hasDuplicateSectionName('Todo', 'p1', [])).toBe(false);
  });

  it('handles null projectId (global sections)', () => {
    const globalSections = [
      makeSection('g1', null, 'Global', 0),
      makeSection('g2', null, 'Global', 1),
      makeSection('g3', null, 'Unique', 2),
    ];
    expect(hasDuplicateSectionName('Global', null, globalSections)).toBe(true);
    expect(hasDuplicateSectionName('Unique', null, globalSections)).toBe(false);
  });
});
