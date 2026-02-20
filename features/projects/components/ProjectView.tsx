'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProjectTabs } from '@/features/projects/components/ProjectTabs';
import { ProjectOverview } from '@/features/projects/components/ProjectOverview';
import { TaskList } from '@/features/tasks/components/TaskList';
import { TaskBoard } from '@/features/tasks/components/TaskBoard';
import { TaskCalendar } from '@/features/tasks/components/TaskCalendar';
import { AutomationTab } from '@/features/automations/components/AutomationTab';
import { RuleDialog, type PrefillTrigger } from '@/features/automations/components/wizard/RuleDialog';
import { InlineEditable } from '@/components/InlineEditable';
import { ShareButton } from '@/features/sharing/components/ShareButton';
import { useDataStore, automationRuleRepository } from '@/stores/dataStore';
import { useAppStore } from '@/stores/appStore';
import { useFilteredTasks } from '@/features/tasks/hooks/useFilteredTasks';
import { validateProjectName } from '@/lib/validation';

export interface ProjectViewProps {
  projectId: string;
  selectedTaskId: string | null;
  onTaskClick: (taskId: string) => void;
  onSubtaskButtonClick: (taskId: string) => void;
  onNewTask: (sectionId?: string, parentTaskId?: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function ProjectView({
  projectId,
  selectedTaskId,
  onTaskClick,
  onSubtaskButtonClick,
  onNewTask,
  onTaskComplete,
  onShowToast,
}: ProjectViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'list';

  const {
    tasks,
    updateProject,
    updateTask,
    deleteProject,
    getSectionsByProjectId,
    getProjectById,
  } = useDataStore();

  const { setProjectTab, getProjectTab } = useAppStore();

  const activeProject = getProjectById(projectId);

  // Get ALL tasks for the project (including subtasks) for drag/drop to work correctly
  const projectTasks = activeProject ? tasks.filter(t => t.projectId === activeProject.id) : [];
  const projectSections = activeProject ? getSectionsByProjectId(activeProject.id) : [];
  const filteredTasks = useFilteredTasks(projectTasks);

  // Section context menu → RuleDialog state
  const [sectionRuleDialogOpen, setSectionRuleDialogOpen] = useState(false);
  const [sectionPrefillTrigger, setSectionPrefillTrigger] = useState<PrefillTrigger | null>(null);

  const handleOpenRuleDialogFromSection = (prefill: PrefillTrigger) => {
    setSectionPrefillTrigger(prefill);
    setSectionRuleDialogOpen(true);
  };

  const handleSectionRuleDialogClose = (open: boolean) => {
    setSectionRuleDialogOpen(open);
    if (!open) {
      setSectionPrefillTrigger(null);
    }
  };

  // Compute enabled rule count for the automations tab badge (reactive to repository changes)
  const [enabledRuleCount, setEnabledRuleCount] = useState(() => {
    if (!activeProject) return 0;
    const rules = automationRuleRepository.findByProjectId(activeProject.id);
    return rules.filter(rule => rule.enabled).length;
  });

  const [totalRuleCount, setTotalRuleCount] = useState(() => {
    if (!activeProject) return 0;
    return automationRuleRepository.findByProjectId(activeProject.id).length;
  });

  useEffect(() => {
    if (!activeProject) return;

    // Update count immediately
    const updateCount = () => {
      const rules = automationRuleRepository.findByProjectId(activeProject.id);
      setEnabledRuleCount(rules.filter(rule => rule.enabled).length);
      setTotalRuleCount(rules.length);
    };

    updateCount();

    // Subscribe to repository changes
    const unsubscribe = automationRuleRepository.subscribe(() => {
      updateCount();
    });

    return unsubscribe;
  }, [activeProject]);

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
      if (storedTab !== tabFromUrl) {
        setProjectTab(activeProject.id, tabFromUrl);
      }
    }
  }, [activeProject, tabFromUrl, getProjectTab, setProjectTab]);

  if (!activeProject) {
    return null;
  }

  return (
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
            onShowToast={(message, type) => onShowToast(message, type)}
          />
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-auto">
        <ProjectTabs
          activeTab={tabFromUrl}
          onTabChange={navigateToTab}
          enabledRuleCount={enabledRuleCount}
          totalRuleCount={totalRuleCount}
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
                onTaskClick={onTaskClick}
                onTaskComplete={onTaskComplete}
                onAddTask={(sectionId) => onNewTask(sectionId)}
                onViewSubtasks={onTaskClick}
                onSubtaskButtonClick={onSubtaskButtonClick}
                onAddSubtask={(parentTaskId) => onNewTask(undefined, parentTaskId)}
                selectedTaskId={selectedTaskId}
                onOpenRuleDialog={handleOpenRuleDialogFromSection}
              />
            ),
            board: (
              <TaskBoard
                tasks={filteredTasks}
                sections={projectSections}
                onTaskClick={onTaskClick}
                onTaskComplete={onTaskComplete}
                onTaskMove={(taskId, sectionId) => {
                  updateTask(taskId, { sectionId });
                }}
                onAddTask={(sectionId) => onNewTask(sectionId)}
                onAddSubtask={(parentTaskId) => onNewTask(undefined, parentTaskId)}
                onOpenRuleDialog={handleOpenRuleDialogFromSection}
              />
            ),
            calendar: (
              <TaskCalendar
                tasks={filteredTasks}
                onTaskClick={onTaskClick}
                onTaskComplete={onTaskComplete}
              />
            ),
            automations: (
              <AutomationTab
                projectId={activeProject.id}
                sections={projectSections}
                onShowToast={onShowToast}
              />
            ),
          }}
        </ProjectTabs>
      </div>

      {/* RuleDialog opened from section context menus */}
      <RuleDialog
        open={sectionRuleDialogOpen}
        onOpenChange={handleSectionRuleDialogClose}
        projectId={activeProject.id}
        sections={projectSections}
        prefillTrigger={sectionPrefillTrigger}
      />
    </>
  );
}
