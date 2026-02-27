'use client';

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { TaskList } from '@/features/tasks/components/TaskList';
import { useDataStore, taskService } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
import { Circle } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Task, Section } from '@/types';
import { filterAutoHiddenTasks } from '@/features/tasks/services/autoHideService';
import { useTMSOrderedTasks } from '@/features/tms/hooks/useTMSOrderedTasks';
import { useFVPSessionState } from '@/features/tms/hooks/useFVPSessionState';
import { useTMSDispatch } from '@/features/tms/hooks/useTMSDispatch';
import { useTMSShortcuts } from '@/features/tms/hooks/useTMSShortcuts';
import { useKeyboardNavStore } from '@/features/keyboard/stores/keyboardNavStore';
import { TMSInlineNotice } from '@/features/tms/components/TMSInlineNotice';
import { AF4ActionRow } from '@/features/tms/components/AF4ActionRow';
import { AF4FlaggedNotice } from '@/features/tms/components/AF4FlaggedNotice';
import { FVPComparisonPanel } from '@/features/tms/components/FVPComparisonPanel';
import { FVPSessionButton } from '@/features/tms/components/FVPSessionButton';
import { DITMoveButtons } from '@/features/tms/components/DITMoveButtons';
import { tmsCopy } from '@/features/tms/copy/tms-copy';
import type { AF4State } from '@/features/tms/handlers/af4';
import type { DITState } from '@/features/tms/handlers/DITHandler';
import { getScanCandidate } from '@/features/tms/handlers/fvp';

interface GlobalTasksViewProps {
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
  onAddTask: (sectionId?: string) => void;
  onViewSubtasks?: (taskId: string) => void;
  onSubtaskButtonClick?: (taskId: string) => void;
  onAddSubtask?: (parentTaskId: string) => void;
  selectedTaskId?: string | null;
  onProjectClick?: (projectId: string) => void;
}

// Extended task type with flat mode metadata
export interface TaskWithMetadata extends Task {
  _flatModeParentName?: string;
  _flatModeParentId?: string;
  _flatModeHasSubtasks?: boolean;
  _flatModeSubtaskCount?: number;
}

// Virtual section ID for tasks from projects
const FROM_PROJECTS_SECTION_ID = '__from_projects__';

/**
 * Global Tasks View component - displays all tasks from all projects
 * Groups project tasks into "From Projects" section
 * Unlinked tasks can have their own sections
 */
export function GlobalTasksView({
  onTaskClick,
  onTaskComplete,
  onAddTask,
  onViewSubtasks,
  onSubtaskButtonClick,
  onAddSubtask,
  selectedTaskId,
  onProjectClick
}: GlobalTasksViewProps) {
  const { tasks, sections, projects } = useDataStore();
  const { globalTasksDisplayMode } = useAppStore();
  const { state: tmsState, setActiveSystem } = useTMSStore();
  const autoHideThreshold = useAppStore((s) => s.autoHideThreshold);
  const showRecentlyCompleted = useAppStore((s) => s.showRecentlyCompleted);

  // Separate tasks: those with projects vs unlinked tasks
  // Project tasks are sorted by project name so they group by project on initial render
  const { projectTasks, unlinkedTasks, unlinkedSections } = useMemo(() => {
    const projectNameMap = new Map(projects.map(p => [p.id, p.name]));
    const projectTasks = tasks
      .filter(t => t.projectId !== null)
      .sort((a, b) => {
        const nameA = projectNameMap.get(a.projectId!) || '';
        const nameB = projectNameMap.get(b.projectId!) || '';
        return nameA.localeCompare(nameB);
      });
    const unlinkedTasks = tasks.filter(t => t.projectId === null);
    const unlinkedSections = sections.filter(s => s.projectId === null);
    
    return { projectTasks, unlinkedTasks, unlinkedSections };
  }, [tasks, sections, projects]);

  // Track collapsed state for the virtual "From Projects" section locally
  // (it doesn't exist in the repository, so updateSection won't persist it)
  const [fromProjectsCollapsed, setFromProjectsCollapsed] = useState(false);

  // Create virtual "Tasks" section (groups all project-linked tasks)
  const virtualFromProjectsSection: Section = useMemo(() => ({
    id: FROM_PROJECTS_SECTION_ID,
    projectId: null,
    name: 'Tasks',
    order: -1,
    collapsed: fromProjectsCollapsed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }), [fromProjectsCollapsed]);

  // Process tasks and sections based on display mode
  const { displayTasks, displaySections } = useMemo(() => {
    // Assign all project tasks to the virtual "Tasks" section.
    // Also assign unlinked tasks with no sectionId to the virtual section
    // so they appear inside it rather than after the "Add tasks..." row.
    const tasksWithVirtualSection = projectTasks.map(task => ({
      ...task,
      sectionId: FROM_PROJECTS_SECTION_ID
    }));

    const unlinkedWithSection = unlinkedTasks.map(task => ({
      ...task,
      sectionId: task.sectionId ?? FROM_PROJECTS_SECTION_ID,
    }));

    // Combine: virtual-section tasks first, then unlinked tasks (preserving their real sections)
    const allTasks = [...tasksWithVirtualSection, ...unlinkedWithSection];
    
    // Create sections list: virtual section + unlinked sections
    const allSections = [virtualFromProjectsSection, ...unlinkedSections];

    if (globalTasksDisplayMode === 'flat') {
      // Flat mode: Flatten parent-child relationships
      const subtasksByParent = new Map<string, Task[]>();
      
      allTasks.forEach(task => {
        if (task.parentTaskId) {
          if (!subtasksByParent.has(task.parentTaskId)) {
            subtasksByParent.set(task.parentTaskId, []);
          }
          subtasksByParent.get(task.parentTaskId)!.push(task);
        }
      });
      
      subtasksByParent.forEach((subtasks) => {
        subtasks.sort((a, b) => a.order - b.order);
      });
      
      const orderedTasks: TaskWithMetadata[] = [];
      
      // Build a project-name lookup for sorting (mirrors nested mode's pre-sort)
      const projectNameMap = new Map(projects.map(p => [p.id, p.name]));

      // Process sectioned tasks
      allSections.forEach(section => {
        const sectionParents = allTasks
          .filter(t => t.sectionId === section.id && !t.parentTaskId)
          .sort((a, b) => {
            const nameA = a.projectId ? (projectNameMap.get(a.projectId) || '') : '';
            const nameB = b.projectId ? (projectNameMap.get(b.projectId) || '') : '';
            const cmp = nameA.localeCompare(nameB);
            return cmp !== 0 ? cmp : a.order - b.order;
          });
        
        sectionParents.forEach(parentTask => {
          const subtasks = subtasksByParent.get(parentTask.id) || [];
          
          orderedTasks.push({
            ...parentTask,
            parentTaskId: null,
            _flatModeHasSubtasks: subtasks.length > 0,
            _flatModeSubtaskCount: subtasks.length
          });
          
          subtasks.forEach(subtask => {
            orderedTasks.push({
              ...subtask,
              parentTaskId: null,
              sectionId: parentTask.sectionId,
              _flatModeParentName: parentTask.description,
              _flatModeParentId: parentTask.id
            });
          });
        });
      });
      
      // Process unsectioned tasks
      const unsectionedParents = allTasks
        .filter(t => !t.sectionId && !t.parentTaskId)
        .sort((a, b) => {
          const nameA = a.projectId ? (projectNameMap.get(a.projectId) || '') : '';
          const nameB = b.projectId ? (projectNameMap.get(b.projectId) || '') : '';
          const cmp = nameA.localeCompare(nameB);
          return cmp !== 0 ? cmp : a.order - b.order;
        });
      
      unsectionedParents.forEach(parentTask => {
        const subtasks = subtasksByParent.get(parentTask.id) || [];
        
        orderedTasks.push({
          ...parentTask,
          parentTaskId: null,
          _flatModeHasSubtasks: subtasks.length > 0,
          _flatModeSubtaskCount: subtasks.length
        });
        
        subtasks.forEach(subtask => {
          orderedTasks.push({
            ...subtask,
            parentTaskId: null,
            sectionId: null, // Keep as unsectioned
            _flatModeParentName: parentTask.description,
            _flatModeParentId: parentTask.id
          });
        });
      });
      
      return { displayTasks: orderedTasks, displaySections: allSections };
    }
    
    // Nested mode: Show tasks with their natural hierarchy
    return { displayTasks: allTasks, displaySections: allSections };
  }, [projectTasks, unlinkedTasks, unlinkedSections, virtualFromProjectsSection, globalTasksDisplayMode, projects]);

  const filteredTasks = useMemo(() => {
    // TMS active or Always hide: filter out all completed tasks
    if (tmsState.activeSystem !== 'none' || autoHideThreshold === 'always') {
      return displayTasks.filter(t => !t.completed);
    }
    // Show recently completed: only completed tasks within the threshold window
    if (showRecentlyCompleted) {
      if (autoHideThreshold === 'show-all') {
        return displayTasks.filter(t => t.completed);
      }
      const result = filterAutoHiddenTasks(displayTasks, tasks, {
        threshold: autoHideThreshold,
        displayMode: globalTasksDisplayMode,
      });
      return result.visible.filter(t => t.completed);
    }
    // Show all: no auto-hiding
    if (autoHideThreshold === 'show-all') {
      return displayTasks;
    }
    // Time-based threshold: hide aged-out completed tasks
    const result = filterAutoHiddenTasks(displayTasks, tasks, {
      threshold: autoHideThreshold,
      displayMode: globalTasksDisplayMode,
    });
    return result.visible;
  }, [displayTasks, tasks, tmsState.activeSystem,
      autoHideThreshold, showRecentlyCompleted, globalTasksDisplayMode]);

  const orderedTasks = useTMSOrderedTasks(filteredTasks);
  const fvpSession = useFVPSessionState(filteredTasks);
  const dispatch = useTMSDispatch();
  const focusedTaskId = useKeyboardNavStore((s) => s.focusedTaskId);

  // AF4 state — read dismissed task IDs for the flagged notice
  const af4State = useTMSStore(
    (s) => s.state.systemStates['af4'] as AF4State | undefined,
  );
  const dismissedTaskIds = af4State?.dismissedTaskIds ?? [];

  // DIT state — read schedule lists for move button visibility
  const ditState = useTMSStore(
    (s) => s.state.systemStates['dit'] as DITState | undefined,
  );

  // FVP raw state — needed for getScanCandidate inside tmsTaskProps
  const fvpRawState = useTMSStore(
    (s) => s.state.systemStates['fvp'] as
      | { dottedTasks: string[]; scanPosition: number; snapshotTaskIds: string[] }
      | undefined,
  );

  // "View changed" notice — fires when Nested/Flat toggle happens while a mode is active
  const [showViewChangedNotice, setShowViewChangedNotice] = useState(false);
  const prevDisplayModeRef = useRef(globalTasksDisplayMode);

  useEffect(() => {
    if (prevDisplayModeRef.current !== globalTasksDisplayMode) {
      prevDisplayModeRef.current = globalTasksDisplayMode;
      if (tmsState.activeSystem !== 'none') {
        setShowViewChangedNotice(true);
      }
    }
  }, [globalTasksDisplayMode, tmsState.activeSystem]);

  // "Queue complete" notice — fires when orderedTasks exhausts while mode is active
  // ⚠️ 6-second window: when queue exhausts, activeSystem is still non-none but orderedTasks is empty.
  // The notice fires here; mode resets after the dismiss delay. This is intentional — the notice
  // is the signal to the user; the mode resets only after they've seen it.
  const prevOrderedLengthRef = useRef(orderedTasks.length);
  const [showQueueCompleteNotice, setShowQueueCompleteNotice] = useState(false);

  useEffect(() => {
    const prev = prevOrderedLengthRef.current;
    prevOrderedLengthRef.current = orderedTasks.length;
    if (tmsState.activeSystem !== 'none' && prev > 0 && orderedTasks.length === 0) {
      setShowQueueCompleteNotice(true);
    }
  }, [orderedTasks.length, tmsState.activeSystem]);

  // tmsTaskProps — only passed when a non-standard, non-none mode is active.
  // Standard mode should NOT dim rows.
  const tmsTaskProps = useCallback(
    (tmsState.activeSystem !== 'none' && tmsState.activeSystem !== 'standard')
      ? (task: Task) => {
          const isCandidate = orderedTasks.length > 0 && orderedTasks[0].id === task.id;
          const activeSystem = tmsState.activeSystem;

          // ── AF4 ──────────────────────────────────────────────────────────
          if (activeSystem === 'af4') {
            if (!isCandidate) return { tmsVariant: 'default' as const };
            return {
              tmsVariant: 'current' as const,
              actionsSlot: (
                <AF4ActionRow
                  task={task}
                  onMadeProgress={() => dispatch({ type: 'MADE_PROGRESS' })}
                  onDone={() => {
                    dispatch({ type: 'MARK_DONE' });
                    onTaskComplete(task.id, true);
                  }}
                  onSkip={() => dispatch({ type: 'SKIP_TASK' })}
                  onFlag={() => dispatch({ type: 'FLAG_DISMISSED' })}
                />
              ),
            };
          }

          // ── FVP ──────────────────────────────────────────────────────────
          if (activeSystem === 'fvp') {
            const isFirst = orderedTasks.length > 0 && orderedTasks[0].id === task.id;

            if (fvpSession.selectionInProgress && fvpSession.currentX) {
              // During scan: show comparison panel on the scan candidate
              const fvpStateForScan = fvpRawState ?? { dottedTasks: [], scanPosition: 1, snapshotTaskIds: [] };
              const currentScanCandidate = getScanCandidate(filteredTasks, fvpStateForScan);

              if (currentScanCandidate?.id === task.id) {
                return {
                  tmsVariant: 'current' as const,
                  actionsSlot: (
                    <FVPComparisonPanel
                      candidate={task}
                      referenceTask={fvpSession.currentX}
                      onYes={() => dispatch({ type: 'DOT_TASK', task, tasks: filteredTasks })}
                      onNo={() => dispatch({ type: 'SKIP_CANDIDATE', task, tasks: filteredTasks })}
                    />
                  ),
                };
              }
            } else if (isFirst) {
              // Not scanning: show Begin/Continue session button on first task
              const hasDotted = (fvpRawState?.dottedTasks?.length ?? 0) > 0;
              return {
                tmsVariant: isCandidate ? 'current' as const : 'default' as const,
                actionsSlot: (
                  <FVPSessionButton
                    hasDottedTasks={hasDotted}
                    onBegin={() => dispatch({ type: 'START_PRESELECTION', tasks: filteredTasks })}
                  />
                ),
              };
            }

            return { tmsVariant: isCandidate ? 'current' as const : 'default' as const };
          }

          // ── DIT ──────────────────────────────────────────────────────────
          if (activeSystem === 'dit' && ditState) {
            return {
              tmsVariant: isCandidate ? 'current' as const : 'default' as const,
              trailingSlot: (
                <DITMoveButtons
                  task={task}
                  ditState={ditState}
                  onMoveToToday={(taskId) => dispatch({ type: 'MOVE_TO_TODAY', taskId })}
                  onMoveToTomorrow={(taskId) => dispatch({ type: 'MOVE_TO_TOMORROW', taskId })}
                  onMoveToInbox={(taskId) => dispatch({ type: 'REMOVE_FROM_SCHEDULE', taskId })}
                />
              ),
            };
          }

          return { tmsVariant: isCandidate ? 'current' as const : 'default' as const };
        }
      : () => ({}),
    [dispatch, orderedTasks, tmsState.activeSystem, fvpSession, fvpRawState, ditState, filteredTasks, onTaskComplete],
  );

  // Wire mode-specific keyboard shortcuts
  useTMSShortcuts({
    activeSystem: tmsState.activeSystem,
    candidateTask: orderedTasks[0] ?? null,
    allTasks: filteredTasks,
    selectionInProgress: fvpSession.selectionInProgress,
    hasDottedTasks: (fvpRawState?.dottedTasks?.length ?? 0) > 0,
    focusedTaskId,
    dispatch,
    onTaskComplete,
  });

  // Determine whether to hide completed subtasks in TaskRow
  const shouldHideCompletedSubtasks = tmsState.activeSystem !== 'none' || autoHideThreshold === 'always';

  // Reinsert callback — delegates to TaskService
  const handleReinsert = useCallback((taskId: string) => {
    taskService.reinsertTask(taskId);
  }, []);

  // Section toggle — handle virtual "From Projects" section locally, delegate others to store
  const { updateSection } = useDataStore();
  const handleToggleSection = useCallback((sectionId: string) => {
    if (sectionId === FROM_PROJECTS_SECTION_ID) {
      setFromProjectsCollapsed(prev => !prev);
    } else {
      const section = sections.find(s => s.id === sectionId);
      if (section) {
        updateSection(sectionId, { collapsed: !section.collapsed });
      }
    }
  }, [sections, updateSection]);

  // The virtual "Tasks" section is read-only — no edit/delete/drag/collapse
  const readonlySectionIds = useMemo(() => new Set([FROM_PROJECTS_SECTION_ID]), []);

  // Empty state
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={Circle}
        title="Ready to get things done"
        description="Create a task to start tracking your work"
      />
    );
  }

  return (
    <>
      {showViewChangedNotice && (
        <TMSInlineNotice
          variant="info"
          message={tmsCopy.inlineNotices.viewChanged}
          autoDismiss={4000}
          onDismiss={() => setShowViewChangedNotice(false)}
        />
      )}
      {showQueueCompleteNotice && (
        <TMSInlineNotice
          variant="success"
          message={tmsCopy.inlineNotices.queueComplete}
          autoDismiss={6000}
          onDismiss={() => setShowQueueCompleteNotice(false)}
        />
      )}
      {tmsState.activeSystem === 'fvp' && fvpSession.total > 0 && fvpSession.isFiltered && fvpSession.progress === 0 && (
        <div role="alert">
          <TMSInlineNotice
            variant="warning"
            message={tmsCopy.inlineNotices.noFvpCandidates}
            actions={[
              {
                label: 'Clear filters',
                onClick: () => { /* TODO: wire to filterStore.clearFilters() when filterStore exists */ },
                variant: 'secondary',
              },
              {
                label: 'End session',
                onClick: () => setActiveSystem('none'),
                variant: 'ghost-destructive',
              },
            ]}
          />
        </div>
      )}
      {tmsState.activeSystem === 'af4' && dismissedTaskIds.length > 0 && (
        <AF4FlaggedNotice
          dismissedTaskIds={dismissedTaskIds}
          tasks={filteredTasks}
          onResolve={(taskId, resolution) =>
            dispatch({ type: 'RESOLVE_DISMISSED', taskId, resolution })
          }
        />
      )}
      <TaskList
        tasks={orderedTasks}
        sections={displaySections}
        onTaskClick={onTaskClick}
        onTaskComplete={onTaskComplete}
        onAddTask={(sectionId) => {
          // Strip the virtual section ID — tasks added from the Tasks section
          // are unlinked (no real sectionId), not tied to __from_projects__
          const realSectionId = sectionId === FROM_PROJECTS_SECTION_ID ? undefined : sectionId;
          onAddTask(realSectionId);
        }}
        onViewSubtasks={onViewSubtasks}
        onSubtaskButtonClick={onSubtaskButtonClick}
        onAddSubtask={globalTasksDisplayMode === 'nested' ? onAddSubtask : undefined}
        selectedTaskId={selectedTaskId}
        showProjectColumn={true}
        onProjectClick={onProjectClick}
        flatMode={globalTasksDisplayMode === 'flat'}
        initialSortByProject={true}
        showReinsertButton={tmsState.activeSystem !== 'none'}
        onReinsert={tmsState.activeSystem !== 'none' ? handleReinsert : undefined}
        onToggleSection={handleToggleSection}
        hideCompletedSubtasks={shouldHideCompletedSubtasks}
        readonlySectionIds={readonlySectionIds}
        tmsTaskProps={
          (tmsState.activeSystem === 'none' || tmsState.activeSystem === 'standard')
            ? undefined
            : tmsTaskProps
        }
      />
    </>
  );
}
