import type { Project, Section } from '@/lib/schemas';

/**
 * Returns the projects that do NOT have a section matching the given name
 * (case-insensitive, whitespace-trimmed). Used in the global rule wizard to
 * warn the user about projects where a section-based trigger/action will be
 * skipped at execution time.
 *
 * Pure function — no store imports, no side effects.
 */
export function findProjectsMissingSection(
  sectionName: string,
  allProjects: Project[],
  allSections: Section[]
): Project[] {
  const normalizedName = sectionName.trim().toLowerCase();
  if (!normalizedName) return [...allProjects];

  return allProjects.filter((project) => {
    const projectSections = allSections.filter((s) => s.projectId === project.id);
    return !projectSections.some(
      (s) => s.name.trim().toLowerCase() === normalizedName
    );
  });
}
