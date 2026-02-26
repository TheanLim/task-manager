/**
 * TaskListView — shared wrapper for TMS task lists.
 *
 * Handles empty state check, space-y-2 wrapper, and key assignment.
 * Each view's renderTask callback handles variant selection, actions slot, etc.
 *
 * Ref: Phase 7C.2
 */

import React from 'react';
import { Task } from '@/types';

export interface TaskListViewProps {
  tasks: Task[];
  renderTask: (task: Task, index: number) => React.ReactNode;
  emptyState: React.ReactNode;
  className?: string;
}

export function TaskListView({ tasks, renderTask, emptyState, className }: TaskListViewProps) {
  if (tasks.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className={className ?? 'space-y-2'}>
      {tasks.map((task, index) => (
        <React.Fragment key={task.id}>
          {renderTask(task, index)}
        </React.Fragment>
      ))}
    </div>
  );
}
