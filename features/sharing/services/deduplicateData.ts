import type { Project, Task, Section, TaskDependency } from '@/lib/schemas';

/**
 * Entity collections that can be deduplicated.
 */
interface EntityCollections {
  projects: Project[];
  tasks: Task[];
  sections: Section[];
  dependencies: TaskDependency[];
}

/**
 * Pure function: deduplicate entity arrays by ID.
 * Returns the deduplicated collections and the count of removed duplicates.
 */
export function deduplicateEntities(collections: EntityCollections): {
  deduplicated: EntityCollections;
  removedCount: number;
} {
  const uniqueProjects = Array.from(
    new Map(collections.projects.map(p => [p.id, p])).values()
  );
  const uniqueTasks = Array.from(
    new Map(collections.tasks.map(t => [t.id, t])).values()
  );
  const uniqueSections = Array.from(
    new Map(collections.sections.map(s => [s.id, s])).values()
  );
  const uniqueDependencies = Array.from(
    new Map(collections.dependencies.map(d => [d.id, d])).values()
  );

  const removedCount =
    (collections.projects.length - uniqueProjects.length) +
    (collections.tasks.length - uniqueTasks.length) +
    (collections.sections.length - uniqueSections.length) +
    (collections.dependencies.length - uniqueDependencies.length);

  return {
    deduplicated: {
      projects: uniqueProjects,
      tasks: uniqueTasks,
      sections: uniqueSections,
      dependencies: uniqueDependencies,
    },
    removedCount,
  };
}

/**
 * Pure function: count duplicates per entity type without modifying data.
 */
export function countDuplicates(collections: EntityCollections): {
  projects: number;
  tasks: number;
  sections: number;
  dependencies: number;
  total: number;
} {
  const projectDuplicates = collections.projects.length - new Set(collections.projects.map(p => p.id)).size;
  const taskDuplicates = collections.tasks.length - new Set(collections.tasks.map(t => t.id)).size;
  const sectionDuplicates = collections.sections.length - new Set(collections.sections.map(s => s.id)).size;
  const dependencyDuplicates = collections.dependencies.length - new Set(collections.dependencies.map(d => d.id)).size;

  return {
    projects: projectDuplicates,
    tasks: taskDuplicates,
    sections: sectionDuplicates,
    dependencies: dependencyDuplicates,
    total: projectDuplicates + taskDuplicates + sectionDuplicates + dependencyDuplicates,
  };
}
