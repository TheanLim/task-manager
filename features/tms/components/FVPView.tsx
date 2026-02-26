'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ListTodo, PartyPopper, Sparkles, Circle, RotateCcw, Eye, Play } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskList } from '@/features/tasks/components/TaskList';
import { TMSEmptyState } from './shared/TMSEmptyState';
import { cn } from '@/lib/utils';
import type { TMSViewProps } from '../handlers';
import type { FVPState, FVPAction } from '../handlers/fvp';
import type { Section } from '@/types';
import {
  getCurrentTask,
  getCurrentX,
  getScanCandidate,
  getOrderedTasks,
  isPreselectionComplete,
} from '../handlers/fvp';

/**
 * FVP (Final Version Perfected) View — Reuses TaskList
 *
 * Special visual effects via tmsTaskProps:
 * - Dotted tasks get 'dotted' variant + pulsing dot leadingSlot
 * - Current task gets 'current' variant
 * - Preselection panel and Do Now hero are rendered above the table
 */

const VIRTUAL_SECTION: Section = {
  id: '__fvp_all__',
  projectId: null,
  name: 'Tasks',
  order: 0,
  collapsed: false,
  createdAt: '2000-01-01T00:00:00.000Z',
  updatedAt: '2000-01-01T00:00:00.000Z',
};

/** Spring presets for consistent feel */
const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 500, damping: 32 };
const SPRING_GENTLE = { type: 'spring' as const, stiffness: 350, damping: 28 };
const SPRING_BOUNCY = { type: 'spring' as const, stiffness: 450, damping: 25 };

/** Crossfade transition for state A↔B↔C switches */
const CROSSFADE = {
  initial: { opacity: 0, scale: 0.96, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.96, filter: 'blur(4px)' },
};

/** Progress ring SVG for the Do Now checkbox area */
function PulseRing() {
  return (
    <motion.span
      className="absolute inset-[-4px] rounded-md border-2 border-accent-brand/40"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0, 0.6, 0],
        scale: [0.8, 1.15, 1.2],
      }}
      transition={{
        duration: 2.5,
        repeat: Infinity,
        ease: 'easeOut',
        type: 'tween',
      }}
      aria-hidden="true"
    />
  );
}

export function FVPView({
  tasks,
  systemState,
  dispatch,
  onTaskClick,
  onTaskComplete,
}: TMSViewProps<FVPState>) {
  const fvpDispatch = dispatch as (action: FVPAction) => void;

  const incompleteTasks = tasks.filter(t => !t.completed);
  const dottedSet = new Set(systemState.dottedTasks);

  const currentTask = getCurrentTask(tasks, systemState);
  const currentX = getCurrentX(tasks, systemState);
  const scanCandidate = getScanCandidate(tasks, systemState);
  const preselectionDone = isPreselectionComplete(tasks, systemState);
  const orderedTasks = getOrderedTasks(tasks, systemState);

  const undottedTasks = incompleteTasks.filter(t => !dottedSet.has(t.id));

  const isStateA = systemState.dottedTasks.length === 0;
  const isStateB = !preselectionDone && scanCandidate !== null;
  const isStateC = preselectionDone && systemState.dottedTasks.length > 0;

  // View mode: when true, sorting is enabled and FVP execution UI is hidden.
  const [viewMode, setViewMode] = useState(false);
  // Auto-exit view mode when dots appear (user started preselection)
  const hasActiveDots = systemState.dottedTasks.length > 0;
  const effectiveViewMode = viewMode && !hasActiveDots;
  const isExecuting = hasActiveDots && !effectiveViewMode;

  const handleEnterViewMode = () => {
    fvpDispatch({ type: 'RESET_FVP' });
    setViewMode(true);
  };
  const handleExitViewMode = () => {
    setViewMode(false);
    fvpDispatch({ type: 'START_PRESELECTION', tasks });
  };

  // Track when preselection just completed for staggered dot animation
  const prevPreselectionDone = useRef(preselectionDone);
  const [justCompleted, setJustCompleted] = useState(false);
  useEffect(() => {
    if (preselectionDone && !prevPreselectionDone.current) {
      setJustCompleted(true);
      const timer = setTimeout(() => setJustCompleted(false), 1500);
      return () => clearTimeout(timer);
    }
    prevPreselectionDone.current = preselectionDone;
  }, [preselectionDone]);

  const handleStartPreselection = () => fvpDispatch({ type: 'START_PRESELECTION', tasks });
  const handleDot = () => { if (scanCandidate) fvpDispatch({ type: 'DOT_TASK', task: scanCandidate, tasks }); };
  const handleSkip = () => { if (scanCandidate) fvpDispatch({ type: 'SKIP_CANDIDATE', task: scanCandidate, tasks }); };
  const handleCompleteCurrent = () => {
    if (!currentTask) return;
    onTaskComplete(currentTask.id, true);
    fvpDispatch({ type: 'COMPLETE_CURRENT', tasks });
  };
  const handleReenterCurrent = () => { if (currentTask) fvpDispatch({ type: 'REENTER_CURRENT', tasks }); };
  const handleReset = () => fvpDispatch({ type: 'RESET_FVP' });

  // Assign ordered tasks to virtual section
  const sectionedTasks = useMemo(() =>
    orderedTasks.map((t, i) => ({ ...t, sectionId: VIRTUAL_SECTION.id, order: i })),
    [orderedTasks],
  );

  if (incompleteTasks.length === 0) {
    return (
      <TMSEmptyState
        icon={<ListTodo className="h-6 w-6" />}
        title="No tasks yet"
        description="Add some tasks to get started with FVP."
      />
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* ── Mode toggle ────────────────────────────────────────────── */}
      {incompleteTasks.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {isExecuting ? 'Sorting locked during preselection' : effectiveViewMode ? 'Sorting enabled — dots cleared' : ''}
          </span>
          {isExecuting ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={handleEnterViewMode}
            >
              <Eye className="h-3.5 w-3.5" />
              View Mode
            </Button>
          ) : (
            <motion.div
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.97, y: 1 }}
              transition={SPRING_SNAPPY}
            >
              <Button
                className={cn(
                  'gap-2 text-xs',
                  effectiveViewMode
                    ? 'bg-accent-brand hover:bg-accent-brand-hover text-white'
                    : 'bg-accent-brand hover:bg-accent-brand-hover text-white',
                )}
                size="sm"
                onClick={effectiveViewMode ? handleExitViewMode : handleStartPreselection}
              >
                {effectiveViewMode ? (
                  <Play className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {effectiveViewMode ? 'Resume Executing' : 'Start Executing'}
              </Button>
            </motion.div>
          )}
        </div>
      )}

      {/* ── Do Now hero (State C) ────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isStateC && currentTask && isExecuting && (
          <motion.div
            key="do-now"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96, filter: 'blur(4px)' }}
            transition={SPRING_GENTLE}
          >
            {/* Floating animation wrapper */}
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
                type: 'tween',
              }}
              className="motion-reduce:transform-none"
            >
              <div className="tms-fvp-do-now rounded-xl p-4 bg-accent-brand/[0.06] border border-accent-brand/25 motion-safe:animate-tms-glow-breathe relative">
                {/* Elevated glow layer */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-accent-brand/[0.03] to-transparent pointer-events-none" />

                <p className="text-[11px] font-bold tracking-[0.1em] text-accent-brand uppercase mb-3 flex items-center gap-1.5 relative">
                  <motion.span
                    className="w-2 h-2 rounded-full bg-accent-brand motion-safe:animate-tms-dot-pulse"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', type: 'tween' }}
                  />
                  Do Now
                </p>

                <div className="flex items-start gap-3 relative">
                  {/* Checkbox with pulse ring */}
                  <span className="relative mt-0.5 shrink-0">
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => handleCompleteCurrent()}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <PulseRing />
                  </span>
                  <motion.span
                    className="flex-1 text-sm font-medium text-foreground cursor-pointer hover:text-accent-brand transition-colors"
                    onClick={() => onTaskClick(currentTask.id)}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, ...SPRING_SNAPPY }}
                  >
                    {currentTask.description}
                  </motion.span>
                </div>

                <motion.div
                  className="border-t border-accent-brand/15 mt-3 pt-3 flex items-center gap-2 relative"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, ...SPRING_SNAPPY }}
                >
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }} transition={SPRING_BOUNCY}>
                    <Button
                      size="sm"
                      className="bg-accent-brand hover:bg-accent-brand-hover text-white"
                      onClick={(e) => { e.stopPropagation(); handleCompleteCurrent(); }}
                    >
                      ✓ Done
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }} transition={SPRING_BOUNCY}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-accent-brand/30 text-accent-brand hover:bg-accent-brand/10"
                      onClick={(e) => { e.stopPropagation(); handleReenterCurrent(); }}
                    >
                      ↺ Re-enter
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }} transition={SPRING_BOUNCY}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground text-xs gap-1"
                      onClick={(e) => { e.stopPropagation(); handleStartPreselection(); }}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restart
                    </Button>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── State B: Preselection panel ──────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isStateB && currentX && scanCandidate && isExecuting && (
          <motion.div
            key={scanCandidate.id}
            initial={{ opacity: 0, x: 60, rotateY: 8, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1 }}
            exit={{ opacity: 0, x: -60, rotateY: -8, scale: 0.97 }}
            transition={SPRING_SNAPPY}
            className="rounded-xl border border-accent-brand/25 bg-card p-4 shadow-elevation-raised"
            style={{ perspective: 800 }}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="text-sm text-muted-foreground mb-3 leading-relaxed">
              <span>Do you want to do </span>
              <motion.button
                className="text-foreground font-semibold underline decoration-accent-brand/40 underline-offset-2 hover:text-accent-brand transition-colors cursor-pointer"
                onClick={() => onTaskClick(scanCandidate.id)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, ...SPRING_SNAPPY }}
              >
                {scanCandidate.description}
              </motion.button>

              <span className="inline-flex items-center mx-1.5 align-middle">
                <span className="inline-block w-1 h-1 rotate-45 bg-accent-brand/50 mx-0.5" />
                <span className="text-[10px] font-bold tracking-wider text-accent-brand/60 uppercase mx-0.5">more than</span>
                <span className="inline-block w-1 h-1 rotate-45 bg-accent-brand/50 mx-0.5" />
              </span>

              <motion.button
                className="text-foreground font-semibold underline decoration-accent-brand/40 underline-offset-2 hover:text-accent-brand transition-colors cursor-pointer"
                onClick={() => onTaskClick(currentX.id)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, ...SPRING_SNAPPY }}
              >
                {currentX.description}
              </motion.button>
              <span>?</span>
            </div>

            <div className="flex gap-2">
              <motion.div
                className="flex-1"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95, y: 1 }}
                transition={SPRING_BOUNCY}
              >
                <Button
                  className="w-full bg-accent-brand hover:bg-accent-brand-hover text-white gap-1.5"
                  onClick={handleDot}
                >
                  <Circle className="h-3 w-3 fill-current" />
                  Yes — dot it
                </Button>
              </motion.div>
              <motion.div
                className="flex-1"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95, y: 1 }}
                transition={SPRING_BOUNCY}
              >
                <Button variant="outline" className="w-full" onClick={handleSkip}>
                  No — skip
                </Button>
              </motion.div>
            </div>
            <div className="flex justify-end mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground text-xs gap-1"
                onClick={handleStartPreselection}
              >
                <RotateCcw className="h-3 w-3" />
                Restart
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── State C: All done ────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isStateC && undottedTasks.length === 0 && !currentTask && isExecuting && (
          <motion.div
            key="all-done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={SPRING_GENTLE}
          >
            <TMSEmptyState
              icon={<PartyPopper className="h-6 w-6" />}
              title="All done!"
              description="Add more tasks or reset to start fresh."
              action={{ label: 'Reset FVP', onClick: handleReset }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Unified task table via TaskList ───────────────────────────── */}
      {sectionedTasks.length > 0 && (
        <TaskList
          tasks={sectionedTasks}
          sections={[VIRTUAL_SECTION]}
          onTaskClick={onTaskClick}
          onTaskComplete={(taskId, completed) => onTaskComplete(taskId, completed)}
          onAddTask={() => {}}
          disableSort={isExecuting}
          tmsTaskProps={(task) => {
            const isDotted = dottedSet.has(task.id);
            const isCurrentTask = currentTask?.id === task.id;
            const dottedIndex = isDotted ? systemState.dottedTasks.indexOf(task.id) : -1;
            return {
              tmsVariant: isCurrentTask ? 'current' as const : isDotted ? 'dotted' as const : undefined,
              leadingSlot: isDotted ? (
                <span
                  className={cn(
                    'w-2.5 h-2.5 rounded-full bg-accent-brand shrink-0',
                    'shadow-[0_0_6px_hsl(var(--accent-brand)/0.3)]',
                    isCurrentTask && 'motion-safe:animate-tms-dot-pulse',
                    justCompleted && 'motion-safe:animate-tms-dot-pulse',
                  )}
                  style={
                    justCompleted && dottedIndex >= 0
                      ? { animationDelay: `${dottedIndex * 120}ms` }
                      : undefined
                  }
                  aria-hidden="true"
                />
              ) : undefined,
            };
          }}
        />
      )}
    </div>
  );
}
