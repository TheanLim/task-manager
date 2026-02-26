'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sun, CalendarDays, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskList } from '@/features/tasks/components/TaskList';
import { TMSEmptyState } from './shared/TMSEmptyState';
import type { TMSViewProps } from '../handlers';
import type { DITState, DITAction } from '../handlers/DITHandler';
import type { Section, Task } from '@/types';

/**
 * DIT (Do It Tomorrow) View — Reuses TaskList
 *
 * Three virtual sections: Today, Tomorrow, Inbox.
 * Each task gets action buttons via tmsTaskProps.actionsSlot.
 * Zone-specific CSS via tmsTaskProps.tmsVariant is not needed here —
 * the section headers provide the visual grouping.
 */

/** Spring presets — gentle feel for DIT's calm personality */
const SPRING_GENTLE = { type: 'spring' as const, stiffness: 350, damping: 28 };
const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 500, damping: 32 };

const SECTIONS: Section[] = [
  { id: '__dit_today__', projectId: null, name: 'Today', order: 0, collapsed: false, createdAt: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z' },
  { id: '__dit_tomorrow__', projectId: null, name: 'Tomorrow', order: 1, collapsed: false, createdAt: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z' },
  { id: '__dit_inbox__', projectId: null, name: 'Inbox', order: 2, collapsed: false, createdAt: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z' },
];

export function DITView({
  tasks,
  systemState,
  dispatch,
  onTaskClick,
  onTaskComplete,
}: TMSViewProps<DITState>) {
  const ditDispatch = dispatch as (a: DITAction) => void;

  // Assign each task to a virtual section based on DIT state
  const assignedTasks = useMemo(() => {
    const todaySet = new Set(systemState.todayTasks);
    const tomorrowSet = new Set(systemState.tomorrowTasks);

    return tasks.map((t, i) => {
      let sectionId: string;
      if (todaySet.has(t.id)) sectionId = '__dit_today__';
      else if (tomorrowSet.has(t.id)) sectionId = '__dit_tomorrow__';
      else sectionId = '__dit_inbox__';
      return { ...t, sectionId, order: i };
    });
  }, [tasks, systemState.todayTasks, systemState.tomorrowTasks]);

  const allEmpty = tasks.length === 0;

  if (allEmpty) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_GENTLE}
      >
        <TMSEmptyState
          icon={<Sun className="h-6 w-6" />}
          title="No tasks yet"
          description="Add tasks to start using Do It Tomorrow."
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <TaskList
        tasks={assignedTasks}
        sections={SECTIONS}
        onTaskClick={onTaskClick}
        onTaskComplete={(taskId, completed) => onTaskComplete(taskId, completed)}
        onAddTask={() => {}}
        onMoveToToday={(taskId) => ditDispatch({ type: 'MOVE_TO_TODAY', taskId })}
        onMoveToTomorrow={(taskId) => ditDispatch({ type: 'MOVE_TO_TOMORROW', taskId })}
        onMoveToInbox={(taskId) => ditDispatch({ type: 'REMOVE_FROM_SCHEDULE', taskId })}
        tmsTaskProps={(task) => {
          const sectionId = task.sectionId;
          if (sectionId === '__dit_today__') {
            return {
              trailingSlot: (
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95, y: 1 }} transition={SPRING_SNAPPY}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      ditDispatch({ type: 'MOVE_TO_TOMORROW', taskId: task.id });
                    }}
                  >
                    → Tomorrow
                  </Button>
                </motion.div>
              ),
            };
          }
          if (sectionId === '__dit_tomorrow__') {
            return {
              trailingSlot: (
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95, y: 1 }} transition={SPRING_SNAPPY}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      ditDispatch({ type: 'MOVE_TO_TODAY', taskId: task.id });
                    }}
                  >
                    ← Today
                  </Button>
                </motion.div>
              ),
            };
          }
          // Inbox
          return {
            trailingSlot: (
              <div className="flex gap-0.5">
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95, y: 1 }} transition={SPRING_SNAPPY}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs hover:text-accent-brand"
                    onClick={(e) => {
                      e.stopPropagation();
                      ditDispatch({ type: 'MOVE_TO_TODAY', taskId: task.id });
                    }}
                  >
                    → Today
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95, y: 1 }} transition={SPRING_SNAPPY}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      ditDispatch({ type: 'MOVE_TO_TOMORROW', taskId: task.id });
                    }}
                  >
                    → Tomorrow
                  </Button>
                </motion.div>
              </div>
            ),
          };
        }}
      />
    </motion.div>
  );
}
