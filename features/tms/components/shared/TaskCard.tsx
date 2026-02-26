import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { PriorityBadge } from './PriorityBadge';
import { DueDateLabel } from './DueDateLabel';
import type { Task } from '@/types';

interface TaskCardProps {
  task: Task;
  variant?: 'default' | 'current' | 'flagged' | 'attention' | 'completed';
  dotted?: boolean;
  showCheckbox?: boolean;
  showPriority?: boolean;
  showDueDate?: boolean;
  showProjectName?: boolean;
  projectName?: string;
  actions?: React.ReactNode;
  onClick?: () => void;
  onComplete?: (completed: boolean) => void;
}

const variantClasses: Record<NonNullable<TaskCardProps['variant']>, string> = {
  default:   'bg-card border border-border rounded-xl p-3',
  current:   'bg-[#131a19] border border-primary rounded-xl p-3 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-primary before:rounded-l-xl',
  flagged:   'bg-[#1a1510] border-t border-r border-b border-border rounded-xl p-3 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-amber-500 before:rounded-l-xl',
  attention: 'bg-[#0f1a19] border-t border-r border-b border-border rounded-xl p-3 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-primary before:rounded-l-xl',
  completed: 'bg-card border border-border rounded-xl p-3 opacity-60',
};

export function TaskCard({
  task,
  variant = 'default',
  dotted = false,
  showCheckbox = true,
  showPriority = true,
  showDueDate = true,
  showProjectName = false,
  projectName,
  actions,
  onClick,
  onComplete,
}: TaskCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      onClick?.();
    } else if (e.key === ' ') {
      e.preventDefault();
      onComplete?.(!task.completed);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      role="article"
      className={`${variantClasses[variant]} relative overflow-hidden min-h-[44px] hover:bg-muted hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:-translate-y-px transition-[transform,box-shadow,background-color,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start gap-2">
        {dotted && (
          <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_rgba(13,148,136,0.25)] shrink-0 mt-1.5" aria-hidden="true" />
        )}
        {showCheckbox && (
          <Checkbox
            checked={task.completed}
            onCheckedChange={(checked) => onComplete?.(checked as boolean)}
            onClick={handleCheckboxClick}
            className="mt-0.5 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <span
            className={`text-sm font-medium ${
              task.completed
                ? 'line-through text-muted-foreground'
                : 'text-foreground'
            }`}
          >
            {task.description}
          </span>
          {(showPriority || showDueDate || showProjectName) && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {showPriority && task.priority !== 'none' && (
                <PriorityBadge priority={task.priority} />
              )}
              {showDueDate && task.dueDate && (
                <DueDateLabel dueDate={task.dueDate} />
              )}
              {showProjectName && projectName && (
                <span className="text-xs text-muted-foreground">{projectName}</span>
              )}
            </div>
          )}
        </div>
      </div>
      {actions && (
        <div className="border-t border-border mt-3 pt-3">
          {actions}
        </div>
      )}
    </div>
  );
}
