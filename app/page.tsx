'use client';

import { useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { ProjectList } from '@/features/projects/components/ProjectList';
import { ProjectDialog } from '@/features/projects/components/ProjectDialog';
import { TaskDialog } from '@/features/tasks/components/TaskDialog';
import { TaskDetailPanel } from '@/features/tasks/components/TaskDetailPanel';
import { DependencyDialog } from '@/features/tasks/components/DependencyDialog';
import { ProjectView } from '@/features/projects/components/ProjectView';
import { GlobalTasksContainer } from '@/components/GlobalTasksContainer';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useDataStore } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
import { getTMSHandler } from '@/features/tms/handlers';
import { ViewMode, Priority, TimeManagementSystem } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { ImportExportMenu } from '@/components/ImportExportMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toast } from '@/components/ui/toast';
import { SharedStateDialog } from '@/features/sharing/components/SharedStateDialog';
import { useDialogManager } from '@/lib/hooks/useDialogManager';
import { useSharedStateLoader, handleLoadSharedState } from '@/features/sharing/hooks/useSharedStateLoader';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectIdFromUrl = searchParams.get('project');
  const viewFromUrl = searchParams.get('view');
  const tabFromUrl = searchParams.get('tab') || 'list';
  const taskIdFromUrl = searchParams.get('task');
  const expandedFromUrl = searchParams.get('expanded') === 'true';

  const isGlobalView = viewFromUrl === 'tasks';

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

  // --- Shared state loading via useSharedStateLoader ---
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onLoadResult = useCallback(
    (result: { message: string; type: 'success' | 'error' | 'info' }) => {
      dm.showToast(result.message, result.type);
    },
    [dm.showToast]
  );

  useSharedStateLoader({
    onSharedStateLoaded: dm.openSharedStateDialog,
    onLoadResult,
  });

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
      const newProject = {
        id: uuidv4(),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
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

      const newTask = {
        id: uuidv4(),
        projectId,
        parentTaskId: dm.taskDialog.parentTaskId,
        sectionId,
        ...data,
        completed: false,
        completedAt: null,
        order,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
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

    updateTask(taskId, {
      completed,
      completedAt: completed ? new Date().toISOString() : null,
    });

    if (task.parentTaskId === null) {
      const subtasks = getSubtasks(taskId);
      subtasks.forEach(subtask => {
        updateTask(subtask.id, {
          completed,
          completedAt: completed ? new Date().toISOString() : null,
        });
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
    if (dm.taskDetailPanel.selectedTaskId && activeProject) {
      const params = new URLSearchParams();
      params.set('project', activeProject.id);
      if (tabFromUrl) params.set('tab', tabFromUrl);
      params.set('task', dm.taskDetailPanel.selectedTaskId);
      params.set('expanded', 'true');
      router.push(`/?${params.toString()}`);
    }
  };

  const handleTaskCollapse = () => {
    if (activeProject && dm.taskDetailPanel.selectedTaskId) {
      const params = new URLSearchParams();
      params.set('project', activeProject.id);
      if (tabFromUrl) params.set('tab', tabFromUrl);
      params.set('task', dm.taskDetailPanel.selectedTaskId);
      router.push(`/?${params.toString()}`);
    }
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

  // --- Render ---
  return (
    <Layout
      sidebar={
        <ProjectList
          projects={projects}
          activeProjectId={settings.activeProjectId}
          onProjectSelect={setActiveProject}
          onNewProject={handleNewProject}
        />
      }
      header={
        <>
          <div className="flex items-center gap-2 flex-wrap shrink-0 ml-auto">
            <ImportExportMenu />
            <ThemeToggle />
            {(activeProject || isGlobalView) && (
              <Button onClick={() => handleNewTask()} size="sm" className="sm:size-default">
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
          {isGlobalView ? (
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
              onShowToast={dm.showToast}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-muted-foreground mb-4">
                Select a project from the sidebar or create a new one to get started
              </p>
              <Button onClick={handleNewProject}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
          )}
        </div>

        {/* Task detail panel — sidebar */}
        {selectedTask && !expandedFromUrl && (
          <div
            className="relative border-t lg:border-t-0 lg:border-l overflow-y-auto flex-shrink-0"
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
                onClose={() => dm.deselectTask()}
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
          onConfirm={(mode) => {
            handleLoadSharedState(dm.sharedStateDialog.sharedState!, mode, onLoadResult);
            dm.closeSharedStateDialog();
          }}
        />
      )}

      {dm.loadingToast && (
        <Toast
          message={dm.loadingToast.message}
          type={dm.loadingToast.type}
          onClose={() => dm.dismissToast()}
        />
      )}
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
