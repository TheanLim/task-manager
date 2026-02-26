'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TaskList } from '@/features/tasks/components/TaskList';
import { TMSEmptyState } from './shared/TMSEmptyState';
import type { TMSViewProps } from '../handlers';
import type { AF4State, AF4Action } from '../handlers/af4';
import type { Section } from '@/types';
import { getCurrentTask, isFullPassComplete } from '../handlers/af4';

/**
 * AF4 (Autofocus 4) View — Reuses TaskList
 *
 * Two virtual sections: Backlog and Active List, separated by a line divider.
 * Current task gets 'current' variant + action buttons via actionsSlot.
 * Dismissed tasks get 'flagged' variant + warning icon via leadingSlot.
 */

/** Spring presets for consistent feel */
const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 500, damping: 32 };
const SPRING_GENTLE = { type: 'spring' as const, stiffness: 350, damping: 28 };
const SPRING_BOUNCY = { type: 'spring' as const, stiffness: 400, damping: 25 };

/** Phase badge crossfade with scale bounce */
const BADGE_TRANSITION = {
  opacity: { duration: 0.2 },
  y: SPRING_GENTLE,
  scale: SPRING_BOUNCY,
};

/** Pulse keyframes for pass-complete badges (applied on a nested element) */
const PASS_COMPLETE_PULSE = {
  animate: {
    scale: [1, 1.03, 1],
  },
  transition: {
    scale: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const, type: 'tween' as const },
  },
};

const AF4_SECTIONS: Section[] = [
  { id: '__af4_backlog__', projectId: null, name: 'Backlog', order: 0, collapsed: false, createdAt: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z' },
  { id: '__af4_active__', projectId: null, name: 'Active List', order: 1, collapsed: false, createdAt: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z' },
];

export function AF4View({
  tasks,
  systemState,
  dispatch,
  onTaskClick,
  onTaskComplete,
}: TMSViewProps<AF4State>) {
  const af4Dispatch = dispatch as (action: AF4Action) => void;
  const [expandedDismissedId, setExpandedDismissedId] = useState<string | null>(null);

  const current = getCurrentTask(tasks, systemState);
  const fullPassDone = isFullPassComplete(systemState);
  const passCompleteNoWork = fullPassDone && !systemState.lastPassHadWork;
  const passCompleteWithWork = fullPassDone && systemState.lastPassHadWork;

  useEffect(() => {
    if (!fullPassDone) return;
    const timer = setTimeout(() => {
      af4Dispatch({ type: 'ADVANCE_AFTER_FULL_PASS', tasks });
    }, 1500);
    return () => clearTimeout(timer);
  }, [fullPassDone, tasks, af4Dispatch]);

  const dismissedSet = new Set(systemState.dismissedTaskIds);

  const lineDrawnAtRef = useRef(new Date());
  const lineTimestamp = format(lineDrawnAtRef.current, 'MMM d, h:mmaaa');

  const handleMadeProgress = () => af4Dispatch({ type: 'MADE_PROGRESS' });
  const handleDone = () => {
    if (!current) return;
    onTaskComplete(current.id, true);
    af4Dispatch({ type: 'MARK_DONE' });
  };
  const handleSkip = () => af4Dispatch({ type: 'SKIP_TASK' });
  const handleDismiss = () => af4Dispatch({ type: 'FLAG_DISMISSED' });
  const handleResolve = (taskId: string, resolution: 'abandon' | 're-enter' | 'defer') => {
    af4Dispatch({ type: 'RESOLVE_DISMISSED', taskId, resolution });
    setExpandedDismissedId(null);
  };
  const handlePromote = () => af4Dispatch({ type: 'PROMOTE_ACTIVE_LIST' });

  // Build task list with virtual section assignments
  const assignedTasks = useMemo(() => {
    const backlog = systemState.backlogTaskIds
      .map((id, i) => {
        const t = tasks.find(x => x.id === id);
        return t ? { ...t, sectionId: '__af4_backlog__', order: i } : null;
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    const active = systemState.activeListTaskIds
      .map((id, i) => {
        const t = tasks.find(x => x.id === id);
        return t ? { ...t, sectionId: '__af4_active__', order: i } : null;
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    return [...backlog, ...active];
  }, [tasks, systemState.backlogTaskIds, systemState.activeListTaskIds]);

  const backlogEmpty = systemState.backlogTaskIds.length === 0 ||
    !systemState.backlogTaskIds.some(id => tasks.find(t => t.id === id));
  const activeEmpty = systemState.activeListTaskIds.length === 0 ||
    !systemState.activeListTaskIds.some(id => tasks.find(t => t.id === id));

  return (
    <div className="p-4 space-y-4">
      {/* ── Phase indicator ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2" aria-live="polite">
        <AnimatePresence mode="wait">
          {passCompleteNoWork ? (
            <motion.div
              key="pass-no-work"
              initial={{ opacity: 0, y: -6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={BADGE_TRANSITION}
            >
              <motion.div
                animate={PASS_COMPLETE_PULSE.animate}
                transition={PASS_COMPLETE_PULSE.transition}
                className="motion-safe:transform-gpu"
              >
                <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/25" aria-live="assertive">
                  Backlog pass complete — switching to Active List
                </Badge>
              </motion.div>
            </motion.div>
          ) : passCompleteWithWork ? (
            <motion.div
              key="pass-with-work"
              initial={{ opacity: 0, y: -6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={BADGE_TRANSITION}
            >
              <motion.div
                animate={PASS_COMPLETE_PULSE.animate}
                transition={PASS_COMPLETE_PULSE.transition}
                className="motion-safe:transform-gpu"
              >
                <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/25" aria-live="assertive">
                  Backlog pass complete — restarting from top
                </Badge>
              </motion.div>
            </motion.div>
          ) : systemState.phase === 'backlog' ? (
            <motion.div
              key="backlog"
              initial={{ opacity: 0, y: -6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={BADGE_TRANSITION}
            >
              <Badge className="bg-accent-brand/15 text-accent-brand border border-accent-brand/25">
                Working Backlog
              </Badge>
            </motion.div>
          ) : (
            <motion.div
              key="active-pass"
              initial={{ opacity: 0, y: -6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={BADGE_TRANSITION}
            >
              <Badge className="bg-muted text-muted-foreground">
                Active List Pass
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Backlog empty state ──────────────────────────────────────── */}
      <AnimatePresence>
        {backlogEmpty && (
          <motion.div
            key="backlog-empty"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={SPRING_BOUNCY}
          >
            <TMSEmptyState
              icon={<CheckCircle2 className="h-6 w-6" />}
              title="Backlog complete!"
              description="Ready to draw a new line."
              action={{ label: 'Draw new line →', onClick: handlePromote }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Task table ───────────────────────────────────────────────── */}
      {assignedTasks.length > 0 && (
        <TaskList
          tasks={assignedTasks}
          sections={AF4_SECTIONS}
          onTaskClick={onTaskClick}
          onTaskComplete={(taskId, completed) => onTaskComplete(taskId, completed)}
          onAddTask={() => {}}
          tmsTaskProps={(task) => {
            const isDismissed = dismissedSet.has(task.id);
            const isCurrent = current?.id === task.id;

            if (isDismissed) {
              return {
                tmsVariant: 'flagged' as const,
                leadingSlot: (
                  <motion.div
                    whileHover={{ scale: 1.15, rotate: 8 }}
                    whileTap={{ scale: 0.9 }}
                    transition={SPRING_SNAPPY}
                    className="motion-safe:transform-gpu"
                  >
                    <AlertTriangle
                      className="h-4 w-4 text-amber-500 shrink-0 cursor-pointer hover:text-amber-400 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedDismissedId(prev => (prev === task.id ? null : task.id));
                      }}
                      aria-label="Resolve flagged task"
                      aria-expanded={expandedDismissedId === task.id}
                    />
                  </motion.div>
                ),
                actionsSlot: expandedDismissedId === task.id ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{
                      height: { ...SPRING_GENTLE, stiffness: 300 },
                      opacity: { duration: 0.2 },
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="bg-amber-500/[0.03] rounded-md p-2">
                      <p className="text-xs text-amber-500 mb-2">
                        This task keeps getting skipped. What do you want to do?
                      </p>
                      <div className="flex gap-2">
                        {([
                          { label: 'Abandon', resolution: 'abandon' as const, className: 'border-destructive text-destructive hover:bg-destructive/10', variant: 'outline' as const },
                          { label: 'Re-enter on Active List', resolution: 're-enter' as const, className: 'border-accent-brand text-accent-brand hover:bg-accent-brand/10', variant: 'outline' as const },
                          { label: 'Defer back to Backlog', resolution: 'defer' as const, className: '', variant: 'ghost' as const },
                        ]).map((btn, i) => (
                          <motion.div
                            key={btn.resolution}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.06 * (i + 1), ...SPRING_SNAPPY }}
                          >
                            <Button
                              variant={btn.variant}
                              size="sm"
                              className={btn.className}
                              onClick={() => handleResolve(task.id, btn.resolution)}
                            >
                              {btn.label}
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : undefined,
              };
            }

            if (isCurrent) {
              return {
                tmsVariant: 'current' as const,
                actionsSlot: (
                  <div className="flex items-center gap-2">
                    {/* Hero action — "Made Progress" gets the most satisfying press */}
                    <motion.div
                      whileHover={{ scale: 1.04, y: -1 }}
                      whileTap={{ scale: 0.93, y: 1 }}
                      transition={SPRING_BOUNCY}
                      className="flex-1 motion-safe:transform-gpu"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-accent-brand text-accent-brand hover:bg-accent-brand/10 flex-1 w-full text-xs"
                        onClick={(e) => { e.stopPropagation(); handleMadeProgress(); }}
                      >
                        ↺ Made progress
                      </Button>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING_SNAPPY}
                      className="motion-safe:transform-gpu"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground text-xs"
                        onClick={(e) => { e.stopPropagation(); handleDone(); }}
                      >
                        ✓ Done
                      </Button>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING_SNAPPY}
                      className="motion-safe:transform-gpu"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground text-xs"
                        onClick={(e) => { e.stopPropagation(); handleSkip(); }}
                      >
                        → Skip
                      </Button>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 6 }}
                      whileTap={{ scale: 0.88 }}
                      transition={SPRING_SNAPPY}
                      className="motion-safe:transform-gpu"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Flag as stubborn"
                        className="text-amber-500 hover:text-amber-400 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                      >
                        ⚠ Flag
                      </Button>
                    </motion.div>
                  </div>
                ),
              };
            }

            return {};
          }}
        />
      )}

      {/* ── Line divider ─────────────────────────────────────────────── */}
      <div className="relative my-2" role="separator" aria-label={`Line drawn ${lineTimestamp}`}>
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t-2 border-border" />
        </div>
        <div className="relative flex justify-center">
          <span
            className={[
              'bg-background px-3 text-[11px] text-muted-foreground font-medium tracking-wide',
              'motion-safe:animate-tms-shimmer',
              'motion-safe:bg-[length:200%_100%]',
              'motion-safe:bg-gradient-to-r motion-safe:from-muted-foreground/60 motion-safe:via-muted-foreground motion-safe:to-muted-foreground/60',
              'motion-safe:bg-clip-text motion-safe:text-transparent',
            ].join(' ')}
          >
            — Line drawn {lineTimestamp} —
          </span>
        </div>
      </div>

      {/* ── Active List empty state ──────────────────────────────────── */}
      <AnimatePresence>
        {activeEmpty && (
          <motion.div
            key="active-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TMSEmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="Active List is empty"
              description="New tasks will appear here."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
