'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';

interface AF4ActionRowProps {
  task: Task;
  onMadeProgress: () => void;
  onDone: () => void;
  onSkip: () => void;
  onFlag: () => void;
}

/**
 * AF4ActionRow — the four-button action row rendered below the candidate task.
 *
 * Always visible (not hover-dependent) per Req 1.1.
 * Anchored to the task row via border-t per Req 1.9.
 * Animates in on first render per Req 1.10.
 *
 * Feature: tms-inline-interactions, Properties 3 and 4
 */
export function AF4ActionRow({ task, onMadeProgress, onDone, onSkip, onFlag }: AF4ActionRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-t border-border mt-2 pt-2',
        'motion-safe:animate-in motion-safe:fade-in-0 duration-150',
      )}
    >
      {/* Primary action — flex-1 to be visually dominant */}
      <Button
        className="flex-1 h-8 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
        size="sm"
        onClick={(e) => { e.stopPropagation(); onMadeProgress(); }}
        aria-label={`Made Progress on: ${task.description}`}
      >
        ↺ Made Progress
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 py-1.5"
        onClick={(e) => { e.stopPropagation(); onDone(); }}
        aria-label={`Done: ${task.description}`}
      >
        ✓ Done
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 py-1.5"
        onClick={(e) => { e.stopPropagation(); onSkip(); }}
        aria-label={`Skip: ${task.description}`}
      >
        → Skip
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 py-1.5 text-amber-400 hover:text-amber-300"
        onClick={(e) => { e.stopPropagation(); onFlag(); }}
        aria-label={`Flag: ${task.description}`}
      >
        ⚠ Flag
      </Button>
    </div>
  );
}
