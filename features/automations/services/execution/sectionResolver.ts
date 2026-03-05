import type { Section } from '@/lib/schemas';

/**
 * Find a section by name within a specific project.
 * Case-insensitive match with whitespace trimming.
 * Returns the oldest section when multiple sections share the same name.
 */
export function findSectionByName(
  name: string,
  projectId: string | null,
  allSections: Section[]
): Section | undefined {
  const normalizedSearchName = name.trim().toLowerCase();

  const candidates = allSections.filter(
    s => s.projectId === projectId && s.name.trim().toLowerCase() === normalizedSearchName
  );

  if (candidates.length === 0) {
    return undefined;
  }

  // Tiebreaker: return the oldest section (lowest order, then earliest createdAt)
  candidates.sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });

  return candidates[0];
}

/**
 * Check if there are duplicate sections with the same name within a specific project.
 * Case-insensitive match with whitespace trimming.
 */
export function hasDuplicateSectionName(
  name: string,
  projectId: string | null,
  allSections: Section[]
): boolean {
  const normalizedSearchName = name.trim().toLowerCase();

  const matchingSections = allSections.filter(
    s => s.projectId === projectId && s.name.trim().toLowerCase() === normalizedSearchName
  );

  return matchingSections.length >= 2;
}
