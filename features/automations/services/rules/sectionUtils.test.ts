import { describe, it, expect } from 'vitest';
import { findProjectsMissingSection } from './sectionUtils';
import type { Project, Section } from '@/lib/schemas';

// Minimal fixture helpers
function makeProject(id: string, name = `Project ${id}`): Project {
  return {
    id,
    name,
    description: '',
    viewMode: 'list',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
}

function makeSection(id: string, projectId: string, name: string): Section {
  return {
    id,
    projectId,
    name,
    order: 0,
    collapsed: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
}

describe('findProjectsMissingSection', () => {
  const projects = [
    makeProject('p1', 'Alpha'),
    makeProject('p2', 'Beta'),
    makeProject('p3', 'Gamma'),
  ];

  it('returns empty array when all projects have the section', () => {
    const sections = [
      makeSection('s1', 'p1', 'Done'),
      makeSection('s2', 'p2', 'Done'),
      makeSection('s3', 'p3', 'Done'),
    ];
    expect(findProjectsMissingSection('Done', projects, sections)).toEqual([]);
  });

  it('returns projects that are missing the section', () => {
    const sections = [
      makeSection('s1', 'p1', 'Done'),
      makeSection('s2', 'p2', 'Finished'), // different name
      // p3 has no sections at all
    ];
    const missing = findProjectsMissingSection('Done', projects, sections);
    expect(missing.map((p) => p.id)).toEqual(['p2', 'p3']);
  });

  it('is case-insensitive — "done" matches "Done" and "DONE"', () => {
    const sections = [
      makeSection('s1', 'p1', 'Done'),
      makeSection('s2', 'p2', 'DONE'),
      makeSection('s3', 'p3', 'done'),
    ];
    expect(findProjectsMissingSection('done', projects, sections)).toEqual([]);
    expect(findProjectsMissingSection('Done', projects, sections)).toEqual([]);
    expect(findProjectsMissingSection('DONE', projects, sections)).toEqual([]);
  });

  it('trims whitespace before comparing', () => {
    const sections = [
      makeSection('s1', 'p1', '  Done  '),
      makeSection('s2', 'p2', 'Done'),
      makeSection('s3', 'p3', 'Done'),
    ];
    expect(findProjectsMissingSection('  Done  ', projects, sections)).toEqual([]);
    expect(findProjectsMissingSection('Done', projects, sections)).toEqual([]);
  });

  it('returns all projects when sectionName is empty string', () => {
    const sections = [makeSection('s1', 'p1', 'Done')];
    const missing = findProjectsMissingSection('', projects, sections);
    expect(missing).toEqual(projects);
  });

  it('returns all projects when sectionName is only whitespace', () => {
    const sections = [makeSection('s1', 'p1', 'Done')];
    const missing = findProjectsMissingSection('   ', projects, sections);
    expect(missing).toEqual(projects);
  });

  it('includes a project with no sections at all in the missing list', () => {
    const sections = [
      makeSection('s1', 'p1', 'Done'),
      makeSection('s2', 'p2', 'Done'),
      // p3 has no sections
    ];
    const missing = findProjectsMissingSection('Done', projects, sections);
    expect(missing.map((p) => p.id)).toEqual(['p3']);
  });

  it('returns empty array when projects list is empty', () => {
    const sections = [makeSection('s1', 'p1', 'Done')];
    expect(findProjectsMissingSection('Done', [], sections)).toEqual([]);
  });

  it('returns all projects when sections list is empty', () => {
    expect(findProjectsMissingSection('Done', projects, [])).toEqual(projects);
  });
});
