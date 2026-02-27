'use client';

import { Button } from '@/components/ui/button';
import type { Task } from '@/types';

interface FVPComparisonPanelProps {
  candidate: Task;
  referenceTask: Task;
  onYes: () => void;
  onNo: () => void;
}

/**
 * FVPComparisonPanel — inline pairwise comparison question for FVP preselection.
 *
 * Renders "Is [candidate] more important than [referenceTask]?" with Yes/No buttons.
 * Both buttons are equal width (flex-1) per Req 3.3.
 * Has role="region", aria-label, and aria-live per Req 9.5 and 9.6.
 *
 * Feature: tms-inline-interactions, Properties 9 and 10
 */
export function FVPComparisonPanel({ candidate, referenceTask, onYes, onNo }: FVPComparisonPanelProps) {
  return (
    <div
      role="region"
      aria-label="FVP comparison"
      aria-live="polite"
      className="space-y-2 py-1"
    >
      <p className="text-xs text-muted-foreground leading-relaxed">
        Is{' '}
        <span className="font-medium text-foreground">{candidate.description}</span>
        {' '}more important than{' '}
        <span className="font-medium text-foreground">{referenceTask.description}</span>
        ?
      </p>

      <div className="flex gap-2">
        <Button
          className="flex-1 h-8 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onYes(); }}
          aria-label={`Yes, prioritise ${candidate.description} over ${referenceTask.description}`}
        >
          Yes, prioritise this
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8 py-1.5"
          onClick={(e) => { e.stopPropagation(); onNo(); }}
          aria-label={`No, skip ${candidate.description}`}
        >
          No, skip it
        </Button>
      </div>
    </div>
  );
}
