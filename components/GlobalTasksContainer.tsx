'use client';

import { GlobalTasksHeader } from '@/components/GlobalTasksHeader';
import { GlobalTasksView } from '@/components/GlobalTasksView';

interface GlobalTasksContainerProps {
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
  onAddTask: (sectionId?: string, parentTaskId?: string) => void;
  onSubtaskButtonClick: (taskId: string) => void;
  selectedTaskId: string | null;
  onProjectClick: (projectId: string) => void;
}

/**
 * Container component for the Global Tasks view.
 * Wraps GlobalTasksHeader (with display mode toggle) and GlobalTasksView.
 * Display mode state (nested/flat) is managed by useAppStore inside the child components.
 *
 * Requirement 5.2: Extract a GlobalTasksContainer component that handles
 * the global tasks view with its header and display modes.
 */
export function GlobalTasksContainer({
  onTaskClick,
  onTaskComplete,
  onAddTask,
  onSubtaskButtonClick,
  selectedTaskId,
  onProjectClick,
}: GlobalTasksContainerProps) {
  return (
    <>
      {/* Header with display mode toggle */}
      <div className="flex-shrink-0 mb-4">
        <GlobalTasksHeader onAddTask={() => onAddTask()} />
      </div>

      {/* Scrollable task list */}
      <div className="flex-1 overflow-auto">
        <GlobalTasksView
          onTaskClick={onTaskClick}
          onTaskComplete={onTaskComplete}
          onAddTask={(sectionId) => onAddTask(sectionId)}
          onViewSubtasks={onTaskClick}
          onSubtaskButtonClick={onSubtaskButtonClick}
          onAddSubtask={(parentTaskId) => onAddTask(undefined, parentTaskId)}
          selectedTaskId={selectedTaskId}
          onProjectClick={onProjectClick}
        />
      </div>
    </>
  );
}
