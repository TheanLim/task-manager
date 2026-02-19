'use client';

import { useEffect, Suspense, useCallback, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { ProjectList } from '@/features/projects/components/ProjectList';
import { ProjectDialog } from '@/features/projects/components/ProjectDialog';
import { TaskDialog } from '@/features/tasks/components/TaskDialog';
import { TaskDetailPanel } from '@/features/tasks/components/TaskDetailPanel';
import { DependencyDialog } from '@/features/tasks/components/DependencyDialog';
import { ProjectView } from '@/features/projects/components/ProjectView';
import { GlobalTasksContainer } from '@/features/tasks/components/GlobalTasksContainer';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { useDataStore, automationService } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
import { getTMSHandler } from '@/features/tms/handlers';
import { ViewMode, Priority, TimeManagementSystem } from '@/types';
import { ProjectService } from '@/features/projects/services/projectService';
import { TaskService } from '@/features/tasks/services/taskService';
import { ImportExportMenu } from '@/features/sharing/components/ImportExportMenu';
import { LandingEmptyState } from '@/components/LandingEmptyState';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Breadcrumb } from '@/components/Breadcrumb';
import { SearchInput } from '@/components/SearchInput';
import { SkeletonProjectList } from '@/components/SkeletonProjectList';
import { SkeletonTaskList } from '@/components/SkeletonTaskList';
import { useHydrated } from '@/app/hooks/useHydrated';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import { toast as sonnerToast } from 'sonner';
import { SharedStateDialog } from '@/features/sharing/components/SharedStateDialog';
import { useDialogManager } from '@/app/hooks/useDialogManager';
import { useSharedStateLoader, handleLoadSharedState } from '@/features/sharing/hooks/useSharedStateLoader';
import { useGlobalShortcuts } from '@/features/keyboard/hooks/useGlobalShortcuts';
import { getDefaultShortcutMap, mergeShortcutMaps } from '@/features/keyboard/services/shortcutService';
import { ShortcutHelpOverlay } from '@/features/keyboard/components/ShortcutHelpOverlay';
import { useKeyboardNavStore } from '@/features/keyboard/stores/keyboardNavStore';
import { formatAutomationToastMessage } from '@/features/automations/services/toastMessageFormatter';
import { getUndoSnapshots, performUndoById } from '@/features/automations/services/undoService';
import { taskRepository } from '@/stores/dataStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Sonner-based toast helper — maps old showToast(message, type, duration?, action?) to sonner API
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info', duration?: number, action?: { label: string; onClick: () => void }) => {
    const opts: Parameters<typeof sonnerToast>[1] = {
      duration: duration ?? (type === 'error' ? 5000 : 3000),
      ...(action ? { action: { label: action.label, onClick: action.onClick } } : {}),
    };
    if (type === 'success') sonnerToast.success(message, opts);
    else if (type === 'error') sonnerToast.error(message, opts);
    else sonnerToast.info(message, opts);
  }, []);

  const projectIdFromUrl = searchParams.get('project');
  const viewFromUrl = searchParams.get('view');
  const tabFromUrl = searchParams.get('tab') || 'list';
  const taskIdFromUrl = searchParams.get('task');
  const expandedFromUrl = searchParams.get('expanded') === 'true';

  const isGlobalView = viewFromUrl === 'tasks';

  const hydrated = useHydrated();
  const isMobile = useMediaQuery('(max-width: 1023px)');

  // --- Dialog & panel state via useDialogManager ---
  const dm = useDialogManager();

  const minTaskPanelWidth = 300;
  const maxTaskPanelWidth = 800;

  // --- Store hooks ---
  const {
    projects,
    tasks,
    sections,
    dependencies,
    addProject,
    updateProject,
    updateTask,
    deleteTask,
    addTask,
    deleteDependency,
    getSubtasks,
    getSectionsByProjectId,
    getProjectById,
  } = useDataStore();

  const { settings, setActiveProject } = useAppStore();

  // Keyboard shortcuts
  const [helpOpen, setHelpOpen] = useState(false);
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);
  const keyboardShortcuts = useAppStore(s => s.keyboardShortcuts);
  const shortcutMap = mergeShortcutMaps(getDefaultShortcutMap(), keyboardShortcuts);
  const focusedTaskId = useKeyboardNavStore(s => s.focusedTaskId);

  useGlobalShortcuts({
    onNewTask: () => {
      // Create task in the same section as the focused task (if any)
      const taskId = useKeyboardNavStore.getState().focusedTaskId;
      if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        handleNewTask(task?.sectionId ?? undefined);
      } else {
        handleNewTask();
      }
    },
    onSearch: () => { /* TODO: wire to search input focus when SearchBar is added to the header */ },
    onHelp: () => setHelpOpen(true),
    onEditTask: () => {
      const taskId = useKeyboardNavStore.getState().focusedTaskId;
      if (!taskId) return;
      const row = document.querySelector(`tr[data-task-id="${taskId}"]`);
      const editable = row?.querySelector('[data-inline-editable]') as HTMLElement;
      editable?.click();
    },
    onOpenTask: () => {
      const taskId = useKeyboardNavStore.getState().focusedTaskId;
      if (taskId) handleTaskClick(taskId);
    },
    onToggleComplete: () => {
      const taskId = useKeyboardNavStore.getState().focusedTaskId;
      if (taskId) handleTaskComplete(taskId, !tasks.find(t => t.id === taskId)?.completed);
    },
    onDeleteTask: () => {
      const taskId = useKeyboardNavStore.getState().focusedTaskId;
      if (taskId) {
        setDeleteConfirmTaskId(taskId);
      }
    },
    onAddSubtask: () => {
      const taskId = useKeyboardNavStore.getState().focusedTaskId;
      if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        handleNewTask(task?.sectionId ?? undefined, taskId);
      }
    },
    isTaskFocused: !!focusedTaskId,
    shortcutMap,
  });

  // --- Shared state loading via useSharedStateLoader ---
  const onLoadResult = useCallback(
    (result: { message: string; type: 'success' | 'error' | 'info' }) => {
      showToast(result.message, result.type);
    },
    [showToast]
  );

  useSharedStateLoader({
    onSharedStateLoaded: dm.openSharedStateDialog,
    onLoadResult,
  });

  // --- Wire automation service to toast notifications (Requirements 11.1, 11.2, 11.3) ---
  useEffect(() => {
    automationService.setRuleExecutionCallback((params) => {
      const message = formatAutomationToastMessage(params);
      const snapshots = getUndoSnapshots();
      const matchingSnapshot = snapshots.find((s) => s.ruleId === params.ruleId);
      if (matchingSnapshot) {
        // Undo-capable toast: 10s duration with Undo action button (Req 6.1, 8.5)
        const ruleIdForUndo = params.ruleId;
        showToast(message, 'info', 10000, {
          label: 'Undo',
          onClick: () => {
            performUndoById(ruleIdForUndo, taskRepository);
          },
        });
      } else {
        // Basic toast: 5s duration (Req 8.5)
        showToast(message, 'info', 5000);
      }
    });

    // Cleanup: remove callback on unmount
    return () => {
      automationService.setRuleExecutionCallback(undefined);
    };
  }, [showToast]);

  // --- Sync URL with active project and handle invalid project IDs ---
  useEffect(() => {
    if (projectIdFromUrl) {
      const project = getProjectById(projectIdFromUrl);
      if (project) {
        if (settings.activeProjectId !== projectIdFromUrl) {
          setActiveProject(projectIdFromUrl);
        }
      } else {
        router.push('/');
      }
    } else {
      if (settings.activeProjectId !== null) {
        setActiveProject(null);
      }
    }
  }, [projectIdFromUrl, getProjectById, settings.activeProjectId, setActiveProject, router]);

  const activeProject = projects.find(p => p.id === settings.activeProjectId);
  const projectTasks = activeProject ? tasks.filter(t => t.projectId === activeProject.id) : [];
  const projectSections = activeProject ? getSectionsByProjectId(activeProject.id) : [];

  // Sync task from URL
  useEffect(() => {
    if (taskIdFromUrl) {
      dm.selectTask(taskIdFromUrl);
    }
  }, [taskIdFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close task sidebar when switching tabs
  useEffect(() => {
    if (dm.taskDetailPanel.selectedTaskId && !expandedFromUrl) {
      dm.deselectTask();
    }
  }, [tabFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize TMS on mount and check for day change
  useEffect(() => {
    if (settings.timeManagementSystem) {
      const handler = getTMSHandler(settings.timeManagementSystem as TimeManagementSystem);
      const currentTmsState = useTMSStore.getState().state;
      const delta = handler.initialize(tasks, currentTmsState);
      if (Object.keys(delta).length > 0) {
        useTMSStore.getState().updateState(delta);
      }
    }
  }, [settings.timeManagementSystem, tasks]);

  // Handle task panel resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dm.taskDetailPanel.isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= minTaskPanelWidth && newWidth <= maxTaskPanelWidth) {
        dm.setTaskPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      dm.setIsResizingTaskPanel(false);
    };

    if (dm.taskDetailPanel.isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dm.taskDetailPanel.isResizing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTaskPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dm.setIsResizingTaskPanel(true);
  };

  // --- Handlers ---

  const handleNewProject = () => {
    dm.openProjectDialog(null);
  };

  const handleProjectSubmit = (data: { name: string; description: string; viewMode: ViewMode }) => {
    if (dm.projectDialog.editingProjectId) {
      updateProject(dm.projectDialog.editingProjectId, data);
    } else {
      const newProject = ProjectService.create(data);
      addProject(newProject);
      router.push(`/?project=${newProject.id}`);
    }
  };

  const handleNewTask = (sectionId?: string, parentTaskId?: string) => {
    if (!activeProject && !isGlobalView) return;
    dm.openTaskDialog({ sectionId: sectionId || null, parentTaskId: parentTaskId || null });
  };

  const handleTaskSubmit = (data: {
    description: string;
    notes: string;
    assignee: string;
    priority: Priority;
    tags: string[];
    dueDate: string | null;
  }) => {
    if (!activeProject && !isGlobalView) return;

    if (dm.taskDialog.editingTaskId) {
      updateTask(dm.taskDialog.editingTaskId, data);
    } else {
      let projectId: string | null;
      let sectionId: string | null;

      if (dm.taskDialog.parentTaskId) {
        const parentTask = tasks.find(t => t.id === dm.taskDialog.parentTaskId);
        projectId = parentTask?.projectId || null;
        sectionId = parentTask?.sectionId || null;
      } else if (activeProject) {
        projectId = activeProject.id;
        sectionId = dm.taskDialog.sectionId || projectSections[0]?.id || null;
      } else {
        projectId = null;
        sectionId = dm.taskDialog.sectionId;
      }

      const order = dm.taskDialog.parentTaskId
        ? getSubtasks(dm.taskDialog.parentTaskId).length
        : (activeProject ? projectTasks.length : tasks.length);

      const newTask = TaskService.create({
        projectId,
        parentTaskId: dm.taskDialog.parentTaskId,
        sectionId,
        ...data,
        order,
      });
      addTask(newTask);

      // Notify TMS handler of task creation and apply state delta
      if (settings.timeManagementSystem) {
        const handler = getTMSHandler(settings.timeManagementSystem as TimeManagementSystem);
        const currentTmsState = useTMSStore.getState().state;
        const delta = handler.onTaskCreated(newTask, currentTmsState);
        if (Object.keys(delta).length > 0) {
          useTMSStore.getState().updateState(delta);
        }
      }
    }
    dm.resetTaskDialogContext();
    // Refocus the grid table after dialog closes — use setTimeout to wait for React re-render
    setTimeout(() => {
      const table = document.querySelector('table[role="grid"]') as HTMLElement;
      table?.focus();
    }, 100);
  };

  const handleTaskClick = (taskId: string) => {
    dm.selectTask(taskId);
  };

  const handleSubtaskButtonClick = (taskId: string) => {
    dm.selectTask(taskId);
    dm.setScrollToSubtasks(true);
  };

  const handleTaskComplete = (taskId: string, completed: boolean) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    updateTask(taskId, TaskService.completionUpdate(completed));

    if (task.parentTaskId === null) {
      const subtasks = getSubtasks(taskId);
      subtasks.forEach(subtask => {
        updateTask(subtask.id, TaskService.completionUpdate(completed));
      });
    }

    // Notify TMS handler of task completion and apply state delta
    if (completed && settings.timeManagementSystem) {
      const handler = getTMSHandler(settings.timeManagementSystem as TimeManagementSystem);
      const currentTmsState = useTMSStore.getState().state;
      const delta = handler.onTaskCompleted(task, currentTmsState);
      if (Object.keys(delta).length > 0) {
        useTMSStore.getState().updateState(delta);
      }
    }
  };

  const handleTaskDelete = () => {
    if (dm.taskDetailPanel.selectedTaskId) {
      deleteTask(dm.taskDetailPanel.selectedTaskId);
      dm.deselectTask();
    }
  };

  const handleAddDependency = () => {
    if (dm.taskDetailPanel.selectedTaskId) {
      dm.openDependencyDialog();
    }
  };

  const handleRemoveDependency = (blockingTaskId: string, blockedTaskId: string) => {
    const dependency = dependencies.find(
      d => d.blockingTaskId === blockingTaskId && d.blockedTaskId === blockedTaskId
    );
    if (dependency) {
      deleteDependency(dependency.id);
    }
  };

  const handleTaskExpand = () => {
    if (!dm.taskDetailPanel.selectedTaskId) return;
    const task = tasks.find(t => t.id === dm.taskDetailPanel.selectedTaskId);
    const projectId = activeProject?.id ?? task?.projectId;
    const params = new URLSearchParams();
    if (projectId) params.set('project', projectId);
    if (tabFromUrl) params.set('tab', tabFromUrl);
    params.set('task', dm.taskDetailPanel.selectedTaskId);
    params.set('expanded', 'true');
    if (!activeProject) params.set('view', 'tasks');
    router.push(`/?${params.toString()}`);
  };

  const handleTaskCollapse = () => {
    if (!dm.taskDetailPanel.selectedTaskId) return;
    const task = tasks.find(t => t.id === dm.taskDetailPanel.selectedTaskId);
    const projectId = activeProject?.id ?? task?.projectId;
    const params = new URLSearchParams();
    if (projectId) params.set('project', projectId);
    if (tabFromUrl) params.set('tab', tabFromUrl);
    params.set('task', dm.taskDetailPanel.selectedTaskId);
    if (!activeProject) params.set('view', 'tasks');
    router.push(`/?${params.toString()}`);
  };

  // --- Derived state for task detail panel ---
  const selectedTask = dm.taskDetailPanel.selectedTaskId
    ? tasks.find(t => t.id === dm.taskDetailPanel.selectedTaskId)
    : null;
  const parentTask = selectedTask?.parentTaskId
    ? tasks.find(t => t.id === selectedTask.parentTaskId)
    : null;
  const subtasks = selectedTask ? getSubtasks(selectedTask.id) : [];

  const blockingTasks = selectedTask
    ? dependencies
        .filter(d => d.blockedTaskId === selectedTask.id)
        .map(d => tasks.find(t => t.id === d.blockingTaskId))
        .filter((t): t is NonNullable<typeof t> => t !== undefined)
    : [];

  const blockedTasks = selectedTask
    ? dependencies
        .filter(d => d.blockingTaskId === selectedTask.id)
        .map(d => tasks.find(t => t.id === d.blockedTaskId))
        .filter((t): t is NonNullable<typeof t> => t !== undefined)
    : [];

  // Lock body scroll when mobile task panel overlay is visible
  useEffect(() => {
    if (isMobile && selectedTask && !expandedFromUrl) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobile, selectedTask, expandedFromUrl]);

  // --- Render ---
  return (
    <Layout
      sidebar={
        hydrated ? (
          <ProjectList
            projects={projects}
            activeProjectId={settings.activeProjectId}
            onProjectSelect={setActiveProject}
            onNewProject={handleNewProject}
          />
        ) : (
          <SkeletonProjectList />
        )
      }
      breadcrumb={<Breadcrumb />}
      searchInput={<SearchInput />}
      header={
        <>
          <div className="flex items-center gap-2 flex-wrap shrink-0 ml-auto">
            <ImportExportMenu />
            <ThemeToggle />
            {(activeProject || isGlobalView) && (
              <Button onClick={() => handleNewTask()} size="sm" className="bg-accent-brand hover:bg-accent-brand-hover text-white sm:size-default">
                <Plus className="mr-0 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">New Task</span>
              </Button>
            )}
          </div>
        </>
      }
    >
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Main content — thin router */}
        <div
          className="flex-1 min-w-0 flex flex-col h-full overflow-hidden"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            const isInteractive = target.closest('button, a, input, textarea, [role="button"]');
            const isCard = target.closest('[class*="cursor-pointer"]');
            if (dm.taskDetailPanel.selectedTaskId && !isInteractive && !isCard) {
              dm.deselectTask();
            }
          }}
        >
          {!hydrated ? (
            <SkeletonTaskList />
          ) : isGlobalView ? (
            <GlobalTasksContainer
              onTaskClick={handleTaskClick}
              onTaskComplete={handleTaskComplete}
              onAddTask={handleNewTask}
              onSubtaskButtonClick={handleSubtaskButtonClick}
              selectedTaskId={dm.taskDetailPanel.selectedTaskId}
              onProjectClick={(projectId) => router.push(`/?project=${projectId}&tab=list`)}
            />
          ) : activeProject ? (
            <ProjectView
              projectId={activeProject.id}
              selectedTaskId={dm.taskDetailPanel.selectedTaskId}
              onTaskClick={handleTaskClick}
              onSubtaskButtonClick={handleSubtaskButtonClick}
              onNewTask={handleNewTask}
              onTaskComplete={handleTaskComplete}
              onShowToast={showToast}
            />
          ) : (
            <LandingEmptyState
              onNewProject={handleNewProject}
              onImport={() => {
                const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
                fileInput?.click();
              }}
            />
          )}
        </div>

        {/* Task detail panel — mobile: full-screen overlay, desktop: sidebar */}
        {selectedTask && !expandedFromUrl && (
          isMobile ? (
            <div
              className="fixed inset-0 z-50 bg-background overflow-y-auto"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  dm.deselectTask();
                }
              }}
            >
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-background border-b px-4 py-2">
                <Button variant="ghost" size="sm" onClick={() => dm.deselectTask()}>
                  <X className="h-4 w-4 mr-1" /> Close
                </Button>
              </div>
              <div className="p-6">
                <TaskDetailPanel
                  task={selectedTask}
                  parentTask={parentTask}
                  subtasks={subtasks}
                  blockingTasks={blockingTasks}
                  blockedTasks={blockedTasks}
                  onDelete={handleTaskDelete}
                  onClose={() => {
                    dm.deselectTask();
                  }}
                  onComplete={(completed) => handleTaskComplete(selectedTask.id, completed)}
                  onExpand={handleTaskExpand}
                  onAddSubtask={() => {
                    handleNewTask(selectedTask.sectionId ?? undefined, selectedTask.id);
                  }}
                  onAddDependency={handleAddDependency}
                  onRemoveDependency={handleRemoveDependency}
                  onSubtaskClick={handleTaskClick}
                  scrollToSubtasks={dm.taskDetailPanel.scrollToSubtasks}
                />
              </div>
            </div>
          ) : (
            <div
              ref={(el) => {
                // Auto-focus first interactive element when panel opens
                if (el) {
                  requestAnimationFrame(() => {
                    const focusable = el.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                    focusable?.focus();
                  });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  dm.deselectTask();
                  // Return focus to the task row that opened the panel
                  const taskId = dm.taskDetailPanel.selectedTaskId;
                  requestAnimationFrame(() => {
                    const row = document.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`);
                    const focusable = row?.querySelector<HTMLElement>('button, [tabindex]:not([tabindex="-1"])');
                    focusable?.focus();
                  });
                }
              }}
              className="relative border-t lg:border-t-0 lg:border-l overflow-y-auto flex-shrink-0 bg-card shadow-elevation-raised animate-slide-in-right"
              style={{ width: dm.taskDetailPanel.panelWidth }}
            >
              <div
                className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors z-10"
                onMouseDown={handleTaskPanelMouseDown}
              />
              <div className="p-6">
                <TaskDetailPanel
                  task={selectedTask}
                  parentTask={parentTask}
                  subtasks={subtasks}
                  blockingTasks={blockingTasks}
                  blockedTasks={blockedTasks}
                  onDelete={handleTaskDelete}
                  onClose={() => {
                    const taskId = selectedTask.id;
                    dm.deselectTask();
                    requestAnimationFrame(() => {
                      const row = document.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`);
                      const focusable = row?.querySelector<HTMLElement>('button, [tabindex]:not([tabindex="-1"])');
                      focusable?.focus();
                    });
                  }}
                  onComplete={(completed) => handleTaskComplete(selectedTask.id, completed)}
                  onExpand={handleTaskExpand}
                  onAddSubtask={() => {
                    handleNewTask(selectedTask.sectionId ?? undefined, selectedTask.id);
                  }}
                  onAddDependency={handleAddDependency}
                  onRemoveDependency={handleRemoveDependency}
                  onSubtaskClick={handleTaskClick}
                  scrollToSubtasks={dm.taskDetailPanel.scrollToSubtasks}
                />
              </div>
            </div>
          )
        )}

        {/* Expanded task view — full page */}
        {selectedTask && expandedFromUrl && (
          <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6">
              <TaskDetailPanel
                task={selectedTask}
                parentTask={parentTask}
                subtasks={subtasks}
                blockingTasks={blockingTasks}
                blockedTasks={blockedTasks}
                onDelete={handleTaskDelete}
                onClose={handleTaskCollapse}
                onComplete={(completed) => handleTaskComplete(selectedTask.id, completed)}
                onExpand={handleTaskCollapse}
                isExpanded={true}
                onAddSubtask={() => {
                  handleNewTask(selectedTask.sectionId ?? undefined, selectedTask.id);
                }}
                onAddDependency={handleAddDependency}
                onRemoveDependency={handleRemoveDependency}
                onSubtaskClick={handleTaskClick}
                scrollToSubtasks={dm.taskDetailPanel.scrollToSubtasks}
              />
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ProjectDialog
        open={dm.projectDialog.open}
        onOpenChange={dm.setProjectDialogOpen}
        onSubmit={handleProjectSubmit}
        project={dm.projectDialog.editingProjectId ? projects.find(p => p.id === dm.projectDialog.editingProjectId) : null}
      />

      <TaskDialog
        open={dm.taskDialog.open}
        onOpenChange={dm.setTaskDialogOpen}
        onSubmit={handleTaskSubmit}
        task={dm.taskDialog.editingTaskId ? tasks.find(t => t.id === dm.taskDialog.editingTaskId) : null}
        parentTask={dm.taskDialog.parentTaskId ? tasks.find(t => t.id === dm.taskDialog.parentTaskId) : null}
      />

      {selectedTask && (
        <DependencyDialog
          open={dm.dependencyDialog.open}
          onOpenChange={dm.setDependencyDialogOpen}
          task={selectedTask}
        />
      )}

      {/* Shared State Dialog */}
      {dm.sharedStateDialog.sharedState && (
        <SharedStateDialog
          open={dm.sharedStateDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              handleLoadSharedState(dm.sharedStateDialog.sharedState!, 'cancel', onLoadResult);
              dm.closeSharedStateDialog();
            }
          }}
          sharedState={dm.sharedStateDialog.sharedState}
          currentState={{
            projects: projects.length,
            tasks: tasks.length,
            sections: sections.length,
            dependencies: dependencies.length,
          }}
          onConfirm={(mode, options) => {
            handleLoadSharedState(dm.sharedStateDialog.sharedState!, mode, onLoadResult, options);
            dm.closeSharedStateDialog();
          }}
        />
      )}

      <ShortcutHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Delete confirmation dialog triggered by 'x' shortcut */}
      <AlertDialog open={!!deleteConfirmTaskId} onOpenChange={(open) => {
        if (!open) setDeleteConfirmTaskId(null);
      }}>
        <AlertDialogContent onCloseAutoFocus={(e) => {
          // Prevent Radix from returning focus to body — focus the table instead
          e.preventDefault();
          const table = document.querySelector('table[role="grid"]') as HTMLElement;
          table?.focus();
        }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmTaskId && (() => {
                const taskToDelete = tasks.find(t => t.id === deleteConfirmTaskId);
                const subtaskCount = taskToDelete ? getSubtasks(deleteConfirmTaskId).length : 0;
                return (
                  <>
                    Are you sure you want to delete &ldquo;{taskToDelete?.description}&rdquo;?
                    {subtaskCount > 0 && (
                      <> This will also delete {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}.</>
                    )}
                    {' '}This action cannot be undone.
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmTaskId) {
                  deleteTask(deleteConfirmTaskId);
                  if (dm.taskDetailPanel.selectedTaskId === deleteConfirmTaskId) dm.deselectTask();
                }
                setDeleteConfirmTaskId(null);
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
