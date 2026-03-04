'use client';

import { AlertTriangle } from 'lucide-react';

interface SectionMismatchWarningProps {
  /** Number of projects where the section was not found */
  skippedCount: number;
  /** Name of the section that was not found */
  sectionName: string;
  /** Called when the user clicks "View in execution log →" */
  onViewLog?: () => void;
  /** Simplified inline variant (no link) for use inside project tab cards */
  inline?: boolean;
}

/**
 * Amber warning strip shown on a RuleCard when a global rule has been skipped
 * in one or more projects because the referenced section was not found.
 */
export function SectionMismatchWarning({
  skippedCount,
  sectionName,
  onViewLog,
  inline = false,
}: SectionMismatchWarningProps) {
  if (inline) {
    return (
      <button
        type="button"
        onClick={onViewLog}
        className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1 hover:underline underline-offset-2 text-left"
      >
        <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
        &ldquo;{sectionName}&rdquo; section not found — rule skipped
      </button>
    );
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="border-t border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2"
    >
      <div className="flex items-start gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Skipped in {skippedCount} project{skippedCount !== 1 ? 's' : ''} — &ldquo;{sectionName}&rdquo; section not found
          </p>
          {onViewLog && (
            <button
              type="button"
              onClick={onViewLog}
              className="text-xs text-amber-600 dark:text-amber-400 underline-offset-2 hover:underline cursor-pointer"
            >
              View in execution log →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
