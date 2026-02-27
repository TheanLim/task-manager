'use client';

import { Button } from '@/components/ui/button';

interface FVPSessionButtonProps {
  hasDottedTasks: boolean;
  onBegin: () => void;
}

/**
 * FVPSessionButton — "Begin FVP session" or "Continue FVP session" button.
 *
 * Rendered as the actionsSlot of the first task row when FVP is active
 * but no preselection scan is in progress.
 *
 * Feature: tms-inline-interactions, Property 11
 */
export function FVPSessionButton({ hasDottedTasks, onBegin }: FVPSessionButtonProps) {
  const label = hasDottedTasks ? 'Continue FVP session' : 'Begin FVP session';
  return (
    <div className="border-t border-border mt-2 pt-2">
      <Button
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={(e) => { e.stopPropagation(); onBegin(); }}
        aria-label={label}
      >
        {label}
      </Button>
    </div>
  );
}
