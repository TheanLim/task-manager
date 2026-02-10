'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { ProjectList } from '@/components/ProjectList';
import { ProjectDialog } from '@/components/ProjectDialog';
import { ProjectTabs } from '@/components/ProjectTabs';
import { ProjectOverview } from '@/components/ProjectOverview';
import { TaskList } from '@/components/TaskList';
import { TaskBoard } from '@/components/TaskBoard';
import { TaskCalendar } from '@/components/TaskCalendar';
import { TaskDialog } from '@/components/TaskDialog';
import { TaskDetailPanel } from '@/components/TaskDetailPanel';
import { DependencyDialog } from '@/components/DependencyDialog';
import { TMSSelector } from '@/components/TMSSelector';
import { DITView } from '@/components/DITView';
import { AF4View } from '@/components/AF4View';
import { FVPView } from '@/components/FVPView';
import { InlineEditable } from '@/components/InlineEditable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useDataStore } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { useTMSStore } from '@/stores/tmsStore';
import { getTMSHandler } from '@/lib/tms';
import { validateProjectName } from '@/lib/validation';
import { ViewMode, Priority, TimeManagementSystem } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { ImportExportMenu } from '@/components/ImportExportMenu';
import { ShareButton } from '@/components/ShareButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SearchBar } from '@/components/SearchBar';
import { FilterPanel } from '@/components/FilterPanel';
import { useFilteredTasks } from '@/lib/hooks/useFilteredTasks';
import { ShareService } from '@/lib/share/shareService';
import { Toast } from '@/components/ui/toast';
import { SharedStateDialog } from '@/components/SharedStateDialog';
import { AppState } from '@/types';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectIdFromUrl = searchParams.get('project');
  const tabFromUrl = searchParams.get('tab') || 'list'; // Default to 'list' instead of 'overview'
  const taskIdFromUrl = searchParams.get('task');
  const expandedFromUrl = searchParams.get('expanded') === 'true';

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [dependencyDialogOpen, setDependencyDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [scrollToSubtasks, setScrollToSubtasks] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [taskDialogSectionId, setTaskDialogSectionId] = useState<string | null>(null);
  const [taskDialogParentId, setTaskDialogParentId] = useState<string | null>(null);
  const [taskPanelWidth, setTaskPanelWidth] = useState(384); // Default 384px (w-96)
  const [isResizingTaskPanel, setIsResizingTaskPanel] = useState(false);
  const [loadingToast, setLoadingToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [sharedStateDialog, setSharedStateDialog] = useState<{
    open: boolean;
    sharedState: AppState | null;
  }>({ open: false, sharedState: null });

  const minTaskPanelWidth = 300;
  const maxTaskPanelWidth = 800;

  // Store hooks
  const {
    projects,
    tasks,
    sections,
    dependencies,
    addProject,
    updateProject,
    deleteProject,
    addTask,
    updateTask,
    deleteTask,
    deleteDependency,
    getTasksByProjectId,
    getSubtasks,
    getSectionsByProjectId,
    getProjectById
  } = useDataStore();

  const { settings, setActiveProject, setProjectTab, getProjectTab } = useAppStore();
  const { state: tmsState } = useTMSStore();

  // Load shared state from URL hash on mount and when hash changes
  useEffect(() => {
    const loadSharedState = async () => {
      // Wait a bit for Zustand stores to hydrate from localStorage
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const shareService = new ShareService();
      const result = await shareService.loadSharedState();
      
      if (result.success && result.state) {
        // Check if user has existing data (after hydration)
        const currentState = useDataStore.getState();
        const hasExistingData = 
          currentState.projects.length > 0 || 
          currentState.tasks.length > 0 || 
          currentState.sections.length > 0 || 
          currentState.dependencies.length > 0;
        
        if (hasExistingData) {
          // Show dialog to ask user what to do
          setSharedStateDialog({
            open: true,
            sharedState: result.state
          });
        } else {
          // No existing data, load directly
          handleLoadSharedState(result.state, 'replace');
        }
      } else if (result.error && result.error !== 'No shared state found in URL') {
        // Show error message (but not for normal page loads without shared state)
        setLoadingToast({ message: result.error, type: 'error' });
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
  }, []); // Run only once on mount, but listen to hash changes
  
  const handleLoadSharedState = (sharedState: AppState, mode: 'replace' | 'merge' | 'cancel') => {
    if (mode === 'cancel') {
      // Remove hash from URL without loading
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      setSharedStateDialog({ open: false, sharedState: null });
      return;
    }
    
    if (mode === 'replace') {
      // Replace all data
      useDataStore.setState({
        projects: sharedState.projects,
        tasks: sharedState.tasks,
        sections: sharedState.sections,
        dependencies: sharedState.dependencies
      });
      
      setLoadingToast({ message: 'Shared data loaded successfully!', type: 'success' });
    } else {
      // Merge data - filter out duplicates by ID
      // First, deduplicate existing data in case there are already duplicates
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
      
      useDataStore.setState({
        projects: [...uniqueProjects, ...newProjects],
        tasks: [...uniqueTasks, ...newTasks],
        sections: [...uniqueSections, ...newSections],
        dependencies: [...uniqueDependencies, ...newDependencies]
      });
      
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
      
      if (cleanedCount > 0 && skippedCount > 0) {
        setLoadingToast({ 
          message: `Merged ${addedCount} items (${skippedCount} duplicates skipped, ${cleanedCount} existing duplicates cleaned)`, 
          type: 'info' 
        });
      } else if (cleanedCount > 0) {
        setLoadingToast({ 
          message: `Merged ${addedCount} items (${cleanedCount} existing duplicates cleaned)`, 
          type: 'info' 
        });
      } else if (skippedCount > 0) {
        setLoadingToast({ 
          message: `Merged ${addedCount} items (${skippedCount} duplicates skipped)`, 
          type: 'info' 
        });
      } else {
        setLoadingToast({ message: 'Shared data merged successfully!', type: 'success' });
      }
    }
    
    // Remove hash from URL
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    
    // Close dialog
    setSharedStateDialog({ open: false, sharedState: null });
  };

  // Sync URL with active project and handle invalid project IDs
  useEffect(() => {
    if (projectIdFromUrl) {
      const project = getProjectById(projectIdFromUrl);
      if (project) {
        // Valid project ID - set as active
        if (settings.activeProjectId !== projectIdFromUrl) {
          setActiveProject(projectIdFromUrl);
        }
      } else {
        // Invalid project ID - redirect to project list
        router.push('/');
      }
    } else {
      // No project in URL - clear active project
      if (settings.activeProjectId !== null) {
        setActiveProject(null);
      }
    }
  }, [projectIdFromUrl, getProjectById, settings.activeProjectId, setActiveProject, router]);

  const activeProject = projects.find(p => p.id === settings.activeProjectId);
  // Get ALL tasks for the project (including subtasks) for drag/drop to work correctly
  const projectTasks = activeProject ? tasks.filter(t => t.projectId === activeProject.id) : [];
  const projectSections = activeProject ? getSectionsByProjectId(activeProject.id) : [];
  const filteredTasks = useFilteredTasks(projectTasks);

  // Navigate to a specific tab
  const navigateToTab = (tab: string) => {
    if (activeProject) {
      setProjectTab(activeProject.id, tab);
      router.push(`/?project=${activeProject.id}&tab=${tab}`);
    }
  };

  // Sync tab from URL with localStorage
  useEffect(() => {
    if (activeProject && tabFromUrl) {
      const storedTab = getProjectTab(activeProject.id);
      // If URL tab differs from stored tab, update stored tab
      if (storedTab !== tabFromUrl) {
        setProjectTab(activeProject.id, tabFromUrl);
      }
    }
  }, [activeProject, tabFromUrl, getProjectTab, setProjectTab]);

  // Sync task from URL
  useEffect(() => {
    if (taskIdFromUrl) {
      setSelectedTaskId(taskIdFromUrl);
    }
  }, [taskIdFromUrl]);

  // Close task sidebar when switching tabs
  useEffect(() => {
    if (selectedTaskId && !expandedFromUrl) {
      setSelectedTaskId(null);
    }
  }, [tabFromUrl]); // Only depend on tabFromUrl, not selectedTaskId to avoid infinite loop

  // Initialize TMS on mount and check for day change
  useEffect(() => {
    if (settings.timeManagementSystem) {
      const handler = getTMSHandler(settings.timeManagementSystem);
      handler.initialize(tasks);
    }
  }, [settings.timeManagementSystem, tasks]);

  // Handle task panel resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingTaskPanel) return;

      // Calculate from the right edge of the window
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= minTaskPanelWidth && newWidth <= maxTaskPanelWidth) {
        setTaskPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingTaskPanel(false);
    };

    if (isResizingTaskPanel) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingTaskPanel]);

  const handleTaskPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingTaskPanel(true);
  };

  // Handlers
  const handleNewProject = () => {
    setEditingProject(null);
    setProjectDialogOpen(true);
  };

  const handleProjectSubmit = (data: { name: string; description: string; viewMode: ViewMode }) => {
    if (editingProject) {
      updateProject(editingProject, data);
    } else {
      const newProject = {
        id: uuidv4(),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      addProject(newProject);
      // Navigate to the new project
      router.push(`/?project=${newProject.id}`);
    }
  };

  const handleNewTask = (sectionId?: string, parentTaskId?: string) => {
    if (!activeProject) return;
    setEditingTask(null);
    setTaskDialogSectionId(sectionId || null);
    setTaskDialogParentId(parentTaskId || null);
    setTaskDialogOpen(true);
  };

  const handleTaskSubmit = (data: {
    description: string;
    notes: string;
    assignee: string;
    priority: Priority;
    tags: string[];
    dueDate: string | null;
  }) => {
    if (!activeProject) return;

    if (editingTask) {
      updateTask(editingTask, data);
    } else {
      // Calculate order based on whether this is a subtask or top-level task
      const order = taskDialogParentId 
        ? getSubtasks(taskDialogParentId).length  // Order within subtasks
        : projectTasks.length;                     // Order within project
      
      const newTask = {
        id: uuidv4(),
        projectId: activeProject.id,
        parentTaskId: taskDialogParentId,  // Use state instead of hardcoded null
        sectionId: taskDialogSectionId || projectSections[0]?.id || null,
        ...data,
        completed: false,
        completedAt: null,
        order,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      addTask(newTask);
    }
    setTaskDialogSectionId(null);
    setTaskDialogParentId(null);  // Reset parent ID after creation
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setScrollToSubtasks(false); // Reset scroll flag on normal click
  };

  const handleSubtaskButtonClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setScrollToSubtasks(true); // Set scroll flag when clicking subtask button
  };

  const handleTaskComplete = (taskId: string, completed: boolean) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Update the task itself
    updateTask(taskId, {
      completed,
      completedAt: completed ? new Date().toISOString() : null
    });
    
    // If this is a parent task (parentTaskId === null), cascade to subtasks
    if (task.parentTaskId === null) {
      const subtasks = getSubtasks(taskId);
      subtasks.forEach(subtask => {
        updateTask(subtask.id, {
          completed,
          completedAt: completed ? new Date().toISOString() : null
        });
      });
    }
  };

  const handleTaskEdit = () => {
    if (selectedTaskId) {
      setEditingTask(selectedTaskId);
      setTaskDialogOpen(true);
    }
  };

  const handleTaskDelete = () => {
    if (selectedTaskId) {
      deleteTask(selectedTaskId);
      setSelectedTaskId(null);
    }
  };

  const handleAddDependency = () => {
    if (selectedTaskId) {
      setDependencyDialogOpen(true);
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
    if (selectedTaskId && activeProject) {
      const params = new URLSearchParams();
      params.set('project', activeProject.id);
      if (tabFromUrl) params.set('tab', tabFromUrl);
      params.set('task', selectedTaskId);
      params.set('expanded', 'true');
      router.push(`/?${params.toString()}`);
    }
  };

  const handleTaskCollapse = () => {
    if (activeProject && selectedTaskId) {
      const params = new URLSearchParams();
      params.set('project', activeProject.id);
      if (tabFromUrl) params.set('tab', tabFromUrl);
      params.set('task', selectedTaskId);
      // Remove the expanded parameter to go back to sidebar view
      router.push(`/?${params.toString()}`);
    }
  };

  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;
  const parentTask = selectedTask?.parentTaskId ? tasks.find(t => t.id === selectedTask.parentTaskId) : null;
  const subtasks = selectedTask ? getSubtasks(selectedTask.id) : [];
  
  // Get dependencies for selected task
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
            {activeProject && (
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
        {/* Sidebar with search, filters, and TMS selector */}
        {/* {activeProject && (
          <div className="w-full lg:w-80 space-y-4 overflow-y-auto">
            <TMSSelector />
            <SearchBar />
            <FilterPanel />
          </div>
        )} */}

        {/* Main content */}
        <div 
          className="flex-1 min-w-0 flex flex-col h-full overflow-hidden"
          onClick={(e) => {
            // Close task detail panel when clicking in main content area
            // but not when clicking on interactive elements (buttons, cards, etc.)
            const target = e.target as HTMLElement;
            const isInteractive = target.closest('button, a, input, textarea, [role="button"]');
            const isCard = target.closest('[class*="cursor-pointer"]');
            
            if (selectedTaskId && !isInteractive && !isCard) {
              setSelectedTaskId(null);
            }
          }}
        >
          {activeProject ? (
            <>
              {/* Sticky Header: Project Name and Share Button */}
              <div className="flex-shrink-0 mb-4 flex items-center gap-4">
                <InlineEditable
                  value={activeProject.name}
                  onSave={(newName) => updateProject(activeProject.id, { name: newName })}
                  validate={validateProjectName}
                  placeholder="Project name"
                  displayClassName="text-2xl font-bold"
                  className="text-2xl font-bold"
                />
                <div className="ml-auto">
                  <ShareButton 
                    variant="button"
                    projectId={activeProject.id}
                    projectName={activeProject.name}
                    onShowToast={(message, type) => setLoadingToast({ message, type })}
                  />
                </div>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-auto">{settings.timeManagementSystem === TimeManagementSystem.DIT && (
                <DITView
                  tasks={filteredTasks}
                  onTaskClick={handleTaskClick}
                  onTaskComplete={handleTaskComplete}
                />
              )}
              
              {settings.timeManagementSystem === TimeManagementSystem.AF4 && (
                <AF4View
                  tasks={filteredTasks}
                  onTaskClick={handleTaskClick}
                  onTaskComplete={handleTaskComplete}
                />
              )}
              
              {settings.timeManagementSystem === TimeManagementSystem.FVP && (
                <FVPView
                  tasks={filteredTasks}
                  onTaskClick={handleTaskClick}
                  onTaskComplete={handleTaskComplete}
                />
              )}
              
              {settings.timeManagementSystem === TimeManagementSystem.NONE && (
                <ProjectTabs
                  activeTab={tabFromUrl}
                  onTabChange={navigateToTab}
                >
                  {{
                    overview: (
                      <ProjectOverview
                        project={activeProject}
                        tasks={projectTasks}
                        onUpdateProject={(updates) => updateProject(activeProject.id, updates)}
                        onDeleteProject={() => deleteProject(activeProject.id)}
                      />
                    ),
                    list: (
                      <TaskList
                        tasks={filteredTasks}
                        sections={projectSections}
                        onTaskClick={handleTaskClick}
                        onTaskComplete={handleTaskComplete}
                        onAddTask={handleNewTask}
                        onViewSubtasks={handleTaskClick}
                        onSubtaskButtonClick={handleSubtaskButtonClick}
                        onAddSubtask={(parentTaskId) => handleNewTask(undefined, parentTaskId)}
                        selectedTaskId={selectedTaskId}
                      />
                    ),
                    board: (
                      <TaskBoard
                        tasks={filteredTasks}
                        sections={projectSections}
                        onTaskClick={handleTaskClick}
                        onTaskComplete={handleTaskComplete}
                        onTaskMove={(taskId, sectionId) => {
                          updateTask(taskId, { sectionId });
                        }}
                        onAddTask={handleNewTask}
                        onAddSubtask={(parentTaskId) => handleNewTask(undefined, parentTaskId)}
                      />
                    ),
                    calendar: (
                      <TaskCalendar
                        tasks={filteredTasks}
                        onTaskClick={handleTaskClick}
                        onTaskComplete={handleTaskComplete}
                      />
                    ),
                  }}
                </ProjectTabs>
              )}
              </div>
            </>
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

        {/* Task detail panel */}
        {selectedTask && !expandedFromUrl && (
          <div 
            className="relative border-t lg:border-t-0 lg:border-l overflow-y-auto flex-shrink-0"
            style={{ width: taskPanelWidth }}
          >
            {/* Resize handle */}
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
                onClose={() => setSelectedTaskId(null)}
                onComplete={(completed) => handleTaskComplete(selectedTask.id, completed)}
                onExpand={handleTaskExpand}
                onAddSubtask={() => {
                  handleNewTask(selectedTask.sectionId ?? undefined, selectedTask.id);
                }}
                onAddDependency={handleAddDependency}
                onRemoveDependency={handleRemoveDependency}
                onSubtaskClick={handleTaskClick}
                scrollToSubtasks={scrollToSubtasks}
              />
            </div>
          </div>
        )}

        {/* Expanded task view - full page */}
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
                scrollToSubtasks={scrollToSubtasks}
              />
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ProjectDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onSubmit={handleProjectSubmit}
        project={editingProject ? projects.find(p => p.id === editingProject) : null}
      />

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        onSubmit={handleTaskSubmit}
        task={editingTask ? tasks.find(t => t.id === editingTask) : null}
        parentTask={taskDialogParentId ? tasks.find(t => t.id === taskDialogParentId) : null}
      />

      {selectedTask && (
        <DependencyDialog
          open={dependencyDialogOpen}
          onOpenChange={setDependencyDialogOpen}
          task={selectedTask}
        />
      )}

      {/* Shared State Dialog */}
      {sharedStateDialog.sharedState && (
        <SharedStateDialog
          open={sharedStateDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              // User closed dialog without choosing - treat as cancel
              handleLoadSharedState(sharedStateDialog.sharedState!, 'cancel');
            }
          }}
          sharedState={sharedStateDialog.sharedState}
          currentState={{
            projects: projects.length,
            tasks: tasks.length,
            sections: sections.length,
            dependencies: dependencies.length,
          }}
          onConfirm={(mode) => handleLoadSharedState(sharedStateDialog.sharedState!, mode)}
        />
      )}

      {loadingToast && (
        <Toast
          message={loadingToast.message}
          type={loadingToast.type}
          onClose={() => setLoadingToast(null)}
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
