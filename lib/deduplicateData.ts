import { useDataStore } from '@/stores/dataStore';

/**
 * Remove duplicate entries from the data store based on IDs
 * This can be called manually if duplicates exist in the store
 */
export function deduplicateDataStore() {
  const state = useDataStore.getState();
  
  // Deduplicate by creating a Map with ID as key (keeps last occurrence)
  const uniqueProjects = Array.from(
    new Map(state.projects.map(p => [p.id, p])).values()
  );
  
  const uniqueTasks = Array.from(
    new Map(state.tasks.map(t => [t.id, t])).values()
  );
  
  const uniqueSections = Array.from(
    new Map(state.sections.map(s => [s.id, s])).values()
  );
  
  const uniqueDependencies = Array.from(
    new Map(state.dependencies.map(d => [d.id, d])).values()
  );
  
  const removedCount = 
    (state.projects.length - uniqueProjects.length) +
    (state.tasks.length - uniqueTasks.length) +
    (state.sections.length - uniqueSections.length) +
    (state.dependencies.length - uniqueDependencies.length);
  
  if (removedCount > 0) {
    useDataStore.setState({
      projects: uniqueProjects,
      tasks: uniqueTasks,
      sections: uniqueSections,
      dependencies: uniqueDependencies
    });
    
    console.log(`Removed ${removedCount} duplicate entries from data store`);
    return removedCount;
  }
  
  console.log('No duplicates found');
  return 0;
}

/**
 * Check if there are any duplicates in the data store
 */
export function checkForDuplicates() {
  const state = useDataStore.getState();
  
  const projectIds = state.projects.map(p => p.id);
  const taskIds = state.tasks.map(t => t.id);
  const sectionIds = state.sections.map(s => s.id);
  const dependencyIds = state.dependencies.map(d => d.id);
  
  const projectDuplicates = projectIds.length - new Set(projectIds).size;
  const taskDuplicates = taskIds.length - new Set(taskIds).size;
  const sectionDuplicates = sectionIds.length - new Set(sectionIds).size;
  const dependencyDuplicates = dependencyIds.length - new Set(dependencyIds).size;
  
  const totalDuplicates = projectDuplicates + taskDuplicates + sectionDuplicates + dependencyDuplicates;
  
  if (totalDuplicates > 0) {
    console.log('Duplicates found:', {
      projects: projectDuplicates,
      tasks: taskDuplicates,
      sections: sectionDuplicates,
      dependencies: dependencyDuplicates,
      total: totalDuplicates
    });
  } else {
    console.log('No duplicates found');
  }
  
  return {
    projects: projectDuplicates,
    tasks: taskDuplicates,
    sections: sectionDuplicates,
    dependencies: dependencyDuplicates,
    total: totalDuplicates
  };
}
