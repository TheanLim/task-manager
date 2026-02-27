'use client';

import { Button } from '@/components/ui/button';
import type { Task } from '@/types';
import type { DITState } from '../handlers/DITHandler';

interface DITMoveButtonsProps {
  task: Task;
  ditState: DITState;
  onMoveToToday: (taskId: string) => void;
  onMoveToTomorrow: (taskId: string) => void;
  onMoveToInbox: (taskId: string) => void;
}

/**
 * DITMoveButtons — hover-revealed move buttons for DIT mode.
 *
 * Renders only the buttons that are meaningful for the task's current schedule state:
 * - "Today" only when task is NOT already in todayTasks
 * - "Tomorrow" only when task is NOT already in tomorrowTasks
 * - "Inbox" only when task IS in todayTasks or tomorrowTasks
 *
 * Feature: tms-inline-interactions, Properties 13 and 14
 */
export function DITMoveButtons({ task, ditState, onMoveToToday, onMoveToTomorrow, onMoveToInbox }: DITMoveButtonsProps) {
  const isToday = ditState.todayTasks.includes(task.id);
  const isTomorrow = ditState.tomorrowTasks.includes(task.id);
  const isScheduled = isToday || isTomorrow;

  return (
    <div className="flex items-center gap-1">
      {!isToday && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-6 px-2"
          onClick={(e) => { e.stopPropagation(); onMoveToToday(task.id); }}
          aria-label="Move to Today"
        >
          Today
        </Button>
      )}
      {!isTomorrow && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-6 px-2"
          onClick={(e) => { e.stopPropagation(); onMoveToTomorrow(task.id); }}
          aria-label="Move to Tomorrow"
        >
          Tomorrow
        </Button>
      )}
      {isScheduled && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-6 px-2"
          onClick={(e) => { e.stopPropagation(); onMoveToInbox(task.id); }}
          aria-label="Move to Inbox"
        >
          Inbox
        </Button>
      )}
    </div>
  );
}
