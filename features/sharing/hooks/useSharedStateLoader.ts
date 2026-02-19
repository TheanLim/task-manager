import { useEffect } from 'react';
import { ShareService } from '@/features/sharing/services/shareService';
import {
  projectRepository,
  taskRepository,
  sectionRepository,
  dependencyRepository,
  automationRuleRepository,
} from '@/stores/dataStore';
import { AppState } from '@/types';

export interface UseSharedStateLoaderOptions {
  /**
   * Called when shared state is loaded and the user has existing data,
   * so a dialog should be shown to ask replace/merge/cancel.
   */
  onSharedStateLoaded: (sharedState: AppState) => void;
  /**
   * Called when shared state is loaded directly (no existing data),
   * or when an error occurs during loading.
   */
  onLoadResult: (result: { message: string; type: 'success' | 'error' | 'info' }) => void;
}

/**
 * Hook that checks for shared state in the URL hash on mount and on hash changes.
 * Parses, decompresses, and validates the shared state, then either:
 * - Loads it directly if the user has no existing data
 * - Calls onSharedStateLoaded so the caller can show a confirmation dialog
 */
export function useSharedStateLoader({ onSharedStateLoaded, onLoadResult }: UseSharedStateLoaderOptions): void {
  useEffect(() => {
    const loadSharedState = async () => {
      // Wait a bit for Zustand stores to hydrate from localStorage
      await new Promise(resolve => setTimeout(resolve, 100));

      const shareService = new ShareService();
      const result = await shareService.loadSharedState();

      if (result.success && result.state) {
        // Check if user has existing data (after hydration)
        const hasExistingData =
          projectRepository.findAll().length > 0 ||
          taskRepository.findAll().length > 0 ||
          sectionRepository.findAll().length > 0 ||
          dependencyRepository.findAll().length > 0;

        if (hasExistingData) {
          // Show dialog to ask user what to do
          onSharedStateLoaded(result.state);
        } else {
          // No existing data, load directly
          handleLoadSharedState(result.state, 'replace', onLoadResult);
        }
      } else if (result.error && result.error !== 'No shared state found in URL') {
        onLoadResult({ message: result.error, type: 'error' });
      }
    };

    // Check on mount
    loadSharedState();

    // Also check when hash changes (user pastes new URL)
    const handleHashChange = () => {
      loadSharedState();
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}


/**
 * Applies shared state to the data store (replace or merge mode),
 * clears the URL hash, and notifies via the result callback.
 */
export function handleLoadSharedState(
  sharedState: AppState,
  mode: 'replace' | 'merge' | 'cancel',
  onLoadResult: (result: { message: string; type: 'success' | 'error' | 'info' }) => void,
  options?: { includeAutomations?: boolean }
): void {
  if (mode === 'cancel') {
    clearUrlHash();
    return;
  }

  if (mode === 'replace') {
    // Write through repositories so the backend, localStorage,
    // and the Zustand store (via repository subscriptions) all stay in sync.
    projectRepository.replaceAll(sharedState.projects);
    taskRepository.replaceAll(sharedState.tasks);
    sectionRepository.replaceAll(sharedState.sections);
    dependencyRepository.replaceAll(sharedState.dependencies);

    onLoadResult({ message: 'Shared data loaded successfully!', type: 'success' });
  } else {
    mergeSharedState(sharedState, onLoadResult);
  }

  // Import automation rules if included
  const includeAutomations = options?.includeAutomations ?? true;
  if (includeAutomations) {
    const shareService = new ShareService(undefined, automationRuleRepository);
    shareService.importAutomationRules(sharedState as unknown as Record<string, unknown>, { includeAutomations });
  }

  clearUrlHash();
}

function mergeSharedState(
  sharedState: AppState,
  onLoadResult: (result: { message: string; type: 'success' | 'error' | 'info' }) => void
): void {
  const projects = projectRepository.findAll();
  const tasks = taskRepository.findAll();
  const sections = sectionRepository.findAll();
  const dependencies = dependencyRepository.findAll();

  // Deduplicate existing data in case there are already duplicates
  const uniqueProjects = Array.from(new Map(projects.map(p => [p.id, p])).values());
  const uniqueTasks = Array.from(new Map(tasks.map(t => [t.id, t])).values());
  const uniqueSections = Array.from(new Map(sections.map(s => [s.id, s])).values());
  const uniqueDependencies = Array.from(new Map(dependencies.map(d => [d.id, d])).values());

  const existingProjectIds = new Set(uniqueProjects.map(p => p.id));
  const existingTaskIds = new Set(uniqueTasks.map(t => t.id));
  const existingSectionIds = new Set(uniqueSections.map(s => s.id));
  const existingDependencyIds = new Set(uniqueDependencies.map(d => d.id));

  const newProjects = sharedState.projects.filter(p => !existingProjectIds.has(p.id));
  const newTasks = sharedState.tasks.filter(t => !existingTaskIds.has(t.id));
  const newSections = sharedState.sections.filter(s => !existingSectionIds.has(s.id));
  const newDependencies = sharedState.dependencies.filter(d => !existingDependencyIds.has(d.id));

  // Write through repositories so backend, localStorage, and Zustand all stay in sync
  projectRepository.replaceAll([...uniqueProjects, ...newProjects]);
  taskRepository.replaceAll([...uniqueTasks, ...newTasks]);
  sectionRepository.replaceAll([...uniqueSections, ...newSections]);
  dependencyRepository.replaceAll([...uniqueDependencies, ...newDependencies]);

  const addedCount = newProjects.length + newTasks.length + newSections.length + newDependencies.length;
  const skippedCount =
    (sharedState.projects.length - newProjects.length) +
    (sharedState.tasks.length - newTasks.length) +
    (sharedState.sections.length - newSections.length) +
    (sharedState.dependencies.length - newDependencies.length);
  const cleanedCount =
    (projects.length - uniqueProjects.length) +
    (tasks.length - uniqueTasks.length) +
    (sections.length - uniqueSections.length) +
    (dependencies.length - uniqueDependencies.length);

  const message = buildMergeMessage(addedCount, skippedCount, cleanedCount);
  const type: 'success' | 'info' = skippedCount > 0 || cleanedCount > 0 ? 'info' : 'success';
  onLoadResult({ message, type });
}

function buildMergeMessage(addedCount: number, skippedCount: number, cleanedCount: number): string {
  if (cleanedCount > 0 && skippedCount > 0) {
    return `Merged ${addedCount} items (${skippedCount} duplicates skipped, ${cleanedCount} existing duplicates cleaned)`;
  }
  if (cleanedCount > 0) {
    return `Merged ${addedCount} items (${cleanedCount} existing duplicates cleaned)`;
  }
  if (skippedCount > 0) {
    return `Merged ${addedCount} items (${skippedCount} duplicates skipped)`;
  }
  return 'Shared data merged successfully!';
}

function clearUrlHash(): void {
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
